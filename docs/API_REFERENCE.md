# API Reference - Claude Code OpenAI Wrapper

This document provides complete documentation for all API endpoints in the Claude Code OpenAI Wrapper, based on the Python implementation in `main.py`.

## 🎯 API Overview

The wrapper provides an OpenAI-compatible REST API that translates OpenAI Chat Completions requests to Claude Code CLI calls. All endpoints return standard OpenAI-formatted responses for seamless integration.

**Base URL**: `http://localhost:8000` (configurable via `PORT` environment variable)
**API Version**: `v1`
**Content-Type**: `application/json`

## 🔐 Authentication

### API Key Authentication (Optional)

If an API key is configured (via `API_KEY` environment variable or interactive setup), all endpoints require Bearer token authentication:

```http
Authorization: Bearer your-api-key-here
```

**Status Codes for Auth Errors**:
- `401 Unauthorized` - Missing or invalid API key

## 📋 Core Chat Endpoints

### POST /v1/chat/completions

**Python Reference**: `main.py:502-641`

Main chat completions endpoint compatible with OpenAI's Chat Completions API.

#### Request

```http
POST /v1/chat/completions
Content-Type: application/json
Authorization: Bearer your-api-key-here
```

#### Request Body

```json
{
  "model": "claude-3-5-sonnet-20241022",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful assistant."
    },
    {
      "role": "user", 
      "content": "Hello, how are you?"
    }
  ],
  "stream": false,
  "temperature": 1.0,
  "max_tokens": null,
  "session_id": "session-123",
  "disable_tools": false
}
```

#### Request Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `model` | string | ✅ Yes | - | Claude model name (see supported models) |
| `messages` | array | ✅ Yes | - | Array of message objects |
| `stream` | boolean | No | `false` | Enable Server-Sent Events streaming |
| `temperature` | number | No | `1.0` | **Not supported** - Will be ignored with warning |
| `top_p` | number | No | `1.0` | **Not supported** - Will be ignored with warning |
| `n` | integer | No | `1` | **Must be 1** - Multiple choices not supported |
| `max_tokens` | integer | No | `null` | **Not supported** - Use custom headers instead |
| `presence_penalty` | number | No | `0` | **Not supported** - Will be ignored with warning |
| `frequency_penalty` | number | No | `0` | **Not supported** - Will be ignored with warning |
| `logit_bias` | object | No | `null` | **Not supported** - Will be ignored with warning |
| `stop` | string/array | No | `null` | **Not supported** - Will be ignored with warning |
| `user` | string | No | `null` | User identifier for logging |
| `session_id` | string | No | `null` | **Extension** - Session ID for conversation continuity |
| `tools` | array | No | `null` | **OpenAI Compatible** - Array of tool function definitions |
| `tool_choice` | string/object | No | `"auto"` | **OpenAI Compatible** - Control tool usage: `"auto"`, `"none"`, or specific function |

#### OpenAI Tools API Support

The wrapper supports the standard OpenAI Tools API for function calling. Users can define tools that Claude can call, with execution handled by the client.

**Tool Definition Example**:
```json
{
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "read_file",
        "description": "Read content from a file",
        "parameters": {
          "type": "object",
          "properties": {
            "path": {
              "type": "string",
              "description": "File path to read"
            }
          },
          "required": ["path"]
        }
      }
    }
  ],
  "tool_choice": "auto"
}
```

**Tool Choice Options**:
- `"auto"`: Claude decides when to use tools
- `"none"`: Force text-only response, no tool calls
- `{"type": "function", "function": {"name": "function_name"}}`: Force specific function call

**Important**: The wrapper does NOT execute tools. It returns tool calls that the client must execute and send back as tool messages.

#### Tool Messages

When Claude requests a tool call, respond with a tool message:

```json
{
  "role": "tool",
  "tool_call_id": "call_abc123",
  "content": "File content here..."
}
```

#### Message Object

```json
{
  "role": "user|assistant|system|tool",
  "content": "Message content as string",
  "name": "optional-name",
  "tool_calls": [
    {
      "id": "call_abc123",
      "type": "function",
      "function": {
        "name": "function_name",
        "arguments": "{\"param\": \"value\"}"
      }
    }
  ],
  "tool_call_id": "call_abc123"
}
```

**Message Roles**:
- `"user"`: User message
- `"assistant"`: Claude's response (may contain tool_calls)
- `"system"`: System prompt
- `"tool"`: Tool execution result (requires tool_call_id)

#### Supported Models

- `claude-sonnet-4-20250514`
- `claude-opus-4-20250514`
- `claude-3-7-sonnet-20250219`
- `claude-3-5-sonnet-20241022`
- `claude-3-5-haiku-20241022`

