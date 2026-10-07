/**
 * E2E (real CLI, behind UPSTREAM_E2E=1): web search and web fetch through the whole surface (spec
 * section 8). A search with `allowed_domains` returns results from the allowed hosts only (the
 * hook's `updatedInput` reaching upstream's search); a fetch returns the document upstream's model
 * received. Scenario 7 is the hook client round trip through the control server: upstream runs the
 * per-run settings file's command hook, the shipped hook client posts each call to the run's hook
 * endpoint with the run's token, and the policy's replies take effect (`max_uses: 1` denies a
 * second search, which the client sees as `max_uses_exceeded`). The model may make both searches
 * in one message, and their results come back in any order, so each is paired with its call by id.
 * The private-host block: a fetch of a loopback URL is denied by the hook (`url_not_allowed`), and
 * the loopback server the test starts sees no connection, which shows upstream honours the deny.
 * In every test the run's audit must log no denied call that upstream ran anyway. Each test spends
 * quota: a model turn plus upstream's own side call per search or fetch.
 *
 *   UPSTREAM_E2E=1 npm --prefix app run test:e2e -- tests/e2e/upstream/web-tools.test.ts
 *   UPSTREAM_E2E=1 npm --prefix app run test:e2e -- tests/e2e/upstream/web-tools.test.ts -t 'scenario 7'
 *   UPSTREAM_E2E=1 npm --prefix app run test:e2e -- tests/e2e/upstream/web-tools.test.ts -t 'private-host'
 *
 * Optional: `UPSTREAM_E2E_MODEL` (default Haiku 4.5), `CLAUDE_COMMAND`, `UPSTREAM_E2E_RECORD_DIR`
 * (scenario 7's and the private-host run's frames are written there as
 * `scenario-7-web-search-max-uses.jsonl` and `web-fetch-private-host.jsonl`).
 */
import type Anthropic from '@anthropic-ai/sdk';
import { once } from 'events';
import * as fs from 'fs';
import * as http from 'http';
import { AddressInfo } from 'net';
import * as os from 'os';
import * as path from 'path';
import { ControlServer, createControlServer, RunHandlers } from '../../../src/upstream/control-server';
import { openStateDirectory, StateDirectory } from '../../../src/upstream/state-directory';
import { logger } from '../../../src/utils/logger';
import type { SurfaceHarness } from '../../mocks/anthropic/surface-harness';
import { waitFor } from '../../mocks/shared/wait-for';
import { describeUpstream, E2E_MODEL, productionSurface, removeStateRoot } from './harness';
import { recordFrames, TeeingRunner, teeingRunner } from './teeing-runner';

const RUN_EXIT_WAIT_MS = 60_000;
const TURN_TIMEOUT_MS = 240_000;
/** The audit's line for a call upstream ran although the hook denied it. */
const RAN_DESPITE_DENIAL = "Upstream ran a call the wrapper's hook denied: the denial was not enforced";
/** The setting the private-host test needs at its default (on). */
const PUBLIC_ONLY = 'CLAUDE_WRAPPER_WEB_FETCH_PUBLIC_ONLY';

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

