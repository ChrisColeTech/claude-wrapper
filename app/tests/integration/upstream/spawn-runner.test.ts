/**
 * The spawn runner against real child processes: a stand-in CLI (`tests/mocks/upstream/fake-cli.js`,
 * run by node) instead of Claude Code, so nothing here spends quota.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createSpawnRunner, Run, RunSpec } from '../../../src/upstream/runner';
import { createFakeClock } from '../../mocks/shared/fake-clock';
import { collectFrames, failureOf, framesUntil, NO_TIMERS, settle } from '../../mocks/upstream/run-helpers';

const FAKE_CLI = path.resolve(__dirname, '..', '..', 'mocks', 'upstream', 'fake-cli.js');
const FLAGS = ['-p', '--system-prompt', 'say "hi"; echo $HOME && exit 3', '--tools', '', '--model', 'fake'];
const USER = { role: 'user' as const, content: [{ type: 'text', text: 'Reply with pong' }] };

let cwd: string;
const started: Run[] = [];

function spec(env: Record<string, string> = {}): RunSpec {
  return { flags: [FAKE_CLI, ...FLAGS], env: { FAKE_MARKER: 'yes', ...env }, cwd, timers: NO_TIMERS };
}

function start(env: Record<string, string> = {}, clock = createFakeClock()): Run {
  const run = createSpawnRunner({ command: process.execPath, clock }).startRun(spec(env));
  started.push(run);
  return run;
}

beforeEach(() => {
  cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'spawn-runner-'));
});

afterEach(async () => {
  for (const run of started.splice(0)) {
    void run.close();
  }
  fs.rmSync(cwd, { recursive: true, force: true });
});

describe('spawn runner with a real child process', () => {
  it('runs the binary with exactly the spec’s flags, cwd and environment', async () => {
    const run = start();

    await run.send(USER);
    const [init] = await framesUntil(run, frame => frame.type === 'result');

    expect(init).toEqual(expect.objectContaining({
      type: 'system', subtype: 'init', argv: FLAGS, cwd: fs.realpathSync(cwd), envNames: ['FAKE_MARKER']
    }));
  });

  it('interrupts, ends stdin, and reports the exit and stderr', async () => {
    const run = start();

    await run.send(USER);
    await framesUntil(run, frame => frame.type === 'result');
    await expect(run.interrupt()).resolves.toEqual(expect.objectContaining({ subtype: 'success' }));
    void run.close();

    expect((await collectFrames(run)).map(frame => frame.type)).toEqual(['control_response']);
    await expect(run.exited).resolves.toEqual({ code: 0, signal: null, stderr: 'fake cli: stdin ended\n' });
  });

  it('passes a large message through stdin intact', async () => {
    const run = start();
    const message = { role: 'user' as const, content: [{ type: 'text', text: 'x'.repeat(8 * 1024 * 1024) }] };

    await run.send(message);
    const [init] = await framesUntil(run, frame => frame.type === 'result');

    const line = JSON.stringify({ type: 'user', message, parent_tool_use_id: null, session_id: '' });
    expect(init).toEqual(expect.objectContaining({ receivedBytes: Buffer.byteLength(line) }));
  });

  it('reports a non-zero exit code', async () => {
    const run = start({ FAKE_CLI_EXIT: '1' });

    void run.close();

    await expect(run.exited).resolves.toEqual(expect.objectContaining({ code: 1, signal: null }));
  });

  it('escalates to SIGTERM and then SIGKILL when the CLI will not stop', async () => {
    const clock = createFakeClock();
    const run = start({ FAKE_CLI_MODE: 'trap-term' }, clock);
    await run.send(USER);
    await framesUntil(run, frame => frame.type === 'result');

    void run.close();
    clock.advance(2_000);
    await new Promise(resolve => setTimeout(resolve, 200));
    let exited = false;
    void run.exited.then(() => { exited = true; });
    await settle();
    expect(exited).toBe(false);

    clock.advance(5_000);
    await expect(run.exited).resolves.toEqual(expect.objectContaining({ code: null, signal: 'SIGKILL' }));
  });

  it('fails the run when the binary cannot be started', async () => {
    const run = createSpawnRunner({ command: path.join(cwd, 'no-such-claude') }).startRun(spec());

    const failure = await failureOf(run);

    expect(failure).toEqual({ kind: 'spawn_failed', message: expect.stringContaining('ENOENT') });
    await expect(run.exited).resolves.toEqual(expect.objectContaining({ code: null, signal: null, failure }));
  });
});
