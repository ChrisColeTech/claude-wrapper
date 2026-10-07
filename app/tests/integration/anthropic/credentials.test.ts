import Anthropic from '@anthropic-ai/sdk';
import * as http from 'http';
import { REQUEST_ID, SurfaceHarness, envelopeOf, rejectionOf, startSurface } from '../../mocks/anthropic/surface-harness';

const KEY = 'wrapper-key-0123456789abcdef';
const MB = 1024 * 1024;
/** Longer than the surface takes to answer a request it does not read, far shorter than sending megabytes. */
const ANSWER_WAIT_MS = 1_500;

interface RawAnswer {
  status: number | undefined;
  headers: http.IncomingHttpHeaders;
  body: unknown;
}

/**
 * Starts a `POST /v1/messages` with no credential whose `content-length` announces `length` bytes,
 * and sends only its first few: the surface can answer only if it does not read the body. Resolves
 * with the answer, or `'no answer'` when none came in time.
 */
function answerBeforeTheBody(baseURL: string, length: number): Promise<RawAnswer | 'no answer'> {
  return new Promise((resolve, reject) => {
    const req = http.request(`${baseURL}/v1/messages`, { method: 'POST', headers: {
      'content-type': 'application/json', 'anthropic-version': '2023-06-01', 'content-length': String(length)
    } });
    const settle = (answer: RawAnswer | 'no answer') => {
      clearTimeout(timer);
      req.on('error', () => undefined); // the rest of the body is never sent
      req.destroy();
      resolve(answer);
    };
    const timer = setTimeout(() => settle('no answer'), ANSWER_WAIT_MS);
    req.on('response', res => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => settle({ status: res.statusCode, headers: res.headers, body: JSON.parse(text) }));
    });
    req.on('error', reject);
    req.write('{"model": "fable", "max_tokens": 16, "messages": [{"role": "user", "content": "');
  });
}

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

    it.each([
      ['a 20 MB body, which the parser would wait for', 20 * MB],
      ['a body over 32 MB, which the parser would refuse with a 413', 40 * MB]
    ])('answers 401 without reading the body: %s', async (_name, length) => {
      const answer = await answerBeforeTheBody(surface.baseURL, length);

      expect(answer).not.toBe('no answer');
      const { status, headers, body } = answer as RawAnswer;
      expect(status).toBe(401);
      expect(body).toEqual({
        type: 'error',
        error: { type: 'authentication_error', message: expect.stringContaining('x-api-key') },
        request_id: expect.stringMatching(REQUEST_ID)
      });
      expect(headers['request-id']).toBe((body as { request_id: string }).request_id);
      expect(headers['x-should-retry']).toBe('false');
    });
  });

  describe('without API_KEY', () => {
    it('is open to any client', async () => {
      await expect(surface.client({ apiKey: 'anything' }).models.list()).resolves.toBeDefined();
    });
  });
});
