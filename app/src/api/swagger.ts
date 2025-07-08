import swaggerJSDoc from 'swagger-jsdoc';
import { OpenAPIV3 } from 'openapi-types';

const swaggerDefinition: OpenAPIV3.Document = {
  openapi: '3.0.0',
  info: {
    title: 'Claude Wrapper API',
    version: '1.0.0',
    description: 'OpenAI-compatible HTTP API wrapper for Claude Code CLI with session management',
    contact: {
      name: 'Claude Wrapper',
      url: 'https://github.com/your-org/claude-wrapper-poc'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: 'http://localhost:8000',
      description: 'Development server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'string',
        description: 'Optional bearer token authentication for protected endpoints'
      }
    },
    schemas: {
      ChatCompletionRequest: {
        type: 'object',
        required: ['model', 'messages'],
        properties: {
          model: {
            type: 'string',
            description: 'Model identifier',
            example: 'claude-3-5-sonnet-20241022'
          },
          messages: {
            type: 'array',
            description: 'Array of conversation messages',
            items: {
              $ref: '#/components/schemas/ChatMessage'
            }
          },
          max_tokens: {
            type: 'integer',
            description: 'Maximum tokens in response',
            default: 1000,
            minimum: 1
          },
          temperature: {
            type: 'number',
            description: 'Sampling temperature 0-2',
            default: 0.7,
            minimum: 0,
            maximum: 2
          },
          stream: {
            type: 'boolean',
            description: 'Enable streaming responses',
            default: false
          },
          session_id: {
            type: 'string',
            description: 'Session ID for conversation continuity',
            example: 'my-conversation-session'
          },
          tools: {
            type: 'array',
            description: 'Available tools for function calling',
            items: {
              $ref: '#/components/schemas/Tool'
            }
          },
          tool_choice: {
            oneOf: [
              { type: 'string', enum: ['auto', 'none'] },
              { $ref: '#/components/schemas/ToolChoice' }
            ],
            description: 'Tool usage preference'
          }
        }
      },
      ChatMessage: {
        type: 'object',
        required: ['role', 'content'],
        properties: {
          role: {
            type: 'string',
            enum: ['user', 'assistant', 'system', 'tool'],
            description: 'Message role'
          },
          content: {
            type: 'string',
            description: 'Message content'
          },
          tool_calls: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/ToolCall'
            }
          },
          tool_call_id: {
            type: 'string',
            description: 'Tool call ID for tool responses'
          }
        }
      },
      ChatCompletionResponse: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Completion ID',
            example: 'chatcmpl-abc123'
          },
          object: {
            type: 'string',
            enum: ['chat.completion'],
            description: 'Response object type'
          },
          created: {
            type: 'integer',
            description: 'Unix timestamp of creation',
            example: 1677652288
          },
          model: {
            type: 'string',
            description: 'Model used for completion',
            example: 'claude-3-5-sonnet-20241022'
          },
          choices: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/ChatCompletionChoice'
            }
          },
          usage: {
            $ref: '#/components/schemas/Usage'
          }
        }
      },
      ChatCompletionChoice: {
        type: 'object',
        properties: {
          index: {
            type: 'integer',
            description: 'Choice index'
          },
          message: {
            $ref: '#/components/schemas/ChatMessage'
          },
          finish_reason: {
            type: 'string',
            enum: ['stop', 'length', 'tool_calls'],
            description: 'Reason for completion finish'
          }
        }
      },
      Tool: {
        type: 'object',
        required: ['type', 'function'],
        properties: {
          type: {
            type: 'string',
            enum: ['function']
          },
          function: {
            $ref: '#/components/schemas/FunctionDefinition'
          }
        }
      },
      FunctionDefinition: {
        type: 'object',
        required: ['name', 'description'],
        properties: {
          name: {
            type: 'string',
            description: 'Function name'
          },
          description: {
            type: 'string',
            description: 'Function description'
          },
          parameters: {
            type: 'object',
            description: 'Function parameters schema'
          }
        }
      },
      ToolCall: {
        type: 'object',
        required: ['id', 'type', 'function'],
        properties: {
          id: {
            type: 'string',
            description: 'Tool call ID'
          },
          type: {
            type: 'string',
            enum: ['function']
          },
          function: {
            type: 'object',
            required: ['name', 'arguments'],
            properties: {
              name: {
                type: 'string',
                description: 'Function name'
              },
              arguments: {
                type: 'string',
                description: 'Function arguments as JSON string'
              }
            }
          }
        }
      },
      ToolChoice: {
        type: 'object',
        required: ['type', 'function'],
        properties: {
          type: {
            type: 'string',
            enum: ['function']
          },
          function: {
            type: 'object',
            required: ['name'],
            properties: {
              name: {
                type: 'string',
                description: 'Function name to call'
              }
            }
          }
        }
      },
      Usage: {
        type: 'object',
        properties: {
          prompt_tokens: {
            type: 'integer',
            description: 'Number of tokens in prompt'
          },
          completion_tokens: {
            type: 'integer',
            description: 'Number of tokens in completion'
          },
          total_tokens: {
            type: 'integer',
            description: 'Total number of tokens'
          }
        }
      },
      ModelsResponse: {
        type: 'object',
        properties: {
          object: {
            type: 'string',
            enum: ['list']
          },
          data: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Model'
            }
          }
        }
      },
      Model: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Model identifier'
          },
          object: {
            type: 'string',
            enum: ['model']
          },
          owned_by: {
            type: 'string',
            description: 'Model owner'
          },
          created: {
            type: 'integer',
            description: 'Creation timestamp'
          }
        }
      },
      Session: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Session ID'
          },
          created_at: {
            type: 'string',
            format: 'date-time',
            description: 'Session creation timestamp'
          },
          last_activity: {
            type: 'string',
            format: 'date-time',
            description: 'Last activity timestamp'
          },
          message_count: {
            type: 'integer',
            description: 'Number of messages in session'
          },
          expires_at: {
            type: 'string',
            format: 'date-time',
            description: 'Session expiration timestamp'
          }
        }
      },
      SessionsResponse: {
        type: 'object',
        properties: {
          sessions: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Session'
            }
          }
        }
      },
      SessionDetail: {
        allOf: [
          { $ref: '#/components/schemas/Session' },
          {
            type: 'object',
            properties: {
              messages: {
                type: 'array',
                items: {
                  allOf: [
                    { $ref: '#/components/schemas/ChatMessage' },
                    {
                      type: 'object',
                      properties: {
                        timestamp: {
                          type: 'string',
                          format: 'date-time'
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        ]
      },
      SessionStats: {
        type: 'object',
        properties: {
          total_sessions: {
            type: 'integer',
            description: 'Total number of sessions'
          },
          active_sessions: {
            type: 'integer',
            description: 'Number of active sessions'
          },
          total_messages: {
            type: 'integer',
            description: 'Total number of messages'
          },
          average_session_length: {
            type: 'number',
            description: 'Average session length'
          }
        }
      },
      HealthResponse: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['healthy'],
            description: 'Service health status'
          },
          service: {
            type: 'string',
            description: 'Service name'
          },
          version: {
            type: 'string',
            description: 'Service version'
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Health check timestamp'
          }
        }
      },
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'Error message'
              },
              type: {
                type: 'string',
                description: 'Error type'
              },
              code: {
                type: 'string',
                description: 'Error code'
              },
              param: {
                type: 'string',
                description: 'Parameter causing error'
              }
            }
          }
        }
      }
    }
  },
  paths: {
    '/v1/chat/completions': {
      post: {
        tags: ['Chat Completions'],
        summary: 'Create chat completion',
        description: 'Create a chat completion using Claude Code CLI with optional session management',
        security: [
          { bearerAuth: [] },
          {}
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ChatCompletionRequest'
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Chat completion response',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ChatCompletionResponse'
                }
              },
              'text/event-stream': {
                schema: {
                  type: 'string',
                  example: 'data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1677652288,"model":"claude-3-5-sonnet-20241022","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},"finish_reason":null}]}\n\ndata: [DONE]'
                }
              }
            }
          },
          '400': {
            description: 'Invalid request',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          },
          '401': {
            description: 'Authentication required',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          },
          '500': {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          }
        }
      }
    },
    '/v1/models': {
      get: {
        tags: ['Models'],
        summary: 'List available models',
        description: 'Get a list of available Claude models',
        responses: {
          '200': {
            description: 'List of available models',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ModelsResponse'
                }
              }
            }
          }
        }
      }
    },
    '/v1/sessions': {
      get: {
        tags: ['Sessions'],
        summary: 'List active sessions',
        description: 'Get a list of all active sessions',
        security: [
          { bearerAuth: [] },
          {}
        ],
        responses: {
          '200': {
            description: 'List of active sessions',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SessionsResponse'
                }
              }
            }
          }
        }
      }
    },
    '/v1/sessions/{sessionId}': {
      get: {
        tags: ['Sessions'],
        summary: 'Get session details',
        description: 'Get detailed information about a specific session',
        security: [
          { bearerAuth: [] },
          {}
        ],
        parameters: [
          {
            name: 'sessionId',
            in: 'path',
            required: true,
            schema: {
              type: 'string'
            },
            description: 'Session ID'
          }
        ],
        responses: {
          '200': {
            description: 'Session details',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SessionDetail'
                }
              }
            }
          },
          '404': {
            description: 'Session not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          }
        }
      },
      delete: {
        tags: ['Sessions'],
        summary: 'Delete session',
        description: 'Delete a specific session',
        security: [
          { bearerAuth: [] },
          {}
        ],
        parameters: [
          {
            name: 'sessionId',
            in: 'path',
            required: true,
            schema: {
              type: 'string'
            },
            description: 'Session ID'
          }
        ],
        responses: {
          '200': {
            description: 'Session deleted',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    deleted: {
                      type: 'boolean'
                    },
                    id: {
                      type: 'string'
                    }
                  }
                }
              }
            }
          },
          '404': {
            description: 'Session not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error'
                }
              }
            }
          }
        }
      }
    },
    '/v1/sessions/stats': {
      get: {
        tags: ['Sessions'],
        summary: 'Get session statistics',
        description: 'Get statistics about all sessions',
        security: [
          { bearerAuth: [] },
          {}
        ],
        responses: {
          '200': {
            description: 'Session statistics',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SessionStats'
                }
              }
            }
          }
        }
      }
    },
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        description: 'Get service health status',
        responses: {
          '200': {
            description: 'Service health status',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HealthResponse'
                }
              }
            }
          }
        }
      }
    }
  }
};

const options = {
  definition: swaggerDefinition,
  apis: ['./src/api/routes/*.ts'], // Path to API docs
};

export const swaggerSpec = swaggerJSDoc(options);