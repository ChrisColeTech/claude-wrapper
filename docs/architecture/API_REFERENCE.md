# API Reference - Claude Wrapper

## 📋 Overview

The Claude Wrapper provides an OpenAI-compatible API interface for interacting with Claude Code CLI. This document describes all available endpoints, request/response formats, and authentication methods.

The wrapper also serves the Anthropic Messages API on the same port: see [Anthropic Surface](#anthropic-surface), whose full contract is the OpenAPI document at `/docs/anthropic-openapi.json`.

## 🌐 Base URL

```
http://localhost:8000
```

## 🔑 Authentication

### **HTTP API Protection (Optional)**
- **No Authentication Required**: Default mode - direct access to all endpoints
- **Bearer Token Protection**: Optional API key protection with `--api-key` flag
- **Anthropic Surface**: Also accepts the key as `x-api-key`, and answers a missing or wrong key with the Anthropic error envelope
- **Selective Protection**: Health and models endpoints always public
- **Local Development**: Perfect for development and testing without auth overhead

## 📊 Core Endpoints

### **Chat Completions**

#### `POST /v1/chat/completions`

Create a chat completion using Claude Code CLI.

**Request Body:**
```json
{
  "model": "claude-3-5-sonnet-20241022",
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "max_tokens": 1000,
  "temperature": 0.7,
  "stream": false
}
```

**Response:**
```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1677652288,
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
    "prompt_tokens": 10,
    "completion_tokens": 15,
    "total_tokens": 25
  }
}
```

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | Yes | Model identifier (e.g., "claude-3-5-sonnet-20241022") |
| `messages` | array | Yes | Array of conversation messages |
| `max_tokens` | integer | No | Maximum tokens in response (default: 1000) |
| `temperature` | number | No | Sampling temperature 0-2 (default: 0.7) |
| `stream` | boolean | No | Enable streaming responses (default: false) |
| `tools` | array | No | Available tools for function calling |
| `tool_choice` | string/object | No | Tool usage preference |

**Message Format:**
```json
{
  "role": "user|assistant|system|tool",
  "content": "Message content",
  "tool_calls": [
    {
      "id": "call_abc123",
      "type": "function",
      "function": {
        "name": "function_name",
        "arguments": "{\"param\":\"value\"}"
      }
    }
  ],
  "tool_call_id": "call_abc123"
}
```

**Tool Calls Example:**
```json
{
  "model": "claude-3-5-sonnet-20241022",
  "messages": [
    {
      "role": "user",
      "content": "What's the weather like today?"
    }
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Get current weather information",
        "parameters": {
          "type": "object",
          "properties": {
            "location": {
              "type": "string",
              "description": "City name"
            }
          },
          "required": ["location"]
        }
      }
    }
  ]
}
```

**Error Responses:**
```json
{
  "error": {
    "message": "Invalid request format",
    "type": "invalid_request_error",
    "param": "messages",
    "code": "invalid_request"
  }
}
```

### **Streaming Chat Completions**

#### `POST /v1/chat/completions` (with `stream: true`)

Create a streaming chat completion using Server-Sent Events.

**Request Body:**
```json
{
  "model": "sonnet",
  "messages": [...],
  "stream": true
}
```

**Response Headers:**
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**Response Format:**
```
data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1677652288,"model":"sonnet","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1677652288,"model":"sonnet","choices":[{"index":0,"delta":{"content":" there"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1677652288,"model":"sonnet","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

**Streaming Tool Calls:**
```
data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1677652288,"model":"claude-3-5-sonnet-20241022","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_abc123","type":"function","function":{"name":"get_weather","arguments":""}}]},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1677652288,"model":"claude-3-5-sonnet-20241022","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"location\""}}]},"finish_reason":null}]}
```

## 🔍 Information Endpoints

### **Models**

#### `GET /v1/models`

List available models.

**Response:**
```json
{
  "object": "list",
  "data": [
    {
      "id": "claude-3-5-sonnet-20241022",
      "object": "model",
      "owned_by": "anthropic",
      "created": 1677652288
    },
    {
      "id": "claude-3-5-haiku-20241022",
      "object": "model",
      "owned_by": "anthropic",
      "created": 1677652288
    }
  ]
}
```

### **Health Check**

#### `GET /health`

Service health status.

**Response:**
```json
{
  "status": "healthy",
  "service": "claude-wrapper-poc",
  "version": "1.0.0",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

The response also has an `anthropic` key with the Anthropic surface's run counts: `{active, parked, maxRuns, queued, rateLimit}`. `queued` is the number of turns waiting on their conversation's previous run, over every conversation. The counts are aggregates: no upstream session id appears.


## Anthropic Surface

The Anthropic Messages API, served beside the OpenAI surface on the same port. The official Anthropic SDKs work against it unmodified (`ANTHROPIC_BASE_URL=http://localhost:8000`). What it is, the operator warning and the known deviations from the real API are in the [README](../../README.md#anthropic-surface); settings are in the [runbook](../ANTHROPIC_SURFACE_RUNBOOK.md).

**The OpenAPI document is the full contract.** It covers every body field, content block, tool type, stream event and error, with the surface's deviations stated on the fields they concern:

- `GET /docs/anthropic-openapi.json`, public like `/swagger.json`;
- the Swagger UI at `/docs`, where "Anthropic surface" is one of the two definitions in the picker;
- its source, `app/src/anthropic/http/openapi.json`. It is a static file. `app/tests/integration/anthropic/openapi-document.test.ts` checks it is valid and that its body fields match what the surface accepts.

### **Requests**

| Header | Rule |
| - | - |
| `anthropic-version` | Required on `/v1/messages` and `/v1/messages/count_tokens`: `2023-06-01`, or the deprecated `2023-01-01`. Missing or another value is a 400. On `/v1/models*`, its presence alone selects this surface. |
| `x-api-key` or `Authorization: Bearer` | The wrapper's `API_KEY`, when one is set (wrong or missing: 401 `authentication_error`). With no `API_KEY` the surface is open. The key never reaches upstream. |
| `anthropic-beta` | Accepted and ignored, except `mcp-client-2025-11-20`, which enables `mcp_servers`. |
| `content-type` | `application/json`. Bodies up to 32 MB (413 `request_too_large` above). |

Every response carries `request-id: req_<24 base62 characters>`.

### **Endpoints**

#### `POST /v1/messages`

One turn on upstream, answered as one API message, even when upstream made several model calls. Without `stream` the response is a `Message`; with `stream: true` it is server-sent events: `message_start`, then `content_block_start`, `content_block_delta` and `content_block_stop` per block, `message_delta` with the summed usage, then `message_stop`. A `ping` follows 15 s without an event.

```bash
curl http://localhost:8000/v1/messages \
  -H 'content-type: application/json' -H 'anthropic-version: 2023-06-01' \
  -d '{"model": "sonnet", "max_tokens": 1024, "messages": [{"role": "user", "content": "Hello, Claude"}]}'
```

```json
{
  "id": "msg_01XFDUDYJgAACzvnptvVoYEL",
  "type": "message",
  "role": "assistant",
  "model": "claude-sonnet-5-5",
  "content": [{ "type": "text", "text": "Hello! How can I help?", "citations": null }],
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "stop_details": null,
  "container": null,
  "diagnostics": null,
  "usage": { "input_tokens": 512, "output_tokens": 9, "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0, "service_tier": "standard" }
}
```

What the turn supports:

- **Client tools.** A turn that calls one ends with upstream's own `tool_use` blocks and `stop_reason: tool_use`. The `tool_result` blocks on the next request continue the same run.
- **Web search and web fetch.** `web_search_*` and `web_fetch_*` tools come back as `server_tool_use` and `web_search_tool_result` / `web_fetch_tool_result` blocks.
- **Connectors.** `mcp_servers` with `mcp_toolset` tools come back as `mcp_tool_use` and `mcp_tool_result` blocks.
- **Conversations.** A history that matches what the surface served continues upstream's session; any other history is replayed into a fresh run's prompt.

#### `POST /v1/messages/count_tokens`

The Messages body without the output-only fields. It answers `{"input_tokens": <n>}`, measured by a run of its own capped at one output token, so the count includes the context upstream adds (about 500 tokens). Each count costs one minimal model call.

#### `GET /v1/models` (with `anthropic-version`)

The catalogue, newest first: `{"data": [ModelInfo...], "first_id", "last_id", "has_more"}`. Query parameters: `limit` (1 to 1000, default 20), `after_id` and `before_id` (an id or alias in the catalogue). Without the header this path is the OpenAI surface's list, described above.

#### `GET /v1/models/{model_id}` (with `anthropic-version`)

One catalogue entry, found by canonical id or alias, under its canonical id. An unknown name is 404 `not_found_error`.

### **Errors**

Every error is `{"type": "error", "error": {"type", "message"}, "request_id"}`, carrying the same id as the `request-id` header. A turn's status and headers are final at its first `message_start`. A failure before that is an HTTP status from the table below. A failure after it is one SSE `error` event with the same body, and then the stream closes.

| Status | `error.type` | When |
| - | - | - |
| 400 | `invalid_request_error` | Covers four cases: a request the surface refuses before any run (an unknown field, or an unsupported parameter, block or tool type); `anthropic-version` missing or unknown; invalid JSON; upstream's own 400, including the billing gate, relayed verbatim. |
| 401 | `authentication_error` | `API_KEY` is set and the client's key is missing or wrong. |
| 404 | `not_found_error` | The model is not in the catalogue (`model: <name>`), or there is no such path or method under `/v1/messages`. |
| 413 | `request_too_large` | The body is over 32 MB. |
| 429 | `rate_limit_error` | Upstream's rate limit. It carries `retry-after` when the reset time is known. |
| 500 | `api_error` | Covers three cases: the operator's Claude Code login or billing failed (the message names the upstream login); the Claude Code binary is missing; or a run failed or exited. |
| 504 | `timeout_error` | A run's startup, stall or lifetime timer fired. |
| 529 | `overloaded_error` | The wrapper is at its cap on runs or shutting down, or upstream is overloaded. |

`x-should-retry: false` comes on every 4xx and on the 500s that retrying cannot fix. Otherwise the header is absent, so the SDK's own retry rules apply.

## 🗂️ Session Management Endpoints (Planned)

### **List Sessions**

#### `GET /v1/sessions`

List active sessions.

**Response:**
```json
{
  "sessions": [
    {
      "id": "session_abc123",
      "created_at": "2024-01-01T00:00:00Z",
      "last_activity": "2024-01-01T00:10:00Z",
      "message_count": 5,
      "expires_at": "2024-01-01T01:00:00Z"
    }
  ]
}
```

### **Get Session**

#### `GET /v1/sessions/{session_id}`

Get specific session information.

**Response:**
```json
{
  "id": "session_abc123",
  "created_at": "2024-01-01T00:00:00Z",
  "last_activity": "2024-01-01T00:10:00Z",
  "message_count": 5,
  "expires_at": "2024-01-01T01:00:00Z",
  "messages": [
    {
      "role": "user",
      "content": "Hello",
      "timestamp": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### **Delete Session**

#### `DELETE /v1/sessions/{session_id}`

Delete a specific session.

**Response:**
```json
{
  "deleted": true,
  "id": "session_abc123"
}
```

### **Session Statistics**

#### `GET /v1/sessions/stats`

Get session statistics.

**Response:**
```json
{
  "total_sessions": 10,
  "active_sessions": 3,
  "total_messages": 150,
  "average_session_length": 15.5
}
```

## 🛠️ Tool Integration

### **Tool Call Format**

The wrapper supports OpenAI-compatible tool calls:

```json
{
  "tool_calls": [
    {
      "id": "call_abc123",
      "type": "function",
      "function": {
        "name": "get_weather",
        "arguments": "{\"location\":\"San Francisco\"}"
      }
    }
  ]
}
```

### **Tool Result Format**

Tool results are provided back to the model:

```json
{
  "role": "tool",
  "tool_call_id": "call_abc123",
  "content": "{\"temperature\": 72, \"condition\": \"sunny\"}"
}
```

## 📊 Error Handling

### **Error Response Format**

All errors follow OpenAI's error format:

```json
{
  "error": {
    "message": "Error description",
    "type": "error_type",
    "param": "parameter_name",
    "code": "error_code"
  }
}
```

### **Error Types**

| Type | Description | HTTP Status |
|------|-------------|-------------|
| `invalid_request_error` | Invalid request format or parameters | 400 |
| `authentication_error` | Authentication failed | 401 |
| `permission_error` | Insufficient permissions | 403 |
| `not_found_error` | Resource not found | 404 |
| `rate_limit_error` | Rate limit exceeded | 429 |
| `internal_server_error` | Internal server error | 500 |
| `service_unavailable_error` | Service temporarily unavailable | 503 |

### **Common Error Codes**

| Code | Description |
|------|-------------|
| `invalid_request` | Request format is invalid |
| `missing_required_parameter` | Required parameter is missing |
| `invalid_parameter_value` | Parameter value is invalid |
| `authentication_failed` | Authentication credentials are invalid |
| `rate_limit_exceeded` | Rate limit has been exceeded |
| `claude_unavailable` | Claude CLI is not available |
| `timeout` | Request timed out |

## 🔄 Request/Response Examples

### **Simple Chat**

**Request:**
```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

**Response:**
```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "claude-3-5-sonnet-20241022",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 8,
    "completion_tokens": 12,
    "total_tokens": 20
  }
}
```

### **Tool Call Example**

**Request:**
```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [
      {"role": "user", "content": "What is 2+2?"}
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "calculate",
          "description": "Perform mathematical calculations",
          "parameters": {
            "type": "object",
            "properties": {
              "expression": {"type": "string"}
            },
            "required": ["expression"]
          }
        }
      }
    ]
  }'
```

**Response:**
```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1677652288,
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
              "name": "calculate",
              "arguments": "{\"expression\": \"2+2\"}"
            }
          }
        ]
      },
      "finish_reason": "tool_calls"
    }
  ],
  "usage": {
    "prompt_tokens": 85,
    "completion_tokens": 15,
    "total_tokens": 100
  }
}
```

### **Streaming Example**

**Request:**
```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [
      {"role": "user", "content": "Tell me a short story"}
    ],
    "stream": true
  }'
```

**Response:**
```
data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1677652288,"model":"claude-3-5-sonnet-20241022","choices":[{"index":0,"delta":{"role":"assistant","content":"Once"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1677652288,"model":"claude-3-5-sonnet-20241022","choices":[{"index":0,"delta":{"content":" upon"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1677652288,"model":"claude-3-5-sonnet-20241022","choices":[{"index":0,"delta":{"content":" a"},"finish_reason":null}]}

data: [DONE]
```

## 📈 Rate Limiting

### **Development Mode**
- **No Rate Limiting**: Unlimited requests for development

### **Production Mode (Planned)**
- **Per-API Key**: 1000 requests per hour
- **Per-IP**: 100 requests per hour (unauthenticated)
- **Burst Allowance**: 10 requests per minute

## 🏷️ Versioning

### **API Version**
- **Current**: v1
- **Stability**: Stable for core endpoints
- **Deprecation**: 6-month notice for breaking changes

### **Compatibility**
- **OpenAI API**: Compatible with OpenAI Chat Completions API
- **Tool Calls**: Full support for OpenAI tool calling format
- **Streaming**: Compatible with OpenAI streaming format

This API reference provides complete documentation for all current and planned endpoints in the Claude Wrapper system.