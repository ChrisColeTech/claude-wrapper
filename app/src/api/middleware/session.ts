/**
 * Session-aware request middleware
 * Handles session management for chat completion requests
 * Follows middleware pattern for Express.js
 */

import { Request, Response, NextFunction } from 'express';
import { sessionManager } from '../../session/manager';
import { OpenAIRequest } from '../../types';
import { logger } from '../../utils/logger';

/**
 * Extended Request interface to include session information
 */
interface SessionRequest extends Request {
  sessionId?: string | null;
  sessionData?: {
    isSessionRequest: boolean;
    sessionId: string | null;
    originalMessages: any[];
    allMessages: any[];
  };
}

/**
 * Session middleware for handling session-aware requests
 * Processes session_id parameter and manages session state
 */
export function sessionMiddleware(
  req: SessionRequest, 
  res: Response, 
  next: NextFunction
): void {
  try {
    const request: OpenAIRequest & { session_id?: string } = req.body || {};
    
    // Check if this is a session-aware request
    const sessionId = request.session_id || null;
    const isSessionRequest = sessionId !== null && sessionId !== undefined;
    
    logger.debug('Session middleware processing request', {
      sessionId,
      isSessionRequest,
      messageCount: request.messages?.length
    });

    if (isSessionRequest) {
      // Process messages with session continuity
      const originalMessages = request.messages || [];
      const [allMessages, actualSessionId] = sessionManager.processMessages(originalMessages, sessionId);
      
      // Store session data in request for later use
      req.sessionData = {
        isSessionRequest: true,
        sessionId: actualSessionId,
        originalMessages,
        allMessages
      };
      
      // Update request body with session-aware messages
      req.body.messages = allMessages;
      
      logger.info('Session-aware request processed', {
        sessionId: actualSessionId,
        originalMessageCount: originalMessages.length,
        totalMessageCount: allMessages.length
      });
    } else {
      // Stateless request - no session processing
      req.sessionData = {
        isSessionRequest: false,
        sessionId: null,
        originalMessages: request.messages || [],
        allMessages: request.messages || []
      };
      
      logger.debug('Stateless request processed');
    }

    next();
  } catch (error) {
    logger.error('Session middleware error', undefined, { error });
    
    res.status(500).json({
      error: {
        message: 'Session processing failed',
        type: 'session_error',
        code: '500',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
}

/**
 * Response interceptor middleware to handle session-aware responses
 * Adds assistant responses back to session after successful completion
 */
export function sessionResponseMiddleware(
  req: SessionRequest,
  res: Response,
  next: NextFunction
): void {
  // Store original res.json method
  const originalJson = res.json.bind(res);
  
  // Override res.json to intercept successful responses
  res.json = function(body: any): Response {
    try {
      // Check if we have session data and a successful chat completion response
      if (req.sessionData?.isSessionRequest && 
          req.sessionData.sessionId && 
          body?.choices?.[0]?.message) {
        
        const assistantMessage = body.choices[0].message;
        
        // Add assistant response to session
        sessionManager.addAssistantResponse(req.sessionData.sessionId, assistantMessage);
        
        logger.debug('Assistant response added to session', {
          sessionId: req.sessionData.sessionId,
          messageContent: assistantMessage.content?.substring(0, 100) + '...'
        });
      }
    } catch (error) {
      logger.warn('Failed to add assistant response to session', { error });
      // Don't fail the request if session update fails
    }
    
    // Call original json method
    return originalJson(body);
  };
  
  next();
}

/**
 * Combined session middleware that handles both request and response processing
 */
export function sessionProcessingMiddleware(
  req: SessionRequest,
  res: Response, 
  next: NextFunction
): void {
  // Apply session request middleware
  sessionMiddleware(req, res, (err) => {
    if (err) {
      return next(err);
    }
    
    // Apply session response middleware
    sessionResponseMiddleware(req, res, next);
  });
}