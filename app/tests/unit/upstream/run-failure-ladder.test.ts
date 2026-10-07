/**
 * A run the runner ends itself (a timer fires, a line is too long) goes down the teardown ladder
 * from its top (spec section 14): `control_request interrupt`, up to 5 s for upstream's `result`,
 * then stdin closed, 2 s, SIGTERM, 5 s, SIGKILL. `exited` always settles. A spawn failure has
 * nothing to interrupt.
 */
import { createRun } from '../../../src/upstream/runner/run';
import { RunTimers } from '../../../src/upstream/runner/types';
import { createFakeClock } from '../../mocks/shared/fake-clock';
import { failureOf, NO_TIMERS, settle } from '../../mocks/upstream/run-helpers';
import { createScriptedProcess } from '../../mocks/upstream/scripted-process';

const MAX_LINE_BYTES = 16 * 1024 * 1024;
const INIT = { type: 'system', subtype: 'init', session_id: 's1' };
const RESULT = { type: 'result', subtype: 'error_during_execution', is_error: true };

function startWith(timers: Partial<RunTimers>) {
  const clock = createFakeClock();
  const proc = createScriptedProcess();
  const run = createRun(proc.start, { timers: { ...NO_TIMERS, ...timers }, clock });
  const failure = failureOf(run);
  const interrupts = () => proc.writtenLines()
    .filter(line => (line as { request?: { subtype?: string } }).request?.subtype === 'interrupt');
  return { clock, proc, run, failure, interrupts };
}

describe('the runner ends a run down the teardown ladder', () => {
  it('interrupts a run whose timer fired, and ends its input once upstream has written its result', async () => {
    const setup = startWith({ stall: 90_000 });
    setup.proc.frames(INIT);

    setup.clock.advance(90_000);
    await settle();
    expect(setup.interrupts()).toHaveLength(1);
    expect(setup.proc.inputEnded()).toBe(false);

    setup.proc.frames({ type: 'control_response', response: { subtype: 'success', request_id: 'x' } }, RESULT);
    await settle();
    expect(setup.proc.inputEnded()).toBe(true);

    setup.proc.exit(0);
    await expect(setup.failure).resolves.toEqual({ kind: 'timeout', timer: 'stall' });
    await expect(setup.run.exited).resolves.toEqual(expect.objectContaining({ failure: { kind: 'timeout', timer: 'stall' } }));
  });

  it('ends the input 5 s after the interrupt when no result comes, then SIGTERM and SIGKILL; exited settles', async () => {
    const setup = startWith({ startup: 20_000 });

    setup.clock.advance(20_000);
    await settle();
    expect(setup.interrupts()).toHaveLength(1);
    setup.clock.advance(4_999);
    expect(setup.proc.inputEnded()).toBe(false);
    setup.clock.advance(1);
    expect(setup.proc.inputEnded()).toBe(true);
    setup.clock.advance(2_000 + 5_000);
    expect(setup.proc.kills).toEqual(['SIGTERM', 'SIGKILL']);

    setup.proc.exit(null, 'SIGKILL');
    await expect(setup.run.exited).resolves.toEqual(expect.objectContaining({
      signal: 'SIGKILL', failure: { kind: 'timeout', timer: 'startup' }
    }));
    expect(setup.clock.pendingCount()).toBe(0);
  });

  it('interrupts a run whose line was too long, and ends its input after the wait', async () => {
    const setup = startWith({});
    setup.proc.frames(INIT);

    setup.proc.stdout(Buffer.alloc(MAX_LINE_BYTES + 1, 'a'));
    await settle();
    expect(setup.interrupts()).toHaveLength(1);
    expect(setup.proc.inputEnded()).toBe(false);
    setup.clock.advance(5_000);
    expect(setup.proc.inputEnded()).toBe(true);

    setup.proc.exit(0);
    await expect(setup.failure).resolves.toEqual({ kind: 'line_too_long', limitBytes: MAX_LINE_BYTES });
  });

  it('ends a run that exits during the wait without closing it', async () => {
    const setup = startWith({ lifetime: 1_000 });

    setup.clock.advance(1_000);
    await settle();
    setup.proc.exit(1);
    await setup.run.exited;
    setup.clock.advance(60_000);

    expect(setup.proc.inputEnded()).toBe(false);
    expect(setup.proc.kills).toEqual([]);
    expect(setup.clock.pendingCount()).toBe(0);
  });

  it('closes a run that could not be started at once: there is nothing to interrupt', async () => {
    const setup = startWith({});

    setup.proc.fail(new Error('spawn claude ENOENT'));

    expect(setup.proc.inputEnded()).toBe(true);
    expect(setup.interrupts()).toEqual([]);
    setup.proc.exit(null);
    await expect(setup.failure).resolves.toEqual({ kind: 'spawn_failed', message: 'spawn claude ENOENT' });
  });
});
