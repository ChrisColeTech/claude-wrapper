/**
 * Debug Endpoints Integration Tests
 * Phase 14A: Integration testing for debug HTTP endpoints
 * 
 * Tests the complete debug endpoint pipeline with real HTTP requests
 */

import request from 'supertest';
import express from 'express';
import { DebugRouter } from '../../../src/routes/debug';
import { toolStateManager } from '../../../src/tools/state';
import { toolStateTracker } from '../../../src/tools/state-tracker';
import { toolRegistry } from '../../../src/tools/registry';
import { DEBUG_ENDPOINTS, DEBUG_PERFORMANCE_LIMITS } from '../../../src/tools/constants';

// Mock dependencies
jest.mock('../../../src/tools/state');
jest.mock('../../../src/tools/state-tracker');
jest.mock('../../../src/tools/registry');
jest.mock('../../../src/utils/logger');

const mockToolStateManager = {
  getToolCallState: jest.fn(),
  getStateSnapshot: jest.fn()
};

const mockToolStateTracker = {
  getSessionMetrics: jest.fn(),
  getAllFunctionStats: jest.fn()
};

const mockToolRegistry = {
  getRegisteredTools: jest.fn(),
  validateToolSpecification: jest.fn()
};

describe('Debug Endpoints Integration', () => {
  let app: express.Express;
  const mockSessionId = 'test-session-123';
  const mockToolCallId = 'tool-call-456';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mocks
    (toolStateManager as any).getToolCallState = mockToolStateManager.getToolCallState;
    (toolStateManager as any).getStateSnapshot = mockToolStateManager.getStateSnapshot;
    (toolStateTracker as any).getSessionMetrics = mockToolStateTracker.getSessionMetrics;
    (toolStateTracker as any).getAllFunctionStats = mockToolStateTracker.getAllFunctionStats;
    (toolRegistry as any).getRegisteredTools = mockToolRegistry.getRegisteredTools;
    (toolRegistry as any).validateToolSpecification = mockToolRegistry.validateToolSpecification;

    // Setup Express app with debug routes
    app = express();
    app.use(express.json());
    app.use('/debug', DebugRouter.createRouter());
  });

  describe('Tool Inspection Endpoints', () => {
    const mockToolCallState = {
      id: mockToolCallId,
      toolCall: {
        id: mockToolCallId,
        function: {
          name: 'test_function',
          arguments: '{"param": "value"}'
        }
      },
      state: 'completed',
      createdAt: Date.now() - 1000,
      completedAt: Date.now(),
      updatedAt: Date.now(),
      metadata: { source: 'test' }
    };

    describe(`GET ${DEBUG_ENDPOINTS.TOOL_INSPECT}/:sessionId/:toolCallId`, () => {
      beforeEach(() => {
        mockToolStateManager.getToolCallState.mockResolvedValue(mockToolCallState);
        mockToolStateTracker.getSessionMetrics.mockResolvedValue({
          successRate: 0.95,
          averageExecutionTime: 500
        });
      });

      it('should return tool inspection result', async () => {
        // Act
        const response = await request(app)
          .get(`${DEBUG_ENDPOINTS.TOOL_INSPECT}/${mockSessionId}/${mockToolCallId}`)
          .expect(200);

        // Assert
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.toolCallId).toBe(mockToolCallId);
        expect(response.body.data.sessionId).toBe(mockSessionId);
        expect(response.body.data.functionName).toBe('test_function');
        expect(response.body.data.state).toBe('completed');
        expect(response.body.data.validationStatus).toBe('passed');
        expect(response.body.responseTimeMs).toBeDefined();
        expect(response.body.responseTimeMs).toBeLessThan(DEBUG_PERFORMANCE_LIMITS.ENDPOINT_RESPONSE_TIMEOUT_MS);
      });

      it('should return 400 for missing sessionId', async () => {
        // Act
        const response = await request(app)
          .get(`${DEBUG_ENDPOINTS.TOOL_INSPECT}//${mockToolCallId}`)
          .expect(400);

        // Assert
        expect(response.body.error).toBeDefined();
        expect(response.body.message).toContain('sessionId');
      });

      it('should return 400 for missing toolCallId', async () => {
        // Act
        const response = await request(app)
          .get(`${DEBUG_ENDPOINTS.TOOL_INSPECT}/${mockSessionId}/`)
          .expect(400);

        // Assert
        expect(response.body.error).toBeDefined();
        expect(response.body.message).toContain('Tool call ID is required');
      });

      it('should return 500 when tool call not found', async () => {
        // Arrange
        mockToolStateManager.getToolCallState.mockResolvedValue(null);

        // Act
        const response = await request(app)
          .get(`${DEBUG_ENDPOINTS.TOOL_INSPECT}/${mockSessionId}/${mockToolCallId}`)
          .expect(500);

        // Assert
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBeDefined();
      });

      it('should meet performance requirements', async () => {
        // Act
        const startTime = Date.now();
        const response = await request(app)
          .get(`${DEBUG_ENDPOINTS.TOOL_INSPECT}/${mockSessionId}/${mockToolCallId}`)
          .expect(200);
        const duration = Date.now() - startTime;

        // Assert
        expect(duration).toBeLessThan(DEBUG_PERFORMANCE_LIMITS.ENDPOINT_RESPONSE_TIMEOUT_MS);
        expect(response.body.responseTimeMs).toBeLessThan(DEBUG_PERFORMANCE_LIMITS.ENDPOINT_RESPONSE_TIMEOUT_MS);
      });
    });

    describe(`GET ${DEBUG_ENDPOINTS.TOOL_HISTORY}/:sessionId`, () => {
      const mockSnapshot = {
        sessionId: mockSessionId,
        pendingCalls: [
          { id: 'pending-1', toolCall: { function: { name: 'func1' } }, state: 'pending' }
        ],
        completedCalls: [
          { id: 'completed-1', toolCall: { function: { name: 'func2' } }, state: 'completed' },
          { id: 'completed-2', toolCall: { function: { name: 'func1' } }, state: 'completed' }
        ]
      };

      beforeEach(() => {
        mockToolStateManager.getStateSnapshot.mockResolvedValue(mockSnapshot);
        mockToolStateTracker.getSessionMetrics.mockResolvedValue({
          successRate: 0.9,
          averageExecutionTime: 750
        });
        mockToolStateTracker.getAllFunctionStats.mockResolvedValue([
          { functionName: 'func1', callCount: 5 },
          { functionName: 'func2', callCount: 3 }
        ]);
      });

      it('should return tool call history', async () => {
        // Act
        const response = await request(app)
          .get(`${DEBUG_ENDPOINTS.TOOL_HISTORY}/${mockSessionId}`)
          .expect(200);

        // Assert
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.sessionId).toBe(mockSessionId);
        expect(response.body.data.totalCalls).toBe(3);
        expect(response.body.data.successRate).toBe(0.9);
        expect(response.body.data.mostUsedFunctions).toEqual(['func1', 'func2']);
      });

      it('should respect limit query parameter', async () => {
        // Act
        const response = await request(app)
          .get(`${DEBUG_ENDPOINTS.TOOL_HISTORY}/${mockSessionId}?limit=1`)
          .expect(200);

        // Assert
        expect(response.body.success).toBe(true);
        expect(response.body.data.sessionId).toBe(mockSessionId);
      });

      it('should return 500 when session not found', async () => {
        // Arrange
        mockToolStateManager.getStateSnapshot.mockResolvedValue(null);

        // Act
        const response = await request(app)
          .get(`${DEBUG_ENDPOINTS.TOOL_HISTORY}/${mockSessionId}`)
          .expect(500);

        // Assert
        expect(response.body.success).toBe(false);
      });
    });

    describe(`GET ${DEBUG_ENDPOINTS.PERFORMANCE_MONITOR}/:sessionId/:toolCallId`, () => {
      beforeEach(() => {
        mockToolStateManager.getToolCallState.mockResolvedValue(mockToolCallState);
      });

      it('should return performance analysis', async () => {
        // Act
        const response = await request(app)
          .get(`${DEBUG_ENDPOINTS.PERFORMANCE_MONITOR}/${mockSessionId}/${mockToolCallId}`)
          .expect(200);

        // Assert
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.toolCallId).toBe(mockToolCallId);
        expect(response.body.data.sessionId).toBe(mockSessionId);
        expect(response.body.data.overallScore).toBeGreaterThanOrEqual(0);
        expect(response.body.data.overallScore).toBeLessThanOrEqual(100);
        expect(['A', 'B', 'C', 'D', 'F']).toContain(response.body.data.performanceGrade);
        expect(response.body.data.bottlenecks).toBeInstanceOf(Array);
        expect(response.body.data.recommendations).toBeInstanceOf(Array);
      });

      it('should return 400 for missing toolCallId', async () => {
        // Act
        const response = await request(app)
          .get(`${DEBUG_ENDPOINTS.PERFORMANCE_MONITOR}/${mockSessionId}/`)
          .expect(400);

        // Assert
        expect(response.body.error).toBeDefined();
        expect(response.body.message).toContain('Tool call ID is required');
      });
    });
  });

  describe('Compatibility Check Endpoints', () => {
    const mockCompatibilityRequest = {
      model: 'claude-3-sonnet-20240229',
      messages: [
        { role: 'user', content: 'Hello' }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get weather information',
            parameters: {
              type: 'object',
              properties: {
                location: { type: 'string' }
              },
              required: ['location']
            }
          }
        }
      ]
    };

    describe(`POST ${DEBUG_ENDPOINTS.COMPATIBILITY_CHECK}`, () => {
      beforeEach(() => {
        mockToolRegistry.getRegisteredTools.mockResolvedValue([
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get weather information',
              parameters: {
                type: 'object',
                properties: {
                  location: { type: 'string' }
                },
                required: ['location']
              }
            }
          }
        ]);
      });

      it('should check OpenAI compatibility', async () => {
        // Act
        const response = await request(app)
          .post(DEBUG_ENDPOINTS.COMPATIBILITY_CHECK)
          .send({ request: mockCompatibilityRequest })
          .expect(200);

        // Assert
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.overallCompatible).toBeDefined();
        expect(response.body.data.openaiComplianceScore).toBeGreaterThanOrEqual(0);
        expect(response.body.data.openaiComplianceScore).toBeLessThanOrEqual(100);
        expect(response.body.data.supportedFeatures).toBeInstanceOf(Array);
        expect(response.body.data.unsupportedFeatures).toBeInstanceOf(Array);
        expect(['full', 'high', 'medium', 'low', 'none']).toContain(response.body.data.compatibilityLevel);
        expect(response.body.responseTimeMs).toBeLessThan(DEBUG_PERFORMANCE_LIMITS.ENDPOINT_RESPONSE_TIMEOUT_MS);
      });

      it('should validate tool specification', async () => {
        // Arrange
        const toolSpec = {
          type: 'function',
          function: {
            name: 'calculate_sum',
            description: 'Calculate sum',
            parameters: {
              type: 'object',
              properties: {
                a: { type: 'number' },
                b: { type: 'number' }
              },
              required: ['a', 'b']
            }
          }
        };

        mockToolRegistry.validateToolSpecification.mockResolvedValue({
          valid: true,
          errors: []
        });

        // Act
        const response = await request(app)
          .post(DEBUG_ENDPOINTS.COMPATIBILITY_CHECK)
          .send({ toolSpecification: toolSpec })
          .expect(200);

        // Assert
        expect(response.body.success).toBe(true);
        expect(response.body.data.toolName).toBe('calculate_sum');
        expect(response.body.data.isCompatible).toBeDefined();
        expect(response.body.data.complianceScore).toBeGreaterThanOrEqual(0);
      });

      it('should verify endpoint compliance', async () => {
        // Act
        const response = await request(app)
          .post(DEBUG_ENDPOINTS.COMPATIBILITY_CHECK)
          .send({ endpoint: '/v1/chat/completions' })
          .expect(200);

        // Assert
        expect(response.body.success).toBe(true);
        expect(response.body.data.endpoint).toBe('/v1/chat/completions');
        expect(response.body.data.isCompliant).toBeDefined();
        expect(response.body.data.complianceScore).toBeGreaterThanOrEqual(0);
      });

      it('should return 400 for missing request body', async () => {
        // Act
        const response = await request(app)
          .post(DEBUG_ENDPOINTS.COMPATIBILITY_CHECK)
          .send({})
          .expect(400);

        // Assert
        expect(response.body.error).toBeDefined();
        expect(response.body.message).toContain('Request body is required');
      });

      it('should meet performance requirements', async () => {
        // Act
        const startTime = Date.now();
        const response = await request(app)
          .post(DEBUG_ENDPOINTS.COMPATIBILITY_CHECK)
          .send({ request: mockCompatibilityRequest })
          .expect(200);
        const duration = Date.now() - startTime;

        // Assert
        expect(duration).toBeLessThan(DEBUG_PERFORMANCE_LIMITS.COMPATIBILITY_CHECK_TIMEOUT_MS);
        expect(response.body.responseTimeMs).toBeLessThan(DEBUG_PERFORMANCE_LIMITS.ENDPOINT_RESPONSE_TIMEOUT_MS);
      });
    });
  });

  describe('Debug Report Endpoints', () => {
    const mockSnapshot = {
      sessionId: mockSessionId,
      pendingCalls: [{ id: 'pending-1' }],
      completedCalls: [{ id: 'completed-1' }, { id: 'completed-2' }]
    };

    describe(`GET ${DEBUG_ENDPOINTS.OPENAI_COMPLIANCE}/:sessionId`, () => {
      beforeEach(() => {
        mockToolStateManager.getStateSnapshot.mockResolvedValue(mockSnapshot);
      });

      it('should generate debug report', async () => {
        // Act
        const response = await request(app)
          .get(`${DEBUG_ENDPOINTS.OPENAI_COMPLIANCE}/${mockSessionId}`)
          .expect(200);

        // Assert
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.sessionId).toBe(mockSessionId);
        expect(response.body.data.reportType).toBe('full');
        expect(response.body.data.summary).toBeDefined();
        expect(response.body.data.toolCalls).toBeDefined();
        expect(response.body.data.performanceOverview).toBeDefined();
        expect(response.body.data.recommendations).toBeInstanceOf(Array);
      });

      it('should support different report types', async () => {
        // Act
        const response = await request(app)
          .get(`${DEBUG_ENDPOINTS.OPENAI_COMPLIANCE}/${mockSessionId}?type=summary`)
          .expect(200);

        // Assert
        expect(response.body.success).toBe(true);
        expect(response.body.data.reportType).toBe('summary');
      });
    });

    describe(`GET ${DEBUG_ENDPOINTS.TOOL_VALIDATION}/:sessionId`, () => {
      beforeEach(() => {
        mockToolStateManager.getStateSnapshot.mockResolvedValue(mockSnapshot);
      });

      it('should validate tool call chain', async () => {
        // Act
        const response = await request(app)
          .get(`${DEBUG_ENDPOINTS.TOOL_VALIDATION}/${mockSessionId}`)
          .expect(200);

        // Assert
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.sessionId).toBe(mockSessionId);
        expect(response.body.data.isValid).toBeDefined();
        expect(response.body.data.chainLength).toBeGreaterThanOrEqual(0);
        expect(response.body.data.validationSteps).toBeInstanceOf(Array);
        expect(response.body.data.failurePoints).toBeInstanceOf(Array);
        expect(response.body.data.recommendations).toBeInstanceOf(Array);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle internal server errors gracefully', async () => {
      // Arrange
      mockToolStateManager.getToolCallState.mockRejectedValue(new Error('Internal error'));

      // Act
      const response = await request(app)
        .get(`${DEBUG_ENDPOINTS.TOOL_INSPECT}/${mockSessionId}/${mockToolCallId}`)
        .expect(500);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.message).toContain('tool inspection failed');
      expect(response.body.responseTimeMs).toBeDefined();
    });

    it('should validate request parameters', async () => {
      // Act
      const response = await request(app)
        .get(`${DEBUG_ENDPOINTS.TOOL_INSPECT}//`)
        .expect(400);

      // Assert
      expect(response.body.error).toBeDefined();
    });

    it('should handle malformed JSON in compatibility check', async () => {
      // Act
      const response = await request(app)
        .post(DEBUG_ENDPOINTS.COMPATIBILITY_CHECK)
        .send('{"invalid": json}')
        .expect(400);

      // Assert
      expect(response.body).toBeDefined();
    });
  });

  describe('Performance Requirements', () => {
    it('should meet debug endpoint response time requirement', async () => {
      // Arrange
      mockToolStateManager.getToolCallState.mockResolvedValue({
        id: mockToolCallId,
        toolCall: { function: { name: 'test' } },
        state: 'completed',
        createdAt: Date.now() - 100,
        completedAt: Date.now(),
        updatedAt: Date.now()
      });

      // Act
      const responses = await Promise.all([
        request(app).get(`${DEBUG_ENDPOINTS.TOOL_INSPECT}/${mockSessionId}/${mockToolCallId}`),
        request(app).get(`${DEBUG_ENDPOINTS.TOOL_HISTORY}/${mockSessionId}`),
        request(app).get(`${DEBUG_ENDPOINTS.PERFORMANCE_MONITOR}/${mockSessionId}/${mockToolCallId}`)
      ]);

      // Assert
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.responseTimeMs).toBeLessThan(DEBUG_PERFORMANCE_LIMITS.ENDPOINT_RESPONSE_TIMEOUT_MS);
      });
    });

    it('should handle concurrent debug requests', async () => {
      // Arrange
      mockToolStateManager.getToolCallState.mockResolvedValue({
        id: mockToolCallId,
        toolCall: { function: { name: 'test' } },
        state: 'completed',
        createdAt: Date.now(),
        completedAt: Date.now(),
        updatedAt: Date.now()
      });

      // Act - Make 5 concurrent requests
      const concurrentRequests = Array(5).fill(null).map(() =>
        request(app).get(`${DEBUG_ENDPOINTS.TOOL_INSPECT}/${mockSessionId}/${mockToolCallId}`)
      );

      const responses = await Promise.all(concurrentRequests);

      // Assert
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.responseTimeMs).toBeLessThan(DEBUG_PERFORMANCE_LIMITS.ENDPOINT_RESPONSE_TIMEOUT_MS);
      });
    });
  });

  describe('Content-Type and Headers', () => {
    it('should accept JSON content type for POST requests', async () => {
      // Arrange
      const requestBody = {
        request: {
          model: 'claude-3-sonnet-20240229',
          messages: [{ role: 'user', content: 'test' }]
        }
      };

      mockToolRegistry.getRegisteredTools.mockResolvedValue([]);

      // Act
      const response = await request(app)
        .post(DEBUG_ENDPOINTS.COMPATIBILITY_CHECK)
        .set('Content-Type', 'application/json')
        .send(requestBody)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
    });

    it('should return JSON responses', async () => {
      // Arrange
      mockToolStateManager.getToolCallState.mockResolvedValue({
        id: mockToolCallId,
        toolCall: { function: { name: 'test' } },
        state: 'completed',
        createdAt: Date.now(),
        completedAt: Date.now(),
        updatedAt: Date.now()
      });

      // Act
      const response = await request(app)
        .get(`${DEBUG_ENDPOINTS.TOOL_INSPECT}/${mockSessionId}/${mockToolCallId}`)
        .expect(200);

      // Assert
      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toBeInstanceOf(Object);
    });
  });
});