#### Custom Headers (Claude-Specific)

| Header | Type | Description |
|--------|------|-------------|
| `X-Claude-Max-Turns` | integer | Maximum conversation turns (tool calling affects turn count) |
| `X-Claude-Permission-Mode` | string | Permission mode: `default`, `acceptEdits`, `bypassPermissions` |
| `X-Claude-Max-Thinking-Tokens` | integer | Maximum thinking tokens |

**Note**: Tool-specific headers removed. Use the standard OpenAI `tools` and `tool_choice` parameters instead.

#### Response (Non-Streaming)

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1677858242,
  "model": "claude-3-5-sonnet-20241022",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! I'm doing well, thank you for asking. How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 15,
    "completion_tokens": 17,
    "total_tokens": 32
  }
}
```

#### Response with Tool Calls

When Claude decides to call a tool, the response includes tool_calls:

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1677858242,
  "model": "claude-3-5-sonnet-20241022",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": null,
        "tool_calls": [
          {
            "id": "call_abc123",
            "type": "function",
            "function": {
              "name": "read_file",
              "arguments": "{\"path\": \"/home/user/config.json\"}"
            }
          }
        ]
      },
      "finish_reason": "tool_calls"
    }
  ],
  "usage": {
    "prompt_tokens": 25,
    "completion_tokens": 15,
    "total_tokens": 40
  }
}
```

**Note**: When `finish_reason` is `"tool_calls"`, the client must execute the tools and continue the conversation with tool result messages.

#### Response (Streaming)

When `stream: true`, responses are sent as Server-Sent Events:

