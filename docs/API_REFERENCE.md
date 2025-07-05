# API Reference - Claude Code OpenAI Wrapper

This document provides complete documentation for all API endpoints in the Claude Code OpenAI Wrapper, based on the Python implementation in `main.py`.

## 🎯 API Overview

The wrapper provides an OpenAI-compatible REST API that translates OpenAI Chat Completions requests to Claude Code CLI calls. All endpoints return standard OpenAI-formatted responses for seamless integration.

**Base URL**: `http://localhost:8000` (configurable via `PORT` environment variable)
**API Version**: `v1`
**Content-Type**: `application/json`

## 🔐 Authentication

### API Key Authentication (Optional)

The wrapper supports optional API key protection for enhanced security. When enabled, all endpoints require Bearer token authentication.

#### Configuration Methods

1. **Interactive Setup** (Recommended)
   ```bash
   claude-wrapper
   # Follow the interactive prompt to generate a secure API key
   ```

2. **CLI Flag**
   ```bash
   claude-wrapper --api-key your-secure-api-key-here
   ```

3. **Environment Variable**
   ```bash
   export API_KEY="your-secure-api-key-here"
   claude-wrapper
   ```

4. **Skip Protection**
   ```bash
   claude-wrapper --no-interactive
   # Disables API key protection entirely
   ```

#### Authentication Headers

When API key protection is enabled, include the Bearer token in all requests:

```http
Authorization: Bearer your-api-key-here
```

#### Security Features

- **Secure Generation**: Interactive setup generates cryptographically secure 32-character tokens
- **Multiple Sources**: Supports environment variables, CLI flags, and interactive generation
- **Validation**: Enforces key format and length requirements (8-256 characters, alphanumeric + -_)
- **Logging**: Security events are logged for audit purposes
- **Flexible Policy**: Can be enabled/disabled per deployment

**Status Codes for Auth Errors**:
- `401 Unauthorized` - Missing or invalid API key
- `403 Forbidden` - Valid key but insufficient permissions

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
**Implementation**: `/app/src/routes/health.ts:106-125`

Basic health check endpoint for monitoring and load balancers.

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

#### Error Response

```json
{
  "status": "unhealthy",
  "service": "claude-code-openai-wrapper",
  "error": "Health check failed"
}
```

**Status Codes**: `200` (healthy), `503` (unhealthy)

---

### GET /health/detailed

**Implementation**: `/app/src/routes/health.ts:131-197`  
**Phase 3B Feature**: Enhanced health monitoring for production operations

Detailed health check endpoint with comprehensive system information and monitoring data.

#### Request

```http
GET /health/detailed
```

#### Response

```json
{
  "status": "healthy",
  "service": "claude-code-openai-wrapper",
  "version": "1.0.0",
  "timestamp": "2023-11-07T10:45:00.123Z",
  "uptime": 1847523,
  "details": {
    "server": "running",
    "authentication": "configured",
    "memory_usage": {
      "used": 45234176,
      "total": 64829440,
      "percentage": 70
    },
    "port_management": {
      "active_reservations": 3,
      "port_scan_performance": "optimal"
    },
    "monitoring": {
      "health_checks_active": true,
      "last_check": "2023-11-07T10:44:58.891Z",
      "overall_status": "healthy",
      "check_count": 4
    }
  }
}
```

#### Response Fields

- `status`: Overall health status (`healthy`, `unhealthy`)
- `service`: Service name identifier
- `version`: Service version
- `timestamp`: Current timestamp
- `uptime`: Service uptime in milliseconds
- `details`: Detailed system information
  - `server`: Server state (`running`, `starting`, `stopping`)
  - `authentication`: Auth status (`configured`, `not_configured`)
  - `memory_usage`: Memory usage statistics
  - `port_management`: Port manager status and performance
  - `monitoring`: Health monitoring system status

**Status Codes**: `200` (healthy), `503` (unhealthy)

---

### GET /health/production

**Implementation**: `/app/src/routes/health.ts:203-284`  
**Phase 3B Feature**: Production-grade comprehensive health monitoring

Production-grade health check providing detailed metrics for monitoring, alerting, and operational visibility.

#### Request

```http
GET /health/production
```

#### Response

```json
{
  "status": "healthy",
  "service": "claude-code-openai-wrapper",
  "version": "1.0.0",
  "timestamp": "2023-11-07T10:45:00.123Z",
  "uptime": 1847523,
  "details": {
    "server": "running",
    "authentication": "configured",
    "memory_usage": {
      "used": 45234176,
      "total": 64829440,
      "percentage": 70
    },
    "port_management": {
      "active_reservations": 3,
      "port_scan_performance": "optimal"
    },
    "monitoring": {
      "health_checks_active": true,
      "last_check": "2023-11-07T10:44:58.891Z",
      "overall_status": "healthy",
      "check_count": 4
    }
  },
  "production_metrics": {
    "response_times": {
      "average": 342,
      "recent": []
    },
    "resource_usage": {
      "memory_trend": "normal",
      "port_conflicts_resolved": 0
    },
    "health_history": {
      "consecutive_healthy_checks": 15,
      "uptime_percentage": 99.8
    }
  }
}
```

#### Response Fields

All fields from `/health/detailed` plus:

- `production_metrics`: Production monitoring data
  - `response_times`: Response time metrics
    - `average`: Average response time in milliseconds
    - `recent`: Recent response times array
  - `resource_usage`: Resource usage trends
    - `memory_trend`: Memory usage trend (`low`, `normal`, `high`)
    - `port_conflicts_resolved`: Number of port conflicts resolved
  - `health_history`: Health check history
    - `consecutive_healthy_checks`: Number of consecutive healthy checks
    - `uptime_percentage`: Service uptime percentage

**Status Codes**: `200` (healthy), `503` (unhealthy)

---

### GET /health/monitoring

**Implementation**: `/app/src/routes/health.ts:290-319`  
**Phase 3B Feature**: Real-time monitoring data access

Real-time monitoring data endpoint providing current health monitoring system data.

#### Request

```http
GET /health/monitoring
```

#### Response

