import Anthropic from '@anthropic-ai/sdk';
import { REQUEST_ID, SurfaceHarness, envelopeOf, rejectionOf, startSurface } from '../../mocks/anthropic/surface-harness';

const NOT_FOUND = 'The requested resource could not be found.';

describe('Anthropic surface: routing under /v1/messages', () => {
  let surface: SurfaceHarness;

  beforeEach(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    surface = await startSurface();
  });

  afterEach(async () => {
    await surface.close();
  });

  describe('unknown paths and methods', () => {
    it('answers an unknown path with NotFoundError in the Anthropic envelope', async () => {
      const error = await rejectionOf(surface.client().messages.batches.list());

      expect(error).toBeInstanceOf(Anthropic.NotFoundError);
      expect(error.type).toBe('not_found_error');
      expect(error.requestID).toMatch(REQUEST_ID);
      expect(error.error).toEqual({
        type: 'error',
        error: { type: 'not_found_error', message: NOT_FOUND },
        request_id: error.requestID
      });
      expect(error.headers?.get('x-should-retry')).toBe('false');
    });

    it('answers an unserved method on /v1/messages with NotFoundError', async () => {
      const error = await rejectionOf(surface.client().get('/v1/messages'));

      expect(error).toBeInstanceOf(Anthropic.NotFoundError);
      expect(envelopeOf(error).error.message).toBe(NOT_FOUND);
    });

    it.each([['no', null], ['an unknown', '2024-01-01']])(
      'answers an unknown path or method with NotFoundError whatever the version header says (%s version)',
      async (_label, version) => {
        const options = { headers: { 'anthropic-version': version } };

        for (const request of [surface.client().messages.batches.list({}, options), surface.client().get('/v1/messages', options)]) {
          const error = await rejectionOf(request);
          expect(error).toBeInstanceOf(Anthropic.NotFoundError);
          expect(envelopeOf(error).error).toEqual({ type: 'not_found_error', message: NOT_FOUND });
        }
      }
    );
  });

  describe('anthropic-version', () => {
    const create = (client: Anthropic, version: string | null) =>
      client.messages.create(
        { model: 'claude-sonnet-4-5', max_tokens: 16, messages: [{ role: 'user', content: 'hi' }] },
        { headers: { 'anthropic-version': version } }
      );

    it('rejects a request without the header with BadRequestError naming it', async () => {
      const error = await rejectionOf(create(surface.client(), null));

      expect(error).toBeInstanceOf(Anthropic.BadRequestError);
      expect(error.type).toBe('invalid_request_error');
      expect(envelopeOf(error).error.message).toBe('anthropic-version: header is required');
      expect(error.requestID).toMatch(REQUEST_ID);
      expect(error.headers?.get('x-should-retry')).toBe('false');
    });

    it('rejects an unknown version with BadRequestError quoting the value', async () => {
      const error = await rejectionOf(create(surface.client(), '2024-01-01'));

      expect(error).toBeInstanceOf(Anthropic.BadRequestError);
      expect(error.type).toBe('invalid_request_error');
      expect(envelopeOf(error).error.message).toContain('"2024-01-01"');
    });

    it.each(['2023-06-01', '2023-01-01'])('lets %s through to routing', async (version) => {
      const error = await rejectionOf(
        surface.client().messages.batches.list({}, { headers: { 'anthropic-version': version } })
      );

      expect(error).toBeInstanceOf(Anthropic.NotFoundError);
    });
  });
});
