/**
 * Tools validation integration tests
 * Tests integration with chat completion request processing
 * 
 * Verifies that OpenAI tools validation works correctly in the full request pipeline
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { ChatRouter } from '../../../src/routes/chat';
import { authMiddleware } from '../../../src/auth/middleware';
import { OpenAITool, OpenAIToolChoice } from '../../../src/tools/types';
import { TOOL_VALIDATION_MESSAGES } from '../../../src/tools/constants';

// Mock dependencies
jest.mock('../../../src/auth/middleware', () => ({
  authMiddleware: jest.fn(() => (_req: any, _res: any, next: any) => next())
}));

jest.mock('../../../src/utils/logger', () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

jest.mock('../../../src/claude/service', () => ({
  claudeService: {
    createStreamingChatCompletion: jest.fn(),
    createChatCompletion: jest.fn()
  }
}));

describe.skip('Tools Validation Integration', () => {
  let app: express.Application;

  beforeEach(() => {
    // Create Express app with chat router
    app = express();
    app.use(express.json());
    
    // Mock auth middleware to allow all requests
    (authMiddleware as jest.Mock).mockImplementation(() => 
      (_req: any, _res: any, next: any) => next()
    );

    // Setup chat routes
    const chatRouter = ChatRouter.createRouter();
    app.use('/', chatRouter);
  });

  describe.skip('Chat Completions with Tools', () => {
    const validChatRequest = {
      model: 'claude-3-5-sonnet-20241022',
      messages: [
        { role: 'user', content: 'What is the weather like?' }
      ]
    };

    const validTools: OpenAITool[] = [
      {
        type: 'function',
        function: {
          name: 'get_current_weather',
          description: 'Get the current weather in a given location',
          parameters: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: 'The city and state, e.g. San Francisco, CA'
              },
              unit: {
                type: 'string',
                enum: ['celsius', 'fahrenheit'],
                description: 'The unit of temperature'
              }
            },
            required: ['location']
          }
        }
      }
    ];

    it('should accept valid tools array', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          ...validChatRequest,
          tools: validTools
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('choices');
      expect(response.body.choices[0]).toHaveProperty('message');
    });

    it('should accept valid tools with tool_choice auto', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          ...validChatRequest,
          tools: validTools,
          tool_choice: 'auto'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('choices');
    });

    it('should accept valid tools with tool_choice none', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          ...validChatRequest,
          tools: validTools,
          tool_choice: 'none'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('choices');
    });

    it('should accept valid tools with specific function choice', async () => {
      const toolChoice: OpenAIToolChoice = {
        type: 'function',
        function: { name: 'get_current_weather' }
      };

      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          ...validChatRequest,
          tools: validTools,
          tool_choice: toolChoice
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('choices');
    });

    it('should reject invalid tool type', async () => {
      const invalidTools = [
        {
          type: 'invalid_type',
          function: { name: 'test_function' }
        }
      ];

      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          ...validChatRequest,
          tools: invalidTools
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.details).toContain(TOOL_VALIDATION_MESSAGES.TOOL_TYPE_INVALID);
    });

    it('should reject empty tools array', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          ...validChatRequest,
          tools: []
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.details).toContain(TOOL_VALIDATION_MESSAGES.TOOLS_ARRAY_EMPTY);
    });

    it('should reject function with invalid name', async () => {
      const invalidTools: OpenAITool[] = [
        {
          type: 'function',
          function: {
            name: 'invalid function name!',
            description: 'Invalid function'
          }
        }
      ];

      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          ...validChatRequest,
          tools: invalidTools
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.details).toContain(TOOL_VALIDATION_MESSAGES.FUNCTION_NAME_INVALID);
    });

    it('should reject function with reserved name', async () => {
      const invalidTools: OpenAITool[] = [
        {
          type: 'function',
          function: {
            name: 'function',
            description: 'Reserved name'
          }
        }
      ];

      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          ...validChatRequest,
          tools: invalidTools
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.details).toContain(TOOL_VALIDATION_MESSAGES.FUNCTION_NAME_RESERVED);
    });

    it('should reject duplicate function names', async () => {
      const duplicateTools: OpenAITool[] = [
        {
          type: 'function',
          function: { name: 'duplicate_name' }
        },
        {
          type: 'function',
          function: { name: 'duplicate_name' }
        }
      ];

      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          ...validChatRequest,
          tools: duplicateTools
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.details).toContain(TOOL_VALIDATION_MESSAGES.DUPLICATE_FUNCTION_NAMES);
    });

    it('should reject tool_choice without tools', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          ...validChatRequest,
          tool_choice: 'auto'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.details).toContain('tool_choice parameter provided without tools array');
    });

    it('should reject tool_choice for non-existent function', async () => {
      const toolChoice: OpenAIToolChoice = {
        type: 'function',
        function: { name: 'non_existent_function' }
      };

      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          ...validChatRequest,
          tools: validTools,
          tool_choice: toolChoice
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.details).toContain(TOOL_VALIDATION_MESSAGES.TOOL_CHOICE_FUNCTION_NOT_FOUND);
    });

    it('should reject invalid tool_choice format', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          ...validChatRequest,
          tools: validTools,
          tool_choice: 'invalid_choice'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe.skip('Complex Tool Scenarios', () => {
    it('should validate multiple tools with complex parameters', async () => {
      const complexTools: OpenAITool[] = [
        {
          type: 'function',
          function: {
            name: 'search_database',
            description: 'Search the database with complex criteria',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string' },
                filters: {
                  type: 'object',
                  properties: {
                    category: { type: 'string' },
                    dateRange: {
                      type: 'object',
                      properties: {
                        start: { type: 'string', format: 'date' },
                        end: { type: 'string', format: 'date' }
                      }
                    },
                    tags: {
                      type: 'array',
                      items: { type: 'string' }
                    }
                  }
                },
                options: {
                  type: 'object',
                  properties: {
                    limit: { type: 'number', minimum: 1, maximum: 100 },
                    sortBy: { type: 'string', enum: ['date', 'relevance', 'title'] },
                    includeMetadata: { type: 'boolean' }
                  }
                }
              },
              required: ['query']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'send_notification',
            description: 'Send a notification to users',
            parameters: {
              type: 'object',
              properties: {
                recipients: {
                  type: 'array',
                  items: { type: 'string' }
                },
                message: { type: 'string' },
                priority: { type: 'string', enum: ['low', 'medium', 'high'] }
              },
              required: ['recipients', 'message']
            }
          }
        }
      ];

      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'claude-3-5-sonnet-20241022',
          messages: [
            { role: 'user', content: 'Search for recent articles and notify the team' }
          ],
          tools: complexTools,
          tool_choice: 'auto'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('choices');
    });

    it('should handle tools with no parameters', async () => {
      const simpleTools: OpenAITool[] = [
        {
          type: 'function',
          function: {
            name: 'get_current_time',
            description: 'Get the current time'
          }
        }
      ];

      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'claude-3-5-sonnet-20241022',
          messages: [
            { role: 'user', content: 'What time is it?' }
          ],
          tools: simpleTools
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('choices');
    });

    it('should reject tools with excessive parameter depth', async () => {
      const deepTools: OpenAITool[] = [
        {
          type: 'function',
          function: {
            name: 'deep_function',
            parameters: {
              type: 'object',
              properties: {
                level1: {
                  type: 'object',
                  properties: {
                    level2: {
                      type: 'object',
                      properties: {
                        level3: {
                          type: 'object',
                          properties: {
                            level4: {
                              type: 'object',
                              properties: {
                                level5: {
                                  type: 'object',
                                  properties: {
                                    level6: { type: 'string' }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      ];

      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'claude-3-5-sonnet-20241022',
          messages: [
            { role: 'user', content: 'Test deep parameters' }
          ],
          tools: deepTools
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.details).toContain(TOOL_VALIDATION_MESSAGES.PARAMETERS_DEPTH_EXCEEDED);
    });
  });

  describe.skip('Performance Tests', () => {
    it('should validate large tools array quickly', async () => {
      const manyTools: OpenAITool[] = Array(50).fill(null).map((_, index) => ({
        type: 'function',
        function: {
          name: `function_${index}`,
          description: `Function number ${index}`,
          parameters: {
            type: 'object',
            properties: {
              param1: { type: 'string' },
              param2: { type: 'number' }
            }
          }
        }
      }));

      const startTime = Date.now();
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'claude-3-5-sonnet-20241022',
          messages: [
            { role: 'user', content: 'Test many tools' }
          ],
          tools: manyTools
        });
      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should validate tools within performance limits', async () => {
      const complexTool: OpenAITool = {
        type: 'function',
        function: {
          name: 'complex_function',
          description: 'A function with many parameters',
          parameters: {
            type: 'object',
            properties: Object.fromEntries(
              Array(50).fill(null).map((_, i) => [
                `param_${i}`,
                {
                  type: 'object',
                  properties: {
                    nested: { type: 'string' },
                    value: { type: 'number' }
                  }
                }
              ])
            )
          }
        }
      };

      const startTime = Date.now();
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'claude-3-5-sonnet-20241022',
          messages: [
            { role: 'user', content: 'Test complex tool' }
          ],
          tools: [complexTool]
        });
      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe.skip('Error Response Format', () => {
    it('should return properly formatted validation errors', async () => {
      const invalidTools = [
        {
          type: 'invalid_type',
          function: { name: '' }
        }
      ];

      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'claude-3-5-sonnet-20241022',
          messages: [
            { role: 'user', content: 'Test' }
          ],
          tools: invalidTools
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('details');
      expect(Array.isArray(response.body.details)).toBe(true);
      expect(response.body.details.length).toBeGreaterThan(0);
    });

    it('should handle malformed tools gracefully', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'claude-3-5-sonnet-20241022',
          messages: [
            { role: 'user', content: 'Test' }
          ],
          tools: 'invalid_tools_format'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe.skip('Real-world Tool Examples', () => {
    it('should validate OpenAI cookbook weather example', async () => {
      const weatherTool: OpenAITool = {
        type: 'function',
        function: {
          name: 'get_current_weather',
          description: 'Get the current weather in a given location',
          parameters: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: 'The city and state, e.g. San Francisco, CA'
              },
              unit: {
                type: 'string',
                enum: ['celsius', 'fahrenheit']
              }
            },
            required: ['location']
          }
        }
      };

      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'claude-3-5-sonnet-20241022',
          messages: [
            { role: 'user', content: 'What\'s the weather like in Boston?' }
          ],
          tools: [weatherTool],
          tool_choice: 'auto'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('choices');
    });

    it('should validate calculator tool example', async () => {
      const calculatorTool: OpenAITool = {
        type: 'function',
        function: {
          name: 'calculate',
          description: 'Perform mathematical calculations',
          parameters: {
            type: 'object',
            properties: {
              expression: {
                type: 'string',
                description: 'Mathematical expression to evaluate'
              },
              precision: {
                type: 'number',
                description: 'Number of decimal places',
                minimum: 0,
                maximum: 10
              }
            },
            required: ['expression']
          }
        }
      };

      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          model: 'claude-3-5-sonnet-20241022',
          messages: [
            { role: 'user', content: 'Calculate 15 * 25 + 100' }
          ],
          tools: [calculatorTool]
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('choices');
    });
  });
});