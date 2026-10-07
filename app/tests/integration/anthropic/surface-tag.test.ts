import request from 'supertest';
import { createServer } from '../../../src/api/server';
import { logger } from '../../../src/utils/logger';
import { REQUEST_ID, SurfaceHarness, startSurface } from '../../mocks/anthropic/surface-harness';

describe('Anthropic surface: the surface tag and request ids', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    delete process.env['DEBUG_MODE'];
  });

  it('tags a request carrying anthropic-version, whatever its path', async () => {
    const response = await request(createServer()).get('/health').set('anthropic-version', '2023-06-01').expect(200);

    expect(response.headers['request-id']).toMatch(REQUEST_ID);
    expect(response.body.status).toBe('healthy');
  });

  it('tags a path under /v1/messages without the header and answers in the Anthropic envelope', async () => {
    const response = await request(createServer()).post('/v1/messages/count_tokens').send({}).expect(400);

    expect(response.headers['request-id']).toMatch(REQUEST_ID);
    expect(response.body).toEqual({
      type: 'error',
      error: { type: 'invalid_request_error', message: 'anthropic-version: header is required' },
      request_id: response.headers['request-id']
    });
  });

  it.each(['/health', '/v1/models', '/v1/messagesx'])('leaves %s without the header on the OpenAI surface', async (path) => {
    const response = await request(createServer()).get(path);

    expect(response.headers['request-id']).toBeUndefined();
  });

  it('mints a fresh id for every request', async () => {
    const app = createServer();
    const first = await request(app).get('/health').set('anthropic-version', '2023-06-01');
    const second = await request(app).get('/health').set('anthropic-version', '2023-06-01');

    expect(first.headers['request-id']).not.toBe(second.headers['request-id']);
  });

  it('mints the id in debug mode too', async () => {
    process.env['DEBUG_MODE'] = 'true';

    const response = await request(createServer()).post('/v1/messages').send({}).expect(400);

    expect(response.headers['request-id']).toMatch(REQUEST_ID);
    expect(response.body.request_id).toBe(response.headers['request-id']);
  });

  it('logs the request id with the request', async () => {
    const info = jest.spyOn(logger, 'info');

    const response = await request(createServer()).get('/health').set('anthropic-version', '2023-06-01');

    expect(info).toHaveBeenCalledWith(
      'Anthropic surface request',
      expect.objectContaining({ requestId: response.headers['request-id'], method: 'GET', url: '/health' })
    );
  });

  describe('anthropic-beta', () => {
    let surface: SurfaceHarness;

    beforeEach(async () => {
      surface = await startSurface();
    });

    afterEach(async () => {
      await surface.close();
    });

    it('accepts any beta name and logs the values at debug', async () => {
      const debug = jest.spyOn(logger, 'debug');

      const page = await surface.client().beta.models.list({ betas: ['made-up-2099-01-01', 'mcp-client-2025-11-20'] });

      expect(page).toBeDefined();
      expect(debug).toHaveBeenCalledWith('anthropic-beta accepted', {
        requestId: expect.stringMatching(REQUEST_ID),
        betas: ['made-up-2099-01-01', 'mcp-client-2025-11-20']
      });
    });
  });
});
