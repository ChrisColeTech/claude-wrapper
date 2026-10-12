import { randomUUID } from 'crypto';
import { Request, Response, Router } from 'express';
import { CoreWrapper } from '../../core/wrapper';
import { ICoreWrapper, OpenAIMessage, OpenAIRequest, OpenAIResponse } from '../../types';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { anthropicError } from '../anthropic';

type AnthropicRole = 'user' | 'assistant';

interface AnthropicTextBlock {
  type: 'text';
  text: string;
}

interface AnthropicMessage {
  role: AnthropicRole;
  content: string | AnthropicTextBlock[];
}

interface AnthropicRequest {
  model: string;
  max_tokens: number;
  messages: AnthropicMessage[];
  system?: string | AnthropicTextBlock[];
  stream?: boolean;
  tools?: unknown[];
  stop_sequences?: unknown[];
  thinking?: unknown;
  output_config?: unknown;
  temperature?: unknown;
  tool_choice?: unknown;
  top_p?: unknown;
  top_k?: unknown;
}

interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicTextBlock[];
  model: string;
  stop_reason: 'end_turn' | 'max_tokens';
  stop_sequence: null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

const SUPPORTED_VERSION = '2023-06-01';
const SUPPORTED_MODELS = new Set(['sonnet', 'opus']);

function invalidRequest(message: string): never {
  throw new AppError(message, 400, 'invalid_request_error');
}

function textContent(content: unknown, field: string): string {
  if (typeof content === 'string') {
    if (content.length === 0) {
      return invalidRequest(`${field} must not be empty`);
    }
    return content;
  }

  if (!Array.isArray(content) || content.length === 0) {
    return invalidRequest(`${field} must be a string or a non-empty array of text blocks`);
  }

  return content.map((block, index) => {
    if (
      typeof block !== 'object' ||
      block === null ||
      (block as { type?: unknown }).type !== 'text' ||
      typeof (block as { text?: unknown }).text !== 'string'
    ) {
      return invalidRequest(`${field}[${index}] must be a text block`);
    }
    const text = (block as AnthropicTextBlock).text;
    if (text.length === 0) {
      return invalidRequest(`${field}[${index}].text must not be empty`);
    }
    return text;
  }).join('');
}

function parseRequest(body: unknown, version: string | undefined): AnthropicRequest {
  if (version !== SUPPORTED_VERSION) {
    invalidRequest(`anthropic-version must be ${SUPPORTED_VERSION}`);
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    invalidRequest('Request body must be a JSON object');
  }

  const request = body as Partial<AnthropicRequest>;
  if (typeof request.model !== 'string' || !SUPPORTED_MODELS.has(request.model)) {
    invalidRequest('model must be one of: sonnet, opus');
  }
  if (!Number.isInteger(request.max_tokens) || (request.max_tokens as number) <= 0) {
    invalidRequest('max_tokens must be a positive integer');
  }
  if (!Array.isArray(request.messages) || request.messages.length === 0) {
    invalidRequest('messages must be a non-empty array');
  }
  if (request.stream !== undefined && typeof request.stream !== 'boolean') {
    invalidRequest('stream must be a boolean');
  }
  if (request.tools !== undefined) {
    invalidRequest('tools are not supported by the minimal Anthropic endpoint');
  }
  if (request.stop_sequences !== undefined) {
    invalidRequest('stop_sequences are not supported by the minimal Anthropic endpoint');
  }
  if (
    request.thinking !== undefined ||
    request.output_config !== undefined ||
    request.temperature !== undefined ||
    request.tool_choice !== undefined ||
    request.top_p !== undefined ||
    request.top_k !== undefined
  ) {
    invalidRequest('generation controls are not supported by the minimal Anthropic endpoint');
  }

  request.messages.forEach((message, index) => {
    if (typeof message !== 'object' || message === null) {
      invalidRequest(`messages[${index}] must be an object`);
    }
    if (message.role !== 'user' && message.role !== 'assistant') {
      invalidRequest(`messages[${index}].role must be user or assistant`);
    }
    textContent(message.content, `messages[${index}].content`);
  });
  if (request.system !== undefined) {
    textContent(request.system, 'system');
  }

  return request as AnthropicRequest;
}

