/**
 * Chat completions route - OpenAI API compatibility
 */

import { Router, Request, Response } from 'express';
import { getLogger } from '../utils/logger';
import { ParameterValidator } from '../validation/validator';
import { ChatCompletionRequest } from '../models/chat';
import { claudeService } from '../claude/service';
import { MessageAdapter } from '../message/adapter';

const logger = getLogger('ChatRoute');
const router = Router();

/**
 * Handle non-streaming response
 */
async function handleNonStreamingResponse(
  req: Request,
  res: Response,
  request: ChatCompletionRequest
): Promise<void> {
  try {
    // Get Claude's response
    const claudeResponse = await claudeService.createChatCompletion(request);

    // Convert response to OpenAI format
    const openaiResponse = MessageAdapter.convertToOpenAIFormat(
      claudeResponse.content,
      request.model
    );

    res.json(openaiResponse);

  } catch (error) {
    logger.error('Non-streaming response error:', error);
    throw error;
  }
}

/**
 * Handle streaming response
 */
async function handleStreamingResponse(
  req: Request,
  res: Response,
  request: ChatCompletionRequest
): Promise<void> {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const streamGenerator = claudeService.createStreamingChatCompletion(request);

    for await (const chunk of streamGenerator) {
      const sseData = MessageAdapter.convertStreamingToOpenAIFormat(
        chunk.delta || chunk.content,
        request.model,
        chunk.finished
      );
      res.write(sseData);
    }

    const finalChunk = MessageAdapter.convertStreamingToOpenAIFormat('', request.model, true);
    res.write(finalChunk);
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    logger.error('Streaming error:', error);
    res.write(`data: ${JSON.stringify({
      error: {
        message: 'Streaming error occurred',
        type: 'api_error'
      }
    })}\n\n`);
    res.end();
  }
}

/**
 * POST /v1/chat/completions
 * OpenAI-compatible chat completions endpoint
 */
router.post('/completions', async (req: Request, res: Response): Promise<void> => {
  try {
    const request: ChatCompletionRequest = req.body;
    
    // Validate request
    const validation = ParameterValidator.validateRequest(request);
    if (!validation.valid) {
      res.status(400).json({
        error: {
          message: validation.errors.join('; '),
          type: 'invalid_request_error',
          code: 'invalid_request'
        }
      });
      return;
    }

    if (request.stream) {
      // Handle streaming response
      await handleStreamingResponse(req, res, request);
    } else {
      // Handle non-streaming response
      await handleNonStreamingResponse(req, res, request);
    }

  } catch (error) {
    logger.error('Chat completion error:', error);
    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : String(error),
        type: 'api_error',
        code: 'internal_error'
      }
    });
  }
});

export default router;