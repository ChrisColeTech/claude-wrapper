import Anthropic from '@anthropic-ai/sdk';
import { REQUEST_ID, SurfaceHarness, envelopeOf, rejectionOf, startSurface } from '../../mocks/anthropic/surface-harness';

const MB = 1024 * 1024;

/** A messages body whose JSON is a little over `bytes` long. */
function bodyOfSize(bytes: number) {
  return { model: 'claude-sonnet-4-5', max_tokens: 16, messages: [{ role: 'user' as const, content: 'a'.repeat(bytes) }] };
}

describe('Anthropic surface: request body', () => {
  let surface: SurfaceHarness;

  beforeEach(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    surface = await startSurface();
  });

  afterEach(async () => {
    await surface.close();
  });

  it('rejects invalid JSON with BadRequestError in the Anthropic envelope', async () => {
    const error = await rejectionOf(
      surface.client().post('/v1/messages', { body: '{"model": ', headers: { 'content-type': 'application/json' } })
    );

    expect(error).toBeInstanceOf(Anthropic.BadRequestError);
    expect(error.type).toBe('invalid_request_error');
    expect(error.requestID).toMatch(REQUEST_ID);
    expect(envelopeOf(error).request_id).toBe(error.requestID);
    expect(error.headers?.get('x-should-retry')).toBe('false');
  });

  it('rejects a body sent with a non-JSON content type with BadRequestError', async () => {
    const error = await rejectionOf(
      surface.client().post('/v1/messages', { body: 'hello', headers: { 'content-type': 'text/plain' } })
    );

    expect(error).toBeInstanceOf(Anthropic.BadRequestError);
    expect(envelopeOf(error).error.message).toContain('application/json');
  });

  it('rejects a body sent without a content type with BadRequestError', async () => {
    const error = await rejectionOf(
      surface.client().post('/v1/messages', { body: new TextEncoder().encode('{}') })
    );

    expect(error).toBeInstanceOf(Anthropic.BadRequestError);
    expect(envelopeOf(error).error.message).toContain('application/json');
  });

  it('accepts a JSON body just under 32 MB', async () => {
    const error = await rejectionOf(surface.client().post('/v1/messages/batches', { body: bodyOfSize(31 * MB) }));

    // Past the body parser, the unknown path answers 404.
    expect(error).toBeInstanceOf(Anthropic.NotFoundError);
  });

  it('rejects a body over 32 MB with 413 request_too_large', async () => {
    const error = await rejectionOf(surface.client().messages.create(bodyOfSize(33 * MB)));

    expect(error).toBeInstanceOf(Anthropic.APIError);
    expect(error.status).toBe(413);
    expect(error.type).toBe('request_too_large');
    expect(error.requestID).toMatch(REQUEST_ID);
    expect(error.headers?.get('x-should-retry')).toBe('false');
  });
});
