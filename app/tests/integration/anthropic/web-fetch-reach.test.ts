/**
 * Web fetch stays off the operator's network (spec section 8): upstream's WebFetch runs on the
 * wrapper's machine, so the surface's hook policy denies a fetch whose host is not public, a name
 * resolved as the call is decided (here by a table injected into the surface, never by DNS). The
 * recorded probe fetched example.com, then www.iana.org; here www.iana.org is a name on the
 * operator's network. The real hook client asks the surface's control server at each recorded
 * `hook_started`, and the denied call comes back as the API's `url_not_allowed` error block. The
 * operator's setting turns the block off.
 */
import Anthropic from '@anthropic-ai/sdk';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { HOOK_ENDPOINT_FILE_NAME, hookCommand } from '../../../src/upstream/hook-settings';
import { logger } from '../../../src/utils/logger';
import { STATE } from '../../mocks/anthropic/plan-context';
import { SurfaceHarness, startSurface } from '../../mocks/anthropic/surface-harness';
import { recordedHookCalls } from '../../mocks/upstream/hook-recordings';
import { recordedStdout } from '../../mocks/upstream/recordings';
import { createScriptedRunner, ScriptedRunner } from '../../mocks/upstream/scripted-runner';

const PROBE = 's-webfetch-hostlist';
const FETCH = { type: 'web_fetch_20250910' as const, name: 'web_fetch' as const };
const NAMES: Record<string, string[]> = { 'example.com': ['93.184.215.14'], 'www.iana.org': ['10.20.30.40'] };
const SETTING = 'CLAUDE_WRAPPER_WEB_FETCH_PUBLIC_ONLY';

type Recorded = { type: string; subtype?: string };

/** Runs the hook command as upstream would, with `stdin`; resolves with what it printed, parsed. */
function runHook(command: string, stdin: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn('/bin/sh', ['-c', command], { env: { PATH: process.env['PATH'] ?? '' } });
    let printed = '';
    child.stdout.on('data', chunk => { printed += String(chunk); });
    child.on('error', reject);
    child.on('close', () => resolve(JSON.parse(printed)));
    child.stdin.end(JSON.stringify(stdin));
  });
}

describe("Anthropic surface: web fetch stays off the operator's network (scripted runner, spec section 8)", () => {
  const frames = recordedStdout(`cli-probes/${PROBE}.jsonl`) as Recorded[];
  const hookCalls = recordedHookCalls(PROBE);
  let surface: SurfaceHarness;
  let runner: ScriptedRunner;
  let scratch: string;
  let resolveHost: jest.Mock<Promise<string[]>, [string]>;

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    runner = createScriptedRunner();
    resolveHost = jest.fn(async (host: string) => NAMES[host] ?? []);
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'web-fetch-reach-'));
  });

  afterEach(async () => {
    delete process.env[SETTING];
    await surface.close();
    fs.rmSync(scratch, { recursive: true, force: true });
  });

  /** Plays the recorded turn, the real hook client answering at each `hook_started`; the replies and the message. */
  async function playTurn(): Promise<{ replies: unknown[]; message: Anthropic.Message }> {
    surface = await startSurface({ runner, stateDirectory: STATE, resolveHost });
    const answer = surface.client().messages.create({
      model: 'fable', max_tokens: 1024, tools: [FETCH],
      messages: [{ role: 'user', content: 'Fetch example.com, then the IANA page about example domains.' }]
    });
    const { spec, process } = await runner.nextRun();
    // The spawn runner writes the run's files; here the test writes the endpoint file upstream's hook reads.
    const endpointFile = path.join(scratch, HOOK_ENDPOINT_FILE_NAME);
    fs.writeFileSync(endpointFile, spec.runDir?.files[HOOK_ENDPOINT_FILE_NAME] as string, { mode: 0o600 });
    const replies: unknown[] = [];
    for (const frame of frames) {
      process.frames(frame);
      if (frame.type === 'system' && frame.subtype === 'hook_started') {
        replies.push(await runHook(hookCommand({ endpointFile }), hookCalls[replies.length]?.stdin));
      }
    }
    process.exit(0);
    return { replies, message: await answer };
  }

  it('denies the fetch of a name that resolves to a private address; the client gets url_not_allowed', async () => {
    const { replies, message } = await playTurn();

    expect(replies).toEqual([{}, { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny',
      permissionDecisionReason: 'url_not_allowed: www.iana.org resolves to an address that is not public' } }]);
    expect(resolveHost.mock.calls).toEqual([['example.com'], ['www.iana.org']]);
    const results = message.content.filter(block => block.type === 'web_fetch_tool_result') as Anthropic.WebFetchToolResultBlock[];
    expect(results.map(block => block.content.type)).toEqual(['web_fetch_result', 'web_fetch_tool_result_error']);
    expect(results[1]?.content).toEqual({ type: 'web_fetch_tool_result_error', error_code: 'url_not_allowed' });
    expect(message.usage.server_tool_use).toEqual({ web_search_requests: 0, web_fetch_requests: 1 });
  });

  it(`lets every fetch through, resolving nothing, with ${SETTING}=false`, async () => {
    process.env[SETTING] = 'false';

    const { replies } = await playTurn();

    expect(replies).toEqual([{}, {}]);
    expect(resolveHost).not.toHaveBeenCalled();
  });
});
