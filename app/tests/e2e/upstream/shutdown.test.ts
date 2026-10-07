/**
 * E2E (real CLI, behind UPSTREAM_E2E=1): the wrapper's shutdown (spec section 14) with one parked
 * run (a client-tool turn waiting for its result) and one streaming run (a long answer in flight)
 * leaves no child process. The stream gets the SSE error "server shutting down", a request
 * arriving afterwards gets 529, every run's directory is gone, and every process the runs started
 * (the CLI and anything under it) has exited within the drain.
 *
 *   UPSTREAM_E2E=1 npm --prefix app run test:e2e -- tests/e2e/upstream/shutdown.test.ts
 *
 * Optional: `UPSTREAM_E2E_MODEL`, `CLAUDE_COMMAND`. Linux or macOS (`ps` lists the process tree).
 */
import type Anthropic from '@anthropic-ai/sdk';
import { ChildProcess, execFileSync, spawn as nodeSpawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createSpawnRunner, Runner } from '../../../src/upstream/runner';
import { openStateDirectory, StateDirectory } from '../../../src/upstream/state-directory';
import type { SurfaceHarness } from '../../mocks/anthropic/surface-harness';
import { describeUpstream, E2E_MODEL, productionSurface, removeStateRoot } from './harness';

const DRAIN_MS = 15_000;
const WEATHER: Anthropic.Tool = {
  name: 'get_weather',
  description: 'Get the current weather for a city. Returns a JSON object.',
  input_schema: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] }
};
const PARKING = {
  model: E2E_MODEL, max_tokens: 1024, tools: [WEATHER],
  messages: [{ role: 'user' as const, content: 'Use the get_weather tool for Paris. Do not answer before you have its result.' }]
};
const STREAMING = {
  model: E2E_MODEL, max_tokens: 4096,
  messages: [{ role: 'user' as const, content: 'Write a long, detailed essay on the history of the tangerine.' }]
};

/** Every live process with its parent, from `ps`. */
function processTable(): Map<number, number> {
  const lines = execFileSync('ps', ['-A', '-o', 'pid=,ppid='], { encoding: 'utf8' }).trim().split('\n');
  return new Map(lines.map(line => line.trim().split(/\s+/).map(Number) as [number, number]));
}

/** `roots` and every process under them now. */
function processTree(roots: number[]): number[] {
  const table = [...processTable()];
  const tree = new Set(roots);
  for (let grown = true; grown;) {
    grown = false;
    for (const [pid, ppid] of table) {
      if (tree.has(ppid) && !tree.has(pid)) { tree.add(pid); grown = true; }
    }
  }
  return [...tree];
}

const alive = (pid: number): boolean => processTable().has(pid);

/** The production spawn runner, noting each child it starts. */
function notingRunner(children: ChildProcess[]): Runner {
  return createSpawnRunner({
    spawn: (command, args, options) => {
      const child = nodeSpawn(command, args, options);
      children.push(child);
      return child;
    }
  });
}

describeUpstream('wrapper shutdown against the real CLI', () => {
  let root: string;
  let state: StateDirectory;
  let surface: SurfaceHarness;
  let children: ChildProcess[];

  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'shutdown-e2e-'));
    state = openStateDirectory(root);
    children = [];
    surface = await productionSurface(state, { runner: notingRunner(children) });
  });

  afterEach(async () => {
    children.filter(child => child.exitCode === null && child.signalCode === null).forEach(child => child.kill('SIGKILL'));
    await surface.close();
    removeStateRoot(root, state.cwd);
  });

  it('leaves no child process with one parked and one streaming run', async () => {
    const client = surface.client({ timeout: 120_000 });
    const parked = await client.messages.create(PARKING);
    expect(parked.stop_reason).toBe('tool_use');
    const stream = client.messages.stream(STREAMING);
    const firstText = new Promise(resolve => stream.on('text', resolve));
    const streamed = stream.finalMessage().then(() => undefined, (error: unknown) => error);
    await firstText;
    expect(children).toHaveLength(2);
    const tree = processTree(children.map(child => child.pid as number));

    const started = Date.now();
    await surface.shutdown();
    const drainedMs = Date.now() - started;

    const error = await streamed as { error?: { error?: { type?: string; message?: string } } };
    expect(error?.error?.error).toEqual({ type: 'api_error', message: 'server shutting down' });
    expect(drainedMs).toBeLessThan(DRAIN_MS + 5_000);
    expect(children.map(child => child.exitCode !== null || child.signalCode !== null)).toEqual([true, true]);
    expect(tree.filter(alive)).toEqual([]);
    expect(fs.readdirSync(state.runs)).toEqual([]);
    await expect(client.messages.create(STREAMING)).rejects.toEqual(expect.objectContaining({ status: 529 }));
    console.log(`shutdown drained ${children.length} runs (${tree.length} processes) in ${drainedMs} ms`);
  }, 180_000);
});
