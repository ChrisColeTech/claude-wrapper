/**
 * The run's private directory (spec sections 10 and 14): the spawn runner creates it owner-only
 * with its `0600` files before spawning, and removes it once the run has exited, however the run
 * ended. A later ticket adds a file with `withRunFile`.
 */
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PassThrough, Writable } from 'stream';
import { ChildProcess } from 'child_process';
import { createSpawnRunner, RunSpec, withRunFile } from '../../../src/upstream/runner';
import { createFakeClock } from '../../mocks/shared/fake-clock';
import { failureOf, NO_TIMERS } from '../../mocks/upstream/run-helpers';

const modeOf = (target: string): number => fs.statSync(target).mode & 0o777;

let runs: string;

beforeEach(() => {
  runs = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'run-directory-')), 'runs');
});

afterEach(() => {
  fs.rmSync(path.dirname(runs), { recursive: true, force: true });
});

function spec(files: Record<string, string> = {}, name = 'run-1'): RunSpec {
  return {
    flags: ['-p'],
    env: {},
    cwd: path.dirname(runs),
    timers: NO_TIMERS,
    runDir: { path: path.join(runs, name), files }
  };
}

function fakeChild(started = true) {
  const child = new EventEmitter() as ChildProcess & EventEmitter;
  const stdin = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
  const pid = started ? 4242 : undefined;
  Object.assign(child, { stdin, stdout: new PassThrough(), stderr: new PassThrough(), pid, kill: jest.fn() });
  return child;
}

describe('spawn runner: the run directory', () => {
  it('exists owner-only with each file 0600 when the CLI is spawned, and is gone once the run has exited', async () => {
    const child = fakeChild();
    const seen: { mode: number; files: Record<string, { mode: number; text: string }> }[] = [];
    const runSpec = spec({ 'mcp-config.json': '{"mcpServers":{}}', 'settings.json': '{"hooks":{}}' });
    const directory = runSpec.runDir?.path ?? '';
    const spawn = jest.fn(() => {
      const files = Object.fromEntries(fs.readdirSync(directory).map(name => {
        const file = path.join(directory, name);
        return [name, { mode: modeOf(file), text: fs.readFileSync(file, 'utf8') }];
      }));
      seen.push({ mode: modeOf(directory), files });
      return child;
    });
    const run = createSpawnRunner({ command: 'claude', spawn, clock: createFakeClock() }).startRun(runSpec);

    expect(seen).toEqual([{
      mode: 0o700,
      files: {
        'mcp-config.json': { mode: 0o600, text: '{"mcpServers":{}}' },
        'settings.json': { mode: 0o600, text: '{"hooks":{}}' }
      }
    }]);

    child.emit('close', 0, null);
    await run.exited;
    expect(fs.existsSync(directory)).toBe(false);
  });

  it('creates an empty directory for a run with no files', () => {
    const runSpec = spec();
    createSpawnRunner({ command: 'claude', spawn: () => fakeChild(), clock: createFakeClock() }).startRun(runSpec);

    expect(fs.readdirSync(runSpec.runDir?.path ?? '')).toEqual([]);
  });

  it('fails the run without spawning when the directory already exists, and leaves that directory alone', async () => {
    const runSpec = spec();
    fs.mkdirSync(runSpec.runDir?.path ?? '', { recursive: true });
    fs.writeFileSync(path.join(runSpec.runDir?.path ?? '', 'someone-else.txt'), 'theirs');
    const spawn = jest.fn(() => fakeChild());

    const run = createSpawnRunner({ command: 'claude', spawn, clock: createFakeClock() }).startRun(runSpec);

    expect(await failureOf(run)).toEqual({ kind: 'spawn_failed', message: expect.stringContaining('EEXIST') });
    await expect(run.exited).resolves.toEqual(expect.objectContaining({ code: null, signal: null }));
    expect(spawn).not.toHaveBeenCalled();
    expect(fs.readdirSync(runSpec.runDir?.path ?? '')).toEqual(['someone-else.txt']);
  });

  it.each(['../escape.json', 'nested/file.json', '.', '..', '', '.hidden'])(
    'fails the run on a file name that is not one plain path segment, writing nothing: %p',
    async (name) => {
      const runSpec = spec({ 'ok.json': '{}', [name]: '{}' });
      const spawn = jest.fn(() => fakeChild());

      const run = createSpawnRunner({ command: 'claude', spawn, clock: createFakeClock() }).startRun(runSpec);

      expect(await failureOf(run)).toEqual({ kind: 'spawn_failed', message: expect.stringContaining('run file name') });
      expect(spawn).not.toHaveBeenCalled();
      expect(fs.existsSync(runSpec.runDir?.path ?? '')).toBe(false);
      expect(fs.existsSync(path.join(runs, 'escape.json'))).toBe(false);
    }
  );

  it('removes the directory when the binary cannot be started', async () => {
    const child = fakeChild(false);
    const runSpec = spec({ 'mcp-config.json': '{}' });
    const run = createSpawnRunner({ command: 'claude', spawn: () => child, clock: createFakeClock() }).startRun(runSpec);

    child.emit('error', Object.assign(new Error('spawn claude ENOENT'), { code: 'ENOENT' }));

    expect(await failureOf(run)).toEqual({ kind: 'spawn_failed', message: 'spawn claude ENOENT' });
    await run.exited;
    expect(fs.existsSync(runSpec.runDir?.path ?? '')).toBe(false);
  });

  it('removes the directory and fails the run when spawn throws, as it does on a NUL byte in an argument', async () => {
    const runSpec = spec();
    const spawn = jest.fn(() => { throw new TypeError("The argument 'args[1]' must be a string without null bytes"); });

    const run = createSpawnRunner({ command: 'claude', spawn, clock: createFakeClock() }).startRun(runSpec);

    expect(await failureOf(run)).toEqual({ kind: 'spawn_failed', message: expect.stringContaining('null bytes') });
    await expect(run.exited).resolves.toEqual(expect.objectContaining({ code: null, signal: null }));
    expect(fs.existsSync(runSpec.runDir?.path ?? '')).toBe(false);
  });

  it('spawns as before when the spec has no run directory', () => {
    const { runDir: _runDir, ...noDirectory } = spec();
    const spawn = jest.fn(() => fakeChild());

    createSpawnRunner({ command: 'claude', spawn, clock: createFakeClock() }).startRun(noDirectory);

    expect(spawn).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(runs)).toBe(false);
  });
});

describe('withRunFile', () => {
  it('returns a spec with the file added to its run directory, leaving the given spec as it was', () => {
    const planned = spec({ 'settings.json': '{}' });

    const withConfig = withRunFile(planned, 'mcp-config.json', '{"mcpServers":{}}');

    expect(withConfig).toEqual({
      ...planned,
      runDir: { path: path.join(runs, 'run-1'), files: { 'settings.json': '{}', 'mcp-config.json': '{"mcpServers":{}}' } }
    });
    expect(planned.runDir?.files).toEqual({ 'settings.json': '{}' });
  });

  it('refuses a spec without a run directory and a name already taken', () => {
    const { runDir: _runDir, ...noDirectory } = spec();

    expect(() => withRunFile(noDirectory, 'mcp-config.json', '{}')).toThrow('the run spec has no run directory');
    expect(() => withRunFile(spec({ 'mcp-config.json': '{}' }), 'mcp-config.json', '{}')).toThrow(
      'the run directory already has mcp-config.json'
    );
  });
});
