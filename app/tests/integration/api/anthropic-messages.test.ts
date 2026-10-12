import request from 'supertest';
import { createServer } from '../../../src/api/server';

jest.mock('../../../src/core/wrapper', () => {
  const mockHandleChatCompletion = jest.fn();
  return {
    CoreWrapper: jest.fn().mockImplementation(() => ({
      handleChatCompletion: mockHandleChatCompletion
    })),
    mockHandleChatCompletion
  };
});

const { mockHandleChatCompletion } = jest.requireMock('../../../src/core/wrapper');
const createAnthropicCoreWrapper = jest.fn();
const app = createServer({ createAnthropicCoreWrapper });
const baseRequest = {
  model: 'sonnet',
  max_tokens: 256,
  messages: [{ role: 'user', content: 'Hello' }]
};
const openAIResponse = {
  id: 'chatcmpl-test',
  object: 'chat.completion',
  created: 1700000000,
  model: 'sonnet',
  choices: [{
    index: 0,
    message: { role: 'assistant', content: 'Hello from Claude' },
    finish_reason: 'stop'
  }],
  usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 }
};

describe('Anthropic Messages API', () => {
  const originalApiKey = process.env['API_KEY'];

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env['API_KEY'];
    createAnthropicCoreWrapper.mockReturnValue({
      handleChatCompletion: mockHandleChatCompletion
    });
    mockHandleChatCompletion.mockResolvedValue(openAIResponse);
  });

  afterAll(() => {
    if (originalApiKey === undefined) {
      delete process.env['API_KEY'];
    } else {
      process.env['API_KEY'] = originalApiKey;
    }
  });

  it('translates text requests and responses', async () => {
    const response = await request(app)
      .post('/v1/messages')
      .set('anthropic-version', '2023-06-01')
      .send({
        ...baseRequest,
        system: [{ type: 'text', text: 'Be concise.' }],
        messages: [{
          role: 'user',
          content: [{ type: 'text', text: 'Hello' }, { type: 'text', text: ' world' }]
        }]
      })
      .expect(200);

    expect(mockHandleChatCompletion).toHaveBeenCalledWith({
      model: 'sonnet',
      max_tokens: 256,
      messages: [
        { role: 'system', content: 'Be concise.' },
        { role: 'user', content: 'Hello world' }
      ]
    });
    expect(response.body).toEqual({
      id: expect.stringMatching(/^msg_/),
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'Hello from Claude' }],
      model: 'sonnet',
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 12, output_tokens: 4 }
    });
  });

  it('returns Anthropic SSE events for streaming requests', async () => {
    const response = await request(app)
      .post('/v1/messages')
      .set('anthropic-version', '2023-06-01')
      .send({ ...baseRequest, stream: true })
      .expect(200)
      .expect('Content-Type', /text\/event-stream/);

    expect(response.text).toContain('event: message_start');
    expect(response.text).toContain('event: content_block_delta');
    expect(response.text).toContain('"text":"Hello from Claude"');
    expect(response.text).toContain('event: message_stop');
  });

  it('opens streams before execution and returns an SSE error on failure', async () => {
    mockHandleChatCompletion.mockRejectedValue(new Error('CLI failed'));

    const response = await request(app)
      .post('/v1/messages')
      .set('anthropic-version', '2023-06-01')
      .send({ ...baseRequest, stream: true })
      .expect(200);

    expect(response.text).toContain('event: message_start');
    expect(response.text).toContain('event: error');
    expect(response.text).not.toContain('CLI failed');
  });

  it('uses a fresh wrapper for every stateless request', async () => {
    await request(app)
      .post('/v1/messages')
      .set('anthropic-version', '2023-06-01')
      .send(baseRequest)
      .expect(200);
    await request(app)
      .post('/v1/messages')
      .set('anthropic-version', '2023-06-01')
      .send(baseRequest)
      .expect(200);

    expect(createAnthropicCoreWrapper).toHaveBeenCalledTimes(2);
  });

  it('accepts the native x-api-key header', async () => {
    process.env['API_KEY'] = 'anthropic-test-key';

    await request(app)
      .post('/v1/messages')
      .set('anthropic-version', '2023-06-01')
      .set('x-api-key', 'anthropic-test-key')
      .send(baseRequest)
      .expect(200);
  });

  it('returns an Anthropic authentication error for an invalid API key', async () => {
    process.env['API_KEY'] = 'anthropic-test-key';

    const response = await request(app)
      .post('/v1/messages')
      .set('anthropic-version', '2023-06-01')
      .set('x-api-key', 'wrong-key')
      .send(baseRequest)
      .expect(401);

    expect(response.body).toEqual(expect.objectContaining({
      type: 'error',
      error: { type: 'authentication_error', message: 'Invalid API key.' },
      request_id: expect.stringMatching(/^req_/)
    }));
  });

  it('requires the supported Anthropic version', async () => {
    const response = await request(app)
      .post('/v1/messages')
      .send(baseRequest)
      .expect(400);

    expect(response.body).toEqual(expect.objectContaining({
      type: 'error',
      error: expect.objectContaining({ type: 'invalid_request_error' })
    }));
    expect(mockHandleChatCompletion).not.toHaveBeenCalled();
  });

  it('rejects unsupported tools before invoking Claude', async () => {
    const response = await request(app)
      .post('/v1/messages')
      .set('anthropic-version', '2023-06-01')
      .send({ ...baseRequest, tools: [{ name: 'weather' }] })
      .expect(400);

    expect(response.body.error.message).toContain('tools are not supported');
    expect(mockHandleChatCompletion).not.toHaveBeenCalled();
  });

  it.each([
    ['unknown model', { model: 'sonnet; echo unsafe' }],
    ['non-boolean streaming', { stream: 'false' }],
    ['generation controls', { temperature: 0.5 }],
    ['empty text', { messages: [{ role: 'user', content: '' }] }]
  ])('rejects %s before invoking Claude', async (_name, override) => {
    await request(app)
      .post('/v1/messages')
      .set('anthropic-version', '2023-06-01')
      .send({ ...baseRequest, ...override })
      .expect(400);

    expect(mockHandleChatCompletion).not.toHaveBeenCalled();
  });

  it('uses the Anthropic error envelope for malformed JSON', async () => {
    const response = await request(app)
      .post('/v1/messages')
      .set('anthropic-version', '2023-06-01')
      .set('Content-Type', 'application/json')
      .send('{invalid')
      .expect(400);

    expect(response.body).toEqual(expect.objectContaining({
      type: 'error',
      error: { type: 'invalid_request_error', message: 'Invalid JSON format' },
      request_id: expect.stringMatching(/^req_/)
    }));
  });

  it('applies Anthropic authentication and privacy behavior to case-variant paths', async () => {
    process.env['API_KEY'] = 'anthropic-test-key';

    await request(app)
      .post('/V1/MESSAGES')
      .set('anthropic-version', '2023-06-01')
      .set('x-api-key', 'anthropic-test-key')
      .send(baseRequest)
      .expect(200);
  });
});
