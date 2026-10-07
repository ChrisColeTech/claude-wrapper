/**
 * `POST /v1/messages/count_tokens` through the official SDK's `countTokens` (spec section 12).
 * The request is planned as its Messages turn would be and measured by a run capped at one
 * output token that persists no session; the run's first `message_delta` is the answer (its input
 * count plus both cache counters), after which the run is interrupted. No session is looked up,
 * recorded or forgotten. A failure before the measurement is the HTTP status Messages would answer.
 */
import Anthropic from '@anthropic-ai/sdk';
import { fingerprint } from '../../../src/anthropic/request';
import { Frame } from '../../../src/upstream/frames';
import { createReplayRunner, parseRecording, Recording, ReplayRunner } from '../../../src/upstream/runner';
import { clientToolRecording, GET_WEATHER, SINGLE_CALL } from '../../mocks/anthropic/client-tool-recordings';
import { STATE } from '../../mocks/anthropic/plan-context';
import { memorySessions, TestSessions } from '../../mocks/anthropic/sessions';
import { envelopeOf, rejectionOf, REQUEST_ID, SurfaceHarness, startSurface } from '../../mocks/anthropic/surface-harness';
import {
  initFrame, MESSAGE_START, resultFrame, streamEvent, syntheticError, TEXT_START, textDelta
} from '../../mocks/anthropic/turn-frames';
import { recordedTurn } from '../../mocks/upstream/recorded-turns';
import { loadRecording } from '../../mocks/upstream/recordings';
import { createScriptedRunner, ScriptedRunner } from '../../mocks/upstream/scripted-runner';
import { waitFor } from '../../mocks/shared/wait-for';

/** Four capped calls, the first measuring 2 + 627 + 0 input tokens. */
const CAPPED = 'cli-probes/t1-max-output-100.jsonl';

const isInterrupt = (line: unknown): boolean =>
  (line as { type?: string; request?: { subtype?: string } }).type === 'control_request' &&
  (line as { request: { subtype?: string } }).request.subtype === 'interrupt';

const countRequest: Anthropic.MessageCountTokensParams = {
  model: 'fable', messages: [{ role: 'user', content: 'Write about tangerines.' }]
};

describe('count_tokens: the measurement', () => {
  let surface: SurfaceHarness;
  let runner: ReplayRunner;
  let state: TestSessions;

  beforeEach(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    runner = createReplayRunner([loadRecording(CAPPED)], { timeScale: 0 });
    state = memorySessions();
    surface = await startSurface({ runner, stateDirectory: STATE, sessions: state.sessions });
  });

  afterEach(async () => {
    await surface.close();
  });

  it("answers the first message_delta's input count plus both cache counters", async () => {
    const { data, request_id } = await surface.client().messages.countTokens(countRequest).withResponse();

    expect(data).toEqual({ input_tokens: 629 });
    expect(request_id).toMatch(REQUEST_ID);
  });

  it('runs upstream capped at one output token, persisting no session', async () => {
    await surface.client().messages.countTokens(countRequest);

    const spec = runner.started[0]?.spec;
    expect(spec?.env['CLAUDE_CODE_MAX_OUTPUT_TOKENS']).toBe('1');
    expect(spec?.flags).toContain('--no-session-persistence');
  });

  it('interrupts the run at once, and records or forgets no session', async () => {
    await surface.client().messages.countTokens(countRequest);

    await waitFor(() => runner.started[0]?.input.some(isInterrupt) === true);
    expect(state.recorded).toEqual([]);
    expect(state.forgotten).toEqual([]);
  });

  it('answers the beta countTokens too', async () => {
    expect(await surface.client().beta.messages.countTokens(countRequest)).toEqual({ input_tokens: 629 });
  });
});

