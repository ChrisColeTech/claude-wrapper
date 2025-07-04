/**
 * Integration tests for Tool Parameter Processing
 * Phase 2A: Tool Request Parameter Processing
 * 
 * Tests integration of parameter processing with chat completion requests
 */

import request from 'supertest';
import express from 'express';
import { ChatRouter } from '../../../src/routes/chat';
import { OpenAITool, OpenAIToolChoice } from '../../../src/tools/types';

describe.skip('Tool Parameter Processing Integration', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Mock authentication middleware to pass
    app.use((req, res, next) => {
      req.headers['x-auth-status'] = 'authenticated';
      next();
    });
    
    app.use(ChatRouter.createRouter());
  });

  describe.skip('POST /v1/chat/completions with tools', () => {
    const validChatRequest = {
      model: 'claude-3-sonnet-20240229',
      messages: [
        { role: 'user', content: 'What is the weather like?' }
      ]
    };

    const validTools: OpenAITool[] = [
      {
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get the current weather for a location',
          parameters: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: 'The city and state/country'
              },
              unit: {
                type: 'string',
                enum: ['celsius', 'fahrenheit'],
                description: 'Temperature unit'
              }
            },
            required: ['location']
          }
        }
      }
    ];

    it('should accept valid tools parameter', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          ...validChatRequest,
          tools: validTools,
          tool_choice: 'auto'
        });

      // Should not return validation error
      expect(response.status).not.toBe(422);
      expect(response.status).not.toBe(400);
    });

    it('should accept auto tool_choice', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          ...validChatRequest,
          tools: validTools,
          tool_choice: 'auto'
        });

      expect(response.status).not.toBe(422);
    });

    it('should accept none tool_choice', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          ...validChatRequest,
          tools: validTools,
          tool_choice: 'none'
        });

      expect(response.status).not.toBe(422);
    });

    it('should accept specific function tool_choice', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          ...validChatRequest,
          tools: validTools,
          tool_choice: {
            type: 'function',
            function: { name: 'get_weather' }
          }
        });

      expect(response.status).not.toBe(422);
    });

    it('should reject invalid tool_choice string', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          ...validChatRequest,
          tools: validTools,
          tool_choice: 'invalid'
        });

      expect(response.status).toBe(422);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.type).toBe('invalid_request_error');
      expect(response.body.error.code).toBe('tool_parameter_error');
    });

    it('should reject tool_choice with non-existing function', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          ...validChatRequest,
          tools: validTools,
          tool_choice: {
            type: 'function',
            function: { name: 'non_existing_function' }
          }
        });

      expect(response.status).toBe(422);
      expect(response.body.error.details).toContain('Tool choice function name not found in tools array');
    });

    it('should reject tool_choice without tools', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          ...validChatRequest,
          tool_choice: 'auto'
        });

      expect(response.status).toBe(422);
      expect(response.body.error.details).toContain('Tool choice specified but no tools provided');
    });

    it('should accept request without tools', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send(validChatRequest);

      // Should not return validation error for missing tools
      expect(response.status).not.toBe(422);
    });

    it('should reject invalid tools array format', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          ...validChatRequest,
          tools: 'invalid_format'
        });

      expect(response.status).toBe(422);
    });

    it('should reject tools with invalid function name', async () => {
      const invalidTools = [
        {
          type: 'function',
          function: {
            name: '', // Empty name
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

      expect(response.status).toBe(422);
    });

    it('should reject tools with missing required fields', async () => {
      const invalidTools = [
        {
          type: 'function',
          function: {
            // Missing name field
            description: 'Function without name'
          }
        }
      ];

      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          ...validChatRequest,
          tools: invalidTools
        });

      expect(response.status).toBe(422);
    });

    it('should reject duplicate function names', async () => {
      const duplicateTools = [
        {
          type: 'function',
          function: {
            name: 'duplicate_function',
            description: 'First function'
          }
        },
        {
          type: 'function',
          function: {
            name: 'duplicate_function',
            description: 'Second function with same name'
          }
        }
      ];

      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          ...validChatRequest,
          tools: duplicateTools
        });

      expect(response.status).toBe(422);
      expect(response.body.error.details).toContain('Function names must be unique within tools array');
    });

    it('should handle large tools array within performance limit', async () => {
      const largeToolsArray = Array.from({ length: 20 }, (_, i) => ({
        type: 'function' as const,
        function: {
          name: `test_function_${i}`,
          description: `Test function ${i}`,
          parameters: {
            type: 'object',
            properties: {
              param: { type: 'string' }
            }
          }
        }
      }));

      const startTime = Date.now();
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          ...validChatRequest,
          tools: largeToolsArray,
          tool_choice: 'auto'
        });
      const duration = Date.now() - startTime;

      // Should process within reasonable time
      expect(duration).toBeLessThan(100); // 100ms for integration test
      
      // Should not fail due to performance issues
      expect(response.status).not.toBe(422);
    });

    it('should process streaming request with tools', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          ...validChatRequest,
          tools: validTools,
          tool_choice: 'auto',
          stream: true
        });

      // Should accept streaming request with tools
      expect(response.status).not.toBe(422);
      
      // Should set appropriate headers for streaming
      if (response.status === 200) {
        expect(response.headers['content-type']).toContain('text/event-stream');
      }
    });

    it('should validate complex tool parameters', async () => {
      const complexTools: OpenAITool[] = [
        {
          type: 'function',
          function: {
            name: 'complex_function',
            description: 'Function with complex parameters',
            parameters: {
              type: 'object',
              properties: {
                simple_param: {
                  type: 'string'
                },
                array_param: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      nested_prop: { type: 'number' }
                    }
                  }
                },
                object_param: {
                  type: 'object',
                  properties: {
                    nested_object: {
                      type: 'object',
                      properties: {
                        deep_prop: { type: 'boolean' }
                      }
                    }
                  }
                }
              },
              required: ['simple_param']
            }
          }
        }
      ];

      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          ...validChatRequest,
          tools: complexTools,
          tool_choice: 'auto'
        });

      expect(response.status).not.toBe(422);
    });

    it('should return appropriate error format for tool validation failures', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send({
          ...validChatRequest,
          tools: 'invalid',
          tool_choice: 'auto'
        });

      expect(response.status).toBe(422);
      expect(response.body).toMatchObject({
        error: {
          message: 'Tool parameter validation failed',
          type: 'invalid_request_error',
          code: 'tool_parameter_error',
          details: expect.any(Array)
        }
      });
    });
  });

  describe.skip('OpenAI compatibility', () => {
    const openaiCompatibleRequest = {
      model: 'claude-3-sonnet-20240229',
      messages: [
        { role: 'user', content: 'Hello' }
      ],
      tools: [
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
                  enum: ['celsius', 'fahrenheit']
                }
              },
              required: ['location']
            }
          }
        }
      ],
      tool_choice: 'auto'
    };

    it('should accept OpenAI-compatible tools format exactly', async () => {
      const response = await request(app)
        .post('/v1/chat/completions')
        .send(openaiCompatibleRequest);

      expect(response.status).not.toBe(422);
    });

    it('should handle all OpenAI tool_choice options', async () => {
      const toolChoices: (OpenAIToolChoice)[] = [
        'auto',
        'none',
        {
          type: 'function',
          function: { name: 'get_current_weather' }
        }
      ];

      for (const toolChoice of toolChoices) {
        const response = await request(app)
          .post('/v1/chat/completions')
          .send({
            ...openaiCompatibleRequest,
            tool_choice: toolChoice
          });

        expect(response.status).not.toBe(422);
      }
    });
  });
});