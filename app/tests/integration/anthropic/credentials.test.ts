import Anthropic from '@anthropic-ai/sdk';
import { REQUEST_ID, SurfaceHarness, envelopeOf, rejectionOf, startSurface } from '../../mocks/anthropic/surface-harness';

const KEY = 'wrapper-key-0123456789abcdef';

// `models.list()` is the probe: it is Anthropic-tagged by its header and succeeds once past the gate.
describe('Anthropic surface: client credentials', () => {
  let surface: SurfaceHarness;

  beforeEach(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    surface = await startSurface();
  });

  afterEach(async () => {
    delete process.env['API_KEY'];
    await surface.close();
  });

  describe('with API_KEY set', () => {
    beforeEach(() => {
      process.env['API_KEY'] = KEY;
    });

    it('accepts the key in x-api-key', async () => {
      await expect(surface.client({ apiKey: KEY }).models.list()).resolves.toBeDefined();
    });

    it('accepts the key as Authorization: Bearer', async () => {
      await expect(surface.client({ apiKey: null, authToken: KEY }).models.list()).resolves.toBeDefined();
    });

    it('rejects a wrong key with AuthenticationError in the Anthropic envelope', async () => {
      const error = await rejectionOf(surface.client({ apiKey: 'not-the-key' }).models.list());

      expect(error).toBeInstanceOf(Anthropic.AuthenticationError);
      expect(error.type).toBe('authentication_error');
      expect(error.requestID).toMatch(REQUEST_ID);
      expect(envelopeOf(error)).toEqual({
        type: 'error',
        error: { type: 'authentication_error', message: 'Invalid API key.' },
        request_id: error.requestID
      });
      expect(error.headers?.get('x-should-retry')).toBe('false');
    });

    it('rejects a wrong Bearer token with AuthenticationError', async () => {
      const error = await rejectionOf(surface.client({ apiKey: null, authToken: 'not-the-key' }).models.list());

      expect(error).toBeInstanceOf(Anthropic.AuthenticationError);
    });

    it('rejects a request carrying no credential with AuthenticationError', async () => {
      const error = await rejectionOf(surface.client().models.list({}, { headers: { 'x-api-key': null } }));

      expect(error).toBeInstanceOf(Anthropic.AuthenticationError);
      expect(envelopeOf(error).error.message).toContain('x-api-key');
    });

    it('checks the key before routing under /v1/messages', async () => {
      const error = await rejectionOf(surface.client({ apiKey: 'not-the-key' }).messages.batches.list());

      expect(error).toBeInstanceOf(Anthropic.AuthenticationError);
    });
  });

  describe('without API_KEY', () => {
    it('is open to any client', async () => {
      await expect(surface.client({ apiKey: 'anything' }).models.list()).resolves.toBeDefined();
    });
  });
});
