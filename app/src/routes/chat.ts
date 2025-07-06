/**
 * Phase 16A: Chat completions route - OpenAI API compatibility without tool execution
 */

import { Router, Request, Response } from 'express';
import { getLogger } from '../utils/logger';
import { ParameterValidator } from '../validation/validator';
import { ChatCompletionRequest } from '../models/chat';
import { claudeClient } from '../claude/client';
import { MessageAdapter } from '../message/adapter';

const logger = getLogger('ChatRoute');
const router = Router();

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

    // Phase 16A: Reject tool requests with helpful message
    if (request.tools || request.tool_choice) {
      res.status(400).json({
        error: {
          message: 'Tool execution is not supported. This API provides OpenAI-compatible chat completions only. Tools should be executed client-side and results included in message content.',
          type: 'invalid_request_error',
          code: 'tools_not_supported'
        }
      });
      return;
    }

    // Convert OpenAI messages to Claude format
    const claudeMessages = MessageAdapter.convertToClaudeFormat(request.messages);

    if (request.stream) {
      // Handle streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      try {
        const streamGenerator = claudeClient.sendMessageStream(claudeMessages, {
          model: request.model,
          temperature: request.temperature,
          max_tokens: request.max_tokens
        });

        for await (const chunk of streamGenerator) {
          const sseData = MessageAdapter.convertStreamingToOpenAIFormat(
            chunk.content,
            request.model
          );
          res.write(sseData);
        }

        // Send final chunk
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
    } else {
      // Handle non-streaming response
      const claudeResponse = await claudeClient.sendMessage(claudeMessages, {
        model: request.model,
        temperature: request.temperature,
        max_tokens: request.max_tokens
      });

      const openaiResponse = MessageAdapter.convertToOpenAIFormat(
        claudeResponse.content,
        request.model
      );

      res.json(openaiResponse);
    }

  } catch (error) {
    logger.error('Chat completion error:', error);
    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Internal server error',
        type: 'api_error',
        code: 'internal_error'
      }
    });
  }
});

export default router;