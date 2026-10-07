/**
 * The upstream failure table through the official SDK (spec section 13, ADR 0005): one test per
 * row, each a replayed run that fails before commit, asserting the error class the SDK raises,
 * the status, `error.type`, the message and `x-should-retry`. Then the retry-steering headers:
 * `retry-after` from a rejected `rate_limit_event`, and never an `anthropic-ratelimit-*` header.
 */
import Anthropic from '@anthropic-ai/sdk';
import { createReplayRunner, parseRecording } from '../../../src/upstream/runner';
import { Frame } from '../../../src/upstream/frames';
import { STATE } from '../../mocks/anthropic/plan-context';
import { envelopeOf, rejectionOf, SurfaceHarness, startSurface } from '../../mocks/anthropic/surface-harness';
import { initFrame, rateLimitEvent, resultFrame, syntheticError } from '../../mocks/anthropic/turn-frames';
import { createFakeClock } from '../../mocks/shared/fake-clock';
import { recordedFrames } from '../../mocks/upstream/recordings';

const request = (model = 'claude-fable-5-1') => ({
  model, max_tokens: 256, messages: [{ role: 'user' as const, content: 'Say hi.' }]
});
const recording = (...frames: Frame[]) => parseRecording(frames.map(frame => JSON.stringify(frame)).join('\n'));
/** A run that answers with upstream's error prose, then the failed `result`. */
const apiFailure = (category: string, text: string, result: object = {}) => recording(initFrame(),
  syntheticError(category, text), resultFrame({ is_error: true, result: text, api_error_status: null, ...result }));

/** An SDK error class (the subclasses' constructors differ from the base's, so only `instanceof` is shared). */
/** The recorded `--bare` run on a subscription login, without its leading UI frame (one user gate). */
const notLoggedIn = () => recording(...recordedFrames('cli-probes/p4-bare.jsonl').filter(frame => frame.type !== 'unknown'));

type SdkError = abstract new (...args: never[]) => InstanceType<typeof Anthropic.APIError>;
interface Row {
  run: () => ReturnType<typeof parseRecording>;
  /** The request's model, when the recording ran another than Fable. */
  model?: string;
  sdkClass: SdkError;
  status: number;
  type: string;
  message: string | RegExp;
  shouldRetry: 'false' | null;
}

const LOGIN = /^The upstream Claude Code login failed \(.+\)\. The wrapper's operator must fix it; your API key and request are not the cause\.$/;
const BILLING = /^The upstream Claude Code account has a billing problem \(.+\)\. The wrapper's operator must fix it; your API key and request are not the cause\.$/;
const GATE = 'Third-party apps now draw from extra usage, not plan limits.';

const ROWS: [string, Row][] = [
  ['api_error_status 400, category invalid_request', {
    run: () => apiFailure('unknown', 'API Error: 400 Unable to download the file.', { api_error_status: 400 }),
    sdkClass: Anthropic.BadRequestError, status: 400, type: 'invalid_request_error',
    message: 'Unable to download the file.', shouldRetry: 'false' }],
  ['api_error_status 404, category model_not_found', {
    run: () => apiFailure('model_not_found', "There's an issue with the selected model.", { api_error_status: 404 }),
    sdkClass: Anthropic.NotFoundError, status: 404, type: 'not_found_error', message: 'model: claude-fable-5-1',
    shouldRetry: 'false' }],
  ['api_error_status 413', {
    run: () => apiFailure('unknown', 'API Error: 413 Request too large', { api_error_status: 413 }),
    sdkClass: Anthropic.APIError, status: 413, type: 'request_too_large', message: 'Request too large',
    shouldRetry: 'false' }],
  ['other 4xx api_error_status', {
    run: () => apiFailure('unknown', 'API Error: 409 Conflict', { api_error_status: 409 }),
    sdkClass: Anthropic.ConflictError, status: 409, type: 'invalid_request_error', message: 'Conflict',
    shouldRetry: 'false' }],
  ['the billing-gate 400', {
    run: () => apiFailure('unknown', `API Error: 400 ${GATE}`, { api_error_status: 400 }),
    sdkClass: Anthropic.BadRequestError, status: 400, type: 'invalid_request_error', message: GATE,
    shouldRetry: 'false' }],
  ['category rate_limit, api_error_status 429', {
    run: () => apiFailure('rate_limit', 'API Error: 429 Rate limited', { api_error_status: 429 }),
    sdkClass: Anthropic.RateLimitError, status: 429, type: 'rate_limit_error', message: 'Rate limited', shouldRetry: null }],
  ['category overloaded, api_error_status 529', {
    run: () => apiFailure('overloaded', 'API Error: 529 Overloaded', { api_error_status: 529 }),
    sdkClass: Anthropic.InternalServerError, status: 529, type: 'overloaded_error', message: 'Overloaded',
    shouldRetry: null }],
  ['category server_error, other 5xx', {
    run: () => apiFailure('server_error', 'API Error: 503 Service unavailable', { api_error_status: 503 }),
    sdkClass: Anthropic.InternalServerError, status: 500, type: 'api_error', message: 'Service unavailable',
    shouldRetry: null }],
  ['api_error_status 504', {
    run: () => apiFailure('unknown', 'API Error: 504 Gateway timeout', { api_error_status: 504 }),
    sdkClass: Anthropic.InternalServerError, status: 504, type: 'timeout_error', message: 'Gateway timeout',
    shouldRetry: null }],
  ['operator-side login: the recorded "Not logged in" run', {
    run: () => notLoggedIn(), model: 'claude-opus-5-5',
    sdkClass: Anthropic.InternalServerError, status: 500, type: 'api_error', message: LOGIN, shouldRetry: 'false' }],
  ['operator-side billing: category billing_error', {
    run: () => apiFailure('billing_error', 'Credit balance too low'),
    sdkClass: Anthropic.InternalServerError, status: 500, type: 'api_error', message: BILLING, shouldRetry: 'false' }],
  ['category max_output_tokens', {
    run: () => apiFailure('max_output_tokens', 'API Error: Claude\'s response exceeded the 100 output token maximum.'),
    sdkClass: Anthropic.InternalServerError, status: 500, type: 'api_error',
    message: 'API Error: Claude\'s response exceeded the 100 output token maximum.', shouldRetry: 'false' }],
  ['category unknown without api_error_status', {
    run: () => apiFailure('unknown', 'API Error: Connection error.'),
    sdkClass: Anthropic.InternalServerError, status: 500, type: 'api_error', message: 'API Error: Connection error.',
    shouldRetry: null }],
  ['result.subtype error_max_budget_usd', {
    run: () => recording(initFrame(), resultFrame({ subtype: 'error_max_budget_usd', is_error: true, result: undefined,
      errors: ['Reached maximum budget ($0.25)'] })),
    sdkClass: Anthropic.InternalServerError, status: 500, type: 'api_error', message: 'Reached maximum budget ($0.25)',
    shouldRetry: 'false' }],
  ['process exit with no result', {
    run: () => parseRecording([{ t_ms: 0, dir: 'host->cli', frame: '{"type":"user"}' },
      { t_ms: 1, dir: 'cli->host', frame: JSON.stringify(initFrame()) },
      { t_ms: 2, dir: 'proc', frame: '[exit code=143 signal=null]' }].map(entry => JSON.stringify(entry)).join('\n')),
    sdkClass: Anthropic.InternalServerError, status: 500, type: 'api_error', message: 'upstream exited with code 143',
    shouldRetry: null }]
];