describe('count_tokens: what is measured', () => {
  let surface: SurfaceHarness | undefined;
  let state: TestSessions;

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    state = memorySessions();
  });

  afterEach(async () => {
    await surface?.close();
    surface = undefined;
  });

  async function countWith(recording: Recording, body: Anthropic.MessageCountTokensParams) {
    const runner = createReplayRunner([recording], { timeScale: 0 });
    surface = await startSurface({ runner, stateDirectory: STATE, sessions: state.sessions });
    return { count: await surface.client().messages.countTokens(body), started: runner.started };
  }

  it('sums all three input counters (recorded: 2 + 3867 + 531)', async () => {
    const { count } = await countWith(recordedTurn('cli-probes/o-pass-through-run1.jsonl', 1), countRequest);

    expect(count).toEqual({ input_tokens: 4400 });
  });

  it('mounts the client tools through the bridge server, so their definitions are counted', async () => {
    const { count, started } = await countWith(clientToolRecording(SINGLE_CALL), {
      model: 'claude-fable-5-1',
      messages: [{ role: 'user', content: 'What is the weather in Paris?' }],
      tools: [GET_WEATHER as Anthropic.Tool]
    });

    expect(count).toEqual({ input_tokens: 4836 });
    const flags = started[0]?.spec.flags ?? [];
    expect(flags[flags.indexOf('--allowedTools') + 1]).toBe('mcp__client__get_weather');
    expect(started[0]?.spec.mcp)
      .toEqual({ url: expect.stringMatching(/^http:\/\/127\.0\.0\.1:\d+\//), token: expect.any(String) });
  });

  it('renders the history as a replayed turn, even when a Messages turn would continue a session', async () => {
    const history = [
      { role: 'user' as const, content: [{ type: 'text' as const, text: 'Name a fruit.' }] },
      { role: 'assistant' as const, content: [{ type: 'text' as const, text: 'Tangerine.' }] }
    ];
    state.sessions.record('session-earlier', fingerprint(history));
    expect(state.sessions.lookup(fingerprint(history))).toBe('session-earlier');

    const { started } = await countWith(loadRecording(CAPPED), {
      model: 'fable', messages: [...history, { role: 'user', content: 'Another one?' }]
    });

    expect(started[0]?.spec.flags).not.toContain('--resume');
    const sent = started[0]?.input[0] as { message: { content: { text?: string }[] } };
    expect(sent.message.content[0]?.text).toContain('<conversation_history>');
    expect(state.forgotten).toEqual([]);
  });
});

describe('count_tokens: the first message_delta ends the run', () => {
  let surface: SurfaceHarness;
  let runner: ScriptedRunner;

  beforeEach(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    runner = createScriptedRunner();
    surface = await startSurface({ runner, stateDirectory: STATE });
  });

  afterEach(async () => {
    await surface.close();
  });

  it('answers at it and interrupts the run before upstream has ended the call', async () => {
    const counted = surface.client().messages.countTokens(countRequest);
    const { process } = await runner.nextRun();
    await waitFor(() => process.writtenLines().length >= 1);

    process.frames(initFrame(), streamEvent(MESSAGE_START), streamEvent(TEXT_START), streamEvent(textDelta('A')),
      streamEvent({ type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null },
        usage: { input_tokens: 10, cache_creation_input_tokens: 5, cache_read_input_tokens: 20, output_tokens: 1 } }));

    expect(await counted).toEqual({ input_tokens: 35 });
    await waitFor(() => process.writtenLines().some(isInterrupt));
    process.frames(resultFrame({ subtype: 'error_during_execution', is_error: true }));
    await waitFor(() => process.inputEnded());
    process.exit(0);
  });
});

const recording = (...frames: Frame[]) => parseRecording(frames.map(frame => JSON.stringify(frame)).join('\n'));

/** Upstream's error prose, then the failed `result`. */
const apiFailure = (category: string, text: string, status: number | null) => recording(initFrame(),
  syntheticError(category, text), resultFrame({ is_error: true, result: text, api_error_status: status }));

const exitBeforeResult = () => parseRecording([
  { t_ms: 0, dir: 'host->cli', frame: '{"type":"user"}' },
  { t_ms: 1, dir: 'cli->host', frame: JSON.stringify(initFrame()) },
  { t_ms: 2, dir: 'proc', frame: '[exit code=143 signal=null]' }
].map(entry => JSON.stringify(entry)).join('\n'));

