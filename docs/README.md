# Claude Wrapper - Complete Documentation

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/claude-wrapper.svg)](https://nodejs.org/en/download/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![GitHub Stars](https://img.shields.io/github/stars/ChrisColeTech/claude-wrapper.svg)](https://github.com/ChrisColeTech/claude-wrapper/stargazers)
[![GitHub Issues](https://img.shields.io/github/issues/ChrisColeTech/claude-wrapper.svg)](https://github.com/ChrisColeTech/claude-wrapper/issues)

**OpenAI-compatible HTTP API wrapper for Claude Code CLI with Session Management**

Transform your Claude Code CLI into a powerful HTTP API server that accepts OpenAI Chat Completions requests. Features intelligent session management for conversation continuity, streaming responses, and comprehensive CLI tooling.

## Table of Contents

- [Tools-First Philosophy](#tools-first-philosophy)
- [Key Features](#key-features)
- [Installation](#installation)
- [CLI Options](#cli-options)
- [API Endpoints](#api-endpoints)
- [API Documentation](#api-documentation)
- [Quick Start](#quick-start)
- [CLI Usage](#cli-usage)
- [Authentication](#authentication)
- [Session Management](#session-management)
- [Tool Integration](#tool-integration)
- [Streaming](#streaming)
- [Configuration](#configuration)
- [Process Management](#process-management)
- [Development](#development)
- [Production Features](#production-features)

## Tools-First Philosophy

Claude Wrapper provides OpenAI Tools API compatibility:

- **Client-Side Execution**: Tools run in your local environment
- **OpenAI Standard**: Uses standard `tools` array format from OpenAI specification
- **MCP Compatible**: Works with your local MCP tool installations

This approach gives you maximum flexibility with Claude's tool capabilities.

## Key Features

- **🔌 OpenAI Compatible**: Drop-in replacement for OpenAI Chat Completions API
- **🧠 Session Management**: Intelligent conversation continuity with session persistence
- **🌊 Streaming Support**: Real-time response streaming with Server-Sent Events
- **🔐 Multi-Provider Auth**: Automatic detection of Anthropic, Bedrock, Vertex, or Claude CLI authentication
- **🛡️ API Protection**: Optional bearer token authentication for endpoint security
- **🛠️ Perfect Tool Calls**: Claude automatically generates OpenAI `tool_calls` format
- **⚡ Zero Conversion**: Direct JSON passthrough, no parsing overhead
- **🔄 Multi-Tool Support**: Multiple tools in single response with intelligent orchestration
- **📡 Cross-Platform**: Works across different Claude Code CLI installations
- **🏗️ Production Ready**: Comprehensive CLI, background services, and monitoring

## Installation

### Global Installation (Recommended)

```bash
# Install globally from npm
npm install -g claude-wrapper
```

### Local Development

```bash
# Clone and setup for development
git clone https://github.com/ChrisColeTech/claude-wrapper.git
cd claude-wrapper
npm install
npm run build

# Development commands
npm run dev          # Development mode with ts-node
npm run build        # Build TypeScript to JavaScript
npm test            # Run tests
npm run test:unit    # Run unit tests only
npm run test:integration  # Run integration tests only

# Install CLI globally for testing
npm install -g .
```

## CLI Options

```bash
Usage: claude-wrapper [options] [port]

Claude API wrapper with OpenAI compatibility

Arguments:
  port                 port to run server on (default: 8000) - alternative to
                       --port option

Options:
  -V, --version        output the version number
  -p, --port <port>    port to run server on (default: 8000)
  -v, --verbose        enable verbose logging
  -d, --debug          enable debug mode (runs in foreground)
  --api-key <key>      set API key for endpoint protection
  --no-interactive     disable interactive API key setup
  --production         enable production server management features
  --health-monitoring  enable health monitoring system
  --stop               stop background server
  --status             check background server status
  -h, --help           display help for command
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/chat/completions` | Main chat completions with session support |
| `GET` | `/v1/models` | List available Claude models (sonnet, opus) |
| `GET` | `/v1/sessions` | List all active sessions |
| `GET` | `/v1/sessions/stats` | Get session statistics |
| `GET` | `/v1/sessions/:id` | Get specific session details |
| `DELETE` | `/v1/sessions/:id` | Delete a specific session |
| `POST` | `/v1/sessions/:id/messages` | Add messages to a session |
| `GET` | `/v1/auth/status` | Check authentication configuration and status |
| `GET` | `/health` | Service health check |
| `GET` | `/docs` | Swagger UI |
| `GET` | `/swagger.json` | OpenAPI 3.0 specification JSON schema |

## API Documentation

Claude Wrapper includes comprehensive Swagger UI for interactive API exploration.

### Accessing Swagger UI

**Swagger UI:**
- Visit `http://localhost:8000/docs` in your browser
- Full OpenAPI 3.0 specification with interactive testing
- Try out API endpoints directly from the documentation
- Complete schema definitions for all request/response types

**OpenAPI Specification:**
- Download the spec at `http://localhost:8000/swagger.json`
- Use with API clients, code generators, or other tools
- Fully compliant OpenAPI 3.0 specification

### Swagger UI Features

- **Complete API Reference**: All endpoints, parameters, and responses documented
- **Interactive Testing**: Test API calls directly from Swagger UI
- **Schema Validation**: Full request/response schema definitions
- **Authentication Examples**: Shows both authenticated and unauthenticated usage
- **Tool Calling Documentation**: Complete OpenAI-compatible tool calling examples

## Quick Start

```bash
claude-wrapper
```

You'll see an interactive prompt asking if you want API key protection:

```
🚀 Starting Claude Wrapper...
🔐 API Key Protection Setup
Would you like to enable API key protection? (y/n): 
```

- **Choose 'y'** to generate a secure API key for protection
- **Choose 'n' or press Enter** to run without authentication

Server starts at `http://localhost:8000` - you're ready to make API calls!

**🚀 Quick Links:**
- Swagger UI: `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/health`
- OpenAPI Spec: `http://localhost:8000/swagger.json`

### Alternative Authentication Options

```bash
# Skip interactive setup (no authentication)
claude-wrapper --no-interactive

# Or provide API key directly
claude-wrapper --api-key my-secure-key
```

## Authentication

### Authentication Methods

**Interactive Setup (Default)**
```bash
claude-wrapper
# Prompts for API key protection choice
```

**Direct API Key**
```bash
claude-wrapper --api-key my-secure-key
```

**Skip Interactive**
```bash
claude-wrapper --no-interactive
# Runs without authentication
```

**Environment Variable**
```bash
export API_KEY=my-secure-key
claude-wrapper
```

### API Usage Examples

**Without Authentication:**
```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "sonnet", "messages": [{"role": "user", "content": "Hello"}]}'
```

**With API Key:**
```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{"model": "sonnet", "messages": [{"role": "user", "content": "Hello"}]}'
```

### Claude CLI Integration

Claude Wrapper calls your existing Claude Code CLI. Set up Claude CLI authentication however you normally would - the wrapper doesn't manage or configure Claude authentication.

## CLI Usage

### Starting the Server

```bash
# Start server on default port (8000)
claude-wrapper

# Start server on specific port
claude-wrapper 9999
claude-wrapper --port 8080

# Start with verbose logging
claude-wrapper --verbose

# Start with debug information (runs in foreground)
claude-wrapper --debug --verbose
```

### Managing the Background Service

```bash
# Check if server is running
claude-wrapper --status

# Stop the background server
claude-wrapper --stop

# View version
claude-wrapper --version

# Show help
claude-wrapper --help
```

## Session Management

Sessions provide conversation continuity across multiple API calls.

### Session Features

- **Session IDs**: Use `session_id` parameter to maintain conversation history
- **Automatic Creation**: Sessions are created automatically when referenced
- **TTL Management**: Sessions expire after 1 hour of inactivity (configurable)
- **Background Cleanup**: Expired sessions are automatically cleaned up
- **Memory Optimization**: Message history is limited to prevent memory bloat

### Session Usage Examples

```bash
# Create a session by sending a message with session_id
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sonnet",
    "messages": [{"role": "user", "content": "Hello"}],
    "session_id": "my-conversation"
  }'

# Continue the conversation - full history is maintained
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sonnet", 
    "messages": [{"role": "user", "content": "What did I just say?"}],
    "session_id": "my-conversation"
  }'

# List all active sessions
curl http://localhost:8000/v1/sessions

# Get session details including full message history
curl http://localhost:8000/v1/sessions/my-conversation

# Delete a session
curl -X DELETE http://localhost:8000/v1/sessions/my-conversation
```

## Tool Integration

### OpenAI-Compatible Tool Calling

Claude Wrapper provides seamless integration with OpenAI's tool calling format:

```bash
# Tool call example
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sonnet",
    "messages": [{"role": "user", "content": "What files are in the current directory?"}],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "list_files",
          "description": "List files in a directory",
          "parameters": {
            "type": "object",
            "properties": {
              "path": {"type": "string", "description": "Directory path"}
            },
            "required": ["path"]
          }
        }
      }
    ],
    "tool_choice": "auto"
  }'
```

### Tool Features

- **Client-Side Execution**: Tools execute in your local environment
- **OpenAI Standard**: Uses OpenAI `tools` array specification
- **Multi-Tool Support**: Multiple tools in single response with orchestration
- **Streaming Tool Calls**: Real-time tool call streaming support

## Streaming

### Server-Sent Events (SSE) Implementation

```bash
# Streaming request example
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sonnet",
    "messages": [{"role": "user", "content": "Write a short story"}],
    "stream": true
  }'
```

### Streaming Features

- **Real-Time Response**: Sub-100ms first chunk delivery
- **Connection Management**: Active connection tracking and cleanup
- **Heartbeat System**: Configurable connection keep-alive
- **Timeout Handling**: Configurable timeouts for connections and chunks
- **Error Streaming**: Error responses through streaming connections

## Configuration

### Environment Variables

#### Core Configuration
```bash
PORT=8000                    # Server port (default: 8000)
NODE_ENV=production          # Environment mode (development/production)
LOG_LEVEL=info              # Logging level (debug/info/warn/error)
```

#### Authentication
```bash
API_KEY=your-api-key-here   # API key for endpoint protection
REQUIRE_API_KEY=true        # Force API key requirement
```

#### Session Management
```bash
SESSION_TTL=3600000         # Session TTL in milliseconds (1 hour)
SESSION_CLEANUP_INTERVAL=300000  # Cleanup interval in milliseconds (5 minutes)
SESSION_MESSAGE_LIMIT=100   # Maximum messages per session
```

#### Streaming
```bash
STREAMING_ENABLED=true      # Enable streaming support
STREAMING_TIMEOUT=30000     # Streaming timeout in milliseconds
STREAMING_CHUNK_SIZE=1024   # Maximum chunk size
```

## Process Management

Claude Wrapper includes comprehensive process management capabilities for robust background service operation.

### Process Features

- **Daemon Process Management**: Spawns detached background processes
- **PID File Management**: Safe creation, validation, and cleanup of process files
- **Graceful Shutdown**: SIGTERM/SIGINT signal handling
- **Process Health Monitoring**: Real-time status checking and health validation
- **Performance Optimized**: <200ms operation targets

### Process Management Commands

```bash
# Start background service (daemon mode)
claude-wrapper
# Output: 🚀 Claude Wrapper server started in background (PID: 12345)

# Check detailed service status
claude-wrapper --status
# Output: 📊 Server Status: RUNNING
#         PID: 12345
#         Health: ✅ HEALTHY

# Stop background service gracefully
claude-wrapper --stop
# Output: ✅ Server stopped successfully
```

## Development

### Multi-Tier Testing Architecture

```bash
# Test commands
npm test                    # Run all tests
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:e2e          # End-to-end tests only
npm run test:coverage     # Coverage analysis
npm run test:watch        # Watch mode
npm run test:debug        # Debug mode with open handles
```

### Development Tools

```bash
# Development commands
npm run dev               # Development mode with hot reload
npm run build            # Build TypeScript to JavaScript
npm run typecheck        # TypeScript type checking
npm run lint             # ESLint code quality
npm run lint:fix         # Auto-fix linting issues
npm run clean            # Clean build artifacts
```

### Code Quality Features

- **TypeScript 5.0+**: Full type safety and modern language features
- **ESLint**: Comprehensive code quality and style enforcement
- **Jest**: Advanced testing framework with custom configurations
- **SOLID Architecture**: Clean code principles with dependency injection
- **Performance Targets**: <200ms operation targets with monitoring

## Production Features

### Validated Concepts
- **100% success rate** with Claude Sonnet 4 and template approach
- **Perfect tool_calls generation** - OpenAI format without training
- **Zero conversion overhead** - Direct JSON passthrough
- **Cross-platform compatibility** - Works across Claude installations
- **Session continuity** - Intelligent conversation management
- **Streaming responses** - Real-time Server-Sent Events

### Key Discoveries
- **Template-based format control** beats abstract instructions
- **Stdin approach** handles unlimited prompt lengths
- **Client-side tool execution** provides security and flexibility
- **Simple architecture** achieves enterprise-grade compatibility
- **Session management** enables complex multi-turn conversations
- **Background services** provide production-ready reliability

### Performance
- **~5ms template injection** overhead
- **No parsing bottlenecks** 
- **Direct JSON passthrough**
- **Horizontally scalable** architecture
- **Efficient session storage** with automatic cleanup
- **Streaming latency** under 100ms first chunk delivery

## Current Status

**✅ PHASE 4A COMPLETE** - Streaming Support + Session Management

**Production-Ready Implementation:**
- **✅ Template-based format control** (100% success rate)
- **✅ Zero-conversion architecture** (direct JSON passthrough) 
- **✅ Client-side tool execution** (secure MCP integration)
- **✅ Production CLI interface** with global installation
- **✅ Background service architecture** with proper daemon management
- **✅ Session management** with intelligent conversation continuity
- **✅ Real-time streaming** with Server-Sent Events
- **✅ Comprehensive test suite** (314 tests, 100% passing)

### Latest Features Implemented
- **✅ Session Management** - Intelligent conversation continuity with TTL
- **✅ Session API** - Full CRUD operations for session management
- **✅ Streaming Support** - Real-time response streaming
- **✅ Background Cleanup** - Automatic expired session cleanup
- **✅ Memory Optimization** - Message history limiting
- **✅ Session Statistics** - Detailed session analytics
- **✅ Enhanced CLI** - Improved command structure and reliability

## License

MIT License - see [LICENSE](LICENSE) file for details.