/**
 * Wrapper shutdown (spec section 14): new requests get 529 `overloaded_error`; turns in flight are
 * failed with the `api_error` "server shutting down" (the SSE `error` after commit); parked runs
 * are interrupted and their calls rejected; every run descends the teardown ladder in parallel;
 * the drain is bounded at 15 s, then SIGKILL.
 */
import { createScheduler, createTeardown, ScheduledRun } from '../../../../src/anthropic/scheduler';
import { ANTHROPIC_SETTING_DEFAULTS } from '../../../../src/config/anthropic-settings';
import { createReplayRunner } from '../../../../src/upstream/runner';
import {
  continuedPlan, fakeRun, freshPlan, hasSettled, heldRun, parkedPlan, quietLog, schedulerOn
} from '../../../mocks/anthropic/scheduler-fixtures';
import { memorySessions } from '../../../mocks/anthropic/sessions';
import { initFrame } from '../../../mocks/anthropic/turn-frames';
import { createFakeClock, FakeClock } from '../../../mocks/shared/fake-clock';
import { loadRecording } from '../../../mocks/upstream/recordings';
import { consume, NO_TIMERS, settle } from '../../../mocks/upstream/run-helpers';

const admission = (requestId: string, plan = freshPlan()) => ({ requestId, plan, replan: () => plan });

describe('the scheduler: shutdown', () => {
  let clock: FakeClock;

  beforeEach(() => {
    clock = createFakeClock();
  });

  it('refuses every new request with 529 overloaded_error, a resuming turn too', async () => {
    const scheduler = schedulerOn(clock);

    await scheduler.shutdown();

    await expect(scheduler.admit(admission('req_1'))).rejects.toEqual(
      expect.objectContaining({ status: 529, type: 'overloaded_error', message: 'Overloaded: the server is shutting down' }));
    await expect(scheduler.admit(admission('req_2', parkedPlan(heldRun(['toolu_1']))))).rejects.toEqual(
      expect.objectContaining({ status: 529 }));
  });

  it('refuses the turns still waiting on a session with 529', async () => {
    const scheduler = schedulerOn(clock);
    const lease = await scheduler.admit(admission('req_1'));
    const run = fakeRun('run-1', 'session-1');
    lease.started(run);
    lease.onFrame(initFrame({ session_id: 'session-1' }));
    const waiting = scheduler.admit(admission('req_2', continuedPlan('session-1')));

    const drained = scheduler.shutdown();

    await expect(waiting).rejects.toEqual(expect.objectContaining({ status: 529, type: 'overloaded_error' }));
    run.end();
    await drained;
    expect(scheduler.counts()).toEqual(expect.objectContaining({ active: 0, queued: {} }));
  });

  it('fails every turn in flight with the api_error "server shutting down" and sends every run down the ladder', async () => {
    const scheduler = schedulerOn(clock);
    const runs = [fakeRun('run-1'), fakeRun('run-2')];
    for (const run of runs) (await scheduler.admit(admission(run.runId))).started(run);

    const drained = scheduler.shutdown();
    runs.forEach(run => run.end());
    await drained;

    for (const run of runs) {
      expect(run.failed).toEqual([expect.objectContaining({ status: 500, type: 'api_error', message: 'server shutting down' })]);
      expect(run.stopped).toEqual(['server shutting down']);
      expect(run.kills).toBe(0);
    }
  });

  it('abandons every parked run: interrupted, its waiting calls rejected', async () => {
    const scheduler = schedulerOn(clock);
    const lease = await scheduler.admit(admission('req_1'));
    const run = fakeRun();
    lease.started(run);
    const parked = heldRun(['toolu_1']);
    scheduler.registerParked(parked);

    const drained = scheduler.shutdown();
    run.end();
    await drained;

    expect(parked.abandoned).toEqual(['server shutting down']);
    expect(scheduler.counts().parked).toBe(0);
  });

  it('abandons at once a run that parks while the wrapper shuts down', async () => {
    const scheduler = schedulerOn(clock);
    await scheduler.shutdown();
    const parked = heldRun(['toolu_1']);

    scheduler.registerParked(parked);

    expect(parked.abandoned).toEqual(['server shutting down']);
  });

  it('SIGKILLs the runs still alive at the 15 s deadline, then waits for their exit', async () => {
    const log = quietLog();
    const scheduler = schedulerOn(clock, {}, log);
    const quick = fakeRun('run-quick');
    const stuck = fakeRun('run-stuck', 'session-9');
    (await scheduler.admit(admission('req_quick'))).started(quick);
    (await scheduler.admit(admission('req_stuck'))).started(stuck);

    const drained = scheduler.shutdown();
    quick.end();
    await hasSettled(drained);
    clock.advance(14_999);
    expect(stuck.kills).toBe(0);
    clock.advance(1);
    await hasSettled(drained);

    expect(stuck.kills).toBe(1);
    expect(quick.kills).toBe(0);
    expect(log.warn).toHaveBeenCalledWith('Shutdown drain ran out: run killed',
      { requestId: 'req_stuck', runId: 'run-stuck', sessionId: 'session-9' });
    expect(await hasSettled(drained)).toBe(false);
    stuck.end();
    await drained;
  });

  it('stops a run that starts after the shutdown began (admitted before it)', async () => {
    const scheduler = schedulerOn(clock);
    const lease = await scheduler.admit(admission('req_1'));
    void scheduler.shutdown();
    const run = fakeRun();

    lease.started(run);

    expect(run.failed).toHaveLength(1);
    expect(run.stopped).toEqual(['server shutting down']);
  });

  it('waits for a run that started during the drain as for the others', async () => {
    const scheduler = schedulerOn(clock);
    const early = fakeRun('run-early');
    (await scheduler.admit(admission('req_early'))).started(early);
    const late = await scheduler.admit(admission('req_late'));

    const drained = scheduler.shutdown();
    const lateRun = fakeRun('run-late');
    late.started(lateRun);
    early.end();

    expect(await hasSettled(drained)).toBe(false);
    lateRun.end();
    await drained;
    expect(lateRun.stopped).toEqual(['server shutting down']);
  });

  it('drains a replayed run in flight down the ladder: interrupt, stdin closed 5 s later, then its exit', async () => {
    const runner = createReplayRunner([loadRecording('cli-probes/c-partial.jsonl')], { clock });
    const scheduler = createScheduler({
      settings: ANTHROPIC_SETTING_DEFAULTS, clock, registry: memorySessions(clock).sessions.parked, logger: quietLog()
    });
    const run = runner.startRun({ flags: ['-p'], env: {}, cwd: '/tmp/replay', timers: NO_TIMERS });
    consume(run);
    await run.send({ role: 'user', content: [{ type: 'text', text: 'hi' }] });
    const teardown = createTeardown(run, { clock });
    const scheduled: ScheduledRun = {
      runId: 'run-1', sessionId: undefined, ended: run.exited.then(() => undefined),
      fail: () => undefined, stop: reason => teardown.descend(reason), kill: () => void run.kill()
    };
    (await scheduler.admit(admission('req_1'))).started(scheduled);

    const drained = scheduler.shutdown();
    await settle();
    expect(runner.started[0]?.input).toContainEqual(expect.objectContaining({
      type: 'control_request', request: { subtype: 'interrupt' }
    }));
    clock.advance(4_999);
    await settle();
    expect(await hasSettled(run.exited)).toBe(false);
    for (let step = 0; step < 3; step += 1) {
      clock.advance(1);
      await settle();
    }

    await drained;
    await expect(run.exited).resolves.toEqual(expect.objectContaining({ code: 0, signal: null }));
  });
});
