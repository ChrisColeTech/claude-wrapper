# Claude Wrapper API Reference

## 🎯 Overview

This document provides complete API documentation for the claude-wrapper service. The API is designed for 100% compatibility with the OpenAI API while providing Claude integration capabilities.

**Reference**: See [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) for the complete project organization.

## 🔗 Base Configuration

### **Base URL**
```
http://localhost:8000
```

### **Authentication**
Optional bearer token authentication for API protection:
```bash
Authorization: Bearer your-api-token-here
```

### **Content Type**
All requests must use JSON:
```
Content-Type: application/json
```

## 📡 Chat Completions API

### **Create Chat Completion**

#### **Non-Streaming**
```http
POST /v1/chat/completions
```

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
  "session_id": "sess_abc123",
  "max_tokens": 1000,
  "temperature": 0.7,
  "stream": false,
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
  ],
  "tool_choice": "auto"
}
```

**Response:**
```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1677649420,
  "model": "claude-3-5-sonnet-20241022",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! I'm doing well, thank you for asking.",
        "tool_calls": [
          {
            "id": "call_abc123",
            "type": "function",
            "function": {
              "name": "get_weather",
              "arguments": "{\"location\": \"San Francisco\"}"
            }
          }
        ]
      },
      "finish_reason": "tool_calls"
    }
  ],
  "usage": {
    "prompt_tokens": 12,
    "completion_tokens": 18,
    "total_tokens": 30
  },
  "session_id": "sess_abc123"
}
```

#### **Streaming**
```http
POST /v1/chat/completions
Content-Type: application/json

{
  "model": "claude-3-5-sonnet-20241022",
  "messages": [
    {
      "role": "user", 
      "content": "Tell me a story"
    }
  ],
  "stream": true
}
```

**Response** (Server-Sent Events):
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1677649420,"model":"claude-3-5-sonnet-20241022","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1677649420,"model":"claude-3-5-sonnet-20241022","choices":[{"index":0,"delta":{"content":"Once"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1677649420,"model":"claude-3-5-sonnet-20241022","choices":[{"index":0,"delta":{"content":" upon"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1677649420,"model":"claude-3-5-sonnet-20241022","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

### **Request Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | Yes | Model identifier (e.g., "claude-3-5-sonnet-20241022") |
| `messages` | array | Yes | Array of message objects |
| `session_id` | string | No | Session ID for conversation continuity |
| `max_tokens` | integer | No | Maximum tokens to generate (default: 1000) |
| `temperature` | number | No | Sampling temperature 0-1 (default: 0.7) |
| `stream` | boolean | No | Enable streaming responses (default: false) |
| `tools` | array | No | Available tools for the model to use |
| `tool_choice` | string/object | No | Control tool usage ("auto", "none", or specific tool) |

### **Message Format**

```json
{
  "role": "user|assistant|system|tool",
  "content": "Message content",
  "name": "function_name",
  "tool_call_id": "call_abc123"
}
```

### **Tool Choice Options**

```json
// Auto - Let model decide
"tool_choice": "auto"

// None - Disable tools
"tool_choice": "none"

