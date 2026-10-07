/**
 * The scheduler's last resort (spec section 14): `kill()` sends SIGKILL at once, without the
 * close ladder's graces, and settles with the exit. A run that has already exited is not signalled.
 */
import { createRun } from '../../../src/upstream/runner/run';
import { createScriptedProcess } from '../../mocks/upstream/scripted-process';
import { createFakeClock } from '../../mocks/shared/fake-clock';
import { NO_TIMERS } from '../../mocks/upstream/run-helpers';

function startScripted() {
  const clock = createFakeClock();
  const proc = createScriptedProcess();
  const run = createRun(proc.start, { timers: NO_TIMERS, clock });
  return { clock, proc, run };
}

describe('run kill', () => {
  it('sends SIGKILL at once and settles with the exit', async () => {
    const { proc, run } = startScripted();

    const killed = run.kill();
    expect(proc.kills).toEqual(['SIGKILL']);
    proc.exit(null, 'SIGKILL');

    await expect(killed).resolves.toEqual({ code: null, signal: 'SIGKILL', stderr: '' });
  });

  it('cuts a close short: SIGKILL before the SIGTERM grace has run out', async () => {
    const { clock, proc, run } = startScripted();

    void run.close();
    clock.advance(1_000);
    void run.kill();
    proc.exit(null, 'SIGKILL');
    await run.exited;
    clock.advance(60_000);

    expect(proc.kills).toEqual(['SIGKILL']);
  });

  it('does not signal a run that has exited', async () => {
    const { proc, run } = startScripted();

    proc.exit(0);
    await expect(run.kill()).resolves.toEqual({ code: 0, signal: null, stderr: '' });

    expect(proc.kills).toEqual([]);
  });
});
