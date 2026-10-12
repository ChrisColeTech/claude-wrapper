# Claude Wrapper

[![CI Status](https://github.com/ChrisColeTech/claude-wrapper/workflows/Continuous%20Integration/badge.svg)](https://github.com/ChrisColeTech/claude-wrapper/actions)
[![NPM Version](https://img.shields.io/npm/v/claude-wrapper.svg)](https://www.npmjs.com/package/claude-wrapper)
[![NPM Downloads](https://img.shields.io/npm/dm/claude-wrapper.svg)](https://www.npmjs.com/package/claude-wrapper)
[![GitHub Stars](https://img.shields.io/github/stars/ChrisColeTech/claude-wrapper.svg)](https://github.com/ChrisColeTech/claude-wrapper/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[![Node Version](https://img.shields.io/node/v/claude-wrapper.svg)](https://nodejs.org/)
[![Platform Support](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue.svg)](https://github.com/ChrisColeTech/claude-wrapper)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/ChrisColeTech/claude-wrapper/pulls)

**OpenAI-compatible HTTP API wrapper for Claude Code CLI with Session Management**

Transform your Claude Code CLI into a powerful HTTP API server with intelligent session management, streaming responses, and OpenAI-compatible tool calling.

## 🛠️ Tools-First Philosophy

**Claude Wrapper provides OpenAI Tools API compatibility:**

- **Client-Side Execution**: Tools run in your local environment
- **OpenAI Standard**: Uses standard `tools` array format from OpenAI specification
- **MCP Compatible**: Works with your local MCP tool installations

This approach gives you **maximum flexibility** with Claude's tool capabilities.

## Key Features

- **OpenAI Compatible**: Drop-in replacement for OpenAI Chat Completions API
- **Session Management**: Automatic message history accumulation for conversation continuity
- **Streaming Support**: Real-time response streaming with Server-Sent Events

## 📦 Installation

```bash
# Install globally from npm
npm install -g claude-wrapper
```

After installation, you can use the CLI with either:

- `wrapper` (recommended short command)
- `claude-wrapper` (full package name)

## 🚀 Quick Start

```bash
wrapper
```

You'll see an interactive prompt asking if you want API key protection:

```bash
🚀 Starting Claude Wrapper...
🔐 API Key Protection Setup
Would you like to enable API key protection? (y/n):


- **Choose 'y'** to generate a secure API key for protection
- **Choose 'n' or press Enter** to run without authentication
```

Server starts at `http://localhost:8000` - you're ready to make API calls!

## 📋 CLI Options

```bash
Usage: wrapper [options] [port]

Claude API wrapper with OpenAI compatibility

Arguments:
  port                 port to run server on (default: 8000) - alternative to
                       --port option

Options:
  -v, --version        output the version number
  -p, --port <port>    port to run server on (default: 8000)
  -d, --debug          enable debug mode (runs in foreground)
  -k, --api-key <key>  set API key for endpoint protection
  -n, --no-interactive disable interactive API key setup
  -P, --production     enable production server management features
  -H, --health-monitoring enable health monitoring system
  -s, --stop           stop background server
  -t, --status         check background server status
  -h, --help           display help for command
```

### Authentication Options

**Authentication is completely optional!** You can also bypass the interactive setup:

```bash
# Skip interactive setup (no authentication)
wrapper --no-interactive
wrapper -n                         # shorthand

# Or provide API key directly
wrapper --api-key my-secure-key
wrapper -k my-secure-key           # shorthand
```

## 📡 API Endpoints

| Method   | Endpoint                    | Description                                   |
| -------- | --------------------------- | --------------------------------------------- |
| `POST`   | `/v1/chat/completions`      | Main chat completions with session support    |
| `POST`   | `/v1/messages`              | Minimal Anthropic Messages API                |
| `GET`    | `/v1/models`                | List available Claude models (sonnet, opus)   |
| `GET`    | `/v1/sessions`              | List all active sessions                      |
| `GET`    | `/v1/sessions/stats`        | Get session statistics                        |
| `GET`    | `/v1/sessions/:id`          | Get specific session details                  |
| `DELETE` | `/v1/sessions/:id`          | Delete a specific session                     |
| `POST`   | `/v1/sessions/:id/messages` | Add messages to a session                     |
| `GET`    | `/v1/auth/status`           | Check authentication configuration and status |
| `GET`    | `/health`                   | Service health check                          |
| `GET`    | `/docs`                     | Swagger UI                                    |
| `GET`    | `/swagger.json`             | OpenAPI 3.0 specification JSON schema         |

### Anthropic Messages API

`POST /v1/messages` supports text-only messages, optional text system prompts,
JSON responses, and Anthropic SSE response envelopes. Set
`anthropic-version: 2023-06-01`. When API protection is enabled, clients may use
either `x-api-key` or `Authorization: Bearer <key>`.

```bash
curl http://localhost:8000/v1/messages \
  -H "content-type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -H "x-api-key: $API_KEY" \
  -d '{"model":"sonnet","max_tokens":256,"messages":[{"role":"user","content":"Hello"}]}'
```

This initial compatibility endpoint does not support tools, image/document
blocks, thinking, structured output, stop sequences, generation controls, or
native incremental CLI output. `max_tokens` is required for protocol
compatibility but is not currently enforced by the underlying CLI. Streaming
requests open the SSE connection immediately, then emit the text block after
the CLI response is complete.

## 🚀 CLI Usage

### Starting the Server

```bash
# Start server on default port (8000)
wrapper

# Start server on specific port
wrapper 9999
wrapper --port 8080
wrapper -p 8080                    # shorthand

# Show version
wrapper --version
wrapper -v                         # shorthand

# Start with debug information (runs in foreground)
wrapper --debug
wrapper -d                         # shorthand
```

### Managing the Background Service

```bash
# Check if server is running
wrapper --status
wrapper -t                         # shorthand

# Stop the background server
wrapper --stop
wrapper -s                         # shorthand
```

## 📚 Documentation

📖 **[Full Documentation](docs/README.md)** - Comprehensive guide with detailed examples, production deployment, troubleshooting, and advanced configuration.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

⭐ **Star this repository** if you find it useful!  
🐛 **Report issues** or suggest features at [GitHub Issues](https://github.com/ChrisColeTech/claude-wrapper/issues)

**Get started today** - `npm install -g claude-wrapper` and run `wrapper` to transform your Claude CLI into a powerful HTTP API!
