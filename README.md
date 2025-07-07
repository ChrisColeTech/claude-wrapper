# Claude Wrapper POC

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/claude-wrapper-poc.svg)](https://nodejs.org/en/download/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

**OpenAI-compatible HTTP API wrapper for Claude Code CLI**

Transform your Claude Code CLI into a powerful HTTP API server that accepts OpenAI Chat Completions requests. This POC validates a "clean approach" using minimal code and zero conversion overhead.

## 🛠️ Tools-First Philosophy

**Claude Wrapper embraces client-side tool execution with OpenAI Tools API compatibility:**

- **Client-Side Execution**: Tools run in YOUR environment, not on the server
- **Security First**: No server-side file access or command execution  
- **OpenAI Standard**: Uses standard `tools` array format from OpenAI specification
- **MCP Compatible**: Works with your local MCP tool installations

This approach gives you **maximum flexibility** while maintaining **security** - Claude gets the power of tools without server-side execution risks.

## 🚀 Key Features

- **🔌 OpenAI Compatible**: Drop-in replacement for OpenAI Chat Completions API
- **🛠️ Perfect Tool Calls**: Claude automatically generates OpenAI `tool_calls` format
- **⚡ Zero Conversion**: Direct JSON passthrough, no parsing overhead
- **🔄 Multi-Tool Support**: Multiple tools in single response with intelligent orchestration
- **📡 Cross-Platform**: Works across different Claude Code CLI installations
- **🎯 Template-Based**: 100% success rate with concrete JSON templates

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

# Start on custom port with no prompts
claude-wrapper --port 3000 --no-interactive

# Start with verbose logging
claude-wrapper --verbose --port 3000 --no-interactive
```

The CLI will start the server as a **background service** and exit immediately. The server runs independently with these endpoints:
- `POST http://localhost:8000/v1/chat/completions` - Main chat completions
- `GET http://localhost:8000/v1/models` - Available models
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
    "model": "claude-sonnet-4-20250514",
    "messages": [
      {"role": "user", "content": "What is 2+2?"}
    ]
  }'

# Test health endpoint
curl http://localhost:8000/health
```

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/chat/completions` | Main chat completions with tool support |
| `GET` | `/v1/models` | List available Claude models |
| `GET` | `/health` | Service health check |

## 🖥️ CLI Command Reference

### Installation and Basic Usage

```bash
# Install globally
npm install -g .

# Start background service (default port 8000)
claude-wrapper

# Start with custom configuration
claude-wrapper --port 3000 --no-interactive --verbose
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
| `-p, --port <port>` | Set server port (default: 8000) | `claude-wrapper --port 3000` |
| `-v, --verbose` | Enable verbose logging | `claude-wrapper --verbose` |
| `-d, --debug` | Enable debug mode | `claude-wrapper --debug` |
| `--api-key <key>` | Set API key for endpoint protection | `claude-wrapper --api-key mykey123` |
| `--no-interactive` | Disable interactive prompts | `claude-wrapper --no-interactive` |
| `--production` | Enable production features | `claude-wrapper --production` |
| `--health-monitoring` | Enable health monitoring | `claude-wrapper --health-monitoring` |
| `--stop` | Stop background server | `claude-wrapper --stop` |
| `--status` | Check server status | `claude-wrapper --status` |
| `--help` | Show help information | `claude-wrapper --help` |
| `--version` | Show version number | `claude-wrapper --version` |

### Port Configuration

```bash
# Using --port flag
claude-wrapper --port 3000

# Using positional argument
claude-wrapper 3000

# Port flag takes precedence over positional
claude-wrapper --port 4000 3000  # Uses port 4000
```

### Background Service Architecture

The CLI operates as a **service manager** that:
1. **Spawns detached background process** - Server runs independently
2. **Exits immediately** - CLI command returns control to terminal
3. **Maintains PID files** - Enables status checking and stopping
4. **Supports graceful shutdown** - Proper cleanup on stop

```bash
# This pattern works correctly:
claude-wrapper --port 3000 --no-interactive  # Starts service, exits immediately
claude-wrapper --status                       # Shows: RUNNING
curl http://localhost:3000/health            # Server responds
claude-wrapper --stop                        # Stops service gracefully
```

## 🏆 POC Results

### **✅ Validated Concepts**
- **100% success rate** with Claude Sonnet 4 and template approach
- **Perfect tool_calls generation** - OpenAI format without training
- **Zero conversion overhead** - Direct JSON passthrough
- **Cross-platform compatibility** - Works across Claude installations

### **🎯 Key Discoveries**
- **Template-based format control** beats abstract instructions
- **Stdin approach** handles unlimited prompt lengths
- **Client-side tool execution** provides security and flexibility
- **Simple architecture** achieves enterprise-grade compatibility

### **⚡ Performance**
- **~5ms template injection** overhead
- **No parsing bottlenecks** 
- **Direct JSON passthrough**
- **Horizontally scalable** architecture

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

**✅ PHASE 2A COMPLETE** - CLI Interface Implementation

**POC Foundation + Production CLI:**
- **✅ Template-based format control** (100% success rate)
- **✅ Zero-conversion architecture** (direct JSON passthrough) 
- **✅ Client-side tool execution** (secure MCP integration)
- **✅ Production CLI interface** with global installation
- **✅ Background service architecture** with proper daemon management
- **✅ Comprehensive test suite** (66 tests, 100% passing)

### CLI Features Implemented
- **✅ Global installation** via npm (`claude-wrapper` command)
- **✅ Background service management** (start, stop, status)
- **✅ Full flag support** (port, verbose, debug, api-key, etc.)
- **✅ Interactive setup** with security prompts
- **✅ PID-based process management** 
- **✅ Graceful shutdown handling**

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