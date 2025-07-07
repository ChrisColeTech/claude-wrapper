import { Router, Request, Response } from 'express';
import { CoreWrapper } from '../../core/wrapper';
import { OpenAIRequest } from '../../types';
import { InvalidRequestError } from '../../utils/errors';
import { asyncHandler } from '../middleware/error';
import { logger } from '../../utils/logger';

const router = Router();
const coreWrapper = new CoreWrapper();

router.post('/v1/chat/completions', asyncHandler(async (req: Request, res: Response) => {
  logger.info('Chat completion request received', {
    body: req.body,
    headers: req.headers
  });

  const request: OpenAIRequest = req.body;
  
  if (!request.model || !request.messages || !Array.isArray(request.messages)) {
    throw new InvalidRequestError('Invalid request format: model and messages are required');
  }

  if (request.messages.length === 0) {
    throw new InvalidRequestError('Messages array cannot be empty');
  }

  // Validate message format
  for (const message of request.messages) {
    if (!message.role || !['system', 'user', 'assistant', 'tool'].includes(message.role)) {
      throw new InvalidRequestError('Invalid message role. Must be one of: system, user, assistant, tool');
    }
    if (message.content === undefined || message.content === null) {
      throw new InvalidRequestError('Message content is required');
    }
  }

  const response = await coreWrapper.handleChatCompletion(request);
  
  logger.info('Chat completion request completed successfully', {
    requestId: response.id,
    model: response.model
  });

  res.json(response);
}));

export default router;