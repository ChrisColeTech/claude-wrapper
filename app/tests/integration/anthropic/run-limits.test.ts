/**
 * The run's limits through the official SDK (spec section 14), upstream scripted on a fake clock:
 * the active-lifetime timer excludes the time a run spends parked (the park TTL covers that) and
 * resumes counting when the run does, its firing logged with the request id and the upstream
 * session id; and `--max-turns`, passed on every run, ends a run that hits it with a post-commit
 * 500 `api_error`, not the real API's `pause_turn`.
 */
import Anthropic from '@anthropic-ai/sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ANTHROPIC_SETTING_ENV } from '../../../src/config/anthropic-settings';
import { logger } from '../../../src/utils/logger';
import { callWeather, connectAsUpstream, toolResultFrame, weatherCalls } from '../../mocks/anthropic/bridge-upstream';
import { GET_WEATHER } from '../../mocks/anthropic/client-tool-recordings';
import { STATE } from '../../mocks/anthropic/plan-context';
import { envelopeOf, rejectionOf, SurfaceHarness, startSurface } from '../../mocks/anthropic/surface-harness';
import { initFrame, MESSAGE_START, resultFrame, streamEvent, TEXT_START, textDelta } from '../../mocks/anthropic/turn-frames';
import { createFakeClock, FakeClock } from '../../mocks/shared/fake-clock';
import { waitFor } from '../../mocks/shared/wait-for';
import { settle } from '../../mocks/upstream/run-helpers';
import { createScriptedRunner, ScriptedRunner } from '../../mocks/upstream/scripted-runner';

type ApiError = InstanceType<typeof Anthropic.APIError>;

const MINUTE = 60_000;
const PARIS = { id: 'toolu_paris', city: 'Paris' };
const ASK: Anthropic.MessageParam = { role: 'user', content: 'Weather in Paris?' };
const REQUEST = { model: 'claude-fable-5-1', max_tokens: 1024 };
const flagValue = (flags: readonly string[], flag: string) => flags[flags.indexOf(flag) + 1];

describe('Anthropic surface: run limits', () => {
  let surface: SurfaceHarness;
  let runner: ScriptedRunner;
  let clock: FakeClock;
  let mcp: Client | undefined;

  beforeEach(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(logger, 'warn');
    process.env[ANTHROPIC_SETTING_ENV.lifetimeMs] = String(MINUTE);
    process.env[ANTHROPIC_SETTING_ENV.stallMs] = String(60 * MINUTE);
    clock = createFakeClock(1_791_000_000_000);
    runner = createScriptedRunner(clock);
    surface = await startSurface({ runner, clock, stateDirectory: STATE });
  });

  afterEach(async () => {
    delete process.env[ANTHROPIC_SETTING_ENV.lifetimeMs];
    delete process.env[ANTHROPIC_SETTING_ENV.stallMs];
    await mcp?.close().catch(() => undefined);
    mcp = undefined;
    await surface.close();
  });

  it('excludes park time from the active lifetime, and counts again once the run resumes', async () => {
    const client = surface.client();
    const asking = client.messages.create({ ...REQUEST, tools: [GET_WEATHER as Anthropic.Tool], messages: [ASK] });
    const { spec, process: upstream } = await runner.nextRun();
    await waitFor(() => upstream.writtenLines().length === 1);
    mcp = await connectAsUpstream(spec);
    clock.advance(15_000);
    upstream.frames(initFrame({ tools: ['mcp__client__get_weather'] }), ...weatherCalls([PARIS]));
    const waiting = callWeather(mcp, PARIS);
    const parked = await asking;

    clock.advance(5 * MINUTE);
    await settle();
    const answering = rejectionOf(client.messages.create({ ...REQUEST, tools: [GET_WEATHER as Anthropic.Tool], messages: [
      ASK, { role: 'assistant', content: parked.content },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: PARIS.id, content: '18 C' }] }
    ] }));
    await waiting;
    upstream.frames(toolResultFrame(PARIS.id, '18 C'));
    clock.advance(44_999);
    await settle();
    expect(upstream.kills).toEqual([]);
    clock.advance(1);
    const error = await answering;

    expect(error.status).toBe(504);
    expect(envelopeOf(error).error.type).toBe('timeout_error');
    expect(logger.warn).toHaveBeenCalledWith('Upstream run ended by the runner', expect.objectContaining({
      requestId: expect.stringMatching(/^req_/), sessionId: 'session-1', reason: { kind: 'timeout', timer: 'lifetime' }
    }));
    upstream.exit(null, 'SIGTERM');
  });

  it('passes --max-turns on every run; hitting it after commit is the SSE error api_error, not pause_turn', async () => {
    const stream = surface.client().messages.stream({ ...REQUEST, messages: [ASK] });
    const firstText = new Promise(resolve => stream.on('text', resolve));
    const ended = stream.finalMessage().then(() => undefined, (error: ApiError) => error);
    const { spec, process: upstream } = await runner.nextRun();
    upstream.frames(initFrame(), ...[MESSAGE_START, TEXT_START, textDelta('Checking')].map(event => streamEvent(event)));
    await firstText;

    upstream.frames(resultFrame({
      subtype: 'error_max_turns', is_error: true, result: undefined, errors: ['Reached maximum number of turns (25)']
    }));
    const error = await ended;

    expect(flagValue(spec.flags, '--max-turns')).toBe('25');
    expect(envelopeOf(error as ApiError).error).toEqual({ type: 'api_error', message: 'Reached maximum number of turns (25)' });
    await waitFor(() => upstream.inputEnded());
    upstream.exit(1);
  });
});