describe('count_tokens: failures before the measurement, as on Messages', () => {
  let surface: SurfaceHarness;

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await surface.close();
  });

  it.each([
    ['an API 400', () => apiFailure('invalid_request', 'API Error: 400 Prompt is too long', 400),
      400, 'invalid_request_error', 'Prompt is too long', 'false'],
    ['a model upstream cannot use', () => apiFailure('model_not_found', 'There is an issue with the model.', 404),
      404, 'not_found_error', 'model: fable', 'false'],
    ['a rate limit', () => apiFailure('rate_limit', 'API Error: 429 Rate limited', 429),
      429, 'rate_limit_error', 'Rate limited', null],
    ['an overload', () => apiFailure('overloaded', 'API Error: 529 Overloaded', 529),
      529, 'overloaded_error', 'Overloaded', null],
    ['a billing problem of the upstream login', () => apiFailure('billing_error', 'Credit balance too low', null),
      500, 'api_error', expect.stringMatching(/^The upstream Claude Code account has a billing problem/), 'false'],
    ['upstream exiting before its result', exitBeforeResult, 500, 'api_error', 'upstream exited with code 143', null],
    ['a startup check failing', () => recording(initFrame({ model: 'claude-opus-5-5' })),
      500, 'api_error', expect.stringContaining('claude-opus-5-5'), 'false']
  ])('%s', async (_name, run, status, type, message, shouldRetry) => {
    surface = await startSurface({ runner: createReplayRunner([run()], { timeScale: 0 }), stateDirectory: STATE });

    const error = await rejectionOf(surface.client().messages.countTokens(countRequest));

    expect(error.status).toBe(status);
    expect(envelopeOf(error).error).toEqual({ type, message });
    expect(envelopeOf(error).request_id).toMatch(REQUEST_ID);
    expect(error.headers?.get('x-should-retry') ?? null).toBe(shouldRetry);
  });
});

describe('count_tokens: request validation before any run', () => {
  let surface: SurfaceHarness;

  beforeEach(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    // Its runner refuses every run: a validation failure must answer before one is started.
    surface = await startSurface({ stateDirectory: STATE });
  });

  afterEach(async () => {
    await surface.close();
  });

  const FORCED = 'tool_choice: type "tool" and "any" are not supported for this model.';

  it.each([
    ['tool_choice any', { tool_choice: { type: 'any' } }, FORCED],
    ['tool_choice tool', { tool_choice: { type: 'tool', name: 'get_weather' } }, FORCED],
    ['a Messages-only field', { max_tokens: 1024 }, 'max_tokens: Extra inputs are not permitted']
  ])('rejects %s with 400 invalid_request_error', async (_name, fields, message) => {
    const body = { ...countRequest, tools: [GET_WEATHER as Anthropic.Tool], ...fields } as Anthropic.MessageCountTokensParams;

    const error = await rejectionOf(surface.client().messages.countTokens(body));

    expect(error).toBeInstanceOf(Anthropic.BadRequestError);
    expect(envelopeOf(error).error).toEqual({ type: 'invalid_request_error', message });
    expect(error.headers?.get('x-should-retry')).toBe('false');
  });

  it('answers an unknown model with 404 not_found_error', async () => {
    const error = await rejectionOf(surface.client().messages.countTokens({ ...countRequest, model: 'claude-unknown' }));

    expect(error).toBeInstanceOf(Anthropic.NotFoundError);
    expect(envelopeOf(error).error).toEqual({ type: 'not_found_error', message: 'model: claude-unknown' });
  });

  it('requires anthropic-version, as Messages does', async () => {
    const error = await rejectionOf(
      surface.client().messages.countTokens(countRequest, { headers: { 'anthropic-version': null } })
    );

    expect(envelopeOf(error).error).toEqual({ type: 'invalid_request_error', message: 'anthropic-version: header is required' });
  });
});
