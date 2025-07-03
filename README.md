# Claude Code OpenAI API Wrapper

[![CI Status](https://github.com/ChrisColeTech/claude-wrapper/workflows/Continuous%20Integration/badge.svg)](https://github.com/ChrisColeTech/claude-wrapper/actions)
[![Node Version](https://img.shields.io/node/v/claude-wrapper.svg)](https://nodejs.org/)
[![Platform Support](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue.svg)](https://github.com/ChrisColeTech/claude-wrapper)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An OpenAI API-compatible wrapper for Claude Code, allowing you to use Claude Code with any OpenAI client library. **Powered by the official Claude Code Node.js SDK** with comprehensive authentication support and advanced features.

## 📋 Current Status

🚧 **Active Development** - TypeScript port from production-ready Python version:

### ✅ **Completed**
- ✅ Complete project architecture and documentation
- ✅ CLI with daemon mode, port management, and debug features
- ✅ Express server with OpenAI-compatible endpoints
- ✅ Multi-provider authentication system
- ✅ Session management and health monitoring
- ✅ Comprehensive test framework setup
- ✅ 8-phase Claude SDK integration plan

### 🚧 **In Progress**
- 🟡 **Claude SDK Integration** - Replacing mock responses with actual Claude Code SDK
- 🟡 **Message format conversion** - OpenAI ↔ Claude format handling
- 🟡 **Real completions** - Non-streaming and streaming responses with Claude

### 🔮 **Planned**
- ⚪ Model validation and selection
- ⚪ Tools integration (disabled by default for OpenAI compatibility)
- ⚪ Advanced features (system prompts, custom headers)
- ⚪ Production hardening and monitoring

## 🎯 Features

### 🔥 **Core API Compatibility**
- OpenAI-compatible `/v1/chat/completions` endpoint
- Support for both streaming and non-streaming responses
- Compatible with OpenAI Node.js SDK and all OpenAI client libraries
- Session continuity for multi-turn conversations

### 🛠 **Claude Code SDK Integration**
- **Official Claude Code Node.js SDK** integration
- **Real-time cost tracking** from SDK metadata
- **Accurate token counting** from Claude responses
- **Session management** with conversation history
- **Enhanced error handling** with detailed diagnostics

### 🔐 **Multi-Provider Authentication**
- **Automatic detection** of authentication method
- **Claude CLI auth** - works with existing `claude auth` setup
- **Direct API key** - `ANTHROPIC_API_KEY` environment variable
- **AWS Bedrock** - enterprise authentication with AWS credentials
- **Google Vertex AI** - GCP authentication support

### ⚡ **Advanced CLI Features**
- **Daemon mode** - Start/stop server in background
- **Port management** - Automatic port conflict resolution
- **Debug and verbose modes** - Comprehensive logging
- **Interactive setup** - Optional API key protection
- **Status monitoring** - Health checks and server status

## 🚀 Quick Start

Get started in under 2 minutes:

```bash
# 1. Install Claude Code CLI (if not already installed)
npm install -g @anthropic-ai/claude-code

# 2. Authenticate (choose one method)
claude auth login  # Recommended for development
# OR set: export ANTHROPIC_API_KEY=your-api-key

# 3. Clone and setup the wrapper
git clone https://github.com/ChrisColeTech/claude-wrapper
cd claude-wrapper
./scripts/init-app.sh
cd app && npm install && npm run build

# 4. Start the server
claude-wrapper

# 5. Test it works
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

🎉 **That's it!** Your OpenAI-compatible Claude Code API is running on `http://localhost:8000`

## 📦 Installation

### Development Install
```bash
# Clone the repository
git clone https://github.com/ChrisColeTech/claude-wrapper
cd claude-wrapper

# Initialize the application
./scripts/init-app.sh
cd app

# Install dependencies and build
npm install
npm run build

# Link globally for CLI access
npm link
```

## 🔧 CLI Usage

The `claude-wrapper` CLI provides comprehensive server management with daemon capabilities:

### Basic Commands

```bash
# Start server (foreground)
claude-wrapper

# Start with custom port
claude-wrapper 8080
claude-wrapper --port 9000

# Start in background (daemon mode)
claude-wrapper --start

# Check server status
claude-wrapper --status

# Stop background server
claude-wrapper --stop

# Show help
claude-wrapper --help

# Show version
claude-wrapper --version
```

### Advanced Options

```bash
# Debug mode (detailed logging)
claude-wrapper --debug

# Verbose mode (verbose logging)
claude-wrapper --verbose

# Disable interactive setup
claude-wrapper --no-interactive

# Combined options
claude-wrapper 8080 --debug --no-interactive
claude-wrapper --start --port 9000 --verbose
```

### Complete CLI Reference

| Option | Short | Description | Example |
|--------|-------|-------------|---------|
| `--port <port>` | `-p` | Set server port (1-65535) | `--port 8080` |
| `--verbose` | `-v` | Enable verbose logging | `--verbose` |
| `--debug` | `-d` | Enable debug mode | `--debug` |
| `--no-interactive` | | Disable interactive setup | `--no-interactive` |
| `--start` | | Start server in background | `--start` |
| `--stop` | | Stop background server | `--stop` |
| `--status` | | Check server status | `--status` |
| `--help` | `-h` | Show help message | `--help` |
| `--version` | `-V` | Show version | `--version` |

### Daemon Mode Examples

```bash
# Start server in background on port 8080 with debug logging
claude-wrapper --start --port 8080 --debug

# Check if background server is running
claude-wrapper --status
# Output:
# 📊 Server Status: RUNNING
#    PID: 12345
#    Logs: /tmp/claude-wrapper.log
#    Health: ✅ OK (port 8080)

# Stop background server
claude-wrapper --stop
# Output: ✅ Server stopped (PID: 12345)
```

### Port Conflict Handling

The CLI automatically handles port conflicts:

```bash
claude-wrapper 8000
# Output if port 8000 is busy:
# ⚠️  Port 8000 is already in use. Finding alternative port...
# 🚀 Server starting on http://localhost:8006
# 📝 Update your client base_url to: http://localhost:8006/v1
```

## ⚙️ Configuration

The server can be configured via environment variables or `.env` file:

```env
# Server Configuration
PORT=8000                    # Server port (default: 8000)
DEBUG_MODE=false             # Enable debug logging (default: false)
VERBOSE=false                # Enable verbose logging (default: false)
MAX_TIMEOUT=600000           # Request timeout in ms (default: 10 minutes)
CORS_ORIGINS=["*"]           # CORS allowed origins (default: allow all)

# Optional API Key Protection
API_KEY=your-optional-key    # Server protection (if not set, interactive prompt)

# Claude Authentication (choose one)
ANTHROPIC_API_KEY=sk-ant-... # Direct API key
# OR Claude CLI auth (claude auth login)
# OR AWS Bedrock
CLAUDE_CODE_USE_BEDROCK=1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
# OR Google Vertex AI
CLAUDE_CODE_USE_VERTEX=1
GOOGLE_CLOUD_PROJECT=...
GOOGLE_CLOUD_REGION=us-central1
```

### 🔐 Interactive API Key Protection

The server supports interactive API key protection for secure remote access:

```bash
claude-wrapper
# Output:
# 🔐 API Endpoint Security Configuration
# ===================================
# Would you like to protect your API endpoint with an API key?
# This adds a security layer when accessing your server remotely.
# 
# Enable API key protection? (y/N): y
# 
# 🔑 API Key Generated!
# ===================================
# API Key: Xf8k2mN9-vLp3qR5_zA7bW1cE4dY6sT0uI
# ===================================
```

To disable interactive prompts:
```bash
claude-wrapper --no-interactive
```

## 📡 API Endpoints

### Core Endpoints
- `POST /v1/chat/completions` - OpenAI-compatible chat completions (supports `session_id`)
- `GET /v1/models` - List available Claude models
- `GET /health` - Health check endpoint
- `GET /v1/auth/status` - Authentication status and configuration

### Session Management (Future)
- `GET /v1/sessions` - List active sessions
- `GET /v1/sessions/{session_id}` - Get session details
- `DELETE /v1/sessions/{session_id}` - Delete session

## 🧪 Usage Examples

### Using curl

```bash
# Basic chat completion
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [
      {"role": "user", "content": "What is 2 + 2?"}
    ]
  }'

# With API key protection (when enabled)
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-generated-api-key" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [
      {"role": "user", "content": "Write a TypeScript hello world script"}
    ],
    "stream": true
  }'

# Session continuity (future feature)
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [
      {"role": "user", "content": "Remember my name is Alice"}
    ],
    "session_id": "my-conversation"
  }'
```

### Using OpenAI Node.js SDK

```javascript
import OpenAI from 'openai';

// Configure client
const client = new OpenAI({
    baseURL: "http://localhost:8000/v1",
    apiKey: "your-api-key-if-protection-enabled"
});

// Basic chat completion
const response = await client.chat.completions.create({
    model: "claude-3-5-sonnet-20241022",
    messages: [
        {"role": "user", "content": "Explain TypeScript in simple terms"}
    ]
});

console.log(response.choices[0].message.content);

// Streaming response
const stream = await client.chat.completions.create({
    model: "claude-3-5-sonnet-20241022",
    messages: [
        {"role": "user", "content": "Write a Python script to sort a list"}
    ],
    stream: true
});

for await (const chunk of stream) {
    if (chunk.choices[0]?.delta?.content) {
        process.stdout.write(chunk.choices[0].delta.content);
    }
}

// Session continuity (future feature)
const response1 = await client.chat.completions.create({
    model: "claude-3-5-sonnet-20241022",
    messages: [
        {"role": "user", "content": "My name is Bob and I like Python."}
    ],
    session_id: "conversation-with-bob"
});

const response2 = await client.chat.completions.create({
    model: "claude-3-5-sonnet-20241022",
    messages: [
        {"role": "user", "content": "What's my name and what language do I like?"}
    ],
    session_id: "conversation-with-bob"  // Same session
});
// Claude will remember: "Your name is Bob and you like Python."
```

## 🎯 Supported Models

The wrapper supports all Claude models available through the Claude Code SDK:

- `claude-sonnet-4-20250514` (Latest Sonnet)
- `claude-opus-4-20250514` (Latest Opus)
- `claude-3-7-sonnet-20250219`
- `claude-3-5-sonnet-20241022`
- `claude-3-5-haiku-20241022`

Model validation is performed against actual Claude SDK capabilities.

## 🔄 Development Workflow

### Building and Testing

```bash
# Development mode with auto-reload
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Full development cycle
npm run build && npm test && npm run lint
```

### Development Status

The project follows a systematic 8-phase implementation plan:

1. **Phase 1**: Claude Service Foundation (🚧 Current)
2. **Phase 2**: Message Format Conversion
3. **Phase 3**: Model Selection and Validation
4. **Phase 4**: Non-Streaming Completions
5. **Phase 5**: Streaming Completions
6. **Phase 6**: Tools Integration (Optional)
7. **Phase 7**: Advanced Features Integration
8. **Phase 8**: Production Hardening

See `docs/claude-sdk-phases/` for detailed implementation specifications.

## 🛠 Troubleshooting

### Common Issues

1. **Claude CLI not found**:
   ```bash
   # Check Claude is installed and in PATH
   which claude
   claude --version
   ```

2. **Authentication errors**:
   ```bash
   # Test authentication
   claude --print --model claude-3-5-haiku-20241022 "Hello"
   
   # Check auth status
   curl http://localhost:8000/v1/auth/status
   ```

3. **Port conflicts**:
   ```bash
   # Use a different port
   claude-wrapper --port 9000
   
   # Check what's using a port (Linux/macOS)
   lsof -i :8000
   ```

4. **Server not starting**:
   ```bash
   # Check logs with debug mode
   claude-wrapper --debug
   
   # For daemon mode, check logs
   claude-wrapper --status
   tail -f /tmp/claude-wrapper.log
   ```

### Debug Mode

Enable comprehensive logging for troubleshooting:

```bash
# Start with debug logging
claude-wrapper --debug

# Or with verbose logging
claude-wrapper --verbose

# Both debug and verbose
claude-wrapper --debug --verbose
```

## 📚 Documentation

- **[Architecture](docs/ARCHITECTURE.md)** - Project architecture and design patterns
- **[Implementation Plan](docs/CLAUDE_SDK_INTEGRATION_PLAN.md)** - Complete implementation roadmap
- **[SDK Reference](docs/CLAUDE_SDK_REFERENCE.md)** - Claude SDK integration patterns
- **[Phase Documentation](docs/claude-sdk-phases/)** - Detailed implementation phases
- **[API Reference](docs/API_REFERENCE.md)** - Complete API documentation
- **[Testing Guide](docs/TESTING.md)** - Testing strategies and standards

## 🤝 Contributing

Contributions are welcome! Please follow our development process:

1. Review the [Implementation Plan](docs/CLAUDE_SDK_INTEGRATION_PLAN.md)
2. Check current phase in [claude-sdk-phases](docs/claude-sdk-phases/)
3. Follow [Architecture Guidelines](docs/ARCHITECTURE.md)
4. Ensure 100% test coverage for new code
5. Submit pull requests with comprehensive tests

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🔗 Links

- **Repository**: [GitHub](https://github.com/ChrisColeTech/claude-wrapper)
- **Issues**: [GitHub Issues](https://github.com/ChrisColeTech/claude-wrapper/issues)
- **Claude Code**: [Official Claude Code CLI](https://github.com/anthropics/claude-code)

---

⭐ **Star this repo** if you find it useful!

🐛 **Report issues** via [GitHub Issues](https://github.com/ChrisColeTech/claude-wrapper/issues)

💡 **Request features** via [GitHub Issues](https://github.com/ChrisColeTech/claude-wrapper/issues)