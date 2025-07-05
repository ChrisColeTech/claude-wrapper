# Claude Wrapper Examples

This directory contains examples demonstrating how to use the Claude Wrapper server with different programming languages and approaches.

## Quick Start

### Basic TypeScript Usage

```typescript
import { OpenAI } from 'openai';

const client = new OpenAI({
  baseURL: 'http://localhost:8000/v1',
  apiKey: process.env.API_KEY || 'no-auth-required'
});

const response = await client.chat.completions.create({
  model: 'claude-3-5-sonnet-20241022',
  messages: [{ role: 'user', content: 'Hello!' }]
});

console.log(response.choices[0].message.content);
```

### Basic JavaScript Usage

```javascript
const { OpenAI } = require('openai');

const client = new OpenAI({
  baseURL: 'http://localhost:8000/v1',
  apiKey: process.env.API_KEY || 'no-auth-required'
});

async function chat() {
  const response = await client.chat.completions.create({
    model: 'claude-3-5-sonnet-20241022',
    messages: [{ role: 'user', content: 'Hello!' }]
  });
  
  console.log(response.choices[0].message.content);
}

chat();
```

### Basic cURL Usage

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Examples Overview

| Example | Language | Focus | Complexity |
|---------|----------|-------|------------|
| `typescript/basic-usage.ts` | TypeScript | Simple SDK integration, auth detection | ⭐⭐ |
| `typescript/streaming-client.ts` | TypeScript | Streaming responses, real-time processing | ⭐⭐⭐⭐ |
| `typescript/session-continuity.ts` | TypeScript | Session management, conversation context | ⭐⭐⭐⭐ |
| `javascript/openai-sdk-integration.js` | JavaScript | Comprehensive SDK features | ⭐⭐⭐⭐ |
| `javascript/fetch-client.js` | JavaScript | Native fetch API, no dependencies | ⭐⭐⭐ |
| `curl/*.sh` | Bash/cURL | Raw HTTP API usage | ⭐⭐ |

## Getting Started

### 1. Start the Server

```bash
cd claude-wrapper
npm start
```

### 2. Set Authentication (if required)

```bash
# If your server requires authentication
export API_KEY=your-api-key-here

# Or configure Claude provider directly
export ANTHROPIC_API_KEY=your-anthropic-key
```

### 3. Run Examples

```bash
# TypeScript examples (requires tsx)
npx tsx scripts/examples/typescript/basic-usage.ts

# JavaScript examples
node scripts/examples/javascript/openai-sdk-integration.js

# cURL examples
./scripts/examples/curl/basic-completion.sh
```

## Core Features Demonstrated

### Authentication
- Auto-detection of server authentication requirements
- Support for multiple Claude providers (Anthropic, Bedrock, Vertex AI, Claude CLI)
- API key protection and validation

### Basic Chat Completions
- Single request/response interactions
- System messages and conversation context
- Parameter configuration (temperature, max_tokens, etc.)

### Streaming Responses
- Real-time response streaming
- Progress tracking and metrics
- Graceful error handling in streams

### Session Management
- Persistent conversation context
- Session lifecycle management
- Multi-session organization

### Error Handling
- Comprehensive error detection
- Graceful degradation
- Helpful troubleshooting guidance

## Example Files

### TypeScript Examples

#### `typescript/basic-usage.ts`
**Simple SDK integration with authentication auto-detection**

Features:
- OpenAI SDK setup and configuration
- Automatic authentication detection
- Model listing and basic completions
- Error handling and validation
- Colored console output for better UX

```bash
npx tsx scripts/examples/typescript/basic-usage.ts
npx tsx scripts/examples/typescript/basic-usage.ts --verbose
```

#### `typescript/streaming-client.ts` 
**Advanced streaming capabilities with real-time processing**

Features:
- Real-time streaming responses
- Progress tracking and metrics
- Performance comparison (streaming vs non-streaming)
- Concurrent streaming operations
- Syntax highlighting simulation for code generation

```bash
npx tsx scripts/examples/typescript/streaming-client.ts
npx tsx scripts/examples/typescript/streaming-client.ts --metrics --verbose
```

#### `typescript/session-continuity.ts`
**Comprehensive session management demonstration**

Features:
- Session creation and persistence
- Multi-session conversation management
- Session statistics and monitoring
- Session cleanup and lifecycle management
- Error handling for session operations

```bash
npx tsx scripts/examples/typescript/session-continuity.ts
npx tsx scripts/examples/typescript/session-continuity.ts --verbose --metrics
```

### JavaScript Examples

#### `javascript/openai-sdk-integration.js`
**Comprehensive OpenAI SDK usage patterns**

Features:
- Complete SDK integration demonstration
- Batch processing with concurrent requests
- Session-based conversations
- Performance metrics and monitoring
- ES6+ JavaScript patterns

```bash
node scripts/examples/javascript/openai-sdk-integration.js
node scripts/examples/javascript/openai-sdk-integration.js --verbose --metrics
```

#### `javascript/fetch-client.js`
**Native fetch API client without external dependencies**

Features:
- Pure JavaScript fetch API usage
- Streaming response handling
- Session management via HTTP API
- Concurrent request processing
- Minimal dependency approach

```bash
node scripts/examples/javascript/fetch-client.js
node scripts/examples/javascript/fetch-client.js --show-requests --metrics
```

### cURL Examples