/** A loopback HTTP server that answers anything and counts every connection made to it. */
async function countingServer(): Promise<{ url: string; connections(): number; close(): Promise<void> }> {
  let connections = 0;
  const server = http.createServer((_req, res) => res.end('This page is on the operator\'s machine and must never be fetched.'));
  server.on('connection', () => { connections += 1; });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/wrapper-e2e-page`,
    connections: () => connections,
    close: () => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); })
  };
}

const blocksOf = <T extends Anthropic.ContentBlock['type']>(message: Anthropic.Message, type: T) =>
  message.content.filter((block): block is Extract<Anthropic.ContentBlock, { type: T }> => block.type === type);

const hostOf = (url: string): string => new URL(url).hostname;

/** The surface's id for a call the hook saw: upstream's `toolu_` id under `srvtoolu_`. */
const surfaceId = (call: HookCall): string => `srv${String(call.input.tool_use_id)}`;

describeUpstream('web search and web fetch through the surface against the real CLI', () => {
  const operatorPublicOnly = process.env[PUBLIC_ONLY];
  let root: string;
  let state: StateDirectory;
  let surface: SurfaceHarness;
  let runner: TeeingRunner;
  let hookCalls: HookCall[];
  let errors: jest.SpyInstance;

  beforeEach(async () => {
    delete process.env[PUBLIC_ONLY];
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'web-tools-e2e-'));
    state = openStateDirectory(root);
    runner = teeingRunner();
    hookCalls = [];
    errors = jest.spyOn(logger, 'error');
    surface = await productionSurface(state, { runner, controlServer: notingControlServer(hookCalls) });
  });

  afterEach(async () => {
    if (operatorPublicOnly !== undefined) process.env[PUBLIC_ONLY] = operatorPublicOnly;
    await waitFor(() => fs.readdirSync(state.runs).length === 0, RUN_EXIT_WAIT_MS);
    await surface.close();
    errors.mockRestore();
    removeStateRoot(root, state.cwd);
  }, RUN_EXIT_WAIT_MS + 10_000);

  /** The run's `result` is read after the response has ended: wait for upstream's exit before checking the audit. */
  const runsExited = () => waitFor(() => fs.readdirSync(state.runs).length === 0, RUN_EXIT_WAIT_MS);

  it('searches with allowed_domains and returns results from the allowed hosts only', async () => {
    const message = await surface.client({ timeout: TURN_TIMEOUT_MS }).messages.create({
      model: E2E_MODEL, max_tokens: 1024,
      tools: [{ type: 'web_search_20250305', name: 'web_search', allowed_domains: ['wikipedia.org'], max_uses: 2 }],
      messages: [{ role: 'user', content: 'Use web search once to find the population of Iceland, then answer in one sentence.' }]
    });

    const uses = blocksOf(message, 'server_tool_use');
    const results = blocksOf(message, 'web_search_tool_result');
    expect(uses.length).toBeGreaterThan(0);
    expect(results.map(result => result.tool_use_id).sort()).toEqual(uses.map(use => use.id).sort());
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
    await runsExited();
    recordFrames('scenario-7-web-search-max-uses', runner.runs[0]?.frames ?? []);

    expect(runner.runs[0]?.spec.flags).toContain('--settings');
    const uses = blocksOf(message, 'server_tool_use');
    expect(uses.length).toBeGreaterThan(0);
    // Every call the client sees went through the hook.
    expect(uses.map(use => use.id).sort()).toEqual(hookCalls.map(surfaceId).sort());
    expect(hookCalls.every(call => call.input.tool_name === 'WebSearch')).toBe(true);
    // max_uses 1: one search let through, any other denied; each result paired with its call by id.
    const denied = hookCalls.filter(call => JSON.stringify(call.reply).includes('max_uses_exceeded'));
    expect(hookCalls.length - denied.length).toBe(1);
    const results = new Map(blocksOf(message, 'web_search_tool_result').map(result => [result.tool_use_id, result.content]));
    for (const call of hookCalls) {
      if (denied.includes(call)) expect(results.get(surfaceId(call))).toEqual({ type: 'web_search_tool_result_error', error_code: 'max_uses_exceeded' });
      else expect(Array.isArray(results.get(surfaceId(call)))).toBe(true);
    }
    // Upstream honoured each denial; no denial the hook did not issue; no web call that bypassed it.
    expect(errors).not.toHaveBeenCalledWith(RAN_DESPITE_DENIAL, undefined, expect.anything());
    expect(errors).not.toHaveBeenCalled();
  }, TURN_TIMEOUT_MS + RUN_EXIT_WAIT_MS);

  it('the private-host block: a fetch of a loopback URL is denied by the hook and never reaches the host', async () => {
    const host = await countingServer();
    try {
      const message = await surface.client({ timeout: TURN_TIMEOUT_MS }).messages.create({
        model: E2E_MODEL, max_tokens: 512, tools: [{ type: 'web_fetch_20250910', name: 'web_fetch' }],
        messages: [{ role: 'user', content: `Fetch ${host.url} with the web fetch tool, once, then say in one sentence whether it worked.` }]
      });
      await runsExited();
      recordFrames('web-fetch-private-host', runner.runs[0]?.frames ?? []);

      // None means the model never asked, or the CLI refused the URL before its PreToolUse hook ran.
      const fetches = hookCalls.filter(call => call.input.tool_name === 'WebFetch');
      expect(fetches.length).toBeGreaterThan(0);
      expect(fetches.map(call => JSON.stringify(call.reply).includes('url_not_allowed'))).toEqual(fetches.map(() => true));
      const results = new Map(blocksOf(message, 'web_fetch_tool_result').map(result => [result.tool_use_id, result.content]));
      expect(fetches.map(call => results.get(surfaceId(call))))
        .toEqual(fetches.map(() => ({ type: 'web_fetch_tool_result_error', error_code: 'url_not_allowed' })));
      expect(message.usage.server_tool_use?.web_fetch_requests).toBe(0);
      expect(host.connections()).toBe(0);
      expect(errors).not.toHaveBeenCalledWith(RAN_DESPITE_DENIAL, undefined, expect.anything());
    } finally {
      await host.close();
    }
  }, TURN_TIMEOUT_MS + RUN_EXIT_WAIT_MS);
});
