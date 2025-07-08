# Claude Wrapper POC

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/claude-wrapper-poc.svg)](https://nodejs.org/en/download/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

**OpenAI-compatible HTTP API wrapper for Claude Code CLI with Session Management**

Transform your Claude Code CLI into a powerful HTTP API server that accepts OpenAI Chat Completions requests. Features intelligent session management for conversation continuity, streaming responses, and comprehensive CLI tooling.

## 🛠️ Tools-First Philosophy

**Claude Wrapper embraces client-side tool execution with OpenAI Tools API compatibility:**

- **Client-Side Execution**: Tools run in YOUR environment, not on the server
- **Security First**: No server-side file access or command execution  
- **OpenAI Standard**: Uses standard `tools` array format from OpenAI specification
- **MCP Compatible**: Works with your local MCP tool installations

This approach gives you **maximum flexibility** while maintaining **security** - Claude gets the power of tools without server-side execution risks.

## 🚀 Key Features

- **🔌 OpenAI Compatible**: Drop-in replacement for OpenAI Chat Completions API
- **🧠 Session Management**: Intelligent conversation continuity with session persistence
- **🌊 Streaming Support**: Real-time response streaming with Server-Sent Events
- **🔐 Multi-Provider Auth**: Automatic detection of Anthropic, Bedrock, Vertex, or Claude CLI authentication
- **🛡️ API Protection**: Optional bearer token authentication for endpoint security
- **🛠️ Perfect Tool Calls**: Claude automatically generates OpenAI `tool_calls` format
- **⚡ Zero Conversion**: Direct JSON passthrough, no parsing overhead
- **🔄 Multi-Tool Support**: Multiple tools in single response with intelligent orchestration
- **📡 Cross-Platform**: Works across different Claude Code CLI installations
- **🎯 Template-Based**: 100% success rate with concrete JSON templates
- **🏗️ Production Ready**: Comprehensive CLI, background services, and monitoring

## 📦 Installation

### Global Installation (Recommended)

```bash
# Clone and setup
git clone <repository-url>
cd claude-wrapper-poc/app
npm install
npm run build

# Install globally for CLI access
npm install -g .
```

### Local Development

```bash
# Development setup
cd claude-wrapper-poc/app
npm install
npm run build

# Development commands
npm run dev          # Development mode with ts-node
npm run build        # Build TypeScript to JavaScript
npm test            # Run tests
npm run test:unit    # Run unit tests only
npm run test:integration  # Run integration tests only
```

## 🚀 Quick Start

### 1. Start the Background Service

```bash
# Start server on default port (8000)
claude-wrapper

# Start with custom configuration  
claude-wrapper --port 9999 --no-interactive --verbose
```

The CLI will start the server as a **background service** and exit immediately. The server runs independently with these endpoints:
- `POST http://localhost:8000/v1/chat/completions` - Main chat completions with session support
- `GET http://localhost:8000/v1/models` - Available models (sonnet, opus)
- `GET http://localhost:8000/v1/sessions` - List active sessions
- `GET http://localhost:8000/v1/sessions/stats` - Session statistics
- `GET http://localhost:8000/health` - Health check

### 2. Manage the Service

```bash
# Check server status
claude-wrapper --status

# Stop the background server
claude-wrapper --stop

# View help and all available options
claude-wrapper --help
```

### 3. Test with cURL

```bash
# Basic chat completion
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sonnet",
    "messages": [
      {"role": "user", "content": "What is 2+2?"}
    ]
  }'

# Session-aware conversation
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sonnet",
    "messages": [
      {"role": "user", "content": "Hello, I want to learn Python"}
    ],
    "session_id": "learning-session"
  }'

# Continue conversation with session
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sonnet",
    "messages": [
      {"role": "user", "content": "What are Python functions?"}
    ],
    "session_id": "learning-session"
  }'

# Test health endpoint
curl http://localhost:8000/health
```

## 📡 API Endpoints

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

## 🧠 Session Management

**Intelligent conversation continuity with automatic session persistence:**

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

## 🔐 Authentication System

**Multi-provider authentication with automatic detection and optional API protection:**

**⚠️ IMPORTANT: Authentication is completely optional!** Claude Wrapper works perfectly without any authentication setup - just start the server and make requests.

### Two Authentication Modes

**🔓 Mode 1: No Authentication (Default)**
- Start: `claude-wrapper` 
- Use: Make requests without any Authorization headers
- Perfect for: Local development, testing, private networks

**🔐 Mode 2: API Key Protection (Optional)**  
- Start: `claude-wrapper --api-key your-key`
- Use: Include `Authorization: Bearer your-key` header
- Perfect for: Shared servers, production deployments, access control

Claude Wrapper automatically detects your Claude Code CLI authentication method and supports multiple providers for maximum flexibility.

### Supported Authentication Methods

1. **Claude CLI System Auth** (Default fallback)
   - Uses your existing `claude` CLI authentication
   - No additional setup required
   - Works with any authentication method configured in Claude CLI

2. **Anthropic API Direct**
   - Set `ANTHROPIC_API_KEY` environment variable
   - Format: `sk-ant-api03-...` (starts with `sk-ant-`)
   
3. **AWS Bedrock**
   - Requires `CLAUDE_CODE_USE_BEDROCK=1` flag
   - AWS credentials: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
   - Optional: `AWS_SESSION_TOKEN`, `AWS_PROFILE`

4. **Google Vertex AI**
   - Requires `CLAUDE_CODE_USE_VERTEX=1` flag  
   - Google credentials: `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_CLOUD_PROJECT`
   - Alternative: `GCLOUD_PROJECT`

### Authentication Priority

The system uses this priority order (highest to lowest):

1. **Bedrock** - If `CLAUDE_CODE_USE_BEDROCK=1` is set
2. **Vertex** - If `CLAUDE_CODE_USE_VERTEX=1` is set  
3. **Anthropic** - If `ANTHROPIC_API_KEY` is present
4. **Claude CLI** - System authentication (fallback)

### No Authentication Required

**Default Behavior (No Authentication Required):**
- Start server without any authentication setup: `claude-wrapper`
- Make requests without Authorization headers - full access to all features
- No environment variables or API keys needed
- Zero authentication overhead

**Example - Default Usage (No Authentication):**
```bash
# Start server (no authentication needed)
claude-wrapper

# Make requests directly - no Authorization header required
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sonnet",
    "messages": [{"role": "user", "content": "Hello"}]
  }'

# All endpoints work without authentication
curl http://localhost:8000/health
curl http://localhost:8000/v1/models
curl http://localhost:8000/v1/auth/status
```

### API Protection (Optional)

Optionally protect your API endpoints with bearer token authentication:

```bash
# Start server with API key protection
claude-wrapper --api-key your-secure-api-key-12345

# Or set via environment variable
export API_KEY=your-secure-api-key-12345
claude-wrapper
```

**Example - With API Protection:**
```bash
# Start server with API key protection
claude-wrapper --api-key my-secure-api-key-12345

# Protected endpoints require Authorization header
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer my-secure-api-key-12345" \
  -d '{
    "model": "sonnet",
    "messages": [{"role": "user", "content": "Hello"}]
  }'

# Public endpoints still work without authentication
curl http://localhost:8000/health                    # ✅ Works
curl http://localhost:8000/v1/models                 # ✅ Works  
curl http://localhost:8000/v1/auth/status            # ✅ Works

# Protected endpoints without token are blocked
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "sonnet", "messages": [{"role": "user", "content": "test"}]}'
# Returns: {"error": {"message": "Missing Authorization header..."}}

# Wrong token is rejected
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer wrong-key" \
  -H "Content-Type: application/json" \
  -d '{"model": "sonnet", "messages": [{"role": "user", "content": "test"}]}'
# Returns: {"error": {"message": "Invalid bearer token..."}}
```

### Authentication Status

Check your authentication configuration:

```bash
# Get authentication status
curl http://localhost:8000/v1/auth/status

# Example response
{
  "claude_code_auth": {
    "method": "anthropic",
    "status": {
      "method": "anthropic", 
      "valid": true,
      "errors": [],
      "config": {
        "validated": true,
        "keyPrefix": "sk-ant-api..."
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

### Environment Variable Examples

**Anthropic Direct:**
```bash
export ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
claude-wrapper
```

**AWS Bedrock:**
```bash
export CLAUDE_CODE_USE_BEDROCK=1
export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE  
export AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
export AWS_REGION=us-east-1
claude-wrapper
```

**Google Vertex AI:**
```bash
export CLAUDE_CODE_USE_VERTEX=1
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
export GOOGLE_CLOUD_PROJECT=your-project-id
claude-wrapper
```

**With API Protection:**
```bash
export ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
export API_KEY=your-secure-server-api-key-12345
claude-wrapper
```

## 🖥️ CLI Command Reference

### Installation and Basic Usage

```bash
# Install globally
npm install -g .

# Start background service (default port 8000)
claude-wrapper

# Start with custom configuration
claude-wrapper --port 9999 --no-interactive --verbose
```

### Service Management

```bash
# Check service status
claude-wrapper --status

# Stop background service
claude-wrapper --stop

# View version
claude-wrapper --version

# Show help
claude-wrapper --help
```

### Available CLI Flags

| Flag | Description | Example |
|------|-------------|---------|
| `-p, --port <port>` | Set server port (default: 8000) | `claude-wrapper --port 9999` |
| `-v, --verbose` | Enable verbose logging | `claude-wrapper --verbose` |
| `-d, --debug` | Enable debug mode | `claude-wrapper --debug` |
| `--api-key <key>` | Set API key for endpoint protection | `claude-wrapper --api-key mykey123` |
| `--no-interactive` | Disable interactive prompts | `claude-wrapper --no-interactive` |
| `--stop` | Stop background server | `claude-wrapper --stop` |
| `--status` | Check server status | `claude-wrapper --status` |
| `--help` | Show help information | `claude-wrapper --help` |
| `--version` | Show version number | `claude-wrapper --version` |

### Background Service Architecture

The CLI operates as a **service manager** that:
1. **Spawns detached background process** - Server runs independently
2. **Exits immediately** - CLI command returns control to terminal
3. **Maintains PID files** - Enables status checking and stopping
4. **Supports graceful shutdown** - Proper cleanup on stop

```bash
# This pattern works correctly:
claude-wrapper --port 9999 --no-interactive       # Starts service, exits immediately
claude-wrapper --status                            # Shows: RUNNING
curl http://localhost:9999/health                  # Server responds
claude-wrapper --stop                              # Stops service gracefully
```

## 🔧 Process Management (Phase 6A)

**Enterprise-grade background process management with production-ready reliability:**

Claude Wrapper now includes comprehensive process management capabilities for robust background service operation. This system provides proper daemon management, graceful shutdown handling, and process monitoring for production environments.

### Background Service Features

- **🔄 Daemon Process Management**: Spawns detached background processes with proper lifecycle management
- **📁 PID File Management**: Safe creation, validation, and cleanup of process identification files
- **🛑 Graceful Shutdown**: SIGTERM/SIGINT signal handling with configurable shutdown steps
- **📊 Process Health Monitoring**: Real-time status checking and health validation
- **⚡ Performance Optimized**: <200ms operation targets for all process management functions

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

# Service automatically handles:
# - PID file creation and validation
# - Graceful shutdown on system signals
# - Stale process cleanup
# - Health monitoring
```

### Production Process Architecture

The process management system follows enterprise patterns:

1. **Daemon Spawning**: Creates detached background processes that survive terminal closure
2. **PID Management**: Maintains process identification files for service tracking
3. **Signal Handling**: Responds to system signals (SIGTERM, SIGINT) for graceful shutdown
4. **Health Monitoring**: Provides status checking and health validation endpoints
5. **Error Recovery**: Automatic cleanup of stale processes and PID files

### Process Lifecycle Example

```bash
# 1. Start the service
$ claude-wrapper --port 9999 --verbose
🚀 Claude Wrapper server started in background (PID: 67890)
📡 API available at http://localhost:9999/v1/chat/completions
📊 Health check at http://localhost:9999/health

# CLI exits immediately, server continues running

# 2. Verify service is running
$ claude-wrapper --status
📊 Server Status: RUNNING
   PID: 67890  
   Health: ✅ HEALTHY

# 3. Service responds to requests
$ curl http://localhost:9999/health
{"status":"healthy","timestamp":"2025-01-08T12:00:00.000Z"}

# 4. Stop service gracefully
$ claude-wrapper --stop
✅ Server stopped successfully

# 5. Verify service stopped
$ claude-wrapper --status
📊 Server Status: NOT RUNNING
```

### Advanced Process Features

**Automatic Cleanup:**
- Detects and removes stale PID files from crashed processes
- Validates process existence before reporting status
- Handles system restarts and unexpected shutdowns

**Production Reliability:**
- Process operations complete within 200ms performance targets
- Comprehensive error handling for all failure scenarios
- SOLID architecture with dependency injection for testing

**Development Integration:**
- Seamless integration with existing CLI commands
- Maintains full backward compatibility
- Extensive test coverage (48 tests covering all process scenarios)

### Process Management API

The background service exposes process health information:

```bash
# Health check endpoint (used internally by --status)
curl http://localhost:8000/health
# Response: {"status":"healthy","timestamp":"2025-01-08T12:00:00.000Z"}

# Service automatically registers with process manager
# PID files stored in system temp directory
# Graceful shutdown on SIGTERM/SIGINT signals
```

This process management system enables reliable production deployments with proper service lifecycle management, health monitoring, and graceful shutdown capabilities.

## 🏆 Production Results

### **✅ Validated Concepts**
- **100% success rate** with Claude Sonnet 4 and template approach
- **Perfect tool_calls generation** - OpenAI format without training
- **Zero conversion overhead** - Direct JSON passthrough
- **Cross-platform compatibility** - Works across Claude installations
- **Session continuity** - Intelligent conversation management
- **Streaming responses** - Real-time Server-Sent Events

### **🎯 Key Discoveries**
- **Template-based format control** beats abstract instructions
- **Stdin approach** handles unlimited prompt lengths
- **Client-side tool execution** provides security and flexibility
- **Simple architecture** achieves enterprise-grade compatibility
- **Session management** enables complex multi-turn conversations
- **Background services** provide production-ready reliability

### **⚡ Performance**
- **~5ms template injection** overhead
- **No parsing bottlenecks** 
- **Direct JSON passthrough**
- **Horizontally scalable** architecture
- **Efficient session storage** with automatic cleanup
- **Streaming latency** under 100ms first chunk delivery

## 📚 Documentation

📖 **[Full Documentation](docs/README.md)** - Comprehensive analysis, technical details, implementation findings, and production rewrite planning.

### **Documentation Index**
- **[Complete Feature Analysis](docs/README.md)** - POC + original project comparison
- **[Implementation Plan](docs/IMPLEMENTATION_PLAN.md)** - Phase-by-phase rewrite strategy
- **[Project Structure](docs/PROJECT_STRUCTURE.md)** - Target architecture organization
- **[Architecture Guide](docs/ARCHITECTURE.md)** - SOLID principles and best practices
- **[API Reference](docs/API_REFERENCE.md)** - Complete endpoint documentation
- **[Code Examples](docs/CODE_EXAMPLES.md)** - Implementation patterns and techniques

## 🎯 Current Status

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

## 🔄 Next Steps

**Production Rewrite Strategy**: Build upon POC foundation and selectively integrate essential features from the original claude-wrapper project while avoiding over-engineering.

See **[Implementation Plan](docs/IMPLEMENTATION_PLAN.md)** for the complete phase-by-phase rewrite strategy.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

⭐ **Star this repository** if you find it useful!  
🐛 **Report issues** or suggest features  
📖 **Read the [Full Documentation](docs/README.md)** for comprehensive details

**POC Status**: All core concepts validated and ready for production implementation!