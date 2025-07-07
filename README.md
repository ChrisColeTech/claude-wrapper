# Claude Wrapper

[![GitHub CI](https://github.com/ChrisColeTech/claude-wrapper/workflows/Continuous%20Integration/badge.svg)](https://github.com/ChrisColeTech/claude-wrapper/actions)
[![NPM Publish](https://github.com/ChrisColeTech/claude-wrapper/workflows/Publish%20to%20NPM/badge.svg)](https://github.com/ChrisColeTech/claude-wrapper/actions)
[![npm version](https://badge.fury.io/js/claude-wrapper.svg)](https://badge.fury.io/js/claude-wrapper)
[![npm downloads](https://img.shields.io/npm/dm/claude-wrapper.svg)](https://www.npmjs.com/package/claude-wrapper)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/claude-wrapper.svg)](https://nodejs.org/en/download/)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9+-blue.svg)](https://www.typescriptlang.org/)
[![GitHub stars](https://img.shields.io/github/stars/ChrisColeTech/claude-wrapper?style=social)](https://github.com/ChrisColeTech/claude-wrapper/stargazers)

**OpenAI-compatible API wrapper for Claude Code CLI**

Transform your Claude Code CLI into a powerful HTTP API server with full OpenAI Chat Completions compatibility. Perfect for developers who want to integrate Claude's capabilities into OpenAI-based applications while maintaining security and control.

## 🔍 What is Claude Code CLI?

**Claude Code CLI** is Anthropic's official command-line AI coding assistant that:

- **Lives in your terminal** - Direct integration with your development environment
- **Understands your codebase** - Has full context of your project structure and code
- **Executes tasks** - Can edit files, run commands, handle git workflows, and more
- **Uses natural language** - Interact with Claude through conversational commands

Install it with: `npm install -g @anthropic-ai/claude-code`

## 🔗 What does Claude-Wrapper do?

**Claude-wrapper** transforms the Claude Code CLI into an HTTP API server:

```
Your App (OpenAI format) → Claude-Wrapper → Claude Code CLI → Your Project
```

This lets you:
- **Use OpenAI API format** - Drop-in replacement for OpenAI Chat Completions API
- **Keep Claude's power** - Maintain all of Claude Code's codebase understanding and execution capabilities  
- **Add HTTP access** - Access Claude Code programmatically via REST API
- **Enable integrations** - Connect Claude Code to web applications, IDEs, and other tools

## 🛠️ Tools-First Philosophy

Claude Wrapper embraces the **OpenAI Tools API specification** with full user-defined function support:

- **User-Defined Functions**: You define tools that Claude can call
- **Client-Side Execution**: Tools execute in YOUR environment, not on the server
- **Security First**: No server-side file access or command execution
- **OpenAI Standard**: Uses standard `tools` array format from OpenAI specification
- **MCP Compatible**: Works with your local MCP tool installations

This approach gives you **maximum flexibility** while maintaining **security** - Claude gets the power of tools without server-side execution risks.

## 🚀 Key Features

- **🔌 OpenAI Compatible**: Drop-in replacement for OpenAI Chat Completions API
- **🛠️ Tools-First Architecture**: Full OpenAI Tools API support with client-side execution
- **🔐 Security Focused**: Optional API protection with user-controlled authentication
- **📡 Real-time Streaming**: Server-Sent Events support for real-time responses
- **🔄 Session Management**: Conversation continuity with session tracking
- **⚡ Production Ready**: Daemon mode, health checks, and monitoring
- **🎯 Multiple Auth Methods**: Anthropic, AWS Bedrock, Google Vertex AI, and CLI support

## 📦 Installation

```bash
# Install globally from npm
npm install -g claude-wrapper
```

## 🛠️ Development

```bash
# Clone and setup
git clone https://github.com/ChrisColeTech/claude-wrapper.git
cd claude-wrapper
npm install
npm run build

# Development commands
npm run dev          # Hot reload
npm test            # Run tests
npm run lint        # Code quality

# Install CLI globally for testing
npm install -g .
```

## 🚀 Quick Start

### 1. Start the Server

```bash
claude-wrapper
```

You'll see this prompt:

```
🔐 API Key Protection Setup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You can optionally protect your API endpoints with a bearer token.
This adds an extra layer of security for remote access.

If enabled, clients must include: Authorization: Bearer <token>

Would you like to enable API key protection? (y/N):
```

**Press Enter** to skip (recommended for local development), then the server will start.

## 🚀 CLI Usage

### Basic Commands

```bash
# Start on default port 8000
claude-wrapper

# Custom port
claude-wrapper 3000
claude-wrapper --port 3000

# Skip API protection prompt
claude-wrapper --no-interactive

# Set API key directly (bypasses interactive setup)
claude-wrapper --api-key your-secure-api-key-here

# Production mode with enhanced features
claude-wrapper --production --health-monitoring

# Debug mode
claude-wrapper --debug --verbose
```

### Daemon Mode

```bash
# Start in background
claude-wrapper --start

# Check status
claude-wrapper --status

# Stop background server
claude-wrapper --stop
```

## 📋 All CLI Options

```bash
Usage: claude-wrapper [options] [port]

Arguments:
  port               Port to run server on (default: 8000)

Options:
  -V, --version          Output the version number
  -p, --port <port>      Port to run server on (default: 8000)
  -v, --verbose          Enable verbose logging
  -d, --debug            Enable debug mode
  --api-key <key>        Set API key for endpoint protection
  --no-interactive       Disable interactive API key setup
  --production           Enable production server management features
  --health-monitoring    Enable health monitoring system
  --start                Start server in background (daemon mode)
  --stop                 Stop background server
  --status               Check background server status
  -h, --help             Display help for command
```

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/chat/completions` | Main chat completions with streaming support |
| `GET` | `/v1/models` | List available Claude models |
| `GET` | `/v1/auth/status` | Claude Code authentication status |
| `GET` | `/health` | Service health check |
| `GET` | `/v1/sessions` | List active sessions |
| `GET` | `/v1/sessions/stats` | Session manager statistics |
| `GET` | `/v1/sessions/{id}` | Get specific session info |
| `DELETE` | `/v1/sessions/{id}` | Delete specific session |

## 🔐 Authentication vs API Protection

### Claude Authentication (Required)
- **Purpose**: Authenticate with Claude services (Anthropic/Bedrock/Vertex)
- **Required**: Yes, or the server won't work
- **Setup**: Environment variables before starting

### API Protection (Optional)
- **Purpose**: Protect your local server endpoints with Bearer tokens
- **Required**: No, purely optional for added security
- **Setup**: Interactive prompt when starting server, or via CLI flags
- **Methods**: 
  - Interactive setup (generates secure 32-character token)
  - `--api-key` flag for direct configuration
  - `API_KEY` environment variable
  - `--no-interactive` to skip setup entirely

When enabled, all API requests must include: `Authorization: Bearer <your-api-key>`

## 🔐 Configure Claude Authentication

Set up one of these authentication methods:

```bash
# Anthropic API (easiest)
export ANTHROPIC_API_KEY="your-api-key-here"
claude-wrapper

# AWS Bedrock
export CLAUDE_CODE_USE_BEDROCK=1
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_REGION="us-east-1"
claude-wrapper

# Google Vertex AI  
export CLAUDE_CODE_USE_VERTEX=1
export ANTHROPIC_VERTEX_PROJECT_ID="your-project-id"
export GOOGLE_APPLICATION_CREDENTIALS="path/to/credentials.json"
claude-wrapper

# Claude CLI (uses existing auth)
claude-wrapper
```

## 📚 Examples and Usage

### 🚀 Quick Start Examples

Get up and running in minutes with these practical examples:

#### Basic Chat Completion
```bash
# cURL example
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [
      {"role": "user", "content": "Hello! How are you?"}
    ]
  }'
```

```javascript
// JavaScript with fetch
const response = await fetch('http://localhost:8000/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'claude-3-5-sonnet-20241022',
    messages: [
      { role: 'user', content: 'Hello! How are you?' }
    ]
  })
});

const data = await response.json();
console.log(data.choices[0].message.content);
```

```typescript
// TypeScript with OpenAI SDK
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'http://localhost:8000/v1',
  apiKey: 'not-needed', // Claude wrapper handles auth
});

const completion = await openai.chat.completions.create({
  model: 'claude-3-5-sonnet-20241022',
  messages: [
    { role: 'user', content: 'Hello! How are you?' }
  ],
});

console.log(completion.choices[0].message.content);
```

#### Streaming Responses
```javascript
// JavaScript streaming example
const response = await fetch('http://localhost:8000/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'claude-3-5-sonnet-20241022',
    messages: [
      { role: 'user', content: 'Count to 5 slowly' }
    ],
    stream: true
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') continue;
      
      try {
        const parsed = JSON.parse(data);
        process.stdout.write(parsed.choices[0].delta.content || '');
      } catch (e) {
        // Skip invalid JSON
      }
    }
  }
}
```

#### Session Management
```bash
# Create a session with context
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [
      {"role": "user", "content": "My name is Alice. Remember this!"}
    ],
    "session_id": "my-conversation-123"
  }'

# Continue the conversation
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [
      {"role": "user", "content": "What is my name?"}
    ],
    "session_id": "my-conversation-123"
  }'
