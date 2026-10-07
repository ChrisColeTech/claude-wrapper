import request from 'supertest';
import { createServer } from '../../../src/api/server';
import { ClaudeCliError } from '../../../src/utils/errors';

// Byte-for-byte regressions: the OpenAI surface's error bodies, auth and model listing are
// what they were before the Anthropic surface was added. Literals were captured from that code.
jest.mock('../../../src/core/wrapper', () => {
  const mockHandleChatCompletion = jest.fn();
  return {
    CoreWrapper: jest.fn().mockImplementation(() => ({ handleChatCompletion: mockHandleChatCompletion })),
    mockHandleChatCompletion
  };
});
const { mockHandleChatCompletion } = jest.requireMock('../../../src/core/wrapper');

const KEY = 'wrapper-key-0123456789abcdef';
const CHAT_BODY = { model: 'sonnet', messages: [{ role: 'user', content: 'hi' }] };
const MODELS =
  '{"object":"list","data":[{"id":"sonnet","object":"model","owned_by":"anthropic","created":1709164800},' +
  '{"id":"opus","object":"model","owned_by":"anthropic","created":1709164800}]}';

describe('OpenAI surface unchanged by the Anthropic surface', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    delete process.env['API_KEY'];
  });

  describe('error bodies', () => {
    it('renders malformed JSON as before', async () => {
      const response = await request(createServer())
        .post('/v1/chat/completions').set('Content-Type', 'application/json').send('{"model": ').expect(400);

      expect(response.text).toBe('{"error":{"message":"Invalid JSON format","type":"invalid_request_error","code":"parse_error"}}');
      expect(response.headers['request-id']).toBeUndefined();
    });

    it('renders a wrapper validation error as before', async () => {
      const response = await request(createServer()).post('/v1/chat/completions').send({}).expect(400);

      expect(response.text).toBe(
        '{"error":{"message":"Invalid request format: model and messages are required","type":"api_error","code":"INVALID_REQUEST"}}'
      );
    });

    it('renders a wrapper 5xx error as before', async () => {
      mockHandleChatCompletion.mockRejectedValue(new ClaudeCliError('Claude CLI failed'));

      const response = await request(createServer()).post('/v1/chat/completions').send(CHAT_BODY).expect(503);

      expect(response.text).toBe('{"error":{"message":"Claude CLI failed","type":"api_error","code":"CLAUDE_CLI_ERROR"}}');
    });

    it('renders an unexpected error as before', async () => {
      mockHandleChatCompletion.mockRejectedValue(new Error('boom'));

      const response = await request(createServer()).post('/v1/chat/completions').send(CHAT_BODY).expect(500);

      expect(response.text).toBe('{"error":{"message":"Internal server error","type":"api_error","code":"internal_error"}}');
    });

    it('keeps the 100 kB body limit (over it is the generic 500, as before)', async () => {
      const big = { ...CHAT_BODY, messages: [{ role: 'user', content: 'a'.repeat(200 * 1024) }] };

      const response = await request(createServer()).post('/v1/chat/completions').send(big).expect(500);

      expect(response.text).toBe('{"error":{"message":"Internal server error","type":"api_error","code":"internal_error"}}');
    });

    it('leaves unknown paths to the default 404', async () => {
      const response = await request(createServer()).get('/v1/nonexistent').expect(404);

      expect(response.headers['content-type']).toMatch(/^text\/html/);
      expect(response.headers['request-id']).toBeUndefined();
    });
  });

  describe('auth with API_KEY set', () => {
    beforeEach(() => {
      process.env['API_KEY'] = KEY;
    });

    it('rejects a missing Authorization header as before', async () => {
      const response = await request(createServer()).get('/v1/models').expect(401);

      expect(response.text).toBe(
        '{"error":{"message":"Missing Authorization header. Include \\"Authorization: Bearer <token>\\" in your request.",' +
        '"type":"authentication_error","code":"missing_token"}}'
      );
    });

    it('stays Bearer-only: x-api-key alone is still a missing token', async () => {
      const response = await request(createServer()).get('/v1/models').set('x-api-key', KEY).expect(401);

      expect(response.body.error.code).toBe('missing_token');
    });

    it('rejects a wrong Bearer token as before', async () => {
      const response = await request(createServer()).get('/v1/models').set('Authorization', 'Bearer wrong').expect(401);

      expect(response.text).toBe(
        '{"error":{"message":"Invalid bearer token. Check your API key.","type":"authentication_error","code":"invalid_token"}}'
      );
    });

    it('accepts the right Bearer token', async () => {
      await request(createServer()).get('/v1/models').set('Authorization', `Bearer ${KEY}`).expect(200);
    });
  });

  describe('/v1/models without anthropic-version', () => {
    it('lists the same models in the same shape', async () => {
      const response = await request(createServer()).get('/v1/models').expect(200);

      expect(response.text).toBe(MODELS);
      expect(response.headers['request-id']).toBeUndefined();
    });
  });
});