```json
{
  "monitoring_active": true,
  "last_updated": "2023-11-07T10:44:58.891Z",
  "report": {
    "overall": "healthy",
    "uptime": 1847523,
    "timestamp": "2023-11-07T10:44:58.891Z",
    "checks": [
      {
        "name": "memory",
        "status": "healthy",
        "message": "Memory usage: 45.2MB / 64.8MB (69.7%)",
        "duration": 2,
        "timestamp": "2023-11-07T10:44:58.891Z",
        "details": {
          "memoryUsage": {
            "rss": 45234176,
            "heapUsed": 32145728,
            "heapTotal": 64829440,
            "external": 1843521
          },
          "usageRatio": 0.497
        }
      },
      {
        "name": "server-port",
        "status": "healthy",
        "message": "Server port 3000 is active",
        "duration": 1,
        "timestamp": "2023-11-07T10:44:58.891Z",
        "details": {
          "port": 3000,
          "available": false,
          "activePort": 3000
        }
      },
      {
        "name": "uptime",
        "status": "healthy",
        "message": "System uptime: 30m 47s",
        "duration": 0,
        "timestamp": "2023-11-07T10:44:58.891Z",
        "details": {
          "uptimeMs": 1847523,
          "uptimeSeconds": 1847
        }
      }
    ],
    "summary": {
      "healthy": 3,
      "warning": 0,
      "unhealthy": 0,
      "total": 3
    },
    "performance": {
      "avgResponseTime": 1.67,
      "memoryUsage": {
        "rss": 45234176,
        "heapUsed": 32145728,
        "heapTotal": 64829440,
        "external": 1843521
      }
    }
  },
  "statistics": {
    "totalChecks": 3,
    "avgResponseTime": 1.67,
    "failureRates": {},
    "uptime": 1847523
  }
}
```

#### Response Fields

- `monitoring_active`: Whether health monitoring is active
- `last_updated`: Last monitoring update timestamp
- `report`: Full health monitoring report
  - `overall`: Overall health status (`healthy`, `warning`, `unhealthy`, `unknown`)
  - `uptime`: System uptime in milliseconds
  - `checks`: Array of individual health check results
    - `name`: Health check name
    - `status`: Check status (`healthy`, `warning`, `unhealthy`)
    - `message`: Human-readable status message
    - `duration`: Check execution time in milliseconds
    - `details`: Additional check-specific data
  - `summary`: Health check summary statistics
  - `performance`: Performance metrics
- `statistics`: Monitoring system statistics

#### Error Response

```json
{
  "error": "Health monitoring not active",
  "message": "Health monitoring system is not running"
}
```

**Status Codes**: `200` (success), `404` (monitoring not active), `503` (error)

---

### GET /v1/auth/status

**Implementation**: Various auth modules  
**Authentication**: None (public endpoint)

