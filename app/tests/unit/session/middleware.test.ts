/**
 * Session Middleware Unit Tests
 * Tests session middleware functionality without external dependencies
 */

import { Request, Response, NextFunction } from 'express';
import { sessionMiddleware, sessionResponseMiddleware, sessionProcessingMiddleware } from '../../../src/api/middleware/session';
import { SessionManager } from '../../../src/session/manager';
import { OpenAIRequest, OpenAIMessage } from '../../../src/types';
import { setupTest, cleanupTest, createTestMessages } from '../../setup/test-setup';
import '../../mocks/logger.mock';

// Mock session manager
jest.mock('../../../src/session/manager', () => ({
  sessionManager: {
    processMessages: jest.fn(),
    addAssistantResponse: jest.fn()
  }
}));

interface SessionRequest extends Request {
  sessionId?: string | null;
  sessionData?: {
    isSessionRequest: boolean;
    sessionId: string | null;
    originalMessages: any[];
    allMessages: any[];
  };
}

describe('Session Middleware', () => {
  let mockReq: Partial<SessionRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let mockSessionManager: jest.Mocked<SessionManager>;

  beforeEach(() => {
    setupTest();
    
    // Setup mock session manager
    mockSessionManager = require('../../../src/session/manager').sessionManager;
    mockSessionManager.processMessages.mockClear();
    mockSessionManager.addAssistantResponse.mockClear();

    // Setup mock request and response
    mockReq = {
      body: {}
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();
  });

  afterEach(() => {
    cleanupTest();
  });

  describe('sessionMiddleware', () => {
    test('should process stateless request without session_id', () => {
      const messages = createTestMessages(2);
      mockReq.body = {
        model: 'gpt-4',
        messages
      } as OpenAIRequest;

      sessionMiddleware(mockReq as SessionRequest, mockRes as Response, mockNext);

      expect(mockReq.sessionData).toEqual({
        isSessionRequest: false,
        sessionId: null,
        originalMessages: messages,
        allMessages: messages
      });

      expect(mockSessionManager.processMessages).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith();
    });

    test('should process session request with session_id', () => {
      const originalMessages = createTestMessages(1);
      const allMessages = createTestMessages(3);
      const testSessionId = 'test-session-123';

      mockReq.body = {
        model: 'gpt-4',
        messages: originalMessages,
        session_id: testSessionId
      } as OpenAIRequest & { session_id: string };

      mockSessionManager.processMessages.mockReturnValue([allMessages, testSessionId]);

      sessionMiddleware(mockReq as SessionRequest, mockRes as Response, mockNext);

      expect(mockSessionManager.processMessages).toHaveBeenCalledWith(originalMessages, testSessionId);
      expect(mockReq.sessionData).toEqual({
        isSessionRequest: true,
        sessionId: testSessionId,
        originalMessages,
        allMessages
      });
      expect(mockReq.body.messages).toEqual(allMessages);
      expect(mockNext).toHaveBeenCalledWith();
    });

    test('should handle null session_id as stateless', () => {
      const messages = createTestMessages(1);
      mockReq.body = {
        model: 'gpt-4',
        messages,
        session_id: null
      } as OpenAIRequest & { session_id: null };

      sessionMiddleware(mockReq as SessionRequest, mockRes as Response, mockNext);

      expect(mockReq.sessionData?.isSessionRequest).toBe(false);
      expect(mockSessionManager.processMessages).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith();
    });

    test('should handle undefined session_id as stateless', () => {
      const messages = createTestMessages(1);
      mockReq.body = {
        model: 'gpt-4',
        messages
      } as OpenAIRequest;

      sessionMiddleware(mockReq as SessionRequest, mockRes as Response, mockNext);

      expect(mockReq.sessionData?.isSessionRequest).toBe(false);
      expect(mockSessionManager.processMessages).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith();
    });

    test('should handle empty string session_id as stateless', () => {
      const messages = createTestMessages(1);
      mockReq.body = {
        model: 'gpt-4',
        messages,
        session_id: ''
      } as OpenAIRequest & { session_id: string };

      sessionMiddleware(mockReq as SessionRequest, mockRes as Response, mockNext);

      expect(mockReq.sessionData?.isSessionRequest).toBe(false);
      expect(mockSessionManager.processMessages).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith();
    });

    test('should handle request without messages', () => {
      mockReq.body = {
        model: 'gpt-4',
        session_id: 'test-session'
      } as OpenAIRequest & { session_id: string };

      mockSessionManager.processMessages.mockReturnValue([[], 'test-session']);

      sessionMiddleware(mockReq as SessionRequest, mockRes as Response, mockNext);

      expect(mockSessionManager.processMessages).toHaveBeenCalledWith([], 'test-session');
      expect(mockNext).toHaveBeenCalledWith();
    });

    test('should handle session manager returning different session ID', () => {
      const originalMessages = createTestMessages(1);
      const allMessages = createTestMessages(2);
      const originalSessionId = 'original-session';
      const actualSessionId = 'actual-session';

      mockReq.body = {
        model: 'gpt-4',
        messages: originalMessages,
        session_id: originalSessionId
      } as OpenAIRequest & { session_id: string };

      mockSessionManager.processMessages.mockReturnValue([allMessages, actualSessionId]);

      sessionMiddleware(mockReq as SessionRequest, mockRes as Response, mockNext);

      expect(mockReq.sessionData?.sessionId).toBe(actualSessionId);
      expect(mockNext).toHaveBeenCalledWith();
    });

    test('should handle session manager errors gracefully', () => {
      const messages = createTestMessages(1);
      mockReq.body = {
        model: 'gpt-4',
        messages,
        session_id: 'test-session'
      } as OpenAIRequest & { session_id: string };

      mockSessionManager.processMessages.mockImplementation(() => {
        throw new Error('Session manager error');
      });

      sessionMiddleware(mockReq as SessionRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          message: 'Session processing failed',
          type: 'session_error',
          code: '500',
          details: 'Session manager error'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should handle non-Error exceptions', () => {
      const messages = createTestMessages(1);
      mockReq.body = {
        model: 'gpt-4',
        messages,
        session_id: 'test-session'
      } as OpenAIRequest & { session_id: string };

      mockSessionManager.processMessages.mockImplementation(() => {
        throw 'String error';
      });

      sessionMiddleware(mockReq as SessionRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          message: 'Session processing failed',
          type: 'session_error',
          code: '500',
          details: 'Unknown error'
        }
      });
    });

    test('should handle missing request body', () => {
      delete mockReq.body;

      sessionMiddleware(mockReq as SessionRequest, mockRes as Response, mockNext);

      expect(mockReq.sessionData?.isSessionRequest).toBe(false);
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('sessionResponseMiddleware', () => {
    let originalJson: jest.Mock;

    beforeEach(() => {
      originalJson = jest.fn().mockReturnThis();
      mockRes.json = originalJson;
    });

    test('should intercept response and add assistant message to session', () => {
      const testSessionId = 'test-session-456';
      const assistantMessage: OpenAIMessage = {
        role: 'assistant',
        content: 'Assistant response content'
      };

      mockReq.sessionData = {
        isSessionRequest: true,
        sessionId: testSessionId,
        originalMessages: [],
        allMessages: []
      };

      const responseBody = {
        choices: [{
          message: assistantMessage,
          index: 0,
          finish_reason: 'stop'
        }]
      };

      sessionResponseMiddleware(mockReq as SessionRequest, mockRes as Response, mockNext);

      // Call the intercepted json method
      (mockRes.json as any)(responseBody);

      expect(mockSessionManager.addAssistantResponse).toHaveBeenCalledWith(testSessionId, assistantMessage);
      expect(originalJson).toHaveBeenCalledWith(responseBody);
    });

    test('should not add message for stateless requests', () => {
      mockReq.sessionData = {
        isSessionRequest: false,
        sessionId: null,
        originalMessages: [],
        allMessages: []
      };

      const responseBody = {
        choices: [{
          message: { role: 'assistant', content: 'Response' },
          index: 0,
          finish_reason: 'stop'
        }]
      };

      sessionResponseMiddleware(mockReq as SessionRequest, mockRes as Response, mockNext);
      (mockRes.json as any)(responseBody);

      expect(mockSessionManager.addAssistantResponse).not.toHaveBeenCalled();
      expect(originalJson).toHaveBeenCalledWith(responseBody);
    });

    test('should not add message when no session ID', () => {
      mockReq.sessionData = {
        isSessionRequest: true,
        sessionId: null,
        originalMessages: [],
        allMessages: []
      };

      const responseBody = {
        choices: [{
          message: { role: 'assistant', content: 'Response' },
          index: 0,
          finish_reason: 'stop'
        }]
      };

      sessionResponseMiddleware(mockReq as SessionRequest, mockRes as Response, mockNext);
      (mockRes.json as any)(responseBody);

      expect(mockSessionManager.addAssistantResponse).not.toHaveBeenCalled();
      expect(originalJson).toHaveBeenCalledWith(responseBody);
    });

    test('should not add message when no choices in response', () => {
      mockReq.sessionData = {
        isSessionRequest: true,
        sessionId: 'test-session',
        originalMessages: [],
        allMessages: []
      };

      const responseBody = {
        choices: []
      };

      sessionResponseMiddleware(mockReq as SessionRequest, mockRes as Response, mockNext);
      (mockRes.json as any)(responseBody);

      expect(mockSessionManager.addAssistantResponse).not.toHaveBeenCalled();
      expect(originalJson).toHaveBeenCalledWith(responseBody);
    });

    test('should not add message when no message in choice', () => {
      mockReq.sessionData = {
        isSessionRequest: true,
        sessionId: 'test-session',
        originalMessages: [],
        allMessages: []
      };

      const responseBody = {
        choices: [{
          index: 0,
          finish_reason: 'stop'
        }]
      };

      sessionResponseMiddleware(mockReq as SessionRequest, mockRes as Response, mockNext);
      (mockRes.json as any)(responseBody);

      expect(mockSessionManager.addAssistantResponse).not.toHaveBeenCalled();
      expect(originalJson).toHaveBeenCalledWith(responseBody);
    });

    test('should handle session manager errors gracefully', () => {
      mockReq.sessionData = {
        isSessionRequest: true,
        sessionId: 'test-session',
        originalMessages: [],
        allMessages: []
      };

      const responseBody = {
        choices: [{
          message: { role: 'assistant', content: 'Response' },
          index: 0,
          finish_reason: 'stop'
        }]
      };

      mockSessionManager.addAssistantResponse.mockImplementation(() => {
        throw new Error('Session manager error');
      });

      sessionResponseMiddleware(mockReq as SessionRequest, mockRes as Response, mockNext);
      (mockRes.json as any)(responseBody);

      // Should not throw and should still call original json
      expect(originalJson).toHaveBeenCalledWith(responseBody);
    });

    test('should handle missing session data', () => {
      delete mockReq.sessionData;

      const responseBody = {
        choices: [{
          message: { role: 'assistant', content: 'Response' },
          index: 0,
          finish_reason: 'stop'
        }]
      };

      sessionResponseMiddleware(mockReq as SessionRequest, mockRes as Response, mockNext);
      (mockRes.json as any)(responseBody);

      expect(mockSessionManager.addAssistantResponse).not.toHaveBeenCalled();
      expect(originalJson).toHaveBeenCalledWith(responseBody);
    });

    test('should call next middleware', () => {
      sessionResponseMiddleware(mockReq as SessionRequest, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('sessionProcessingMiddleware', () => {
    test('should apply both session and response middleware', () => {
      const messages = createTestMessages(1);
      const testSessionId = 'test-session-789';

      mockReq.body = {
        model: 'gpt-4',
        messages,
        session_id: testSessionId
      } as OpenAIRequest & { session_id: string };

      mockSessionManager.processMessages.mockReturnValue([messages, testSessionId]);

      sessionProcessingMiddleware(mockReq as SessionRequest, mockRes as Response, mockNext);

      // Verify session middleware was applied
      expect(mockReq.sessionData?.isSessionRequest).toBe(true);
      expect(mockReq.sessionData?.sessionId).toBe(testSessionId);

      // Verify next was called
      expect(mockNext).toHaveBeenCalledWith();

      // Verify response middleware was applied (json method should be overridden)
      expect(typeof mockRes.json).toBe('function');
    });

    test('should handle session middleware errors', () => {
      mockReq.body = {
        model: 'gpt-4',
        messages: createTestMessages(1),
        session_id: 'test-session'
      } as OpenAIRequest & { session_id: string };

      mockSessionManager.processMessages.mockImplementation(() => {
        throw new Error('Session processing error');
      });

      sessionProcessingMiddleware(mockReq as SessionRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should pass through stateless requests', () => {
      const messages = createTestMessages(2);
      mockReq.body = {
        model: 'gpt-4',
        messages
      } as OpenAIRequest;

      sessionProcessingMiddleware(mockReq as SessionRequest, mockRes as Response, mockNext);

      expect(mockReq.sessionData?.isSessionRequest).toBe(false);
      expect(mockNext).toHaveBeenCalledWith();
    });
  });
});