// Specific tool
"tool_choice": {
  "type": "function",
  "function": {"name": "get_weather"}
}
```

## 🤖 Models API

### **List Models**
```http
GET /v1/models
```

**Response:**
```json
{
  "object": "list",
  "data": [
    {
      "id": "claude-3-5-sonnet-20241022",
      "object": "model",
      "created": 1677649420,
      "owned_by": "anthropic",
      "capabilities": {
        "tools": true,
        "streaming": true,
        "context_length": 200000
      }
    },
    {
      "id": "claude-3-5-haiku-20241022",
      "object": "model", 
      "created": 1677649420,
      "owned_by": "anthropic",
      "capabilities": {
        "tools": true,
        "streaming": true,
        "context_length": 200000
      }
    }
  ]
}
```

### **Get Model**
```http
GET /v1/models/{model_id}
```

**Response:**
```json
{
  "id": "claude-3-5-sonnet-20241022",
  "object": "model",
  "created": 1677649420,
  "owned_by": "anthropic",
  "capabilities": {
    "tools": true,
    "streaming": true,
    "context_length": 200000,
    "max_tokens": 4096
  }
}
```

## 💬 Session Management API

### **Create Session**
Sessions are created automatically when using `session_id` in chat completions.

### **List Sessions**
```http
GET /v1/sessions
```

**Response:**
```json
{
  "object": "list",
  "data": [
    {
      "session_id": "sess_abc123",
      "created_at": "2025-07-06T10:30:00.000Z",
      "last_accessed_at": "2025-07-06T10:35:00.000Z",
      "message_count": 4,
      "expires_at": "2025-07-06T11:30:00.000Z",
      "status": "active"
    }
  ]
}
```

### **Get Session**
```http
GET /v1/sessions/{session_id}
```

**Response:**
```json
{
  "session_id": "sess_abc123",
  "created_at": "2025-07-06T10:30:00.000Z",
  "last_accessed_at": "2025-07-06T10:35:00.000Z", 
  "message_count": 4,
  "expires_at": "2025-07-06T11:30:00.000Z",
  "status": "active",
  "messages": [
    {
      "role": "user",
      "content": "Hello"
    },
    {
      "role": "assistant", 
      "content": "Hi there! How can I help you?"
    }
  ]
}
```

### **Update Session**
```http
PATCH /v1/sessions/{session_id}
```

**Request Body:**
```json
{
  "expires_at": "2025-07-06T12:30:00.000Z"
}
```

### **Delete Session**
```http
DELETE /v1/sessions/{session_id}
```

**Response:**
```json
{
  "deleted": true,
  "session_id": "sess_abc123"
}
```

### **Session Statistics**
```http
GET /v1/sessions/stats
```

**Response:**
```json
{
  "total_sessions": 5,
  "active_sessions": 3,
  "expired_sessions": 2,
  "memory_usage_mb": 12.5,
  "cleanup_runs": 24,
  "average_session_age_minutes": 15.2
}
```

## 🔐 Authentication API

### **Authentication Status**
```http
GET /v1/auth/status
```

**Response:**
```json
{
  "authenticated": true,
  "method": "anthropic",
  "providers": {
    "anthropic": {
      "available": true,
      "configured": true,
      "valid": true
    },
    "bedrock": {
      "available": false,
      "configured": false,
      "error": "AWS credentials not configured"
    },
    "vertex": {
      "available": false,
      "configured": false,
      "error": "Google Cloud credentials not found"
    },
    "claude_cli": {
      "available": true,
      "configured": true,
      "valid": false,
      "error": "CLI authentication test failed"
    }
  }
}
```

## 🔍 Health & Monitoring API

### **Health Check**
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "claude-code-openai-wrapper",
  "version": "1.0.0",
  "timestamp": "2025-07-06T10:30:00.000Z",
  "uptime": 3600,
  "checks": {
    "claude_integration": "healthy",
    "session_storage": "healthy",
    "memory_usage": "healthy"
  }
}
```

### **Detailed Health**
```http
GET /v1/health/detailed
```

**Response:**
```json
{
  "status": "healthy",
  "service": "claude-code-openai-wrapper",
  "version": "1.0.0",
  "timestamp": "2025-07-06T10:30:00.000Z",
  "uptime": 3600,
  "system": {
    "memory": {
      "usage": "45.2MB",
      "limit": "512MB",
      "percentage": 8.8
    },
    "cpu": {
      "usage": "12%"
    }
  },
  "components": {
    "claude_integration": {
      "status": "healthy",
      "response_time": "120ms",
      "last_check": "2025-07-06T10:29:45.000Z"
    },
    "session_storage": {
      "status": "healthy",
      "active_sessions": 3,
      "memory_usage": "2.1MB"
    },
    "authentication": {
      "status": "healthy", 
      "active_providers": ["anthropic"],
      "last_auth_check": "2025-07-06T10:25:00.000Z"
    }
  }
}
```

### **System Metrics**
```http
GET /v1/metrics
```

**Response:**
```json
{
  "requests": {
    "total": 1234,
    "success": 1200,
    "errors": 34,
    "rate_per_minute": 45.2
  },
  "response_times": {
    "average": "250ms",
    "p95": "500ms",
    "p99": "1200ms"
  },
  "sessions": {
    "active": 12,
    "created_today": 45,
    "average_duration": "15m"
  },
  "claude_integration": {
    "total_tokens": 125000,
    "total_requests": 890,
    "average_response_time": "180ms"
  }
}
```

## 🛠️ Debug & Development API

### **Debug Information**
```http
GET /v1/debug/info
```

**Response:**
```json
{
  "service": "claude-code-openai-wrapper",
  "version": "1.0.0",
  "environment": "development",
  "node_version": "18.17.0",
  "memory": {
    "heap_used": "45.2MB",
    "heap_total": "67.8MB",
    "external": "12.1MB"
  },
  "configuration": {
    "session_ttl": "1h",
    "cleanup_interval": "5m",
    "max_sessions": 10000
  }
}
```