Returns Claude Code authentication status and server security configuration.

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
    "api_key_required": false,
    "api_key_source": "none",
    "version": "1.0.0"
  },
  "security_config": {
    "protection_enabled": false,
    "api_key_configured": false,
    "key_source": "none",
    "policy": {
      "require_api_key": false,
      "min_key_length": 16,
      "max_key_length": 128,
      "allow_environment_key": true,
      "allow_runtime_key": true
    },
    "storage_info": null
  }
}
```

#### Response Fields

- `claude_code_auth`: Claude service authentication status
- `server_info`: Basic server configuration  
- `security_config`: API key protection configuration
  - `protection_enabled`: Whether endpoints require API keys
  - `api_key_configured`: Whether a valid API key is set
  - `key_source`: Source of the API key (`environment`, `runtime`, or `none`)
  - `policy`: Current security policy settings
  - `storage_info`: API key storage metadata (without exposing the actual key)

---

## 📊 Production Monitoring Endpoints

**Phase 3B Feature**: Advanced production monitoring and alerting capabilities

These endpoints provide access to the comprehensive production monitoring system for operations teams and developers.

### GET /monitoring/health

**Implementation**: `/app/src/monitoring/health-check.ts:174-256`  
**Authentication**: Optional (depends on server configuration)

Comprehensive health check service with detailed component checks and metrics.

#### Request

```http
GET /monitoring/health
Authorization: Bearer your-api-key
```

#### Response

```json
{
  "status": "healthy",
  "timestamp": "2023-11-07T10:45:00.123Z",
  "uptime": 1847523,
  "version": "1.0.0",
  "service": "claude-wrapper",
  "environment": "production",
  "checks": {
    "server": {
      "status": "pass",
      "time": "2023-11-07T10:45:00.120Z",
      "duration": 2,
      "output": "Server uptime: 1847 seconds"
    },
    "memory": {
      "status": "pass",
      "time": "2023-11-07T10:45:00.121Z",
      "duration": 1,
      "output": "Memory usage: 45MB / 65MB (69.7%)"
    },
    "eventloop": {
      "status": "pass",
      "time": "2023-11-07T10:45:00.122Z",
      "duration": 3,
      "output": "Event loop delay: 1.23ms"
    },
    "authentication": {
      "status": "pass",
      "time": "2023-11-07T10:45:00.122Z",
      "duration": 0,
      "output": "Authentication configured"
    },
    "environment": {
      "status": "pass",
      "time": "2023-11-07T10:45:00.122Z",
      "duration": 0,
      "output": "All required environment variables present"
    }
  },
  "metadata": {
    "node_version": "v18.17.0",
    "platform": "linux",
    "arch": "x64",
    "pid": 12345
  }
}
```

#### Response Fields

- `status`: Overall health status (`healthy`, `degraded`, `unhealthy`)
- `timestamp`: Check execution timestamp
- `uptime`: Service uptime in milliseconds
- `version`: Service version
- `service`: Service name
- `environment`: Deployment environment
- `checks`: Individual health check results
  - Each check has `status` (`pass`, `warn`, `fail`), `time`, `duration`, and `output`
- `metadata`: System information

**Status Codes**: `200` (success), `503` (unhealthy)

---

### GET /monitoring/readiness

**Implementation**: `/app/src/monitoring/health-check.ts:275-292`  
**Authentication**: Optional

Kubernetes-style readiness probe for determining if the service is ready to receive traffic.

#### Request

```http
GET /monitoring/readiness
```

#### Response

```json
{
  "ready": true,
  "checks": []
}
```

#### Error Response

```json
{
  "ready": false,
  "checks": ["memory", "authentication"]
}
```

#### Response Fields

- `ready`: Whether the service is ready to receive traffic
- `checks`: Array of failed check names (empty if ready)

**Status Codes**: `200` (ready), `503` (not ready)

---

### GET /monitoring/liveness

**Implementation**: `/app/src/monitoring/health-check.ts:297-304`  
**Authentication**: Optional

Kubernetes-style liveness probe for determining if the service is alive and should not be restarted.

#### Request

```http
GET /monitoring/liveness
```

#### Response

```json
{
  "alive": true,
  "uptime": 1847523
}
```

#### Response Fields

- `alive`: Whether the service is alive
- `uptime`: Service uptime in seconds

**Status Codes**: `200` (alive), `503` (not alive)

---

### GET /monitoring/system

**Implementation**: `/app/src/monitoring/system-monitor.ts:579-581`  
**Authentication**: Required

Comprehensive system monitoring data including component health and metrics.

#### Request

```http
GET /monitoring/system
Authorization: Bearer your-api-key
```

#### Response

```json
{
  "status": "healthy",
  "timestamp": "2023-11-07T10:45:00.123Z",
  "uptime": 1847523,
  "version": "1.0.0",
  "components": {
    "server": {
      "status": "healthy",
      "lastCheck": "2023-11-07T10:45:00.120Z",
      "responseTime": 2,
      "errorCount": 0,
      "details": "Server is responsive"
    },
    "authentication": {
      "status": "healthy",
      "lastCheck": "2023-11-07T10:45:00.120Z",
      "responseTime": 1,
      "errorCount": 0,
      "details": "Authentication configured"
    },
    "sessions": {
      "status": "healthy",
      "lastCheck": "2023-11-07T10:45:00.120Z",
      "responseTime": 1,
      "errorCount": 0,
      "details": "Session system operational"
    },
    "claude_sdk": {
      "status": "healthy",
      "lastCheck": "2023-11-07T10:45:00.120Z",
      "responseTime": 2,
      "errorCount": 0,
      "details": "Claude SDK accessible"
    },
    "memory": {
      "status": "healthy",
      "lastCheck": "2023-11-07T10:45:00.120Z",
      "responseTime": 0,
      "errorCount": 0,
      "details": "Memory usage: 69.7%"
    },
    "database": {
      "status": "healthy",
      "lastCheck": "2023-11-07T10:45:00.120Z",
      "responseTime": 0,
      "errorCount": 0,
      "details": "In-memory storage operational"
    }
  },
  "metrics": {
    "requests": {
      "total": 1234,
      "successful": 1198,
      "failed": 36,
      "rate": 0.67,
      "averageResponseTime": 342
    },
    "memory": {
      "used": 45234176,
      "free": 19595264,
      "usage": 69.7,
      "heapUsed": 32145728,
      "heapTotal": 64829440
    },
    "cpu": {
      "usage": 0,
      "loadAverage": [0.1, 0.05, 0.01]
    },
    "sessions": {
      "active": 5,
      "total": 23,
      "created": 28,
      "expired": 5
    },
    "errors": {
      "total": 36,
      "rate": 0.02,
      "last24Hours": 36
    }
  }
}
```

#### Response Fields

- `status`: Overall system health status
- `timestamp`: Current timestamp
- `uptime`: System uptime in milliseconds
- `version`: Service version
- `components`: Individual component health status
- `metrics`: Comprehensive system metrics including requests, memory, CPU, sessions, and errors

**Status Codes**: `200` (success), `503` (system unhealthy)

---

### GET /monitoring/metrics

**Implementation**: `/app/src/production/monitoring.ts:240-322`  
**Authentication**: Required

Production metrics summary for monitoring and alerting systems.

#### Request

```http
GET /monitoring/metrics
Authorization: Bearer your-api-key
```

#### Response

```json
{
  "timestamp": 1699355100123,
  "period": {
    "start": 1699351500123,
    "end": 1699355100123,
    "duration": 3600000
  },
  "tools": {
    "totalCalls": 45,
    "successRate": 0.956,
    "averageLatency": 234,
    "errorsByTool": {
      "read_file": 1,
      "write_file": 1
    },
    "callsByTool": {
      "read_file": 23,
      "write_file": 12,
      "list_directory": 10
    }
  },
  "performance": {
    "averageResponseTime": 342,
    "p95ResponseTime": 650,
    "p99ResponseTime": 980,
    "requestsPerSecond": 0.0125,
    "errorRate": 0.044
  },
  "system": {
    "memoryUsage": 45.2,
    "cpuUsage": 0,
    "uptime": 1847,
    "activeConnections": 0
  }
}
```

#### Response Fields

- `timestamp`: Metrics collection timestamp
- `period`: Time period for metrics (1 hour window)
- `tools`: Tool operation metrics
  - `totalCalls`: Total tool calls in period
  - `successRate`: Success rate (0-1)
  - `averageLatency`: Average tool latency in milliseconds
  - `errorsByTool`: Error count per tool
  - `callsByTool`: Call count per tool
- `performance`: Performance metrics
  - `averageResponseTime`: Average response time in milliseconds
  - `p95ResponseTime`: 95th percentile response time
  - `p99ResponseTime`: 99th percentile response time
  - `requestsPerSecond`: Request rate
  - `errorRate`: Error rate (0-1)
- `system`: System resource metrics

**Status Codes**: `200` (success), `503` (monitoring unavailable)

---

### POST /monitoring/alerts

**Implementation**: `/app/src/production/monitoring.ts:324-345`  
**Authentication**: Required

Configure monitoring alerts for production deployments.

#### Request

```http
POST /monitoring/alerts
Authorization: Bearer your-api-key
Content-Type: application/json
```

#### Request Body

```json
{
  "condition": {
    "metric": "tool_error_rate",
    "threshold": 0.1,
    "operator": "gt",
    "window": 300000,
    "cooldown": 600000
  },
  "callback_url": "https://example.com/webhook/alerts"
}
```

#### Request Parameters

- `condition`: Alert condition
  - `metric`: Metric to monitor (`tool_error_rate`, `response_time`, `memory_usage`, etc.)
  - `threshold`: Alert threshold value
  - `operator`: Comparison operator (`gt`, `lt`, `eq`, `gte`, `lte`)
  - `window`: Time window in milliseconds (optional)
  - `cooldown`: Cooldown period in milliseconds (optional)
- `callback_url`: Webhook URL for alert notifications (optional)

#### Response

```json
{
  "alert_id": "alert_1699355100_abc123def",
  "status": "configured",
  "condition": {
    "metric": "tool_error_rate",
    "threshold": 0.1,
    "operator": "gt",
    "window": 300000,
    "cooldown": 600000
  }
}
```

#### Response Fields

- `alert_id`: Unique alert identifier
- `status`: Configuration status
- `condition`: Configured alert condition

**Status Codes**: `201` (created), `400` (invalid request), `503` (monitoring unavailable)

---

### DELETE /monitoring/alerts/{alert_id}

**Implementation**: `/app/src/production/monitoring.ts:347-355`  
**Authentication**: Required

Remove a configured monitoring alert.

#### Request

```http
DELETE /monitoring/alerts/alert_1699355100_abc123def
Authorization: Bearer your-api-key
```

#### Response

```json
{
  "alert_id": "alert_1699355100_abc123def",
  "status": "removed"
}
```

#### Error Response

```json
{
  "error": "Alert not found",
  "alert_id": "alert_1699355100_abc123def"
}
```

**Status Codes**: `200` (removed), `404` (not found), `503` (monitoring unavailable)

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

### 📋 Authentication Examples

#### Setup Authentication

**Option 1: Environment Variable**
```bash
export API_KEY="your-secure-api-key-here"
claude-wrapper
```

**Option 2: CLI Flag**
```bash
claude-wrapper --api-key your-secure-api-key-here
```

**Option 3: Interactive Setup**
```bash
claude-wrapper
# Follow the interactive prompt to generate a secure API key
```

**Option 4: No Authentication (Development)**
```bash
claude-wrapper --no-interactive
```

#### Test Authentication Status

**cURL**
```bash
curl -X GET http://localhost:8000/v1/auth/status
```

**JavaScript**
```javascript
const response = await fetch('http://localhost:8000/v1/auth/status');
const authStatus = await response.json();
console.log('Authentication required:', authStatus.server_info.api_key_required);
```

**TypeScript**
```typescript
interface AuthStatus {
  claude_code_auth: {
    method: string;
    status: {
      valid: boolean;
      errors: string[];
    };
  };
  server_info: {
    api_key_required: boolean;
    api_key_source: string;
  };
}

