import Anthropic from '@anthropic-ai/sdk';
import { ClaudeCliError } from '../../../src/utils/errors';
import { REQUEST_ID, SurfaceHarness, envelopeOf, rejectionOf, startSurface } from '../../mocks/anthropic/surface-harness';

// The OpenAI chat route throws the wrapper's own error classes; with `anthropic-version` set the
// request is Anthropic-tagged, so whatever it throws must come back in the Anthropic envelope.
jest.mock('../../../src/core/wrapper', () => {
  const mockHandleChatCompletion = jest.fn();
  return {
    CoreWrapper: jest.fn().mockImplementation(() => ({ handleChatCompletion: mockHandleChatCompletion })),
    mockHandleChatCompletion
  };
});
const { mockHandleChatCompletion } = jest.requireMock('../../../src/core/wrapper');

const CHAT_BODY = { model: 'sonnet', messages: [{ role: 'user', content: 'hi' }] };

describe('Anthropic surface: stray wrapper errors', () => {
  let surface: SurfaceHarness;

  beforeEach(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    surface = await startSurface();
  });

  afterEach(async () => {
    await surface.close();
  });

  it('maps a 4xx wrapper error to invalid_request_error with that status', async () => {
    const error = await rejectionOf(surface.client().post('/v1/chat/completions', { body: {} }));

    expect(error).toBeInstanceOf(Anthropic.BadRequestError);
    expect(error.requestID).toMatch(REQUEST_ID);
    expect(envelopeOf(error)).toEqual({
      type: 'error',
      error: { type: 'invalid_request_error', message: 'Invalid request format: model and messages are required' },
      request_id: error.requestID
    });
    expect(error.headers?.get('x-should-retry')).toBe('false');
  });

  it('maps a 5xx wrapper error to 500 api_error, leaving retries to the SDK', async () => {
    mockHandleChatCompletion.mockRejectedValue(new ClaudeCliError('Claude CLI failed'));

    const error = await rejectionOf(surface.client().post('/v1/chat/completions', { body: CHAT_BODY }));

    expect(error).toBeInstanceOf(Anthropic.InternalServerError);
    expect(error.status).toBe(500);
    expect(envelopeOf(error).error).toEqual({ type: 'api_error', message: 'Claude CLI failed' });
    expect(error.headers?.get('x-should-retry')).toBeNull();
  });

  it('maps an unexpected error to 500 api_error without its internals', async () => {
    mockHandleChatCompletion.mockRejectedValue(new Error('secret internal detail'));

    const error = await rejectionOf(surface.client().post('/v1/chat/completions', { body: CHAT_BODY }));

    expect(error).toBeInstanceOf(Anthropic.InternalServerError);
    expect(envelopeOf(error).error).toEqual({ type: 'api_error', message: 'Internal server error' });
  });
});