### **Diagnostics**
```http
GET /v1/debug/diagnostics
```

**Response:**
```json
{
  "timestamp": "2025-07-06T10:30:00.000Z",
  "checks": [
    {
      "name": "claude_sdk_availability",
      "status": "pass",
      "message": "Claude SDK is available and responding"
    },
    {
      "name": "session_storage_health",
      "status": "pass", 
      "message": "Session storage is functioning normally"
    },
    {
      "name": "memory_usage",
      "status": "warn",
      "message": "Memory usage is above 80% threshold"
    }
  ]
}
```

## ❌ Error Responses

### **Error Format**
All errors follow OpenAI-compatible format:

```json
{
  "error": {
    "message": "Invalid model specified",
    "type": "invalid_request_error",
    "param": "model",
    "code": "invalid_model"
  }
}
```

### **HTTP Status Codes**

| Code | Description | Example |
|------|-------------|---------|
| 200 | Success | Successful completion |
| 400 | Bad Request | Invalid parameters |
| 401 | Unauthorized | Missing/invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Session or model not found |
| 422 | Validation Error | Request validation failed |
| 429 | Rate Limited | Too many requests |
| 500 | Internal Error | Server error |
| 502 | Bad Gateway | Claude API unavailable |
| 503 | Service Unavailable | Service temporarily unavailable |

### **Common Error Types**

#### **Authentication Errors**
```json
{
  "error": {
    "message": "No valid authentication method found",
    "type": "authentication_error",
    "code": "no_auth_configured"
  }
}
```

#### **Validation Errors**
```json
{
  "error": {
    "message": "Request validation failed",
    "type": "invalid_request_error",
    "param": "messages",
    "code": "validation_error",
    "details": [
      {
        "field": "messages.0.content",
        "message": "Content is required",
        "type": "required"
      }
    ]
  }
}
```

#### **Claude Integration Errors**
```json
{
  "error": {
    "message": "Claude API request failed",
    "type": "service_error", 
    "code": "claude_api_error",
    "details": {
      "claude_error": "rate_limit_exceeded",
      "retry_after": 60
    }
  }
}
```

#### **Session Errors**
```json
{
  "error": {
    "message": "Session not found or expired",
    "type": "invalid_request_error",
    "param": "session_id",
    "code": "session_not_found"
  }
}
```

## 🔧 Configuration Options

### **Environment Variables**

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `PORT` | No | Server port | 8000 |
| `NODE_ENV` | No | Environment | development |
| `API_KEY` | No | Bearer token for API protection | None |
| `ANTHROPIC_API_KEY` | No | Anthropic API key | None |
| `CLAUDE_CODE_USE_BEDROCK` | No | Enable AWS Bedrock | false |
| `CLAUDE_CODE_USE_VERTEX` | No | Enable Google Vertex | false |
| `AWS_ACCESS_KEY_ID` | No | AWS access key | None |
| `AWS_SECRET_ACCESS_KEY` | No | AWS secret key | None |
| `AWS_REGION` | No | AWS region | us-east-1 |
| `GOOGLE_APPLICATION_CREDENTIALS` | No | GCP service account file | None |
| `GCLOUD_PROJECT` | No | Google Cloud project ID | None |

### **Claude-Specific Headers**

| Header | Description | Example |
|--------|-------------|---------|
| `X-Claude-Model` | Override model selection | claude-3-5-sonnet-20241022 |
| `X-Claude-Max-Tokens` | Override max tokens | 2000 |
| `X-Claude-Temperature` | Override temperature | 0.8 |
| `X-Session-TTL` | Override session TTL | 3600 |

## 📝 Usage Examples

### **cURL Examples**

#### **Basic Chat Completion**
```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

#### **Streaming Chat**
```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet-20241022", 
    "messages": [{"role": "user", "content": "Tell me a story"}],
    "stream": true
  }'
```

#### **With Session**
```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [{"role": "user", "content": "Remember my name is John"}],
    "session_id": "sess_user123"
  }'
```

#### **With Tools**
```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [{"role": "user", "content": "What is the weather in Paris?"}],
    "tools": [{
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Get weather information",
        "parameters": {
          "type": "object",
          "properties": {
            "location": {"type": "string"}
          },
          "required": ["location"]
        }
      }
    }],
    "tool_choice": "auto"
  }'
```

---

**Note**: This API is designed for 100% compatibility with OpenAI's API while providing Claude-specific capabilities. All OpenAI SDK clients should work seamlessly with this wrapper.