```
data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1677858242,"model":"claude-3-5-sonnet-20241022","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1677858242,"model":"claude-3-5-sonnet-20241022","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1677858242,"model":"claude-3-5-sonnet-20241022","choices":[{"index":0,"delta":{"content":"!"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1677858242,"model":"claude-3-5-sonnet-20241022","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

#### Error Responses

**422 Validation Error**:
```json
{
  "error": {
    "message": "Request validation failed - the request body doesn't match the expected format",
    "type": "validation_error",
    "code": "invalid_request_error",
    "details": [
      {
        "field": "messages",
        "message": "Field required",
        "type": "missing",
        "input": null
      }
    ],
    "help": {
      "common_issues": [
        "Missing required fields (model, messages)",
        "Invalid field types (e.g. messages should be an array)",
        "Invalid role values (must be 'system', 'user', or 'assistant')",
        "Invalid parameter ranges (e.g. temperature must be 0-2)"
      ],
      "debug_tip": "Set DEBUG_MODE=true or VERBOSE=true environment variable for more detailed logging"
    }
  }
}
```

**503 Authentication Error**:
```json
{
  "error": {
    "message": "Claude Code authentication failed",
    "errors": ["ANTHROPIC_API_KEY environment variable not set"],
    "method": "anthropic",
    "help": "Check /v1/auth/status for detailed authentication information"
  }
}
```

---

## 🤖 Model Information

### GET /v1/models

**Python Reference**: `main.py:644-656`

Returns list of available Claude models.

#### Request

```http
GET /v1/models
Authorization: Bearer your-api-key-here
```

#### Response

```json
{
  "object": "list",
  "data": [
    {
      "id": "claude-sonnet-4-20250514",
      "object": "model",
      "owned_by": "anthropic"
    },
    {
      "id": "claude-opus-4-20250514", 
      "object": "model",
      "owned_by": "anthropic"
    },
    {
      "id": "claude-3-7-sonnet-20250219",
      "object": "model", 
      "owned_by": "anthropic"
    },
    {
      "id": "claude-3-5-sonnet-20241022",
      "object": "model",
      "owned_by": "anthropic"
    },
    {
      "id": "claude-3-5-haiku-20241022",
      "object": "model",
      "owned_by": "anthropic"
    }
  ]
}
```

---

## 🏥 Health & Status Endpoints

### GET /health

**Python Reference**: `main.py:680-683`

Health check endpoint for monitoring and load balancers.

#### Request

```http
GET /health
```

#### Response

```json
{
  "status": "healthy",
  "service": "claude-code-openai-wrapper"
}
```

### GET /v1/auth/status

**Python Reference**: `main.py:754-769`

Returns Claude Code authentication status and server configuration.

#### Request

```http
GET /v1/auth/status
```

#### Response

```json
{
  "claude_code_auth": {
    "method": "anthropic",
    "status": {
      "method": "anthropic",
      "valid": true,
      "errors": [],
      "config": {
        "api_key_present": true,
        "api_key_length": 108
      }
    },
    "environment_variables": ["ANTHROPIC_API_KEY"]
  },
  "server_info": {
    "api_key_required": true,
    "api_key_source": "environment",
    "version": "1.0.0"
  }
}
```

---

## 🔄 Session Management Endpoints

### GET /v1/sessions/stats

**Python Reference**: `main.py:772-782`

Returns session manager statistics.

#### Request

```http
GET /v1/sessions/stats
Authorization: Bearer your-api-key-here
```

#### Response

```json
{
  "session_stats": {
    "active_sessions": 5,
    "expired_sessions": 0,
    "total_messages": 23
  },
  "cleanup_interval_minutes": 5,
  "default_ttl_hours": 1
}
```

### GET /v1/sessions

**Python Reference**: `main.py:785-791`

Returns list of all active sessions.

#### Request

```http
GET /v1/sessions
Authorization: Bearer your-api-key-here
```

#### Response

```json
{
  "sessions": [
    {
      "session_id": "session-123",
      "created_at": "2023-11-07T10:30:00Z",
      "last_accessed": "2023-11-07T10:45:00Z", 
      "message_count": 6,
      "expires_at": "2023-11-07T11:45:00Z"
    },
    {
      "session_id": "session-456",
      "created_at": "2023-11-07T10:20:00Z",
      "last_accessed": "2023-11-07T10:50:00Z",
      "message_count": 12,
      "expires_at": "2023-11-07T11:50:00Z"
    }
  ],
  "total": 2
}
```

### GET /v1/sessions/{session_id}

**Python Reference**: `main.py:794-804`

Returns information about a specific session.

#### Request

```http
GET /v1/sessions/session-123
Authorization: Bearer your-api-key-here
```

#### Response

```json
{
  "session_id": "session-123",
  "created_at": "2023-11-07T10:30:00Z",
  "last_accessed": "2023-11-07T10:45:00Z",
  "message_count": 6,
  "expires_at": "2023-11-07T11:45:00Z"
}
```

#### Error Response

```json
{
  "error": {
    "message": "Session not found",
    "type": "api_error",
    "code": "404"
  }
}
```

### DELETE /v1/sessions/{session_id}

**Python Reference**: `main.py:807-817`

Deletes a specific session.

#### Request

```http
DELETE /v1/sessions/session-123
Authorization: Bearer your-api-key-here
```

#### Response

```json
{
  "message": "Session session-123 deleted successfully"
}
```

#### Error Response

```json
{
  "error": {
    "message": "Session not found", 
    "type": "api_error",
    "code": "404"
  }
}
```

---

## 🔧 Development & Debug Endpoints

### POST /v1/compatibility

**Python Reference**: `main.py:659-677`

Analyzes OpenAI API compatibility for a request without executing it.

#### Request

```http
POST /v1/compatibility
Content-Type: application/json
```

#### Request Body

Same as `/v1/chat/completions` request body.

#### Response

```json
{
  "compatibility_report": {
    "supported_parameters": ["model", "messages", "stream", "user"],
    "unsupported_parameters": ["temperature", "max_tokens"],
    "warnings": [],
    "suggestions": [
      "Use max_turns parameter instead to limit conversation length, or use max_thinking_tokens to limit internal reasoning.",
      "Claude Code SDK does not support temperature control. Consider using different models for varied response styles."
    ]
  },
  "claude_code_sdk_options": {
    "supported": [
      "model", "system_prompt", "max_turns", "tools", "tool_choice",
      "permission_mode", "max_thinking_tokens",
      "continue_conversation", "resume", "cwd"
    ],
    "openai_tools_api": {
      "supported": true,
      "tool_execution": "client_side",
      "supported_tool_types": ["function"],
      "tool_choice_options": ["auto", "none", "specific_function"]
    },
    "custom_headers": [
      "X-Claude-Max-Turns", "X-Claude-Permission-Mode", 
      "X-Claude-Max-Thinking-Tokens"
    ]
  }
}
```

### POST /v1/debug/request

**Python Reference**: `main.py:686-751`

Debug endpoint for testing request validation and seeing raw request data.

#### Request

```http
POST /v1/debug/request
Content-Type: application/json
```

#### Request Body

Any JSON payload to debug.

#### Response

```json
{
  "debug_info": {
    "headers": {
      "content-type": "application/json",
      "authorization": "Bearer ***"
    },
    "method": "POST",
    "url": "http://localhost:8000/v1/debug/request",
    "raw_body": "{\"model\":\"claude-3-5-sonnet-20241022\",\"messages\":[]}",
    "json_parse_error": null,
    "parsed_body": {
      "model": "claude-3-5-sonnet-20241022",
      "messages": []
    },
    "validation_result": {
      "valid": false,
      "errors": [
        {
          "field": "messages",
          "message": "List should have at least 1 item after validation",
          "type": "too_short",
          "input": []
        }
      ]
    },
    "debug_mode_enabled": true,
    "example_valid_request": {
      "model": "claude-3-sonnet-20240229",
      "messages": [
        {
          "role": "user",
          "content": "Hello, world!"
        }
      ],
      "stream": false
    }
  }
}
```

---

## 📊 Error Handling

### Standard Error Format

All errors follow OpenAI's error response format:

```json
{
  "error": {
    "message": "Error description",
    "type": "error_type",
    "code": "error_code"
  }
}
```

### Common HTTP Status Codes

| Code | Description | When It Occurs |
|------|-------------|----------------|
| `200` | Success | Request completed successfully |
| `400` | Bad Request | Invalid request parameters |
| `401` | Unauthorized | Missing or invalid API key |
| `404` | Not Found | Session or resource not found |
| `422` | Validation Error | Request body validation failed |
| `500` | Internal Server Error | Server or Claude Code SDK error |
| `503` | Service Unavailable | Claude Code authentication failed |

### Error Types

| Type | Description |
|------|-------------|
| `validation_error` | Request validation failed |
| `api_error` | General API error |
| `streaming_error` | Error during SSE streaming |
| `authentication_error` | Claude Code authentication failed |

---

## 🔌 Integration Examples

### Basic Chat Request

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

### Streaming Request

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "claude-3-5-sonnet-20241022", 
    "messages": [
      {"role": "user", "content": "Count to 5"}
    ],
    "stream": true
  }'
```

