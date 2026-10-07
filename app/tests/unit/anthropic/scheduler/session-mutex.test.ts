/**
 * The per-session mutex (spec section 14): one upstream session never runs two runs at once. A
 * continued turn waits for its session's previous run to exit, up to 10 s once that run's turn is
 * over, then SIGKILLs it and proceeds; it is re-planned only then, against the sessions as that run
 * left them. Concurrent requests on one session queue FIFO, so a duplicate becomes a replayed turn.
 */
import { Lease } from '../../../../src/anthropic/scheduler';
import { TurnPlan } from '../../../../src/anthropic/request';
import { initFrame } from '../../../mocks/anthropic/turn-frames';
import {
  continuedPlan, fakeRun, FakeRun, freshPlan, hasSettled, quietLog, schedulerOn
} from '../../../mocks/anthropic/scheduler-fixtures';
import { createFakeClock, FakeClock } from '../../../mocks/shared/fake-clock';

const SESSION = 'session-1';

describe('the scheduler: one run per upstream session', () => {
  let clock: FakeClock;

  beforeEach(() => {
    clock = createFakeClock();
  });

  /** A run on SESSION whose turn has started: admitted fresh, started, its init seen. */
  async function runOnSession(scheduler: ReturnType<typeof schedulerOn>, requestId = 'req_1'): Promise<{ lease: Lease; run: FakeRun }> {
    const lease = await scheduler.admit({ requestId, plan: freshPlan(), replan: freshPlan });
    const run = fakeRun(`run-${requestId}`, SESSION);
    lease.started(run);
    lease.onFrame(initFrame({ session_id: SESSION }));
    return { lease, run };
  }

  const continued = (scheduler: ReturnType<typeof schedulerOn>, requestId: string, replan: () => TurnPlan) =>
    scheduler.admit({ requestId, plan: continuedPlan(SESSION), replan });

  it("waits for the previous run's exit, then re-plans against what that run left", async () => {
    const scheduler = schedulerOn(clock);
    const previous = await runOnSession(scheduler);
    previous.lease.release();
    const replan = jest.fn(() => continuedPlan(SESSION));

    const admitted = continued(scheduler, 'req_2', replan);
    expect(await hasSettled(admitted)).toBe(false);
    expect(replan).not.toHaveBeenCalled();
    previous.run.end();

    const lease = await admitted;
    expect(replan).toHaveBeenCalledTimes(1);
    expect(lease.plan.continuation).toEqual(expect.objectContaining({ resume: SESSION }));
    expect(previous.run.kills).toBe(0);
  });

  it('becomes a replayed turn when the re-plan no longer continues the session (its run ended in an error)', async () => {
    const scheduler = schedulerOn(clock);
    const previous = await runOnSession(scheduler);
    previous.lease.release();

    const admitted = continued(scheduler, 'req_2', freshPlan);
    previous.run.end();

    expect((await admitted).plan).toBe(freshPlan());
  });

  it('SIGKILLs a previous run that has not exited 10 s after its turn ended, and proceeds once it has', async () => {
    const log = quietLog();
    const scheduler = schedulerOn(clock, {}, log);
    const previous = await runOnSession(scheduler);
    previous.lease.release();

    const admitted = continued(scheduler, 'req_2', () => continuedPlan(SESSION));
    await hasSettled(admitted);
    clock.advance(9_999);
    expect(previous.run.kills).toBe(0);
    clock.advance(1);
    await hasSettled(admitted);

    expect(previous.run.kills).toBe(1);
    expect(log.warn).toHaveBeenCalledWith("The session's previous run did not exit in time: killed",
      expect.objectContaining({ requestId: 'req_2', sessionId: SESSION, runId: 'run-req_1', waitMs: 10_000 }));
    expect(await hasSettled(admitted)).toBe(false);
    previous.run.end();
    await expect(admitted).resolves.toBeDefined();
  });

  it("never times out on a previous turn still in flight (or parked): it waits for that turn's end", async () => {
    const scheduler = schedulerOn(clock);
    const previous = await runOnSession(scheduler);

    const admitted = continued(scheduler, 'req_2', freshPlan);
    await hasSettled(admitted);
    clock.advance(600_000);
    await hasSettled(admitted);
    expect(previous.run.kills).toBe(0);

    previous.lease.release();
    await hasSettled(admitted);
    clock.advance(10_000);
    await hasSettled(admitted);
    expect(previous.run.kills).toBe(1);
  });

  it('queues concurrent turns on one session FIFO, each re-planned after the one before it has gone', async () => {
    const scheduler = schedulerOn(clock);
    const previous = await runOnSession(scheduler);
    const order: string[] = [];
    const second = continued(scheduler, 'req_2', () => { order.push('req_2'); return continuedPlan(SESSION); });
    const third = continued(scheduler, 'req_3', () => { order.push('req_3'); return freshPlan(); });
    expect(scheduler.counts().queued).toEqual({ [SESSION]: 2 });

    previous.lease.release();
    previous.run.end();
    const secondLease = await second;
    expect(order).toEqual(['req_2']);
    expect(await hasSettled(third)).toBe(false);
    const secondRun = fakeRun('run-req_2', SESSION);
    secondLease.started(secondRun);
    secondLease.release();
    secondRun.end();

    expect((await third).plan).toBe(freshPlan());
    expect(order).toEqual(['req_2', 'req_3']);
    expect(scheduler.counts().queued).toEqual({});
  });

  it('lets a turn on another session, or on none, through at once', async () => {
    const scheduler = schedulerOn(clock);
    await runOnSession(scheduler);

    await expect(scheduler.admit({ requestId: 'req_2', plan: freshPlan(), replan: freshPlan })).resolves.toBeDefined();
    const other = continuedPlan('session-2');
    await expect(scheduler.admit({ requestId: 'req_3', plan: other, replan: () => other })).resolves.toBeDefined();
  });

  it('lets a continued turn through at once when the previous run has already exited', async () => {
    const scheduler = schedulerOn(clock);
    const previous = await runOnSession(scheduler);
    previous.lease.release();
    previous.run.end();
    await previous.run.ended;

    await expect(continued(scheduler, 'req_2', () => continuedPlan(SESSION))).resolves.toBeDefined();
  });

  it('holds a slot while the turn waits', async () => {
    const scheduler = schedulerOn(clock, { maxRuns: 2 });
    await runOnSession(scheduler);

    void continued(scheduler, 'req_2', freshPlan);
    const refused = scheduler.admit({ requestId: 'req_3', plan: freshPlan(), replan: freshPlan });

    await expect(refused).rejects.toEqual(expect.objectContaining({ status: 529 }));
  });
});
