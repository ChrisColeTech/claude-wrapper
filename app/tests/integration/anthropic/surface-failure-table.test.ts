/**
 * The surface-side failure table through the official SDK (spec section 13), one test per row:
 * the error class the SDK raises, the status, `error.type` and `x-should-retry`. The rows of a
 * run the runner ended itself (a CLI that cannot be started, a timer firing) are this ticket's;
 * the others are checked here as the section's whole checklist. The run-cap and rate-limit
 * admission rows belong to the scheduler (process lifecycle ticket).
 */
import Anthropic from '@anthropic-ai/sdk';
import { STATE } from '../../mocks/anthropic/plan-context';
import { envelopeOf, rejectionOf, SurfaceHarness, startSurface } from '../../mocks/anthropic/surface-harness';
import { createFakeClock, FakeClock } from '../../mocks/shared/fake-clock';
import { createScriptedRunner, ScriptedRunner } from '../../mocks/upstream/scripted-runner';

type ApiError = InstanceType<typeof Anthropic.APIError>;
type SdkError = abstract new (...args: never[]) => ApiError;

const KEY = 'sk-wrapper-key';
const request = (fields: object = {}) => ({
  model: 'claude-fable-5-1', max_tokens: 256, messages: [{ role: 'user' as const, content: 'Say hi.' }], ...fields
});

describe('Anthropic surface: the surface-side failure table through the SDK', () => {
  let surface: SurfaceHarness;
  let runner: ScriptedRunner;
  let clock: FakeClock;

  /** Asserts one row: SDK class, HTTP status, `error.type`, and `x-should-retry` (null: the SDK's default). */
  function expectRow(error: ApiError, sdkClass: SdkError, status: number, type: string, shouldRetry: 'false' | null): void {
    expect(error).toBeInstanceOf(sdkClass);
    expect(error.status).toBe(status);
    expect(envelopeOf(error).error.type).toBe(type);
    expect(error.headers?.get('x-should-retry') ?? null).toBe(shouldRetry);
  }

  beforeEach(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    clock = createFakeClock();
    runner = createScriptedRunner(clock);
    surface = await startSurface({ runner, clock, stateDirectory: STATE });
  });

  afterEach(async () => {
    delete process.env['API_KEY'];
    await surface.close();
  });

  it('invalid JSON body: 400 invalid_request_error', async () => {
    const error = await rejectionOf(surface.client().post('/v1/messages',
      { body: '{"model": ', headers: { 'content-type': 'application/json' } }));

    expectRow(error, Anthropic.BadRequestError, 400, 'invalid_request_error', 'false');
  });

  it('missing or wrong content type: 400 invalid_request_error', async () => {
    const error = await rejectionOf(surface.client().post('/v1/messages',
      { body: 'hello', headers: { 'content-type': 'text/plain' } }));

    expectRow(error, Anthropic.BadRequestError, 400, 'invalid_request_error', 'false');
  });

  it('body over 32 MB: 413 request_too_large', async () => {
    const error = await rejectionOf(surface.client().messages.create(request({
      messages: [{ role: 'user', content: 'a'.repeat(33 * 1024 * 1024) }] })));

    expectRow(error, Anthropic.APIError, 413, 'request_too_large', 'false');
  });

  it('missing or unknown anthropic-version: 400 invalid_request_error', async () => {
    const error = await rejectionOf(surface.client().messages.create(request(),
      { headers: { 'anthropic-version': '1999-01-01' } }));

    expectRow(error, Anthropic.BadRequestError, 400, 'invalid_request_error', 'false');
  });

  it('client key missing or wrong (API_KEY set): 401 authentication_error', async () => {
    process.env['API_KEY'] = KEY;

    const error = await rejectionOf(surface.client({ apiKey: 'not-the-key' }).messages.create(request()));

    expectRow(error, Anthropic.AuthenticationError, 401, 'authentication_error', 'false');
  });

  it('request validation: 400 invalid_request_error', async () => {
    const error = await rejectionOf(surface.client().messages.create(request({ messages: [] })));

    expectRow(error, Anthropic.BadRequestError, 400, 'invalid_request_error', 'false');
  });

  it('unknown model: 404 not_found_error naming it', async () => {
    const error = await rejectionOf(surface.client().messages.create(request({ model: 'claude-nonesuch' })));

    expectRow(error, Anthropic.NotFoundError, 404, 'not_found_error', 'false');
    expect(envelopeOf(error).error.message).toBe('model: claude-nonesuch');
  });

  it('unknown path or method under /v1/messages: 404 not_found_error', async () => {
    const error = await rejectionOf(surface.client().get('/v1/messages/nonesuch'));

    expectRow(error, Anthropic.NotFoundError, 404, 'not_found_error', 'false');
    expect(envelopeOf(error).error.message).toBe('The requested resource could not be found.');
  });

  it('CLI binary missing or unspawnable: 500 api_error, not retried', async () => {
    const created = rejectionOf(surface.client().messages.create(request()));
    const { process: upstream } = await runner.nextRun();

    upstream.fail(new Error('spawn claude ENOENT'));
    upstream.exit(null, null);
    const error = await created;

    expectRow(error, Anthropic.InternalServerError, 500, 'api_error', 'false');
    expect(envelopeOf(error).error.message).toBe('upstream could not be started');
  });

  it('pre-commit timer firing: 504 timeout_error', async () => {
    const created = rejectionOf(surface.client().messages.create(request()));
    const { process: upstream } = await runner.nextRun();

    clock.advance(20_000);
    const error = await created;

    expectRow(error, Anthropic.InternalServerError, 504, 'timeout_error', null);
    upstream.exit(null, 'SIGTERM');
  });

  it.todo('run cap or wrapper shutdown: 529 overloaded_error (the scheduler, process lifecycle ticket)');
  it.todo('rate-limit admission after a rejected rate_limit_event: 429 rate_limit_error with retry-after (the scheduler)');
});