const response = await fetch('http://localhost:8000/v1/auth/status');
const authStatus: AuthStatus = await response.json();
```

### 💬 Chat Completion Examples

#### Basic Chat Request

**cURL**
```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [
      {"role": "user", "content": "Hello! How can you help me today?"}
    ]
  }'
```

**JavaScript with Fetch**
```javascript
const response = await fetch('http://localhost:8000/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-api-key'
  },
  body: JSON.stringify({
    model: 'claude-3-5-sonnet-20241022',
    messages: [
      { role: 'user', content: 'Hello! How can you help me today?' }
    ]
  })
});

const data = await response.json();
console.log(data.choices[0].message.content);
```

**TypeScript with OpenAI SDK**
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'http://localhost:8000/v1',
  apiKey: 'your-api-key', // or 'not-needed' if auth disabled
});

const completion = await openai.chat.completions.create({
  model: 'claude-3-5-sonnet-20241022',
  messages: [
    { role: 'user', content: 'Hello! How can you help me today?' }
  ],
});

console.log(completion.choices[0].message.content);
```

#### Multi-turn Conversation

**JavaScript**
```javascript
class ConversationManager {
  constructor(apiKey, baseURL = 'http://localhost:8000/v1') {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
    this.messages = [];
  }

  async sendMessage(content, sessionId = null) {
    // Add user message to conversation
    this.messages.push({ role: 'user', content });

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        messages: this.messages,
        session_id: sessionId
      })
    });

    const data = await response.json();
    const assistantMessage = data.choices[0].message;

    // Add assistant response to conversation
    this.messages.push(assistantMessage);

    return assistantMessage.content;
  }

  clearConversation() {
    this.messages = [];
  }
}

// Usage
const conversation = new ConversationManager('your-api-key');
const response1 = await conversation.sendMessage('My name is Alice');
const response2 = await conversation.sendMessage('What is my name?');
```

**TypeScript**
```typescript
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface CompletionResponse {
  choices: Array<{
    message: Message;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

class TypedConversationManager {
  private messages: Message[] = [];

  constructor(
    private apiKey: string,
    private baseURL: string = 'http://localhost:8000/v1'
  ) {}

  async sendMessage(content: string, sessionId?: string): Promise<string> {
    this.messages.push({ role: 'user', content });

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        messages: this.messages,
        session_id: sessionId
      })
    });

    const data: CompletionResponse = await response.json();
    const assistantMessage = data.choices[0].message;

    this.messages.push(assistantMessage);
    return assistantMessage.content;
  }

  getMessages(): readonly Message[] {
    return [...this.messages];
  }
}
```

### 🌊 Streaming Examples

#### Basic Streaming

**cURL**
```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "claude-3-5-sonnet-20241022", 
    "messages": [
      {"role": "user", "content": "Count to 10 slowly"}
    ],
    "stream": true
  }'
```

**JavaScript Streaming Client**
```javascript
class StreamingClient {
  constructor(apiKey, baseURL = 'http://localhost:8000/v1') {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }

  async streamCompletion(messages, onChunk, onComplete, onError) {
    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          messages,
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              onComplete?.();
              return;
            }

            try {
              const chunk = JSON.parse(data);
              const content = chunk.choices?.[0]?.delta?.content;
              if (content) {
                onChunk(content);
              }
            } catch (e) {
              console.warn('Failed to parse chunk:', data);
            }
          }
        }
      }
    } catch (error) {
      onError?.(error);
    }
  }
}

// Usage
const client = new StreamingClient('your-api-key');
let fullResponse = '';

await client.streamCompletion(
  [{ role: 'user', content: 'Write a short poem about coding' }],
  (chunk) => {
    fullResponse += chunk;
    process.stdout.write(chunk);
  },
  () => {
    console.log('\n\nStream completed!');
    console.log('Full response:', fullResponse);
  },
  (error) => {
    console.error('Stream error:', error);
  }
);
```

**TypeScript Streaming with Types**
```typescript
interface StreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason?: string;
  }>;
}

type ChunkHandler = (content: string) => void;
type CompleteHandler = () => void;
type ErrorHandler = (error: Error) => void;

class TypedStreamingClient {
  constructor(
    private apiKey: string,
    private baseURL: string = 'http://localhost:8000/v1'
  ) {}

  async streamCompletion(
    messages: Message[],
    onChunk: ChunkHandler,
    onComplete?: CompleteHandler,
    onError?: ErrorHandler
  ): Promise<void> {
    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          messages,
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              onComplete?.();
              return;
            }

            try {
              const chunk: StreamChunk = JSON.parse(data);
              const content = chunk.choices?.[0]?.delta?.content;
              if (content) {
                onChunk(content);
              }
            } catch (e) {
              console.warn('Failed to parse chunk:', data);
            }
          }
        }
      }
    } catch (error) {
      onError?.(error as Error);
    }
  }
}
```

### 🔄 Session Management Examples

#### Session Operations

**cURL Examples**
```bash
# Create session with context
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [
      {"role": "user", "content": "My name is Alice and I am a developer"}
    ],
    "session_id": "dev-session-123"
  }'

# Continue conversation in same session
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [
      {"role": "user", "content": "What is my name and profession?"}
    ],
    "session_id": "dev-session-123"
  }'

# List all sessions
curl -X GET http://localhost:8000/v1/sessions \
  -H "Authorization: Bearer your-api-key"

# Get session details
curl -X GET http://localhost:8000/v1/sessions/dev-session-123 \
  -H "Authorization: Bearer your-api-key"

# Delete session
curl -X DELETE http://localhost:8000/v1/sessions/dev-session-123 \
  -H "Authorization: Bearer your-api-key"

# Get session statistics
curl -X GET http://localhost:8000/v1/sessions/stats \
  -H "Authorization: Bearer your-api-key"
```

