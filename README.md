# Claude Code OpenAI API Wrapper

[![CI Status](https://github.com/ChrisColeTech/claude-wrapper/workflows/Continuous%20Integration/badge.svg)](https://github.com/ChrisColeTech/claude-wrapper/actions)
[![Node Version](https://img.shields.io/node/v/claude-wrapper.svg)](https://nodejs.org/)
[![Platform Support](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue.svg)](https://github.com/ChrisColeTech/claude-wrapper)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An OpenAI API-compatible wrapper for Claude Code, allowing you to use Claude Code with any OpenAI client library. **Now powered by the official Claude Code Node.js SDK** with enhanced authentication and features.

## Status

🚧 **In Development** - Porting from production-ready Python version:
- ⚪ Chat completions endpoint with **official Claude Code Node.js SDK**
- ⚪ Streaming and non-streaming responses  
- ⚪ Full OpenAI SDK compatibility
- ⚪ **Multi-provider authentication** (API key, Bedrock, Vertex AI, CLI auth)
- ⚪ **System prompt support** via SDK options
- ⚪ Model selection support with validation
- ⚪ **Tools enabled by default** - Full Claude Code power (Read, Write, Bash, etc.)
- ⚪ **Real-time cost and token tracking** from SDK
- ⚪ **Session continuity** with conversation history across requests
- ⚪ **Session management endpoints** for full session control
- ⚪ Health, auth status, and models endpoints
- ⚪ **Development mode** with auto-reload

## Features

### 🔥 **Core API Compatibility**
- OpenAI-compatible `/v1/chat/completions` endpoint
- Support for both streaming and non-streaming responses
- Compatible with OpenAI Node.js SDK and all OpenAI client libraries
- Automatic model validation and selection

### 🛠 **Claude Code SDK Integration**
- **Official Claude Code Node.js SDK** integration
- **Real-time cost tracking** - actual costs from SDK metadata
- **Accurate token counting** - input/output tokens from SDK
- **Session management** - proper session IDs and continuity
- **Enhanced error handling** with detailed authentication diagnostics

### 🔐 **Multi-Provider Authentication**
- **Automatic detection** of authentication method
- **Claude CLI auth** - works with existing `claude auth` setup
- **Direct API key** - `ANTHROPIC_API_KEY` environment variable
- **AWS Bedrock** - enterprise authentication with AWS credentials
- **Google Vertex AI** - GCP authentication support

### ⚡ **Advanced Features**
- **System prompt support** via SDK options
- **Tools enabled by default** - Full Claude Code power (Read, Write, Bash, etc.) out of the box
- **Optional tool disabling** - Use `disable_tools` parameter for 5-10x speed boost when needed
- **CLI with options** - Custom ports, help, version commands
- **Interactive API key protection** - Optional security with auto-generated tokens
- **Comprehensive logging** and debugging capabilities

## Quick Start

Get started in under 2 minutes:

```bash
# 1. Install Claude Code CLI (if not already installed)
npm install -g @anthropic-ai/claude-code

# 2. Authenticate (choose one method)
claude auth login  # Recommended for development
# OR set: export ANTHROPIC_API_KEY=your-api-key

# 3. Install the wrapper globally
npm install -g claude-wrapper

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

## Prerequisites

1. **Claude Code CLI**: Install Claude Code CLI
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

2. **Authentication**: Choose one method:
   - **Option A**: Authenticate via CLI (Recommended for development)
     ```bash
     claude auth login
     ```
   - **Option B**: Set environment variable
     ```bash
     export ANTHROPIC_API_KEY=your-api-key
     ```
   - **Option C**: Use AWS Bedrock or Google Vertex AI (see Configuration section)

3. **Node.js 18+**: Required for the server

4. **npm**: For dependency management

## Installation

### Option 1: Global Install (Recommended)
```bash
npm install -g claude-wrapper
```

### Option 2: Development Install
```bash
# Clone the repository
git clone https://github.com/ChrisColeTech/claude-wrapper
cd claude-wrapper

# Initialize the application
./scripts/init-app.sh
cd app

# Install dependencies
npm install

# Build and link globally
npm run build
npm link
```

## Configuration

Edit the `.env` file:

```env
# Optional API key for client authentication
# If not set, server will prompt for interactive API key protection on startup
# API_KEY=your-optional-api-key

# Server port
PORT=8000

# Timeout in milliseconds
MAX_TIMEOUT=600000

# CORS origins
CORS_ORIGINS=["*"]
```

### 🔐 **API Security Configuration**

The server supports **interactive API key protection** for secure remote access:

1. **No API key set**: Server prompts "Enable API key protection? (y/N)" on startup
   - Choose **No** (default): Server runs without authentication
   - Choose **Yes**: Server generates and displays a secure API key

2. **Environment API key set**: Uses the configured `API_KEY` without prompting

```bash
# Example: Interactive protection enabled
claude-wrapper

# Output:
# ============================================================
# 🔐 API Endpoint Security Configuration
# ============================================================
# Would you like to protect your API endpoint with an API key?
# This adds a security layer when accessing your server remotely.
# 
# Enable API key protection? (y/N): y
# 
# 🔑 API Key Generated!
# ============================================================
# API Key: Xf8k2mN9-vLp3qR5_zA7bW1cE4dY6sT0uI
# ============================================================
# Server running on http://localhost:8000
```

**Perfect for:**
- 🏠 **Local development** - No authentication needed
- 🌐 **Remote access** - Secure with generated tokens
- 🔒 **VPN/Tailscale** - Add security layer for remote endpoints

## Running the Server

1. Verify Claude Code is installed and working:
   ```bash
   claude --version
   claude --print --model claude-3-5-haiku-20241022 "Hello"  # Test with fastest model
   ```

2. Start the server:

   **Global install:**
   ```bash
   claude-wrapper
   ```

   **Development mode:**
   ```bash
   cd app
   npm run dev
   ```

   **CLI Options:**
   ```bash
   claude-wrapper --port 9000              # Custom port
   claude-wrapper --help                   # Show all options
   claude-wrapper --version                # Show version
   ```

## Usage Examples

### Using curl

```bash
# Basic chat completion (no auth)
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

# Disable tools for speed (5-10x faster)
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [
      {"role": "user", "content": "Explain quantum computing"}
    ],
    "disable_tools": true
  }'
```

### Using OpenAI Node.js SDK

```javascript
import OpenAI from 'openai';

// Configure client (automatically detects auth requirements)
const client = new OpenAI({
    baseURL: "http://localhost:8000/v1",
    apiKey: "your-api-key-if-required"  // Only needed if protection enabled
});

// Basic chat completion - tools enabled by default
const response = await client.chat.completions.create({
    model: "claude-3-5-sonnet-20241022",
    messages: [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "What files are in the current directory?"}
    ]
});

console.log(response.choices[0].message.content);
// Output: Claude will actually read your directory and list the files!

// Disable tools for faster responses
const fastResponse = await client.chat.completions.create({
    model: "claude-3-5-sonnet-20241022",
    messages: [
        {"role": "user", "content": "Explain TypeScript"}
    ],
    disable_tools: true  // 5-10x faster text-only response
});

// Check real costs and tokens
console.log(`Cost: $${response.usage.total_tokens * 0.000003:.6f}`);
console.log(`Tokens: ${response.usage.total_tokens} (${response.usage.prompt_tokens} + ${response.usage.completion_tokens})`);

// Streaming
const stream = client.chat.completions.create({
    model: "claude-3-5-sonnet-20241022",
    messages: [
        {"role": "user", "content": "Explain quantum computing"}
    ],
    stream: true
});

for await (const chunk of stream) {
    if (chunk.choices[0]?.delta?.content) {
        process.stdout.write(chunk.choices[0].delta.content);
    }
}
```

## Supported Models

- `claude-sonnet-4-20250514` (Recommended)
- `claude-opus-4-20250514`
- `claude-3-7-sonnet-20250219`
- `claude-3-5-sonnet-20241022`
- `claude-3-5-haiku-20241022`

The model parameter is passed to Claude Code via the Node.js SDK.

## Session Continuity

The wrapper supports **session continuity**, allowing you to maintain conversation context across multiple requests. This is a powerful feature that goes beyond the standard OpenAI API.

### How It Works

- **Stateless Mode** (default): Each request is independent, just like the standard OpenAI API
- **Session Mode**: Include a `session_id` to maintain conversation history across requests

### Using Sessions with OpenAI SDK

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
    baseURL: "http://localhost:8000/v1",
    apiKey: "not-needed"
});

// Start a conversation with session continuity
const response1 = await client.chat.completions.create({
    model: "claude-3-5-sonnet-20241022",
    messages: [
        {"role": "user", "content": "Hello! My name is Alice and I'm learning TypeScript."}
    ],
    session_id: "my-learning-session"
});

// Continue the conversation - Claude remembers the context
const response2 = await client.chat.completions.create({
    model: "claude-3-5-sonnet-20241022", 
    messages: [
        {"role": "user", "content": "What's my name and what am I learning?"}
    ],
    session_id: "my-learning-session"  // Same session ID
});
// Claude will remember: "Your name is Alice and you're learning TypeScript."
```

### Session Management

The wrapper provides endpoints to manage active sessions:

- `GET /v1/sessions` - List all active sessions
- `GET /v1/sessions/{session_id}` - Get session details
- `DELETE /v1/sessions/{session_id}` - Delete a session
- `GET /v1/sessions/stats` - Get session statistics

```bash
# List active sessions
curl http://localhost:8000/v1/sessions

# Get session details
curl http://localhost:8000/v1/sessions/my-session

# Delete a session
curl -X DELETE http://localhost:8000/v1/sessions/my-session
```

### Session Features

- **Automatic Expiration**: Sessions expire after 1 hour of inactivity
- **Streaming Support**: Session continuity works with both streaming and non-streaming requests
- **Memory Persistence**: Full conversation history is maintained within the session
- **Efficient Storage**: Only active sessions are kept in memory

## API Endpoints

### Core Endpoints
- `POST /v1/chat/completions` - OpenAI-compatible chat completions (supports `session_id`)
- `GET /v1/models` - List available models
- `GET /v1/auth/status` - Check authentication status and configuration
- `GET /health` - Health check endpoint

### Session Management Endpoints
- `GET /v1/sessions` - List all active sessions
- `GET /v1/sessions/{session_id}` - Get detailed session information
- `DELETE /v1/sessions/{session_id}` - Delete a specific session
- `GET /v1/sessions/stats` - Get session manager statistics

## Development Status

### 🚧 **Current Implementation**
This is a Node.js/TypeScript port currently in development. The application structure is complete and ready for implementation following our 15-phase plan.

### ✅ **Recent Progress**
- **✅ Complete project documentation** - 7 comprehensive documents
- **✅ 15-phase implementation plan** - Feature-complete phases
- **✅ Application scaffolding** - Full project structure created
- **✅ Architecture guidelines** - SOLID/DRY principles enforced

### 🛣 **Implementation Roadmap**
Follow `docs/IMPLEMENTATION_PLAN.md` for the systematic 15-phase development approach. Each phase implements a complete, testable feature with full test coverage.

## Troubleshooting

1. **Claude CLI not found**:
   ```bash
   # Check Claude is in PATH
   which claude
   ```

2. **Authentication errors**:
   ```bash
   # Test authentication with fastest model
   claude --print --model claude-3-5-haiku-20241022 "Hello"
   ```

3. **Timeout errors**:
   - Increase `MAX_TIMEOUT` in `.env`
   - Note: Claude Code can take time for complex requests

## Testing

### 🧪 **Quick Test Suite**
```bash
# Make sure server is running first
npm test
```

### 📝 **Development Tools**
```bash
# Install development dependencies
npm install

# Format code
npm run lint:fix

# Type checking
npm run type-check

# Build for production
npm run build
```

## License

MIT License

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

---

⭐ **Star this repo** if you find it useful!

🐛 **Report issues** via [GitHub Issues](https://github.com/ChrisColeTech/claude-wrapper/issues)

💡 **Request features** via [GitHub Issues](https://github.com/ChrisColeTech/claude-wrapper/issues)