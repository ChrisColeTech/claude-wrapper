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
  -V, --version      Output the version number
  -p, --port <port>  Port to run server on (default: 8000)
  -v, --verbose      Enable verbose logging
  -d, --debug        Enable debug mode
  --no-interactive   Disable interactive API key setup
  --start            Start server in background (daemon mode)
  --stop             Stop background server
  --status           Check background server status
  -h, --help         Display help for command
```

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/chat/completions` | Main chat completions with streaming support |
| `GET` | `/v1/models` | List available Claude models |
| `GET` | `/v1/auth/status` | Claude Code authentication status |
| `GET` | `/health` | Service health check |
| `GET` | `/v1/sessions` | List active sessions |

## 🔐 Authentication vs API Protection

### Claude Authentication (Required)
- **Purpose**: Authenticate with Claude services (Anthropic/Bedrock/Vertex)
- **Required**: Yes, or the server won't work
- **Setup**: Environment variables before starting

### API Protection (Optional)
- **Purpose**: Protect your local server endpoints with Bearer tokens
- **Required**: No, purely optional
- **Setup**: Interactive prompt when starting server

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

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

⭐ **Star this repository** if you find it useful!  
🐛 **Report issues** or suggest features at [GitHub Issues](https://github.com/ChrisColeTech/claude-wrapper/issues)

**Get started today** - `npm install -g claude-wrapper` and unlock Claude's power in your existing OpenAI applications!