describe('Anthropic surface: the upstream failure table through the SDK', () => {
  let surface: SurfaceHarness;

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await surface.close();
  });

  it.each(ROWS)('%s', async (_name, row) => {
    surface = await startSurface({ runner: createReplayRunner([row.run()], { timeScale: 0 }), stateDirectory: STATE });

    const error = await rejectionOf(surface.client().messages.create(request(row.model)));

    expect(error).toBeInstanceOf(row.sdkClass);
    expect(error.status).toBe(row.status);
    expect(envelopeOf(error).error.type).toBe(row.type);
    expect(envelopeOf(error).error.message).toEqual(typeof row.message === 'string' ? row.message : expect.stringMatching(row.message));
    expect(error.headers?.get('x-should-retry') ?? null).toBe(row.shouldRetry);
  });

  it('names the model the client asked for on a 404, alias included', async () => {
    const run = recording(initFrame({ model: 'claude-opus-5-5' }), syntheticError('model_not_found', 'CLI prose'),
      resultFrame({ is_error: true, result: 'CLI prose', api_error_status: 404 }));
    surface = await startSurface({ runner: createReplayRunner([run], { timeScale: 0 }), stateDirectory: STATE });

    const error = await rejectionOf(surface.client().messages.stream(request('opus')).finalMessage());

    expect(error).toBeInstanceOf(Anthropic.NotFoundError);
    expect(envelopeOf(error).error.message).toBe('model: opus');
  });

  describe('retry-steering headers on a 429', () => {
    const nowMs = 1_791_000_000_000;
    const limited = (status: string) => recording(initFrame(), rateLimitEvent(status, nowMs / 1000 + 90),
      syntheticError('rate_limit', 'API Error: 429 Rate limited'),
      resultFrame({ is_error: true, result: 'API Error: 429 Rate limited', api_error_status: 429 }));

    async function rateLimited(status: string) {
      surface = await startSurface({ runner: createReplayRunner([limited(status)], { timeScale: 0 }),
        clock: createFakeClock(nowMs), stateDirectory: STATE });
      return rejectionOf(surface.client().messages.create(request()));
    }

    it('carries retry-after, the seconds until resetsAt, when the last rate_limit_event was rejected', async () => {
      const error = await rateLimited('rejected');

      expect(error).toBeInstanceOf(Anthropic.RateLimitError);
      expect(error.headers?.get('retry-after')).toBe('90');
    });

    it('omits retry-after otherwise, and never sends anthropic-ratelimit-* headers', async () => {
      const error = await rateLimited('allowed_warning');

      expect(error.headers?.get('retry-after')).toBeNull();
      expect([...(error.headers?.keys() ?? [])].filter(name => name.startsWith('anthropic-ratelimit-'))).toEqual([]);
    });
  });
});
