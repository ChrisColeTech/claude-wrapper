/**
 * The spawn runner starts the CLI with no shell, exactly the spec's argument list, working
 * directory and environment, and writes to stdin with drain awareness.
 */
import { EventEmitter } from 'events';
import { PassThrough, Writable } from 'stream';
import { ChildProcess } from 'child_process';
import { createSpawnRunner } from '../../../src/upstream/runner';
import { RunSpec } from '../../../src/upstream/runner/types';
import { createFakeClock } from '../../mocks/shared/fake-clock';
import { NO_TIMERS, settle } from '../../mocks/upstream/run-helpers';

const SPEC: RunSpec = {
  flags: ['-p', '--system-prompt', 'say "hi"; echo $HOME', '--tools', ''],
  env: { HOME: '/home/wrapper', CLAUDE_CODE_MAX_OUTPUT_TOKENS: '64' },
  cwd: '/var/lib/wrapper/cwd',
  timers: NO_TIMERS
};

/** A child whose stdin accepts one chunk at a time, held until `release()`. */
function fakeChild() {
  const held: Array<() => void> = [];
  const child = new EventEmitter() as ChildProcess & EventEmitter;
  const stdin = new Writable({
    highWaterMark: 8,
    write(_chunk, _encoding, callback) { held.push(() => callback()); }
  });
  Object.assign(child, { stdin, stdout: new PassThrough(), stderr: new PassThrough(), pid: 4242, kill: jest.fn() });
  const release = (): void => { held.splice(0).forEach(done => done()); };
  return { child, release };
}

describe('spawn runner', () => {
  it('spawns the command with the spec’s flags, cwd and environment, never through a shell', () => {
    const { child } = fakeChild();
    const spawn = jest.fn().mockReturnValue(child);
    const runner = createSpawnRunner({ command: '/opt/claude/bin/claude', spawn, clock: createFakeClock() });

    runner.startRun(SPEC);

    expect(spawn).toHaveBeenCalledTimes(1);
    const [command, args, options] = spawn.mock.calls[0];
    expect(command).toBe('/opt/claude/bin/claude');
    expect(args).toEqual(SPEC.flags);
    expect(options).toEqual(expect.objectContaining({
      cwd: SPEC.cwd, env: SPEC.env, shell: false, stdio: ['pipe', 'pipe', 'pipe']
    }));
  });

  it('resolves a send only once stdin has drained', async () => {
    const { child, release } = fakeChild();
    const runner = createSpawnRunner({ command: 'claude', spawn: () => child, clock: createFakeClock() });
    const run = runner.startRun(SPEC);

    let sent = false;
    const sending = run.send({ role: 'user', content: 'a message longer than the pipe buffer' }).then(() => { sent = true; });
    await settle();
    expect(sent).toBe(false);

    release();
    await sending;
    expect(sent).toBe(true);
  });

  it('reports exit code and signal from the child, and kills it with the signal asked for', async () => {
    const { child } = fakeChild();
    const clock = createFakeClock();
    const run = createSpawnRunner({ command: 'claude', spawn: () => child, clock }).startRun(SPEC);

    void run.close();
    clock.advance(2_000);
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');

    child.emit('exit', null, 'SIGTERM');
    child.emit('close', null, 'SIGTERM');
    await expect(run.exited).resolves.toEqual({ code: null, signal: 'SIGTERM', stderr: '' });
  });
});