```

#### Tool Usage with OpenAI Tools API
```javascript
// Define tools for Claude to use
const completion = await openai.chat.completions.create({
  model: 'claude-3-5-sonnet-20241022',
  messages: [
    { role: 'user', content: 'What files are in my current directory?' }
  ],
  tools: [
    {
      type: 'function',
      function: {
        name: 'list_files',
        description: 'List files in a directory',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Directory path' }
          },
          required: ['path']
        }
      }
    }
  ],
  tool_choice: 'auto'
});

// If Claude wants to use a tool, execute it and continue
if (completion.choices[0].finish_reason === 'tool_calls') {
  const toolCall = completion.choices[0].message.tool_calls[0];
  
  // Execute the tool (in your environment)
  const result = await executeListFiles(JSON.parse(toolCall.function.arguments));
  
  // Continue conversation with tool result
  const finalResponse = await openai.chat.completions.create({
    model: 'claude-3-5-sonnet-20241022',
    messages: [
      { role: 'user', content: 'What files are in my current directory?' },
      completion.choices[0].message,
      {
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result)
      }
    ]
  });
}
```

### 📂 Complete Example Scripts

Ready-to-run example scripts in multiple languages:

#### Bash/cURL Examples
- **[Basic Completion](scripts/examples/curl/basic-completion.sh)** - Simple chat completion
- **[Streaming Responses](scripts/examples/curl/streaming-completion.sh)** - Real-time streaming
- **[Session Management](scripts/examples/curl/session-management.sh)** - Conversation continuity
- **[Authentication Examples](scripts/examples/curl/authentication-examples.sh)** - API key usage

#### JavaScript Examples
- **[Fetch Client](scripts/examples/javascript/fetch-client.js)** - Modern fetch API usage
- **[OpenAI SDK Integration](scripts/examples/javascript/openai-sdk-integration.js)** - Drop-in replacement

#### TypeScript Examples
- **[Basic Usage](scripts/examples/typescript/basic-usage.ts)** - Type-safe implementation
- **[Streaming Client](scripts/examples/typescript/streaming-client.ts)** - Streaming with types
- **[Session Continuity](scripts/examples/typescript/session-continuity.ts)** - Session management

### 🔧 Advanced Configuration Examples

#### Production Configuration
```bash
# Production server with monitoring
claude-wrapper --production \
  --health-monitoring \
  --port 8000 \
  --api-key secure-production-key