### Session Continuity

```bash
# First message
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [
      {"role": "user", "content": "My name is Alice"}
    ],
    "session_id": "my-session-123"
  }'

# Follow-up message (remembers context)
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [
      {"role": "user", "content": "What is my name?"}
    ],
    "session_id": "my-session-123"
  }'
```

### Custom Claude Headers

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -H "X-Claude-Max-Turns: 3" \
  -H "X-Claude-Permission-Mode: acceptEdits" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [
      {"role": "user", "content": "Help me write code"}
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "create_file",
          "description": "Create a new file with content",
          "parameters": {
            "type": "object",
            "properties": {
              "path": {"type": "string", "description": "File path"},
              "content": {"type": "string", "description": "File content"}
            },
            "required": ["path", "content"]
          }
        }
      }
    ],
    "tool_choice": "auto"
  }'
```

## 🔧 Complete Tool Calling Workflow Example

Here's a complete example of how tool calling works with the wrapper:

### Step 1: Initial Request with Tools

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [
      {"role": "user", "content": "Read my config file at /home/user/app.json"}
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "read_file",
          "description": "Read content from a file",
          "parameters": {
            "type": "object",
            "properties": {
              "path": {"type": "string", "description": "File path to read"}
            },
            "required": ["path"]
          }
        }
      }
    ],
    "tool_choice": "auto"
  }'
```

### Step 2: Wrapper Returns Tool Call

```json
{
  "choices": [{
    "message": {
      "role": "assistant", 
      "content": null,
      "tool_calls": [{
        "id": "call_abc123",
        "type": "function", 
        "function": {
          "name": "read_file",
          "arguments": "{\"path\": \"/home/user/app.json\"}"
        }
      }]
    },
    "finish_reason": "tool_calls"
  }]
}
```

### Step 3: Client Executes Tool and Continues Conversation

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [
      {"role": "user", "content": "Read my config file at /home/user/app.json"},
      {
        "role": "assistant",
        "content": null,
        "tool_calls": [{
          "id": "call_abc123",
          "type": "function", 
          "function": {
            "name": "read_file",
            "arguments": "{\"path\": \"/home/user/app.json\"}"
          }
        }]
      },
      {
        "role": "tool",
        "tool_call_id": "call_abc123", 
        "content": "{\"database_url\": \"postgres://localhost\", \"port\": 3000}"
      }
    ]
  }'
```

### Step 4: Final Response

```json
{
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "I can see your config file contains database and port settings. Your app is configured to connect to a PostgreSQL database at localhost and run on port 3000."
    },
    "finish_reason": "stop"
  }]
}
```

This workflow shows how the wrapper enables OpenAI-compatible tool calling while maintaining security by having clients execute tools in their own environment.

---

This API reference provides complete documentation for integrating with the Claude Code OpenAI Wrapper, ensuring full compatibility with OpenAI clients while leveraging Claude's capabilities through secure, client-side tool execution.