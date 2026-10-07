/**
 * Web search and web fetch through the official SDK (spec sections 8, 10, 11, 16). A recorded
 * two-call search turn, replayed, comes back as one message: `server_tool_use`, its
 * `web_search_tool_result`, the answer, and the summed usage with the request count. The run gets
 * its settings file (the `PreToolUse` hook running the shipped hook client) and its hook endpoint
 * file in its own directory, the token only there. With the scripted runner the surface's hook
 * policy answers the real hook client through the control server, and the call it denies comes
 * back as the error block with the hook's code.
 */
import Anthropic from '@anthropic-ai/sdk';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { HOOK_ENDPOINT_FILE_NAME, hookCommand } from '../../../src/upstream/hook-settings';
import { createReplayRunner, ReplayRunner, RunSpec } from '../../../src/upstream/runner';
import { logger } from '../../../src/utils/logger';
import { STATE } from '../../mocks/anthropic/plan-context';
import { SurfaceHarness, startSurface } from '../../mocks/anthropic/surface-harness';
import { recordedHookCalls } from '../../mocks/upstream/hook-recordings';
import { loadRecording, recordedStdout } from '../../mocks/upstream/recordings';
import { createScriptedRunner, ScriptedRunner } from '../../mocks/upstream/scripted-runner';

const TWO_CALLS = 'cli-probes/t7-websearch-cap-300.jsonl';
const RUN_DIR = /^\/var\/lib\/claude-wrapper\/runs\/[0-9a-f-]{36}$/;
const SEARCH = { type: 'web_search_20250305' as const, name: 'web_search' as const };

type Recorded = { type: string; subtype?: string; usage?: Record<string, unknown>; tool_use_result?: { results: unknown[] } };

describe('Anthropic surface: a recorded two-call web search turn (replay runner)', () => {
  const stdout = recordedStdout(TWO_CALLS) as Recorded[];
  const result = stdout.find(frame => frame.type === 'result') as Recorded & { usage: Record<string, number> };
  const links = (stdout.find(frame => frame.tool_use_result)?.tool_use_result?.results[0] as { content: { url: string }[] }).content;
  let surface: SurfaceHarness;
  let runner: ReplayRunner;

  beforeEach(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    runner = createReplayRunner([loadRecording(TWO_CALLS)], { timeScale: 0 });
    surface = await startSurface({ runner, stateDirectory: STATE });
  });

  afterEach(async () => {
    await surface.close();
  });

  const request = {
    model: 'fable', max_tokens: 300, tools: [SEARCH],
    messages: [{ role: 'user' as const, content: 'What is the population of Iceland?' }]
  };

  it.each([
    ['messages.create', (client: Anthropic) => client.messages.create(request)],
    ['messages.stream().finalMessage()', (client: Anthropic) => client.messages.stream(request).finalMessage()]
  ])('%s: one message with the search, its results and the answer, usage summed over both calls', async (_name, send) => {
    const message = await send(surface.client());

    expect(message.content.map(block => block.type)).toEqual(['server_tool_use', 'web_search_tool_result', 'text']);
    const [use, searched] = message.content as [Anthropic.ServerToolUseBlock, Anthropic.WebSearchToolResultBlock];
    expect(use).toEqual({ type: 'server_tool_use', id: expect.stringMatching(/^srvtoolu_/), name: 'web_search',
      input: { query: 'Iceland population 2026 Statistics Iceland' } });
    expect(searched.tool_use_id).toBe(use.id);
    expect((searched.content as Anthropic.WebSearchResultBlock[]).map(item => item.url)).toEqual(links.map(link => link.url));
    expect(message.stop_reason).toBe('end_turn');
    expect(message.usage).toEqual(expect.objectContaining({
      input_tokens: result.usage['input_tokens'], output_tokens: result.usage['output_tokens'],
      cache_creation_input_tokens: result.usage['cache_creation_input_tokens'],
      cache_read_input_tokens: result.usage['cache_read_input_tokens'],
      server_tool_use: { web_search_requests: 1, web_fetch_requests: 0 }
    }));
  });

  it('streams one message_start, the result block whole in one content_block_start', async () => {
    const events: Anthropic.RawMessageStreamEvent[] = [];
    for await (const event of await surface.client().messages.create({ ...request, stream: true })) events.push(event);

    expect(events.filter(event => event.type === 'message_start')).toHaveLength(1);
    const resultStart = events.findIndex(event => event.type === 'content_block_start' && event.content_block.type === 'web_search_tool_result');
    expect(events[resultStart + 1]).toEqual({ type: 'content_block_stop', index: 1 });
  });

  it('gives the run the built-in, its allow rule, and the hook in two files of its own directory, the token in one', async () => {
    await surface.client().messages.create(request);
    const spec = runner.started[0]?.spec as RunSpec;
    const dir = spec.runDir?.path as string;
    const files = spec.runDir?.files ?? {};
    const flag = (name: string) => spec.flags[spec.flags.indexOf(name) + 1];

    expect(dir).toMatch(RUN_DIR);
    expect(flag('--tools')).toBe('WebSearch');
    expect(flag('--allowedTools')).toBe('WebSearch');
    expect(flag('--settings')).toBe(path.join(dir, 'settings.json'));
    const endpoint = JSON.parse(files[HOOK_ENDPOINT_FILE_NAME] as string) as { url: string; token: string };
    expect(endpoint).toEqual({ url: expect.stringMatching(/^http:\/\/127\.0\.0\.1:\d+\/runs\/[0-9a-f-]+\/hook$/), token: expect.any(String) });
    expect(spec.hooks).toEqual(endpoint);
    expect(JSON.parse(files['settings.json'] as string)).toEqual({ hooks: { PreToolUse: [{ matcher: 'WebSearch|WebFetch',
      hooks: [{ type: 'command', command: hookCommand({ endpointFile: path.join(dir, HOOK_ENDPOINT_FILE_NAME) }), timeout: 30 }] }] } });
    expect(spec.flags.join(' ')).not.toContain(endpoint.token);
    expect(Object.values(spec.env).join(' ')).not.toContain(endpoint.token);
    expect(files['settings.json']).not.toContain(endpoint.token);
  });
});