**JavaScript Session Manager**
```javascript
class SessionManager {
  constructor(apiKey, baseURL = 'http://localhost:8000/v1') {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };
  }

  async createSession(sessionId, initialMessage) {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: initialMessage }],
        session_id: sessionId
      })
    });

    return response.json();
  }

  async continueSession(sessionId, message) {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: message }],
        session_id: sessionId
      })
    });

    return response.json();
  }

  async listSessions() {
    const response = await fetch(`${this.baseURL}/sessions`, {
      headers: this.headers
    });
    return response.json();
  }

  async getSession(sessionId) {
    const response = await fetch(`${this.baseURL}/sessions/${sessionId}`, {
      headers: this.headers
    });
    return response.json();
  }

  async deleteSession(sessionId) {
    const response = await fetch(`${this.baseURL}/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: this.headers
    });
    return response.json();
  }

  async getSessionStats() {
    const response = await fetch(`${this.baseURL}/sessions/stats`, {
      headers: this.headers
    });
    return response.json();
  }
}

// Usage
const sessionManager = new SessionManager('your-api-key');

// Create a new session
await sessionManager.createSession('my-session', 'Hello, I am starting a new conversation');

// Continue the conversation
await sessionManager.continueSession('my-session', 'Can you remember what I said?');

// Get session info
const sessionInfo = await sessionManager.getSession('my-session');
console.log('Session has', sessionInfo.message_count, 'messages');

// Clean up
await sessionManager.deleteSession('my-session');
```

### 🛠️ Tools and Function Calling Examples

#### Complete Tool Calling Workflow

**cURL - Step 1: Initial Request with Tools**
```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [
      {"role": "user", "content": "What is the weather like in San Francisco?"}
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "get_weather",
          "description": "Get current weather information for a city",
          "parameters": {
            "type": "object",
            "properties": {
              "city": {
                "type": "string",
                "description": "The city name"
              },
              "unit": {
                "type": "string",
                "enum": ["celsius", "fahrenheit"],
                "description": "Temperature unit"
              }
            },
            "required": ["city"]
          }
        }
      }
    ],
    "tool_choice": "auto"
  }'
```

**JavaScript Tool Calling Client**
```javascript
class ToolCallingClient {
  constructor(apiKey, baseURL = 'http://localhost:8000/v1') {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
    this.tools = new Map();
  }

  // Register a tool function
  registerTool(name, fn, schema) {
    this.tools.set(name, { fn, schema });
  }

  async callWithTools(messages, options = {}) {
    const toolSchemas = Array.from(this.tools.values()).map(tool => ({
      type: 'function',
      function: tool.schema
    }));

    let currentMessages = [...messages];
    let maxIterations = options.maxIterations || 5;
    let iteration = 0;

    while (iteration < maxIterations) {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          messages: currentMessages,
          tools: toolSchemas,
          tool_choice: 'auto',
          ...options
        })
      });

      const data = await response.json();
      const message = data.choices[0].message;
      currentMessages.push(message);

      // If no tool calls, return final response
      if (!message.tool_calls || message.tool_calls.length === 0) {
        return {
          content: message.content,
          messages: currentMessages,
          iterations: iteration + 1
        };
      }

      // Execute tool calls
      for (const toolCall of message.tool_calls) {
        const toolName = toolCall.function.name;
        const tool = this.tools.get(toolName);

        if (!tool) {
          throw new Error(`Unknown tool: ${toolName}`);
        }

        try {
          const args = JSON.parse(toolCall.function.arguments);
          const result = await tool.fn(args);

          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result)
          });
        } catch (error) {
          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: error.message })
          });
        }
      }

      iteration++;
    }

    throw new Error(`Maximum iterations (${maxIterations}) exceeded`);
  }
}

// Usage example
const client = new ToolCallingClient('your-api-key');

// Register tools
client.registerTool('get_weather', async ({ city, unit = 'celsius' }) => {
  // Simulate API call
  return {
    city,
    temperature: unit === 'celsius' ? 22 : 72,
    condition: 'sunny',
    unit
  };
}, {
  name: 'get_weather',
  description: 'Get current weather information for a city',
  parameters: {
    type: 'object',
    properties: {
      city: { type: 'string', description: 'The city name' },
      unit: { type: 'string', enum: ['celsius', 'fahrenheit'] }
    },
    required: ['city']
  }
});

client.registerTool('calculate', async ({ expression }) => {
  // Safe calculation (in real app, use a proper expression evaluator)
  try {
    return { result: eval(expression) };
  } catch (error) {
    return { error: 'Invalid expression' };
  }
}, {
  name: 'calculate',
  description: 'Calculate mathematical expressions',
  parameters: {
    type: 'object',
    properties: {
      expression: { type: 'string', description: 'Mathematical expression to evaluate' }
    },
    required: ['expression']
  }
});

// Use tools
const result = await client.callWithTools([
  { role: 'user', content: 'What is the weather in Paris and what is 15 * 23?' }
]);

console.log(result.content);
```

**TypeScript Advanced Tool System**
```typescript
interface ToolSchema {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

interface ToolFunction {
  (args: Record<string, any>): Promise<any> | any;
}

interface ToolDefinition {
  fn: ToolFunction;
  schema: ToolSchema;
}

class TypedToolClient {
  private tools = new Map<string, ToolDefinition>();

  constructor(
    private apiKey: string,
    private baseURL: string = 'http://localhost:8000/v1'
  ) {}

  registerTool<T extends Record<string, any>>(
    name: string,
    fn: (args: T) => Promise<any> | any,
    schema: ToolSchema
  ): void {
    this.tools.set(name, { fn, schema });
  }

  async executeTools(
    messages: Message[],
    options: {
      maxIterations?: number;
      sessionId?: string;
    } = {}
  ): Promise<{
    content: string;
    messages: Message[];
    iterations: number;
    toolCalls: number;
  }> {
    const toolSchemas = Array.from(this.tools.values()).map(tool => ({
      type: 'function' as const,
      function: tool.schema
    }));

    let currentMessages = [...messages];
    let maxIterations = options.maxIterations || 5;
    let iteration = 0;
    let totalToolCalls = 0;

    while (iteration < maxIterations) {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          messages: currentMessages,
          tools: toolSchemas,
          tool_choice: 'auto',
          session_id: options.sessionId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const message = data.choices[0].message;
      currentMessages.push(message);

      if (!message.tool_calls || message.tool_calls.length === 0) {
        return {
          content: message.content,
          messages: currentMessages,
          iterations: iteration + 1,
          toolCalls: totalToolCalls
        };
      }

      // Execute all tool calls in parallel
      const toolPromises = message.tool_calls.map(async (toolCall) => {
        const toolName = toolCall.function.name;
        const tool = this.tools.get(toolName);

        if (!tool) {
          return {
            role: 'tool' as const,
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: `Unknown tool: ${toolName}` })
          };
        }

        try {
          const args = JSON.parse(toolCall.function.arguments);
          const result = await tool.fn(args);
          totalToolCalls++;

          return {
            role: 'tool' as const,
            tool_call_id: toolCall.id,
            content: JSON.stringify(result)
          };
        } catch (error) {
          return {
            role: 'tool' as const,
            tool_call_id: toolCall.id,
            content: JSON.stringify({ 
              error: error instanceof Error ? error.message : 'Unknown error' 
            })
          };
        }
      });

