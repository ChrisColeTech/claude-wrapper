/**
 * Phase 4: Chat completions route - OpenAI API compatibility with tool execution
 */

import { Router, Request, Response } from 'express';
import { getLogger } from '../utils/logger';
import { ParameterValidator } from '../validation/validator';
import { ChatCompletionRequest } from '../models/chat';
import { claudeService } from '../claude/service';
import { MessageAdapter } from '../message/adapter';
import { ToolCallDetector } from '../tools/protocol/tool-call-detector';
import { ToolCallGenerator } from '../tools/protocol/tool-call-generator';
import { StreamingToolCalls } from '../tools/protocol/streaming-tool-calls';
import { OpenAIFormatter } from '../tools/protocol/openai-formatter';

const logger = getLogger('ChatRoute');
const router = Router();

// Initialize tool protocol components
const toolCallDetector = new ToolCallDetector();
const toolCallGenerator = new ToolCallGenerator();
const streamingToolCalls = new StreamingToolCalls();
const openaiFormatter = new OpenAIFormatter();

/**
 * Handle non-streaming response with tool support
 */
async function handleNonStreamingResponse(
  req: Request,
  res: Response,
  request: ChatCompletionRequest,
  hasTools: boolean
): Promise<void> {
  try {
    // Get Claude's response
    const claudeResponse = await claudeService.createChatCompletion(request);

    // Check if Claude's response indicates tool usage and we have tools available
    if (hasTools && request.tools) {
      const detection = toolCallDetector.detectToolCalls(
        claudeResponse.content,
        request.tools
      );

      if (detection.needsTools) {
        // Generate tool calls for the client to execute
        const generation = toolCallGenerator.generateFromDetection(
          detection,
          request.tools
        );

        if (generation.allValid && generation.toolCalls.length > 0) {
          // Format response with tool calls
          const choice = openaiFormatter.formatChatCompletionWithToolCalls(
            generation.toolCalls,
            request.model,
            claudeResponse.content
          );

          const response = {
            id: `chatcmpl-${Date.now().toString(36)}`,
            object: 'chat.completion' as const,
            created: Math.floor(Date.now() / 1000),
            model: request.model,
            choices: [choice],
            usage: {
              prompt_tokens: claudeResponse.metadata.prompt_tokens || 0,
              completion_tokens: claudeResponse.metadata.completion_tokens || 0,
              total_tokens: claudeResponse.metadata.total_tokens || 0
            }
          };

          res.json(response);
          return;
        }
      }
    }

    // Standard response without tool calls
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
 * Handle streaming response with tool support
 */
async function handleStreamingResponse(
  req: Request,
  res: Response,
  request: ChatCompletionRequest,
  hasTools: boolean
): Promise<void> {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const streamGenerator = claudeService.createStreamingChatCompletion(request);
    let accumulatedContent = '';

    // Collect the full response first for tool detection
    const chunks: any[] = [];
    for await (const chunk of streamGenerator) {
      chunks.push(chunk);
      accumulatedContent += chunk.delta || chunk.content || '';
    }

    // Check for tool usage if tools are available
    if (hasTools && request.tools && accumulatedContent) {
      const detection = toolCallDetector.detectToolCalls(
        accumulatedContent,
        request.tools
      );

      if (detection.needsTools) {
        const generation = toolCallGenerator.generateFromDetection(
          detection,
          request.tools
        );

        if (generation.allValid && generation.toolCalls.length > 0) {
          // Stream the tool calls
          const toolCallStream = streamingToolCalls.streamMixedContent(
            accumulatedContent,
            generation.toolCalls,
            request.model
          );

          for await (const chunk of toolCallStream) {
            const sseData = `data: ${JSON.stringify(chunk)}\n\n`;
            res.write(sseData);
          }

          res.write('data: [DONE]\n\n');
          res.end();
          return;
        }
      }
    }

    // Standard streaming without tool calls
    for (const chunk of chunks) {
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

    // Phase 4: Process tool requests
    const hasTools = request.tools && request.tools.length > 0;
    const hasToolMessages = request.messages.some(msg => msg.role === 'tool');
    
    if (hasTools || hasToolMessages) {
      logger.debug('Processing request with tools', { 
        toolCount: request.tools?.length || 0,
        hasToolMessages 
      });
    }

    if (request.stream) {
      // Handle streaming response with tool support
      await handleStreamingResponse(req, res, request, hasTools || false);
    } else {
      // Handle non-streaming response with tool support
      await handleNonStreamingResponse(req, res, request, hasTools || false);
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