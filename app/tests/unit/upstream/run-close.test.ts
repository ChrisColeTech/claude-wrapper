/**
 * Ending a run: `close()` ends stdin and escalates to SIGTERM and SIGKILL when upstream does
 * not exit; `exited` carries the exit code, the signal and the tail of stderr.
 */
import { createRun } from '../../../src/upstream/runner/run';
import { createScriptedProcess } from '../../mocks/upstream/scripted-process';
import { createFakeClock } from '../../mocks/shared/fake-clock';
import { failureOf, NO_TIMERS } from '../../mocks/upstream/run-helpers';

function startScripted() {
  const clock = createFakeClock();
  const proc = createScriptedProcess();
  const run = createRun(proc.start, { timers: NO_TIMERS, clock });
  return { clock, proc, run };
}

describe('run close', () => {
  it('ends stdin and sends no signal when upstream exits within the grace period', async () => {
    const { clock, proc, run } = startScripted();

    const closed = run.close();
    expect(proc.inputEnded()).toBe(true);
    clock.advance(1_999);
    proc.exit(0);

    await expect(closed).resolves.toEqual({ code: 0, signal: null, stderr: '' });
    clock.advance(60_000);
    expect(proc.kills).toEqual([]);
  });

  it('sends SIGTERM 2 s after closing and SIGKILL 5 s after that', async () => {
    const { clock, proc, run } = startScripted();

    void run.close();
    void run.close();
    clock.advance(1_999);
    expect(proc.kills).toEqual([]);
    clock.advance(1);
    expect(proc.kills).toEqual(['SIGTERM']);
    clock.advance(4_999);
    expect(proc.kills).toEqual(['SIGTERM']);
    clock.advance(1);
    expect(proc.kills).toEqual(['SIGTERM', 'SIGKILL']);

    proc.exit(null, 'SIGKILL');
    await expect(run.exited).resolves.toEqual({ code: null, signal: 'SIGKILL', stderr: '' });
    expect(clock.pendingCount()).toBe(0);
  });

  it('reports the last 64 KB of stderr on exit', async () => {
    const { proc, run } = startScripted();

    proc.stderr('Error: --json-schema is not valid JSON\n');
    proc.stderr(Buffer.alloc(64 * 1024, 'x'));
    proc.stderr('tail line\n');
    proc.exit(1);

    const { stderr } = await run.exited;
    expect(Buffer.byteLength(stderr)).toBe(64 * 1024);
    expect(stderr.endsWith('xxxxtail line\n')).toBe(true);
    expect(stderr).not.toContain('json-schema');
  });

  it('fails the run when upstream cannot be started', async () => {
    const { proc, run } = startScripted();

    proc.fail(new Error('spawn claude ENOENT'));
    proc.exit(null);

    await expect(failureOf(run)).resolves.toEqual({ kind: 'spawn_failed', message: 'spawn claude ENOENT' });
    await expect(run.exited).resolves.toEqual({
      code: null, signal: null, stderr: '', failure: { kind: 'spawn_failed', message: 'spawn claude ENOENT' }
    });
  });

  it('ends the frames after the last frame when upstream exits', async () => {
    const { proc, run } = startScripted();

    proc.frames({ type: 'system', subtype: 'init', session_id: 's1' });
    proc.exit(143);

    await expect(failureOf(run)).resolves.toBeUndefined();
    await expect(run.exited).resolves.toEqual({ code: 143, signal: null, stderr: '' });
  });
});
