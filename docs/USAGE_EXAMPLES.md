# Usage Examples - Claude Code OpenAI Wrapper

This guide provides comprehensive examples for using the Claude Code OpenAI Wrapper, covering all features including the Interactive API Key Protection system.

## 🚀 Quick Start Examples

### Basic Setup (No API Protection)

```bash
# Install globally
npm install -g claude-wrapper

# Start without API protection (recommended for local development)
claude-wrapper --no-interactive

# Server starts on http://localhost:8000
# No authentication required for requests
```

### Interactive Security Setup

```bash
# Start with interactive setup
claude-wrapper

# You'll see the security prompt:
# 🔐 API Key Protection Setup
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# You can optionally protect your API endpoints with a bearer token.
# This adds an extra layer of security for remote access.
# 
# If enabled, clients must include: Authorization: Bearer <token>
# 
# Would you like to enable API key protection? (y/N): 

# Press 'y' and Enter to enable protection
# The system will generate a secure API key for you
```

## 🔐 Security Configuration Examples

### Method 1: Interactive Setup (Recommended)

```bash
# Start server with interactive prompt
claude-wrapper

# Choose 'y' when prompted
# Save the generated API key securely
```

**Example Output:**
```
✅ API key protection enabled!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔑 Your API key: kB8x9mP2nQ7vR3wE5tY6uI1oL4sA0dF9

⚠️  IMPORTANT: Save this key securely!
   • This key will not be shown again
   • You can also set it via API_KEY environment variable
   • Include it in requests: Authorization: Bearer <key>
```

### Method 2: Environment Variable

```bash
# Set API key in environment
export API_KEY="your-secure-api-key-here"

# Start server (will detect existing key)
claude-wrapper
```

### Method 3: CLI Flag

```bash
# Provide API key directly via CLI
claude-wrapper --api-key kB8x9mP2nQ7vR3wE5tY6uI1oL4sA0dF9
```

### Method 4: Skip Protection

```bash
# Disable API key protection entirely
claude-wrapper --no-interactive
```

## 📡 API Usage Examples

### Without API Key Protection

```bash
# Basic chat request (no authentication needed)
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ]
  }'
```

### With API Key Protection

```bash
# Chat request with Bearer token
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer kB8x9mP2nQ7vR3wE5tY6uI1oL4sA0dF9" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ]
  }'
```

### JavaScript/Node.js Example

```javascript
const apiKey = "kB8x9mP2nQ7vR3wE5tY6uI1oL4sA0dF9";
const baseURL = "http://localhost:8000";

async function chatWithClaude(message) {
  const response = await fetch(`${baseURL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}` // Include when API protection is enabled
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      messages: [
        {role: "user", content: message}
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}

// Usage
chatWithClaude("Hello, Claude!")
  .then(response => console.log(response))
  .catch(error => console.error('Error:', error));
```

### Python Example

```python
import requests
import os

API_KEY = "kB8x9mP2nQ7vR3wE5tY6uI1oL4sA0dF9"
BASE_URL = "http://localhost:8000"

def chat_with_claude(message):
    headers = {
        "Content-Type": "application/json"
    }
    
    # Add Authorization header if API key is configured
    if API_KEY:
        headers["Authorization"] = f"Bearer {API_KEY}"
    
    response = requests.post(
        f"{BASE_URL}/v1/chat/completions",
        headers=headers,
        json={
            "model": "claude-3-5-sonnet-20241022",
            "messages": [
                {"role": "user", "content": message}
            ]
        }
    )
    
    response.raise_for_status()
    return response.json()

# Usage
try:
    result = chat_with_claude("Hello, Claude!")
    print(result)
except requests.exceptions.RequestException as e:
    print(f"Error: {e}")
```

## 🚀 Production Deployment Examples

### Production with Enhanced Features

```bash
# Start in production mode with all features
claude-wrapper --production --health-monitoring --api-key your-production-key
```

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine

# Install claude-wrapper globally
RUN npm install -g claude-wrapper

# Set API key via environment variable
ENV API_KEY=your-production-api-key-here

# Expose port
EXPOSE 8000

# Start server with production settings
CMD ["claude-wrapper", "--no-interactive", "--production"]
```

```bash
# Build and run Docker container
docker build -t claude-wrapper .
docker run -p 8000:8000 -e API_KEY=your-secure-key claude-wrapper
```

### SystemD Service

```ini
# /etc/systemd/system/claude-wrapper.service
[Unit]
Description=Claude Code OpenAI Wrapper
After=network.target

[Service]
Type=simple
User=claude
WorkingDirectory=/opt/claude-wrapper
Environment=API_KEY=your-production-api-key
Environment=NODE_ENV=production
ExecStart=/usr/bin/claude-wrapper --no-interactive --production --health-monitoring
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start service
sudo systemctl enable claude-wrapper
sudo systemctl start claude-wrapper
sudo systemctl status claude-wrapper
```

## 🔄 Daemon Mode Examples

### Background Server Management

```bash
# Start server in background
claude-wrapper --start --api-key your-key