function toOpenAIRequest(request: AnthropicRequest): OpenAIRequest {
  const messages: OpenAIMessage[] = [];
  if (request.system !== undefined) {
    messages.push({ role: 'system', content: textContent(request.system, 'system') });
  }
  messages.push(...request.messages.map((message, index) => ({
    role: message.role,
    content: textContent(message.content, `messages[${index}].content`)
  })));

  return {
    model: request.model,
    messages,
    max_tokens: request.max_tokens
  };
}

function toAnthropicResponse(response: OpenAIResponse, model: string, messageId?: string): AnthropicResponse {
  const choice = response.choices[0];
  if (!choice || typeof choice.message.content !== 'string') {
    throw new AppError('Claude returned an unsupported response', 502, 'api_error');
  }
  const content = choice.message.content;

  return {
    id: messageId || `msg_${randomUUID().replace(/-/g, '')}`,
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: content }],
    model,
    stop_reason: choice.finish_reason === 'length' ? 'max_tokens' : 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: response.usage.prompt_tokens,
      output_tokens: response.usage.completion_tokens
    }
  };
}

function writeEvent(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function startStream(res: Response, messageId: string, model: string): void {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  writeEvent(res, 'message_start', {
    type: 'message_start',
    message: {
      id: messageId,
      type: 'message',
      role: 'assistant',
      content: [],
      model,
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 }
    }
  });
}

function finishStream(res: Response, response: AnthropicResponse): void {
  writeEvent(res, 'content_block_start', {
    type: 'content_block_start',
    index: 0,
    content_block: { type: 'text', text: '' }
  });
  writeEvent(res, 'content_block_delta', {
    type: 'content_block_delta',
    index: 0,
    delta: { type: 'text_delta', text: response.content[0]?.text || '' }
  });
  writeEvent(res, 'content_block_stop', { type: 'content_block_stop', index: 0 });
  writeEvent(res, 'message_delta', {
    type: 'message_delta',
    delta: { stop_reason: response.stop_reason, stop_sequence: null },
    usage: { output_tokens: response.usage.output_tokens }
  });
  writeEvent(res, 'message_stop', { type: 'message_stop' });
  res.end();
}

function streamError(res: Response): void {
  writeEvent(res, 'error', anthropicError('api_error', 'Internal server error'));
  res.end();
}

function sendError(res: Response, error: unknown): void {
  const status = error instanceof AppError ? error.statusCode : 500;
  const type = error instanceof AppError ? error.code : 'api_error';
  const message = error instanceof AppError ? error.message : 'Internal server error';
  res.status(status).json(anthropicError(type, message));
}

export function createAnthropicMessagesRouter(
  createCoreWrapper: () => ICoreWrapper = () => new CoreWrapper()
): Router {
  const router = Router();

  router.post('/v1/messages', async (req: Request, res: Response) => {
    try {
      const request = parseRequest(req.body, req.get('anthropic-version'));
      logger.info('Anthropic message request received', {
        model: request.model,
        messageCount: request.messages.length,
        isStreaming: request.stream === true
      });

      const coreWrapper = createCoreWrapper();
      if (request.stream) {
        const messageId = `msg_${randomUUID().replace(/-/g, '')}`;
        startStream(res, messageId, request.model);
        try {
          const openAIResponse = await coreWrapper.handleChatCompletion(toOpenAIRequest(request));
          finishStream(res, toAnthropicResponse(openAIResponse, request.model, messageId));
        } catch (error) {
          logger.error('Anthropic streaming request failed', error instanceof Error ? error : undefined);
          streamError(res);
        }
      } else {
        const openAIResponse = await coreWrapper.handleChatCompletion(toOpenAIRequest(request));
        res.json(toAnthropicResponse(openAIResponse, request.model));
      }
    } catch (error) {
      if (error instanceof AppError && error.statusCode < 500) {
        logger.warn('Anthropic message request rejected', { message: error.message });
      } else {
        logger.error('Anthropic message request failed', error instanceof Error ? error : undefined);
      }
      sendError(res, error);
    }
  });

  return router;
}