      const toolResults = await Promise.all(toolPromises);
      currentMessages.push(...toolResults);
      iteration++;
    }

    throw new Error(`Maximum iterations (${maxIterations}) exceeded`);
  }
}
```

### 🔧 Advanced Configuration Examples

#### Custom Headers and Options

**cURL with Custom Headers**
```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -H "X-Claude-Max-Turns: 5" \
  -H "X-Claude-Permission-Mode: acceptEdits" \
  -H "X-Claude-Max-Thinking-Tokens: 1000" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [
      {"role": "user", "content": "Help me write a Python script"}
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

**JavaScript with Custom Configuration**
```javascript
class ConfigurableClient {
  constructor(apiKey, config = {}) {
    this.apiKey = apiKey;
    this.baseURL = config.baseURL || 'http://localhost:8000/v1';
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...config.headers
    };
    this.defaultOptions = {
      maxTurns: config.maxTurns,
      permissionMode: config.permissionMode,
      maxThinkingTokens: config.maxThinkingTokens
    };
  }

  async completion(messages, options = {}) {
    const headers = { ...this.defaultHeaders };
    
    // Add Claude-specific headers
    if (options.maxTurns || this.defaultOptions.maxTurns) {
      headers['X-Claude-Max-Turns'] = options.maxTurns || this.defaultOptions.maxTurns;
    }
    if (options.permissionMode || this.defaultOptions.permissionMode) {
      headers['X-Claude-Permission-Mode'] = options.permissionMode || this.defaultOptions.permissionMode;
    }
    if (options.maxThinkingTokens || this.defaultOptions.maxThinkingTokens) {
      headers['X-Claude-Max-Thinking-Tokens'] = options.maxThinkingTokens || this.defaultOptions.maxThinkingTokens;
    }

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: options.model || 'claude-3-5-sonnet-20241022',
        messages,
        ...options
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API Error: ${error.error?.message || response.statusText}`);
    }

    return response.json();
  }
}

// Usage with configuration
const client = new ConfigurableClient('your-api-key', {
  maxTurns: 10,
  permissionMode: 'acceptEdits',
  maxThinkingTokens: 2000,
  headers: {
    'X-Custom-Header': 'custom-value'
  }
});

const result = await client.completion([
  { role: 'user', content: 'Help me debug this code' }
], {
  tools: [/* tool definitions */],
  maxTurns: 5 // Override default
});
```

### 🔧 Error Handling Examples

#### Handle API Errors

**JavaScript Error Handling**
```javascript
class RobustClaudeClient {
  constructor(apiKey, baseURL = 'http://localhost:8000/v1') {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }

  async completion(messages, options = {}) {
    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          messages,
          ...options
        })
      });

      // Handle different HTTP status codes
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        switch (response.status) {
          case 401:
            throw new Error('Authentication failed: Invalid API key');
          case 422:
            throw new Error(`Validation error: ${errorData.error?.message || 'Invalid request format'}`);
          case 503:
            throw new Error('Claude service unavailable: Check authentication setup');
          default:
            throw new Error(`HTTP ${response.status}: ${errorData.error?.message || response.statusText}`);
        }
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to Claude wrapper server');
      }
      throw error;
    }
  }

  async withRetry(fn, maxRetries = 3, delay = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxRetries) throw error;
        
        // Only retry on network errors or 5xx status codes
        if (error.message.includes('Network error') || 
            error.message.includes('HTTP 5')) {
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
          continue;
        }
        
        throw error; // Don't retry client errors (4xx)
      }
    }
  }
}

// Usage with error handling
const client = new RobustClaudeClient('your-api-key');

try {
  const result = await client.withRetry(() => 
    client.completion([
      { role: 'user', content: 'Hello!' }
    ])
  );
  console.log(result.choices[0].message.content);
} catch (error) {
  console.error('Failed to get completion:', error.message);
}
```

### 🏥 Health Monitoring Integration Examples

#### Production Health Monitoring Setup

**Docker Health Check Configuration**
```dockerfile
# Dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
```

**Kubernetes Probes Configuration**
```yaml
# kubernetes-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: claude-wrapper
spec:
  template:
    spec:
      containers:
      - name: claude-wrapper
        image: claude-wrapper:latest
        ports:
        - containerPort: 3000
        livenessProbe:
          httpGet:
            path: /monitoring/liveness
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 3
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /monitoring/readiness
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        env:
        - name: ANTHROPIC_API_KEY
          valueFrom:
            secretKeyRef:
              name: claude-secrets
              key: api-key
```

**Monitoring Script Example**
```bash
#!/bin/bash
# monitoring-check.sh - Production monitoring script

API_KEY="your-api-key"
BASE_URL="http://localhost:3000"

# Basic health check
echo "Checking basic health..."
curl -s "${BASE_URL}/health" | jq '.'

# Detailed health check
echo "Checking detailed health..."
curl -s -H "Authorization: Bearer ${API_KEY}" \
  "${BASE_URL}/health/detailed" | jq '.'

# Production metrics
echo "Checking production metrics..."
curl -s -H "Authorization: Bearer ${API_KEY}" \
  "${BASE_URL}/health/production" | jq '.production_metrics'

# System monitoring
echo "Checking system status..."
curl -s -H "Authorization: Bearer ${API_KEY}" \
  "${BASE_URL}/monitoring/system" | jq '.components'

# Real-time monitoring data
echo "Checking real-time monitoring..."
curl -s -H "Authorization: Bearer ${API_KEY}" \
  "${BASE_URL}/health/monitoring" | jq '.report.summary'
```

**Node.js Health Monitoring Client**
```javascript
const axios = require('axios');

