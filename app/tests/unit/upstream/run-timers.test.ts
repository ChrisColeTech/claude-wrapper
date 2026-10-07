/**
 * The runner enforces the three run timers on the injected clock: startup (start to the first
 * `system/init`), stall (any frame resets it; idle after a `result` until the next send) and
 * active lifetime (park time excluded). A firing ends the run with a typed reason.
 */
import { createRun } from '../../../src/upstream/runner/run';
import { RunTimers } from '../../../src/upstream/runner/types';
import { createScriptedProcess } from '../../mocks/upstream/scripted-process';
import { createFakeClock } from '../../mocks/shared/fake-clock';
import { failureOf, settle, NO_TIMERS } from '../../mocks/upstream/run-helpers';

const INIT = { type: 'system', subtype: 'init', session_id: 's1' };
const PROGRESS = { type: 'tool_progress', tool_use_id: 't1', heartbeat: true };
const RESULT = { type: 'result', subtype: 'success', is_error: false };
const USER = { role: 'user' as const, content: 'hi' };

function startWith(timers: Partial<RunTimers>) {
  const clock = createFakeClock();
  const proc = createScriptedProcess();
  const run = createRun(proc.start, { timers: { ...NO_TIMERS, ...timers }, clock });
  const failure = failureOf(run);
  return { clock, proc, run, failure };
}

async function firedAfter(setup: ReturnType<typeof startWith>, ms: number): Promise<boolean> {
  setup.clock.advance(ms);
  await settle();
  return setup.proc.inputEnded();
}

describe('run timers', () => {
  it('fails the run when system/init does not arrive within the startup timer', async () => {
    const setup = startWith({ startup: 20_000 });

    expect(await firedAfter(setup, 19_999)).toBe(false);
    expect(await firedAfter(setup, 1)).toBe(true);

    setup.proc.exit(1);
    await expect(setup.failure).resolves.toEqual({ kind: 'timeout', timer: 'startup' });
    await expect(setup.run.exited).resolves.toEqual(expect.objectContaining({
      failure: { kind: 'timeout', timer: 'startup' }
    }));
  });

  it('clears the startup timer on system/init', async () => {
    const setup = startWith({ startup: 20_000 });

    setup.clock.advance(1_000);
    setup.proc.frames(INIT);

    expect(await firedAfter(setup, 60_000)).toBe(false);
  });

  it('resets the stall timer on every frame, heartbeats included, and fires after silence', async () => {
    const setup = startWith({ stall: 90_000 });

    for (let i = 0; i < 5; i++) {
      setup.clock.advance(30_000);
      setup.proc.frames(PROGRESS);
    }
    expect(await firedAfter(setup, 89_999)).toBe(false);
    expect(await firedAfter(setup, 1)).toBe(true);

    setup.proc.exit(1);
    await expect(setup.failure).resolves.toEqual({ kind: 'timeout', timer: 'stall' });
  });

  it('pauses the stall timer while idle after a result, and arms it again on send', async () => {
    const setup = startWith({ stall: 90_000 });

    setup.proc.frames(INIT, RESULT);
    expect(await firedAfter(setup, 600_000)).toBe(false);

    setup.proc.frames({ type: 'system', subtype: 'status', status: null });
    expect(await firedAfter(setup, 600_000)).toBe(false);

    await setup.run.send(USER);
    expect(await firedAfter(setup, 90_000)).toBe(true);
  });

  it('fails the run at the end of its active lifetime whatever frames arrive', async () => {
    const setup = startWith({ lifetime: 1_800_000 });

    setup.clock.advance(1_799_999);
    setup.proc.frames(INIT);
    expect(await firedAfter(setup, 0)).toBe(false);
    expect(await firedAfter(setup, 1)).toBe(true);

    setup.proc.exit(1);
    await expect(setup.failure).resolves.toEqual({ kind: 'timeout', timer: 'lifetime' });
  });

  it('excludes park time from the active lifetime', async () => {
    const setup = startWith({ lifetime: 1_800_000 });

    setup.clock.advance(1_000_000);
    const unpark = setup.run.park();
    expect(await firedAfter(setup, 3_600_000)).toBe(false);

    unpark();
    unpark();
    expect(await firedAfter(setup, 799_999)).toBe(false);
    expect(await firedAfter(setup, 1)).toBe(true);
  });

  it('keeps the lifetime paused until every overlapping park has ended', async () => {
    const setup = startWith({ lifetime: 1_000 });

    const unparkFirst = setup.run.park();
    const unparkSecond = setup.run.park();
    unparkFirst();
    expect(await firedAfter(setup, 5_000)).toBe(false);

    unparkSecond();
    expect(await firedAfter(setup, 1_000)).toBe(true);
  });

  it('leaves no timer behind once upstream has exited', async () => {
    const setup = startWith({ startup: 20_000, stall: 90_000, lifetime: 1_800_000 });

    setup.proc.frames(INIT, RESULT);
    void setup.run.close();
    setup.proc.exit(0);
    await setup.run.exited;

    expect(setup.clock.pendingCount()).toBe(0);
    await expect(setup.failure).resolves.toBeUndefined();
  });
});