# With environment variables
export NODE_ENV=production
export ANTHROPIC_API_KEY=your-anthropic-key
export API_KEY=your-wrapper-api-key
export CLAUDE_WRAPPER_MAX_SESSIONS=1000
claude-wrapper --production
```

#### Docker Deployment
```dockerfile
# Dockerfile example
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build
EXPOSE 8000
CMD ["node", "app/dist/cli.js", "--production"]
```

#### Process Management with PM2
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'claude-wrapper',
    script: 'app/dist/cli.js',
    args: '--production --health-monitoring',
    instances: 4,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 8000
    }
  }]
};
```

### 🛠️ Development and Testing

#### Running Tests
```bash
# Run all tests
npm test

# Performance testing
npm run test:performance

# Load testing
npm run test:stress

# Test specific functionality
npm run test:integration
```

#### Development Setup
```bash
# Clone and setup
git clone https://github.com/ChrisColeTech/claude-wrapper.git
cd claude-wrapper
npm install

# Development mode with hot reload
npm run dev

# Build for production
npm run build
```

### 🚨 Troubleshooting Examples

#### Common Issues and Solutions

**Authentication Problems**
```bash
# Check authentication status
curl http://localhost:8000/v1/auth/status

# Test with different auth methods
export ANTHROPIC_API_KEY=your-key
claude-wrapper --debug
```

**Performance Issues**
```bash
# Enable performance monitoring
claude-wrapper --production --health-monitoring --debug

# Check health status
curl http://localhost:8000/health
```

**Session Problems**
```bash
# List all sessions
curl http://localhost:8000/v1/sessions

# Get session statistics
curl http://localhost:8000/v1/sessions/stats

# Clear specific session
curl -X DELETE http://localhost:8000/v1/sessions/your-session-id
```

## 📚 Complete Documentation

📖 **[Full Documentation](docs/README.md)** - Comprehensive guide with detailed examples, production deployment, troubleshooting, and advanced configuration.

### 📋 Documentation Index

#### Core Documentation
- **[API Reference](docs/API_REFERENCE.md)** - Complete API documentation with examples
- **[Architecture Guide](docs/ARCHITECTURE.md)** - Technical architecture and design
- **[Setup Guide](docs/examples/SETUP_GUIDE.md)** - Detailed installation and setup
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and solutions

#### Advanced Topics
- **[Performance Benchmarks](docs/examples/PERFORMANCE_BENCHMARKS.md)** - Performance metrics and optimization
- **[Security Guide](docs/SECURITY.md)** - Security best practices and configuration
- **[Testing Documentation](docs/TESTING.md)** - Testing strategies and test suites
- **[Debug Endpoints](docs/DEBUG_ENDPOINTS.md)** - Debugging and diagnostic tools

#### Examples and Integration
- **[Code Examples](docs/CODE_EXAMPLES.md)** - Code snippets and integration patterns
- **[Usage Examples](docs/USAGE_EXAMPLES.md)** - Real-world usage scenarios
- **[Production Deployment](docs/production-deployment.md)** - Production setup and monitoring

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

⭐ **Star this repository** if you find it useful!  
🐛 **Report issues** or suggest features at [GitHub Issues](https://github.com/ChrisColeTech/claude-wrapper/issues)

**Get started today** - `npm install -g claude-wrapper` and unlock Claude's power in your existing OpenAI applications!