/**
 * E2E (real CLI, behind UPSTREAM_E2E=1): web search and web fetch through the whole surface (spec
 * section 8). A search with `allowed_domains` returns results from the allowed hosts only (the
 * hook's `updatedInput` reaching upstream's search); a fetch returns the document upstream's model
 * received. Scenario 7 is the hook client round trip through the control server: upstream runs the
 * per-run settings file's command hook, the shipped hook client posts each call to the run's hook
 * endpoint with the run's token, and the policy's replies take effect (`max_uses: 1` denies a
 * second search, which the client sees as `max_uses_exceeded`). Each test spends quota: a model
 * turn plus upstream's own side call per search or fetch.
 *
 *   UPSTREAM_E2E=1 npm --prefix app run test:e2e -- tests/e2e/upstream/web-tools.test.ts
 *   UPSTREAM_E2E=1 npm --prefix app run test:e2e -- tests/e2e/upstream/web-tools.test.ts -t 'scenario 7'
 *
 * Optional: `UPSTREAM_E2E_MODEL` (default Haiku 4.5), `CLAUDE_COMMAND`.
 */
import type Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ControlServer, createControlServer, RunHandlers } from '../../../src/upstream/control-server';
import { createSpawnRunner, Runner, RunSpec } from '../../../src/upstream/runner';
import { openStateDirectory, StateDirectory } from '../../../src/upstream/state-directory';
import { logger } from '../../../src/utils/logger';
import type { SurfaceHarness } from '../../mocks/anthropic/surface-harness';
import { waitFor } from '../../mocks/shared/wait-for';
import { describeUpstream, E2E_MODEL, removeStateRoot } from './harness';

const RUN_EXIT_WAIT_MS = 60_000;
const TURN_TIMEOUT_MS = 240_000;

interface HookCall {
  input: { tool_name?: string; tool_use_id?: string; tool_input?: Record<string, unknown> };
  reply: unknown;
}

/** The control server, noting every hook call it serves: upstream's input and the policy's reply. */
function notingControlServer(calls: HookCall[]): ControlServer {
  const server = createControlServer();
  const noting = (handlers: RunHandlers): RunHandlers => {
    const { hookHandler } = handlers;
    if (!hookHandler) return handlers;
    return { ...handlers, hookHandler: async input => {
      const reply = await hookHandler(input);
      calls.push({ input: input as HookCall['input'], reply });
      return reply;
    } };
  };
  return {
    start: () => server.start(),
    registerRun: (id, handlers) => server.registerRun(id, noting(handlers)),
    releaseRun: id => server.releaseRun(id),
    close: () => server.close()
  };
}

/** The production spawn runner, noting each run's spec (never logged: it carries the token). */
function notingRunner(specs: RunSpec[]): Runner {
  const runner = createSpawnRunner();
  return { startRun: spec => { specs.push(spec); return runner.startRun(spec); } };
}

/** Built here, not imported at the top: a skipped file must not start the OpenAI surface's timers. */
async function productionSurface(state: StateDirectory, runner: Runner, controlServer: ControlServer): Promise<SurfaceHarness> {
  const { createServer } = await import('../../../src/api/server');
  const { serveApp } = await import('../../mocks/anthropic/surface-harness');
  return serveApp(createServer({ stateDirectory: state, runner, controlServer }));
}

const blocksOf = <T extends Anthropic.ContentBlock['type']>(message: Anthropic.Message, type: T) =>
  message.content.filter((block): block is Extract<Anthropic.ContentBlock, { type: T }> => block.type === type);

const hostOf = (url: string): string => new URL(url).hostname;

