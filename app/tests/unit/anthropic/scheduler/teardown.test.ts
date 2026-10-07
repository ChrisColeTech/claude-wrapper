/**
 * The teardown ladder (spec section 14), for every early end of a run (disconnect, cut, failure,
 * park TTL, shutdown): `control_request interrupt`, up to 5 s for upstream's `result`, stdin
 * closed, up to 2 s for the exit, SIGTERM, up to 5 s, SIGKILL. A run whose `result` is in has its
 * stdin closed at once and nothing left to interrupt. Driven on a fake clock with a scripted upstream.
 */
import { createTeardown } from '../../../../src/anthropic/scheduler';
import { createRun } from '../../../../src/upstream/runner/run';
import { createFakeClock } from '../../../mocks/shared/fake-clock';
import { NO_TIMERS, settle } from '../../../mocks/upstream/run-helpers';
import { createScriptedProcess } from '../../../mocks/upstream/scripted-process';

function startScripted() {
  const clock = createFakeClock();
  const proc = createScriptedProcess();
  const run = createRun(proc.start, { timers: NO_TIMERS, clock });
  const interrupts = () => proc.writtenLines().filter(line => (line as { type: string }).type === 'control_request');
  return { clock, proc, run, interrupts };
}

describe('the teardown ladder', () => {
  it('interrupts, waits 5 s for the result, closes stdin, then SIGTERM after 2 s and SIGKILL after 5 s more', async () => {
    const { clock, proc, run, interrupts } = startScripted();
    const teardown = createTeardown(run, { clock });

    teardown.descend('the client went away');
    await settle();
    expect(interrupts()).toEqual([
      { type: 'control_request', request_id: expect.any(String), request: { subtype: 'interrupt' } }
    ]);

    clock.advance(4_999);
    expect(proc.inputEnded()).toBe(false);
    clock.advance(1);
    expect(proc.inputEnded()).toBe(true);
    clock.advance(2_000);
    expect(proc.kills).toEqual(['SIGTERM']);
    clock.advance(5_000);
    expect(proc.kills).toEqual(['SIGTERM', 'SIGKILL']);
    proc.exit(null, 'SIGKILL');
    await expect(run.exited).resolves.toEqual({ code: null, signal: 'SIGKILL', stderr: '' });
  });

  it('closes stdin as soon as the result is in, without waiting out the 5 s', async () => {
    const { clock, proc, run } = startScripted();
    const teardown = createTeardown(run, { clock });

    teardown.descend('cut');
    clock.advance(1_000);
    teardown.resultIn();

    expect(proc.inputEnded()).toBe(true);
    proc.exit(1);
    await run.exited;
    expect(clock.pendingCount()).toBe(0);
  });

  it('only closes stdin of a run whose result is already in: nothing left to interrupt', async () => {
    const { clock, proc, run, interrupts } = startScripted();
    const teardown = createTeardown(run, { clock });

    teardown.resultIn();
    teardown.descend('the client went away');
    await settle();

    expect(proc.inputEnded()).toBe(true);
    expect(interrupts()).toEqual([]);
  });

  it('descends once however often it is asked', async () => {
    const { clock, run, interrupts } = startScripted();
    const teardown = createTeardown(run, { clock });

    teardown.descend('cut');
    teardown.descend('the client went away');
    await settle();

    expect(interrupts()).toHaveLength(1);
  });

  it("interrupts through the run's own interrupt when it has one (a bridged run rejects its waiting calls after)", async () => {
    const { clock, run, interrupts } = startScripted();
    const interrupt = jest.fn(async () => undefined);
    const teardown = createTeardown(run, { clock, interrupt });

    teardown.descend('park TTL expired');
    await settle();

    expect(interrupt).toHaveBeenCalledWith('park TTL expired');
    expect(interrupts()).toEqual([]);
  });

  it('leaves a run that exits on the interrupt alone', async () => {
    const { clock, proc, run } = startScripted();
    const teardown = createTeardown(run, { clock });

    teardown.descend('cut');
    proc.exit(1);
    await run.exited;
    await settle();
    clock.advance(60_000);

    expect(proc.inputEnded()).toBe(false);
    expect(proc.kills).toEqual([]);
  });
});