# Check server status
claude-wrapper --status

# Stop background server
claude-wrapper --stop
```

**Example Status Output:**
```
📊 Server Status: RUNNING
   PID: 12345
   Logs: /tmp/claude-wrapper.log
   Health: ✅ OK (port 8000)
```

## 🛠️ Development Examples

### Local Development Setup

```bash
# Clone repository for development
git clone https://github.com/your-repo/claude-wrapper.git
cd claude-wrapper

# Install dependencies
npm install

# Build project
npm run build

# Start in development mode
npm run dev

# Run tests
npm test

# Install globally for testing
npm install -g .
```

### Environment Configuration

```bash
# .env file for development
PORT=8000
DEBUG_MODE=true
VERBOSE=true
API_KEY=dev-key-for-testing-only
ANTHROPIC_API_KEY=your-anthropic-key
```

### Testing with Different Authentication Methods

```bash
# Test with Anthropic API
export ANTHROPIC_API_KEY="your-anthropic-key"
claude-wrapper --no-interactive

# Test with AWS Bedrock
export CLAUDE_CODE_USE_BEDROCK=1
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_REGION="us-east-1"
claude-wrapper --no-interactive

# Test with Google Vertex AI
export CLAUDE_CODE_USE_VERTEX=1
export ANTHROPIC_VERTEX_PROJECT_ID="your-project-id"
export GOOGLE_APPLICATION_CREDENTIALS="path/to/credentials.json"
claude-wrapper --no-interactive
```

## 🔍 Debugging Examples

### Enable Debug Logging

```bash
# Start with maximum verbosity
claude-wrapper --debug --verbose --api-key test-key
```

### Check Authentication Status

```bash
# Check Claude authentication
curl http://localhost:8000/v1/auth/status

# Check with API key protection
curl -H "Authorization: Bearer your-key" http://localhost:8000/v1/auth/status
```

### Monitor Security Events

```bash
# Check server logs for security events
tail -f /tmp/claude-wrapper.log | grep -i security

# Or check application logs
claude-wrapper --debug --verbose 2>&1 | grep -i "security\|auth"
```

## 📊 Monitoring Examples

### Health Check Monitoring

```bash
# Basic health check
curl http://localhost:8000/health

# Health check with API key
curl -H "Authorization: Bearer your-key" http://localhost:8000/health

# Monitor server health
while true; do
  curl -s http://localhost:8000/health | jq .
  sleep 30
done
```

### Session Management

```bash
# List active sessions
curl -H "Authorization: Bearer your-key" http://localhost:8000/v1/sessions

# Get session statistics
curl -H "Authorization: Bearer your-key" http://localhost:8000/v1/sessions/stats

# Get specific session
curl -H "Authorization: Bearer your-key" http://localhost:8000/v1/sessions/session-123

# Delete session
curl -X DELETE -H "Authorization: Bearer your-key" http://localhost:8000/v1/sessions/session-123
```

## 🛠️ Integration Examples

### OpenAI SDK Drop-in Replacement

```javascript
// Replace OpenAI endpoint with claude-wrapper
const OpenAI = require('openai');

const openai = new OpenAI({
  baseURL: 'http://localhost:8000/v1',
  apiKey: 'kB8x9mP2nQ7vR3wE5tY6uI1oL4sA0dF9', // Your claude-wrapper API key
});

async function main() {
  const completion = await openai.chat.completions.create({
    messages: [
      {role: "system", content: "You are a helpful assistant."},
      {role: "user", content: "Hello!"}
    ],
    model: "claude-3-5-sonnet-20241022",
  });

  console.log(completion.choices[0]);
}

main();
```

### Streaming Example

```javascript
const response = await fetch('http://localhost:8000/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-key'
  },
  body: JSON.stringify({
    model: "claude-3-5-sonnet-20241022",
    messages: [{role: "user", content: "Count to 10"}],
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
      if (data === '[DONE]') return;
      
      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices[0]?.delta?.content;
        if (content) {
          process.stdout.write(content);
        }
      } catch (e) {
        // Skip invalid JSON
      }
    }
  }
}
```

## 🚨 Error Handling Examples

### Handle Authentication Errors

```javascript
async function makeAuthenticatedRequest(endpoint, data) {
  try {
    const response = await fetch(`http://localhost:8000${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.API_KEY}`
      },
      body: JSON.stringify(data)
    });

    if (response.status === 401) {
      throw new Error('Authentication failed - check your API key');
    }

    if (response.status === 403) {
      throw new Error('Access forbidden - insufficient permissions');
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API error: ${error.error?.message || response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Request failed:', error.message);
    throw error;
  }
}
```

### Retry Logic for Reliability

```javascript
async function resilientRequest(endpoint, data, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await makeAuthenticatedRequest(endpoint, data);
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      console.log(`Attempt ${attempt} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}
```

This comprehensive usage guide covers all aspects of using the Claude Code OpenAI Wrapper with the Interactive API Key Protection system, from basic setup to production deployment and advanced integration scenarios.