describeUpstream('web search and web fetch through the surface against the real CLI', () => {
  let root: string;
  let state: StateDirectory;
  let surface: SurfaceHarness;
  let controlServer: ControlServer;
  let specs: RunSpec[];
  let hookCalls: HookCall[];
  let errors: jest.SpyInstance;

  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'web-tools-e2e-'));
    state = openStateDirectory(root);
    specs = [];
    hookCalls = [];
    errors = jest.spyOn(logger, 'error');
    controlServer = notingControlServer(hookCalls);
    surface = await productionSurface(state, notingRunner(specs), controlServer);
  });

  afterEach(async () => {
    await waitFor(() => fs.readdirSync(state.runs).length === 0, RUN_EXIT_WAIT_MS);
    await surface.close();
    await controlServer.close();
    errors.mockRestore();
    removeStateRoot(root, state.cwd);
  }, RUN_EXIT_WAIT_MS + 10_000);

  it('searches with allowed_domains and returns results from the allowed hosts only', async () => {
    const message = await surface.client({ timeout: TURN_TIMEOUT_MS }).messages.create({
      model: E2E_MODEL, max_tokens: 1024,
      tools: [{ type: 'web_search_20250305', name: 'web_search', allowed_domains: ['wikipedia.org'], max_uses: 2 }],
      messages: [{ role: 'user', content: 'Use web search once to find the population of Iceland, then answer in one sentence.' }]
    });

    const uses = blocksOf(message, 'server_tool_use');
    const results = blocksOf(message, 'web_search_tool_result');
    expect(uses.length).toBeGreaterThan(0);
    expect(results.map(result => result.tool_use_id)).toEqual(uses.map(use => use.id));
    const urls = results.flatMap(result => (Array.isArray(result.content) ? result.content.map(item => item.url) : []));
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.filter(url => hostOf(url) !== 'wikipedia.org' && !hostOf(url).endsWith('.wikipedia.org'))).toEqual([]);
    expect(message.usage.server_tool_use?.web_search_requests).toBeGreaterThan(0);
    expect(message.stop_reason).toBe('end_turn');
  }, TURN_TIMEOUT_MS);

  it('fetches a page and returns the document upstream’s model received', async () => {
    const message = await surface.client({ timeout: TURN_TIMEOUT_MS }).messages.create({
      model: E2E_MODEL, max_tokens: 1024,
      tools: [{ type: 'web_fetch_20250910', name: 'web_fetch', allowed_domains: ['example.com'] }],
      messages: [{ role: 'user', content: 'Fetch https://example.com/ with the web fetch tool and quote its main heading.' }]
    });

    const [fetched] = blocksOf(message, 'web_fetch_tool_result');
    expect(blocksOf(message, 'server_tool_use')[0]).toEqual(expect.objectContaining({ name: 'web_fetch', input: { url: expect.stringContaining('example.com') } }));
    expect(fetched?.content).toEqual(expect.objectContaining({
      type: 'web_fetch_result', url: expect.stringContaining('example.com'),
      content: expect.objectContaining({ type: 'document', source: expect.objectContaining({ type: 'text', data: expect.any(String) }) })
    }));
    expect(message.usage.server_tool_use?.web_fetch_requests).toBeGreaterThan(0);
  }, TURN_TIMEOUT_MS);

  it('scenario 7: upstream runs the hook client, which reaches the run’s policy through the control server', async () => {
    const message = await surface.client({ timeout: TURN_TIMEOUT_MS }).messages.create({
      model: E2E_MODEL, max_tokens: 1024,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 1 }],
      messages: [{ role: 'user', content: 'Run exactly two separate web searches, one after the other: first "Claude Code release notes", ' +
        'then "Claude Code latest version". Then answer in one sentence.' }]
    });

    expect(specs[0]?.flags).toContain('--settings');
    const uses = blocksOf(message, 'server_tool_use');
    expect(uses.length).toBeGreaterThan(0);
    // Every call the client sees went through the hook: the surface's id is upstream's under `srvtoolu_`.
    expect(uses.map(use => use.id)).toEqual(hookCalls.map(call => `srv${String(call.input.tool_use_id)}`));
    expect(hookCalls.every(call => call.input.tool_name === 'WebSearch')).toBe(true);
    expect(hookCalls[0]?.reply).toEqual({});
    const results = blocksOf(message, 'web_search_tool_result');
    if (hookCalls.length > 1) {
      expect(JSON.stringify(hookCalls[1]?.reply)).toContain('max_uses_exceeded');
      expect(results[1]?.content).toEqual({ type: 'web_search_tool_result_error', error_code: 'max_uses_exceeded' });
    }
    expect(Array.isArray(results[0]?.content)).toBe(true);
    // No denial the hook did not issue, and no web call that bypassed it (logged at the run's result).
    await waitFor(() => fs.readdirSync(state.runs).length === 0, RUN_EXIT_WAIT_MS);
    expect(errors).not.toHaveBeenCalled();
  }, TURN_TIMEOUT_MS);
});