/** Runs the hook command as upstream would, with `stdin`; resolves with what it printed. */
function runHook(command: string, stdin: unknown): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('/bin/sh', ['-c', command], { env: { PATH: process.env['PATH'] ?? '' } });
    let printed = '';
    child.stdout.on('data', chunk => { printed += String(chunk); });
    child.on('error', reject);
    child.on('close', () => resolve(printed));
    child.stdin.end(JSON.stringify(stdin));
  });
}

describe('Anthropic surface: the hook policy behind the hook client (scripted runner, spec section 8)', () => {
  const PROBE = 's-websearch-allowed-then-deny';
  const frames = recordedStdout(`cli-probes/${PROBE}.jsonl`) as Recorded[];
  const hookCalls = recordedHookCalls(PROBE);
  let surface: SurfaceHarness;
  let runner: ScriptedRunner;
  let scratch: string;
  let errors: jest.SpyInstance;

  beforeEach(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    errors = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    runner = createScriptedRunner();
    surface = await startSurface({ runner, stateDirectory: STATE });
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'web-tools-'));
  });

  afterEach(async () => {
    await surface.close();
    fs.rmSync(scratch, { recursive: true, force: true });
  });

  it('denies the call after max_uses through the real hook client; the client gets max_uses_exceeded', async () => {
    const answer = surface.client().messages.create({
      model: 'fable', max_tokens: 1024, tools: [{ ...SEARCH, max_uses: 1, allowed_domains: ['github.com'] }],
      messages: [{ role: 'user', content: 'Search twice for Claude Code releases.' }]
    });
    const { spec, process } = await runner.nextRun();
    // The spawn runner writes the run's files; here the test writes the endpoint file upstream's hook reads.
    const endpointFile = path.join(scratch, HOOK_ENDPOINT_FILE_NAME);
    fs.writeFileSync(endpointFile, spec.runDir?.files[HOOK_ENDPOINT_FILE_NAME] as string, { mode: 0o600 });
    const replies: unknown[] = [];

    for (const frame of frames) {
      process.frames(frame);
      // Upstream runs the hook between these two frames.
      if (frame.type === 'system' && frame.subtype === 'hook_started') {
        replies.push(JSON.parse(await runHook(hookCommand({ endpointFile }), hookCalls[replies.length]?.stdin)));
      }
    }
    process.exit(0);
    const message = await answer;

    expect(replies[0]).toEqual(hookCalls[0]?.reply);
    expect(replies[1]).toEqual({ hookSpecificOutput: expect.objectContaining({ permissionDecision: 'deny',
      permissionDecisionReason: 'max_uses_exceeded: WebSearch may be used at most 1 time in this request' }) });
    const results = message.content.filter(block => block.type === 'web_search_tool_result') as Anthropic.WebSearchToolResultBlock[];
    expect(results.map(block => Array.isArray(block.content) ? 'results' : block.content)).toEqual([
      'results', { type: 'web_search_tool_result_error', error_code: 'max_uses_exceeded' }
    ]);
    expect(message.usage.server_tool_use).toEqual({ web_search_requests: 1, web_fetch_requests: 0 });
    expect(errors).not.toHaveBeenCalled();
  });
});