class HealthMonitoringClient {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.headers = apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {};
  }

  async basicHealth() {
    try {
      const response = await axios.get(`${this.baseUrl}/health`);
      return {
        healthy: response.data.status === 'healthy',
        data: response.data
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  async detailedHealth() {
    const response = await axios.get(`${this.baseUrl}/health/detailed`, {
      headers: this.headers
    });
    return response.data;
  }

  async productionHealth() {
    const response = await axios.get(`${this.baseUrl}/health/production`, {
      headers: this.headers
    });
    return response.data;
  }

  async systemMonitoring() {
    const response = await axios.get(`${this.baseUrl}/monitoring/system`, {
      headers: this.headers
    });
    return response.data;
  }

  async realTimeMonitoring() {
    const response = await axios.get(`${this.baseUrl}/health/monitoring`, {
      headers: this.headers
    });
    return response.data;
  }

  async getMetrics() {
    const response = await axios.get(`${this.baseUrl}/monitoring/metrics`, {
      headers: this.headers
    });
    return response.data;
  }

  async configureAlert(condition, callbackUrl) {
    const response = await axios.post(`${this.baseUrl}/monitoring/alerts`, {
      condition,
      callback_url: callbackUrl
    }, {
      headers: { ...this.headers, 'Content-Type': 'application/json' }
    });
    return response.data;
  }

  async removeAlert(alertId) {
    const response = await axios.delete(`${this.baseUrl}/monitoring/alerts/${alertId}`, {
      headers: this.headers
    });
    return response.data;
  }

  // Comprehensive health check with retry logic
  async comprehensiveHealthCheck(maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Health check attempt ${attempt}/${maxRetries}`);

        // Basic health first
        const basicHealth = await this.basicHealth();
        if (!basicHealth.healthy) {
          throw new Error(`Basic health check failed: ${basicHealth.error}`);
        }

        // Detailed health check
        const detailedHealth = await this.detailedHealth();
        console.log(`Server status: ${detailedHealth.details.server}`);
        console.log(`Memory usage: ${detailedHealth.details.memory_usage.percentage}%`);
        console.log(`Authentication: ${detailedHealth.details.authentication}`);

        // Production metrics
        const productionHealth = await this.productionHealth();
        console.log(`Average response time: ${productionHealth.production_metrics.response_times.average}ms`);
        console.log(`Memory trend: ${productionHealth.production_metrics.resource_usage.memory_trend}`);
        console.log(`Uptime percentage: ${productionHealth.production_metrics.health_history.uptime_percentage}%`);

        // System monitoring
        const systemHealth = await this.systemMonitoring();
        const unhealthyComponents = Object.entries(systemHealth.components)
          .filter(([_, component]) => component.status !== 'healthy')
          .map(([name]) => name);

        if (unhealthyComponents.length > 0) {
          console.warn(`Unhealthy components: ${unhealthyComponents.join(', ')}`);
        }

        console.log('✅ All health checks passed');
        return {
          success: true,
          basic: basicHealth,
          detailed: detailedHealth,
          production: productionHealth,
          system: systemHealth
        };

      } catch (error) {
        console.error(`Health check attempt ${attempt} failed:`, error.message);
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
}

// Usage example
async function monitorHealth() {
  const monitor = new HealthMonitoringClient('http://localhost:3000', 'your-api-key');

  try {
    // Comprehensive health check
    const health = await monitor.comprehensiveHealthCheck();
    console.log('Health check summary:', {
      overall: health.detailed.status,
      uptime: Math.round(health.detailed.uptime / 1000 / 60), // minutes
      memoryUsage: health.detailed.details.memory_usage.percentage,
      responseTime: health.production.production_metrics.response_times.average
    });

    // Set up alerts for production monitoring
    const errorRateAlert = await monitor.configureAlert({
      metric: 'tool_error_rate',
      threshold: 0.1,
      operator: 'gt',
      window: 300000, // 5 minutes
      cooldown: 600000 // 10 minutes
    }, 'https://your-monitoring-system.com/webhook');

    console.log('Error rate alert configured:', errorRateAlert.alert_id);

    const memoryAlert = await monitor.configureAlert({
      metric: 'memory_usage',
      threshold: 0.8,
      operator: 'gt',
      window: 60000, // 1 minute
      cooldown: 300000 // 5 minutes
    }, 'https://your-monitoring-system.com/webhook');

    console.log('Memory usage alert configured:', memoryAlert.alert_id);

    // Get current metrics
    const metrics = await monitor.getMetrics();
    console.log('Current metrics:', {
      toolCalls: metrics.tools.totalCalls,
      successRate: `${(metrics.tools.successRate * 100).toFixed(1)}%`,
      avgLatency: `${metrics.tools.averageLatency}ms`,
      errorRate: `${(metrics.performance.errorRate * 100).toFixed(1)}%`
    });

  } catch (error) {
    console.error('Health monitoring failed:', error.message);
    process.exit(1);
  }
}

// Run monitoring
monitorHealth();
```

**Python Health Monitoring Client**
```python
import requests
import time
import logging
from typing import Dict, Optional, Any

class HealthMonitoringClient:
    def __init__(self, base_url: str, api_key: Optional[str] = None):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.session = requests.Session()
        if api_key:
            self.session.headers.update({'Authorization': f'Bearer {api_key}'})
    
    def basic_health(self) -> Dict[str, Any]:
        """Basic health check"""
        try:
            response = self.session.get(f'{self.base_url}/health', timeout=5)
            response.raise_for_status()
            data = response.json()
            return {
                'healthy': data.get('status') == 'healthy',
                'data': data
            }
        except Exception as e:
            return {
                'healthy': False,
                'error': str(e)
            }
    
    def detailed_health(self) -> Dict[str, Any]:
        """Detailed health check with system information"""
        response = self.session.get(f'{self.base_url}/health/detailed', timeout=10)
        response.raise_for_status()
        return response.json()
    
    def production_health(self) -> Dict[str, Any]:
        """Production-grade health check with metrics"""
        response = self.session.get(f'{self.base_url}/health/production', timeout=10)
        response.raise_for_status()
        return response.json()
    
    def system_monitoring(self) -> Dict[str, Any]:
        """Comprehensive system monitoring data"""
        response = self.session.get(f'{self.base_url}/monitoring/system', timeout=10)
        response.raise_for_status()
        return response.json()
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get production metrics"""
        response = self.session.get(f'{self.base_url}/monitoring/metrics', timeout=10)
        response.raise_for_status()
        return response.json()
    
    def configure_alert(self, condition: Dict[str, Any], callback_url: Optional[str] = None) -> Dict[str, Any]:
        """Configure monitoring alert"""
        payload = {'condition': condition}
        if callback_url:
            payload['callback_url'] = callback_url
        
        response = self.session.post(
            f'{self.base_url}/monitoring/alerts',
            json=payload,
            timeout=10
        )
        response.raise_for_status()
        return response.json()
    
    def comprehensive_health_check(self, max_retries: int = 3) -> Dict[str, Any]:
        """Run comprehensive health check with retry logic"""
        for attempt in range(1, max_retries + 1):
            try:
                logging.info(f"Health check attempt {attempt}/{max_retries}")
                
                # Basic health
                basic = self.basic_health()
                if not basic['healthy']:
                    raise Exception(f"Basic health check failed: {basic.get('error')}")
                
                # Detailed health
                detailed = self.detailed_health()
                logging.info(f"Server: {detailed['details']['server']}")
                logging.info(f"Memory: {detailed['details']['memory_usage']['percentage']}%")
                logging.info(f"Auth: {detailed['details']['authentication']}")
                
                # Production health
                production = self.production_health()
                metrics = production['production_metrics']
                logging.info(f"Avg response time: {metrics['response_times']['average']}ms")
                logging.info(f"Memory trend: {metrics['resource_usage']['memory_trend']}")
                logging.info(f"Uptime: {metrics['health_history']['uptime_percentage']}%")
                
                # System monitoring
                system = self.system_monitoring()
                unhealthy_components = [
                    name for name, component in system['components'].items()
                    if component['status'] != 'healthy'
                ]
                
                if unhealthy_components:
                    logging.warning(f"Unhealthy components: {', '.join(unhealthy_components)}")
                
                logging.info("✅ All health checks passed")
                return {
                    'success': True,
                    'basic': basic,
                    'detailed': detailed,
                    'production': production,
                    'system': system
                }
                
            except Exception as e:
                logging.error(f"Health check attempt {attempt} failed: {e}")
                if attempt == max_retries:
                    raise
                time.sleep(attempt)  # Exponential backoff

# Usage example
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    monitor = HealthMonitoringClient('http://localhost:3000', 'your-api-key')
    
    try:
        # Run comprehensive health check
        health = monitor.comprehensive_health_check()
        
        print("Health Summary:")
        print(f"  Status: {health['detailed']['status']}")
        print(f"  Uptime: {health['detailed']['uptime'] // 1000 // 60} minutes")
        print(f"  Memory: {health['detailed']['details']['memory_usage']['percentage']}%")
        print(f"  Response Time: {health['production']['production_metrics']['response_times']['average']}ms")
        
        # Configure production alerts
        error_alert = monitor.configure_alert({
            'metric': 'tool_error_rate',
            'threshold': 0.1,
            'operator': 'gt',
            'window': 300000,
            'cooldown': 600000
        }, 'https://your-monitoring-system.com/webhook')
        
        print(f"Error rate alert: {error_alert['alert_id']}")
        
        # Get current metrics
        metrics = monitor.get_metrics()
        print(f"Tool calls: {metrics['tools']['totalCalls']}")
        print(f"Success rate: {metrics['tools']['successRate'] * 100:.1f}%")
        print(f"Error rate: {metrics['performance']['errorRate'] * 100:.1f}%")
        
    except Exception as e:
        logging.error(f"Health monitoring failed: {e}")
        exit(1)
```

### 🔧 Complete Tool Calling Workflow Example

Here's a complete example of how tool calling works with the wrapper:

#### Step 1: Initial Request with Tools

**cURL**
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

#### Step 2: Wrapper Returns Tool Call

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

#### Step 3: Client Executes Tool and Continues Conversation

**cURL**
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

#### Step 4: Final Response

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

### 🚀 Production-Ready Example

**Complete Production Client**
```typescript
import OpenAI from 'openai';

interface ClaudeWrapperConfig {
  apiKey?: string;
  baseURL?: string;
  timeout?: number;
  retries?: number;
  rateLimiting?: {
    requestsPerMinute: number;
  };
}

class ProductionClaudeClient {
  private openai: OpenAI;
  private rateLimiter: {
    requests: number[];
    limit: number;
  };

  constructor(config: ClaudeWrapperConfig = {}) {
    this.openai = new OpenAI({
      apiKey: config.apiKey || 'not-needed',
      baseURL: config.baseURL || 'http://localhost:8000/v1',
      timeout: config.timeout || 30000,
      maxRetries: config.retries || 3,
    });

    this.rateLimiter = {
      requests: [],
      limit: config.rateLimiting?.requestsPerMinute || 60
    };
  }

  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Remove requests older than 1 minute
    this.rateLimiter.requests = this.rateLimiter.requests.filter(
      time => time > oneMinuteAgo
    );

    if (this.rateLimiter.requests.length >= this.rateLimiter.limit) {
      const oldestRequest = Math.min(...this.rateLimiter.requests);
      const waitTime = oldestRequest + 60000 - now;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.rateLimiter.requests.push(now);
  }

  async completion(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    options: Partial<OpenAI.Chat.ChatCompletionCreateParams> = {}
  ): Promise<OpenAI.Chat.ChatCompletion> {
    await this.checkRateLimit();

    return await this.openai.chat.completions.create({
      model: 'claude-3-5-sonnet-20241022',
      messages,
      ...options
    });
  }

  async stream(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    options: Partial<OpenAI.Chat.ChatCompletionCreateParams> = {}
  ): Promise<OpenAI.Chat.ChatCompletionChunk[]> {
    await this.checkRateLimit();

    const stream = await this.openai.chat.completions.create({
      model: 'claude-3-5-sonnet-20241022',
      messages,
      stream: true,
      ...options
    });

    const chunks: OpenAI.Chat.ChatCompletionChunk[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    return chunks;
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.openai.baseURL?.replace('/v1', '')}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  // Session management methods
  async listSessions(): Promise<any> {
    const response = await fetch(`${this.openai.baseURL}/sessions`, {
      headers: {
        'Authorization': `Bearer ${this.openai.apiKey}`
      }
    });
    return response.json();
  }

  async deleteSession(sessionId: string): Promise<void> {
    await fetch(`${this.openai.baseURL}/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.openai.apiKey}`
      }
    });
  }
}

// Usage
const client = new ProductionClaudeClient({
  apiKey: process.env.CLAUDE_WRAPPER_API_KEY,
  baseURL: process.env.CLAUDE_WRAPPER_URL || 'http://localhost:8000/v1',
  timeout: 60000,
  retries: 3,
  rateLimiting: {
    requestsPerMinute: 50
  }
});

// Basic usage
const completion = await client.completion([
  { role: 'user', content: 'Hello!' }
]);

// With session
const sessionCompletion = await client.completion([
  { role: 'user', content: 'Remember my name is Alice' }
], { 
  // @ts-ignore - session_id is a custom parameter
  session_id: 'user-session-123' 
});

// Health monitoring
const isHealthy = await client.healthCheck();
if (!isHealthy) {
  console.error('Claude wrapper is not healthy');
}
```

This workflow shows how the wrapper enables OpenAI-compatible tool calling while maintaining security by having clients execute tools in their own environment.

---

This API reference provides complete documentation for integrating with the Claude Code OpenAI Wrapper, ensuring full compatibility with OpenAI clients while leveraging Claude's capabilities through secure, client-side tool execution.