#### `curl/basic-completion.sh`
**Simple HTTP API usage**

```bash
./scripts/examples/curl/basic-completion.sh
```

#### `curl/streaming-completion.sh`
**Server-Sent Events streaming**

```bash
./scripts/examples/curl/streaming-completion.sh
```

#### `curl/session-management.sh`
**Session API operations**

```bash
./scripts/examples/curl/session-management.sh
```

#### `curl/authentication-examples.sh`
**Authentication configuration and testing**

```bash
./scripts/examples/curl/authentication-examples.sh
./scripts/examples/curl/authentication-examples.sh --verbose
```

## Configuration

All examples support environment variable configuration:

| Variable | Description | Default |
|----------|-------------|---------|
| `CLAUDE_WRAPPER_URL` | Server base URL | `http://localhost:8000` |
| `API_KEY` | Authentication key (if required) | None |
| `VERBOSE` | Enable verbose output | `false` |
| `SHOW_METRICS` | Show performance metrics | `false` |
| `TIMEOUT` | Request timeout (ms) | `30000` |

## Authentication Setup

### No Authentication Required
If the server is configured without authentication, examples will work immediately:

```bash
npx tsx scripts/examples/typescript/basic-usage.ts
```

### API Key Authentication
If the server requires an API key:

```bash
export API_KEY=your-generated-api-key
npx tsx scripts/examples/typescript/basic-usage.ts
```

### Claude Provider Authentication

#### Anthropic API Key
```bash
export ANTHROPIC_API_KEY=your-anthropic-key
npm start  # Start server with Anthropic provider
```

#### AWS Bedrock
```bash
export CLAUDE_CODE_USE_BEDROCK=1
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_REGION=us-east-1
npm start
```

#### Google Vertex AI
```bash
export CLAUDE_CODE_USE_VERTEX=1
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
npm start
```

#### Claude CLI (Fallback)
```bash
# Install and configure Claude CLI first
claude auth login
npm start  # Server will auto-detect Claude CLI auth
```

## Common Usage Patterns

### Simple Chat
```typescript
const response = await client.chat.completions.create({
  model: 'claude-3-5-sonnet-20241022',
  messages: [{ role: 'user', content: 'Explain TypeScript briefly' }],
  max_tokens: 200
});
```

### With System Message
```typescript
const response = await client.chat.completions.create({
  model: 'claude-3-5-sonnet-20241022',
  messages: [
    { role: 'system', content: 'You are a helpful coding assistant.' },
    { role: 'user', content: 'How do I handle errors in async functions?' }
  ]
});
```

### Streaming Response
```typescript
const stream = await client.chat.completions.create({
  model: 'claude-3-5-sonnet-20241022',
  messages: [{ role: 'user', content: 'Write a function...' }],
  stream: true
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
```

### Session-based Conversation
```typescript
// First message in session
await client.chat.completions.create({
  model: 'claude-3-5-sonnet-20241022',
  messages: [{ role: 'user', content: 'My name is Alex' }],
  extra_body: { session_id: 'my-session-123' }
});

// Later message in same session (Claude remembers context)
await client.chat.completions.create({
  model: 'claude-3-5-sonnet-20241022',
  messages: [{ role: 'user', content: 'What is my name?' }],
  extra_body: { session_id: 'my-session-123' }
});
```

## Troubleshooting

### Server Connection Issues
```bash
# Check if server is running
curl http://localhost:8000/health

# Start the server if needed
cd claude-wrapper && npm start
```

### Authentication Errors
```bash
# Check authentication status
curl http://localhost:8000/v1/auth/status

# Verify your API key
export API_KEY=your-key-here
```

### Model Not Found
```bash
# List available models
curl http://localhost:8000/v1/models
```

### Streaming Issues
- Ensure your client supports Server-Sent Events
- Check network connectivity and timeouts
- Verify streaming is enabled in request (`"stream": true`)

### Session Problems
- Sessions expire after 1 hour of inactivity
- Check session exists: `curl http://localhost:8000/v1/sessions/your-session-id`
- List active sessions: `curl http://localhost:8000/v1/sessions`

## Performance Tips

1. **Use Streaming** for long responses to improve perceived performance
2. **Batch Requests** for multiple independent operations
3. **Session Management** for conversational flows to maintain context
4. **Connection Pooling** for high-throughput applications
5. **Timeout Configuration** based on your use case

## API Compatibility

The Claude Wrapper implements the OpenAI API specification with extensions:

- **Standard OpenAI endpoints**: `/v1/chat/completions`, `/v1/models`
- **Session extensions**: `/v1/sessions/*` endpoints
- **Authentication**: `/v1/auth/status` endpoint
- **Health checks**: `/health` endpoint

All standard OpenAI SDK features are supported, plus additional session management capabilities.

## Next Steps

1. **Start Simple**: Use the basic usage examples to get familiar
2. **Add Streaming**: Implement streaming for better user experience
3. **Session Management**: Add conversation context for chat applications
4. **Error Handling**: Implement robust error handling patterns
5. **Performance Optimization**: Use batch processing and connection pooling
6. **Production Setup**: Configure authentication and monitoring

For more detailed information, see:
- [API Reference](../../docs/API_REFERENCE.md)
- [Architecture Guide](../../docs/ARCHITECTURE.md)
- [Troubleshooting Guide](../../docs/TROUBLESHOOTING.md)
- [Security Guide](../../docs/SECURITY.md)