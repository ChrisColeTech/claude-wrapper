# Claude Wrapper - Complete Documentation

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/claude-wrapper.svg)](https://nodejs.org/en/download/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![GitHub Stars](https://img.shields.io/github/stars/ChrisColeTech/claude-wrapper.svg)](https://github.com/ChrisColeTech/claude-wrapper/stargazers)
[![GitHub Issues](https://img.shields.io/github/issues/ChrisColeTech/claude-wrapper.svg)](https://github.com/ChrisColeTech/claude-wrapper/issues)

**OpenAI-compatible HTTP API wrapper for Claude Code CLI with Enhanced Performance**

Transform your Claude Code CLI into a powerful HTTP API server that accepts OpenAI Chat Completions requests. Features intelligent system prompt optimization, WSL integration, streaming responses, and comprehensive CLI tooling.

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
- [Mock Mode](#mock-mode)
- [WSL Integration](#wsl-integration)
- [System Prompt Optimization](#system-prompt-optimization)
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
- **⚡ System Prompt Optimization**: 60-70% performance improvement with intelligent session caching
- **🌊 Streaming Support**: Real-time response streaming with Server-Sent Events
- **🪟 WSL Integration**: Automatic port forwarding script generation for seamless Windows access
- **🔍 Auto-Detection**: Automatically finds Claude CLI across different installation methods (npm, Docker, aliases, environment variables)
- **🛡️ API Protection**: Optional bearer token authentication for endpoint security
- **🛠️ Perfect Tool Calls**: Claude automatically generates OpenAI `tool_calls` format
- **⚡ Zero Conversion**: Direct JSON passthrough, no parsing overhead
- **🔄 Multi-Tool Support**: Multiple tools in single response with intelligent orchestration
- **📡 Cross-Platform**: Works across different Claude Code CLI installations
- **🧪 Mock Mode**: Instant responses for testing, development, and performance evaluation
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
  -m, --mock           enable mock mode for testing (instant responses)
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

**🪟 WSL Users:** The CLI automatically detects WSL and provides port forwarding scripts for Windows access!

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

## Mock Mode

Mock mode provides instant responses for testing, development, and performance evaluation without making actual Claude CLI calls.

### Features

- **⚡ Instant Responses**: Zero latency response generation for performance testing
- **🎯 Realistic Format**: Returns authentic Claude CLI JSON response structure
- **🌊 Streaming Support**: Mock streaming with word-by-word content deltas
- **🔢 Token Calculation**: Automatic token counting based on prompt length
- **🆔 Session Management**: Unique session ID generation for each request
- **🔄 Full Compatibility**: Works with all existing endpoints and authentication

### Usage

**Enable Mock Mode:**
```bash
# Enable mock mode for testing
claude-wrapper --mock
claude-wrapper -m                         # shorthand

# Combine with other options
claude-wrapper --mock --debug             # mock mode with debug output
claude-wrapper --mock --port 9999         # mock mode on custom port
claude-wrapper --mock --api-key test-key  # mock mode with authentication
```

**Environment Variable:**
```bash
export MOCK_MODE=true
claude-wrapper
```

### Mock Response Structure

Mock mode returns realistic Claude CLI responses with:

```json
{
  "id": "unique-session-id",
  "object": "chat.completion",
  "created": 1710000000,
  "model": "claude-3-5-sonnet-20241022",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Mock response content based on your request"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 15,
    "completion_tokens": 25,
    "total_tokens": 40
  }
}
```

### Mock Streaming

Mock streaming provides realistic streaming behavior:

```bash
# Example mock streaming response
data: {"choices":[{"delta":{"content":"Hello"}}],"id":"session-123"}
data: {"choices":[{"delta":{"content":" there!"}}],"id":"session-123"}
data: {"choices":[{"delta":{"content":" How"}}],"id":"session-123"}
data: {"choices":[{"delta":{"content":" can"}}],"id":"session-123"}
data: {"choices":[{"delta":{"content":" I"}}],"id":"session-123"}
data: {"choices":[{"delta":{"content":" help"}}],"id":"session-123"}
data: {"choices":[{"delta":{"content":" you"}}],"id":"session-123"}
data: {"choices":[{"delta":{"content":"?"}}],"id":"session-123"}
data: [DONE]
```

### Use Cases

**Performance Testing:**
- Load testing without API rate limits
- Benchmarking client application performance
- Testing concurrent request handling

**Development:**
- Rapid prototyping and testing
- Offline development environments
- CI/CD pipeline testing

**Debugging:**
- Isolating client-side issues
- Testing error handling scenarios
- Validating request/response formats

### Configuration

Mock mode can be configured through environment variables:

```bash
# Enable mock mode
MOCK_MODE=true

# Combined with other settings
MOCK_MODE=true
LOG_LEVEL=debug
PORT=9999
```

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

## WSL Integration

Claude Wrapper includes automatic WSL (Windows Subsystem for Linux) detection and port forwarding script generation for seamless Windows access.

### Features

- **🔍 Auto-Detection**: Automatically detects WSL environment and IP address
- **📝 Script Generation**: Creates Windows batch and PowerShell scripts with correct port/IP
- **📁 Accessible Storage**: Saves scripts to `C:\claude-wrapper\` for easy access
- **🔧 Dynamic Configuration**: Works with any port (`-p` flag) automatically
- **💡 Clear Instructions**: Provides step-by-step guidance for setup

### How It Works

When you run `claude-wrapper` in WSL, it automatically:

1. **Detects WSL Environment** - Identifies WSL and gets the current IP address
2. **Generates Scripts** - Creates Windows port forwarding scripts with correct settings
3. **Saves to Windows** - Stores scripts in accessible `C:\claude-wrapper\` location
4. **Shows File Paths** - Displays Windows file paths for easy navigation

### WSL Output Example

```bash
$ claude-wrapper -p 9000

🚀 Claude Wrapper server started in background (PID: 12345)

📡 API Endpoints:
   POST   http://localhost:9000/v1/chat/completions      - Main chat API
   GET    http://localhost:9000/v1/models                - List available models
   ...

🌐 WSL Access (for Windows): http://172.29.125.14:9000

🌉 WSL Port Forwarding Scripts:
   Batch Script:      C:\claude-wrapper\claude-wrapper-port-9000.bat
   PowerShell Script: C:\claude-wrapper\claude-wrapper-port-9000.ps1

💡 Open File Explorer, navigate to a script path, and run as Administrator
🔧 Or copy the path and run from Command Prompt/PowerShell as Administrator
```

### Setting Up Port Forwarding

1. **Navigate to Scripts**: Open File Explorer and go to `C:\claude-wrapper\`
2. **Run as Administrator**: Right-click the script and select "Run as administrator"
3. **Access Server**: Your Claude Wrapper server is now accessible at `http://localhost:9000`

### Manual Port Forwarding

If you prefer manual setup, use this command in Windows Command Prompt (as Administrator):

```cmd
netsh interface portproxy add v4tov4 listenport=9000 listenaddress=0.0.0.0 connectport=9000 connectaddress=172.29.125.14
```

## System Prompt Optimization

Claude Wrapper includes intelligent system prompt optimization that provides significant performance improvements for repeated system prompts.

### Performance Benefits

- **60-70% faster responses** for requests with repeated system prompts
- **Intelligent session caching** for system prompt reuse
- **Automatic optimization** without client changes
- **Token efficiency** by avoiding repeated system prompt processing

### How It Works

**Traditional approach (slow):**
```bash
# Every request sends full system prompt + user message
Request 1: [System: "You are a helpful assistant"] + [User: "Hello"] → Process everything
Request 2: [System: "You are a helpful assistant"] + [User: "Goodbye"] → Process everything again
```

**Optimized approach (fast):**
```bash
# System prompt processed once, then cached for reuse
Request 1: [System: "You are a helpful assistant"] → Setup session, cache system prompt
Request 2: [User: "Hello"] → Reuse cached session (60-70% faster)
Request 3: [User: "Goodbye"] → Reuse cached session (60-70% faster)
```

### Automatic Detection

The wrapper automatically detects when requests use the same system prompt and:
- Creates an optimized session for the system prompt
- Reuses the session for subsequent requests with the same system prompt
- Manages session lifecycle automatically
- Falls back to normal processing when system prompts change
- Works transparently without requiring client modifications

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
MOCK_MODE=false             # Enable mock mode for testing (true/false)
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

**Mock Mode Testing:**
- 20+ dedicated tests for mock functionality
- Integration tests for end-to-end mock workflows
- Performance testing with zero-latency responses
- Streaming mock tests with realistic event sequences

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

**✅ PHASE 5 COMPLETE** - System Prompt Optimization + WSL Integration

**Production-Ready Implementation:**
- **✅ Template-based format control** (100% success rate)
- **✅ Zero-conversion architecture** (direct JSON passthrough) 
- **✅ Client-side tool execution** (secure MCP integration)
- **✅ Production CLI interface** with global installation
- **✅ Background service architecture** with proper daemon management
- **✅ System prompt optimization** with 60-70% performance improvements
- **✅ WSL integration** with automatic port forwarding script generation
- **✅ Real-time streaming** with Server-Sent Events
- **✅ Mock mode implementation** with instant responses for testing
- **✅ Comprehensive test suite** (430+ tests, 100% passing)

### Latest Features Implemented
- **✅ Mock Mode Implementation** - Instant responses for testing, development, and performance evaluation
- **✅ System Prompt Optimization** - Intelligent caching with Claude CLI `--resume` flag
- **✅ WSL Integration** - Automatic port forwarding script generation for Windows access
- **✅ Performance Improvements** - 60-70% faster responses for repeated system prompts
- **✅ Dynamic Script Generation** - Works with any port configuration automatically
- **✅ Windows File Integration** - Scripts saved to accessible `C:\claude-wrapper\` location
- **✅ Enhanced CLI Output** - Clear instructions and file paths for WSL users
- **✅ HTTP Script Endpoints** - Alternative access via HTTP for generated scripts
- **✅ Comprehensive Mock Testing** - 20+ dedicated tests for mock functionality with 100% pass rate

## License

MIT License - see [LICENSE](LICENSE) file for details.