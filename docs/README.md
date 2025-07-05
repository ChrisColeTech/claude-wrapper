# Claude Wrapper

[![npm version](https://badge.fury.io/js/claude-wrapper.svg)](https://badge.fury.io/js/claude-wrapper)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/claude-wrapper.svg)](https://nodejs.org/en/download/)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9+-blue.svg)](https://www.typescriptlang.org/)

**OpenAI-compatible API wrapper for Claude Code CLI**

Transform your Claude Code CLI into a powerful HTTP API server with full OpenAI Chat Completions compatibility. Perfect for developers who want to integrate Claude's capabilities into OpenAI-based applications while maintaining security and control.

## 🛠️ Tools-First Philosophy

Claude Wrapper embraces the **OpenAI Tools API specification** with full user-defined function support:

### What This Means
- **User-Defined Functions**: You define tools that Claude can call
- **Client-Side Execution**: Tools execute in YOUR environment, not on the server
- **Security First**: No server-side file access or command execution
- **OpenAI Standard**: Uses standard `tools` array format from OpenAI specification
- **MCP Compatible**: Works with your local MCP tool installations

### How It Works
1. **Define Tools**: Create function definitions with JSON schemas
2. **Claude Calls**: Claude decides when and how to call your tools
3. **You Execute**: Your client receives tool calls and executes them locally
4. **Return Results**: Send results back to Claude for continued conversation

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

**Press Enter** to skip (recommended for local development), then the server will start and check for Claude authentication.

### 2. Configure Claude Authentication

If you don't have Claude credentials configured, the server will show an error. Set up one of these:

```bash
# Anthropic API (easiest)
export ANTHROPIC_API_KEY="your-api-key-here"
claude-wrapper

# Or use AWS Bedrock / Google Vertex AI / Claude CLI
# (see Authentication section below)
```

### 3. Test the API

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [
      {"role": "user", "content": "Hello, Claude!"}
    ]
  }'
```

### 4. Use with OpenAI SDK

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'http://localhost:8000/v1',
  apiKey: 'not-needed' // Optional API key protection
});

const response = await client.chat.completions.create({
  model: 'claude-3-5-sonnet-20241022',
  messages: [
    { role: 'user', content: 'Explain quantum computing' }
  ]
});
```

## 🚀 CLI Usage Examples

### Basic Server Management

```bash
# Start on default port 8000
claude-wrapper

# Custom port (two ways)
claude-wrapper 3000
claude-wrapper --port 3000

# Skip API protection prompt
claude-wrapper --no-interactive
```

### Development & Debugging

```bash
# Verbose logging
claude-wrapper --verbose

# Debug mode with verbose
claude-wrapper --debug --verbose

# Custom port with debugging
claude-wrapper --port 8080 --debug --verbose
```

### Daemon Mode (Background Server)

```bash
# Start background server
claude-wrapper --start

# Start background with custom port
claude-wrapper --start --port 3000

# Check if running
claude-wrapper --status

# Stop background server
claude-wrapper --stop
```

### Real-World Scenarios

```bash
# Production server
claude-wrapper --port 80 --no-interactive

# Development with debug
claude-wrapper 8080 --debug --verbose

# Secure remote server
claude-wrapper --port 443
# (then answer 'y' to API protection prompt)
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

## 🔐 Understanding Authentication vs API Protection

### Claude Authentication (Required)
- **Purpose**: Authenticate with Claude services (Anthropic/Bedrock/Vertex)
- **Required**: Yes, or the server won't work
- **Setup**: Environment variables before starting

### API Protection (Optional)
- **Purpose**: Protect your local server endpoints with Bearer tokens
- **Required**: No, purely optional
- **Setup**: Interactive prompt when starting server

## 🔐 Authentication Methods

### Option 1: Anthropic Direct

```bash
export ANTHROPIC_API_KEY="your-api-key-here"
claude-wrapper
```

### Option 2: AWS Bedrock

```bash
export CLAUDE_CODE_USE_BEDROCK=1
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_REGION="us-east-1"
claude-wrapper
```

### Option 3: Google Vertex AI

```bash
export CLAUDE_CODE_USE_VERTEX=1
export ANTHROPIC_VERTEX_PROJECT_ID="your-project-id"
export GOOGLE_APPLICATION_CREDENTIALS="path/to/credentials.json"
claude-wrapper
```

### Option 4: Claude CLI

```bash
# Uses existing Claude CLI authentication
claude-wrapper
```

## 🛠️ OpenAI Tools API Examples

Define tools that Claude can call, with execution handled by your client:

```javascript
const response = await client.chat.completions.create({
  model: 'claude-3-5-sonnet-20241022',
  messages: [
    { role: 'user', content: 'Read the file config.json' }
  ],
  tools: [
    {
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read content from a file',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file to read'
            }
          },
          required: ['path']
        }
      }
    }
  ],
  tool_choice: 'auto'
});

// Claude will return a tool call that you execute in your environment
if (response.choices[0].message.tool_calls) {
  const toolCall = response.choices[0].message.tool_calls[0];
  const args = JSON.parse(toolCall.function.arguments);
  
  // Execute the tool in YOUR environment
  const fileContent = fs.readFileSync(args.path, 'utf8');
  
  // Send the result back to Claude
  const followUp = await client.chat.completions.create({
    model: 'claude-3-5-sonnet-20241022',
    messages: [
      ...previousMessages,
      response.choices[0].message,
      {
        role: 'tool',
        tool_call_id: toolCall.id,
        content: fileContent
      }
    ]
  });
}
```

### Example Tools You Can Define
- File operations (read/write files in your project)
- API calls to your services
- Database queries
- System commands
- Custom business logic
- Integration with your development tools

## 🔄 Daemon Mode Examples

### Basic Daemon Operations

```bash
# Start daemon
$ claude-wrapper --start
✅ Server started in background
   PID: 12345
   Port: 8000
   Logs: /tmp/claude-wrapper.log
   Stop: claude-wrapper --stop

# Check status
$ claude-wrapper --status
📊 Server Status: RUNNING
   PID: 12345
   Logs: /tmp/claude-wrapper.log
   Health: ✅ OK (port 8000)

# Stop daemon
$ claude-wrapper --stop
✅ Server stopped (PID: 12345)
```

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/chat/completions` | Main chat completions with streaming support |
| `GET` | `/v1/models` | List available Claude models |
| `GET` | `/v1/auth/status` | Claude Code authentication status |
| `GET` | `/health` | Service health check |
| `GET` | `/v1/sessions` | List active sessions |
| `POST` | `/v1/sessions` | Create new session |
| `DELETE` | `/v1/sessions/{id}` | Delete specific session |

### Available Models

- `claude-3-5-sonnet-20241022` (Latest)
- `claude-3-5-haiku-20241022`
- `claude-3-opus-20240229`
- `claude-3-sonnet-20240229`
- `claude-3-haiku-20240307`

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `8000` |
| `API_KEY` | Optional API protection | `none` |
| `DEBUG_MODE` | Enable debug logging | `false` |
| `VERBOSE` | Enable verbose logging | `false` |
| `CORS_ORIGINS` | Allowed CORS origins | `["*"]` |
| `MAX_TIMEOUT` | Request timeout (ms) | `600000` |

### Custom Headers

| Header | Description | Type |
|--------|-------------|------|
| `X-Claude-Max-Turns` | Maximum conversation turns | `integer` |
| `X-Claude-Permission-Mode` | Permission mode | `default`, `acceptEdits`, `bypassPermissions` |
| `X-Claude-Max-Thinking-Tokens` | Maximum thinking tokens | `integer` |

## 🛠️ Development

### Prerequisites

- **Node.js**: 18.0.0 or higher
- **npm**: 8.0.0 or higher
- **TypeScript**: 4.9.0 or higher
- **Claude Code CLI** (automatically installed as optional dependency)

### Development Commands

```bash
# Clone the repository
git clone https://github.com/ChrisColeTech/claude-wrapper.git
cd claude-wrapper

# Install dependencies
npm install

# Build the project
npm run build

# Development with hot reload
npm run dev

# Run tests
npm test
npm run test:watch
npm run test:coverage

# Performance tests
npm run test:performance
npm run test:stress

# Code quality
npm run lint
npm run lint:fix
npm run type-check

# Install CLI globally for testing
npm install -g .
```

### Project Structure

See [PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) for detailed codebase organization and file mapping.

## 🚀 Production Deployment

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 8000
ENV NODE_ENV=production

CMD ["claude-wrapper", "--no-interactive"]
```

```bash
# Build and run
docker build -t claude-wrapper .
docker run -p 8000:8000 \
  -e ANTHROPIC_API_KEY="your-key" \
  claude-wrapper
```

### Environment Setup

```bash
# Production environment variables
export NODE_ENV=production
export PORT=8000
export ANTHROPIC_API_KEY="your-production-key"
export API_KEY="secure-api-protection-key"
export CORS_ORIGINS='["https://your-domain.com"]'
export MAX_TIMEOUT=300000

# Start in production mode
claude-wrapper --no-interactive
```

## 🔧 Troubleshooting

### Common Issues

#### Authentication Errors

```bash
# Check authentication status
curl http://localhost:8000/v1/auth/status

# Test with debug mode
claude-wrapper --debug --verbose

# Verify environment variables
echo $ANTHROPIC_API_KEY
```

#### Port Already in Use

```bash
# Use a different port
claude-wrapper --port 3001

# Or find what's using the port
lsof -i :8000
```

#### Debug Mode

```bash
# Full debug output
claude-wrapper --debug --verbose
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Guidelines

1. Follow TypeScript strict mode
2. Maintain 100% test coverage
3. Use conventional commits
4. Update documentation

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Anthropic** for the powerful Claude models and Claude Code CLI
- **OpenAI** for the standardized Chat Completions API
- **The open source community** for the foundational tools and libraries

---

⭐ **Star this repository** if you find it useful!  
🐛 **Report issues** or suggest features  
🔧 **Contribute** to make it even better!

**Get started today** - `npm install -g claude-wrapper` and unlock Claude's power in your existing OpenAI applications!