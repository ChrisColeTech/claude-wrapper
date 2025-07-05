# Claude Wrapper Setup Guide

This guide provides comprehensive setup instructions for running the claude-wrapper examples and deploying the server in various environments.

## Table of Contents

- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Server Setup](#server-setup)
- [Authentication Configuration](#authentication-configuration)
- [Running Examples](#running-examples)
- [Development Setup](#development-setup)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)

## Quick Start

For immediate testing with the examples:

```bash
# 1. Clone and setup the project
git clone <repository-url> claude-wrapper
cd claude-wrapper

# 2. Install dependencies
npm install

# 3. Start the server (will prompt for auth setup)
npm start

# 4. In another terminal, run examples
./scripts/examples/curl/basic-completion.sh
```

## Prerequisites

### Required Software

- **Node.js** (v18.0.0 or higher)
- **npm** (v8.0.0 or higher)
- **curl** (for cURL examples)
- **jq** (for JSON parsing in shell scripts)

### Optional Software

- **tsx** (for TypeScript examples): `npm install -g tsx`
- **Git** (for version control)
- **Docker** (for containerized deployment)

### Installation Commands

**Ubuntu/Debian:**
```bash
# Node.js and npm
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Additional tools
sudo apt-get install -y curl jq git
```

**macOS:**
```bash
# Using Homebrew
brew install node jq git
```

**Windows:**
```bash
# Using Chocolatey
choco install nodejs jq git
```

## Server Setup

### 1. Basic Installation

```bash
# Clone the repository
git clone <repository-url> claude-wrapper
cd claude-wrapper

# Install dependencies
npm install

# Build the project (if needed)
npm run build
```

### 2. Environment Configuration

Create a `.env` file in the project root:

```env
# Server Configuration
PORT=8000
CORS_ORIGINS=*
DEBUG_MODE=false
VERBOSE=false

# Authentication (choose one method)
ANTHROPIC_API_KEY=your-anthropic-api-key
# OR
CLAUDE_CODE_USE_BEDROCK=1
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_REGION=us-east-1
# OR
CLAUDE_CODE_USE_VERTEX=1
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Optional: API Key Protection
API_KEY=your-generated-wrapper-api-key
```

### 3. Start the Server

```bash
# Basic startup
npm start

# With specific port
PORT=3000 npm start

# With debug mode
DEBUG_MODE=true npm start

# Production mode
npm run start:production
```

## Authentication Configuration

The claude-wrapper supports multiple authentication methods with automatic detection.

### Method 1: Anthropic API Key (Recommended)

```bash
export ANTHROPIC_API_KEY=your-anthropic-api-key
npm start
```

### Method 2: AWS Bedrock

```bash
export CLAUDE_CODE_USE_BEDROCK=1
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_REGION=us-east-1
npm start
```

### Method 3: Google Vertex AI

```bash
export CLAUDE_CODE_USE_VERTEX=1
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
npm start
```

### Method 4: Claude CLI (Fallback)

```bash
# Install Claude CLI
npm install -g @anthropic/claude-cli

# Authenticate
claude auth login

# Start server (will auto-detect Claude CLI)
npm start
```

### API Key Protection

To add an additional authentication layer:

```bash
export API_KEY=your-secure-api-key
npm start
```

Then use the API key in requests:
```bash
curl -H "Authorization: Bearer your-secure-api-key" \
  http://localhost:8000/v1/chat/completions
```

## Running Examples

### cURL Examples

All cURL examples support environment configuration:

```bash
# Basic usage
./scripts/examples/curl/basic-completion.sh

# With custom server URL
CLAUDE_WRAPPER_URL=http://localhost:3000 ./scripts/examples/curl/basic-completion.sh

# With API key
API_KEY=your-key ./scripts/examples/curl/basic-completion.sh

# Verbose output
VERBOSE=true ./scripts/examples/curl/streaming-completion.sh
```

### TypeScript Examples

```bash
# Install tsx globally (recommended)
npm install -g tsx

# Run TypeScript examples
npx tsx scripts/examples/typescript/basic-usage.ts
npx tsx scripts/examples/typescript/streaming-client.ts
npx tsx scripts/examples/typescript/session-continuity.ts
```

### JavaScript Examples

```bash
# Node.js examples
node scripts/examples/javascript/openai-sdk-integration.js
node scripts/examples/javascript/fetch-client.js
```

### Environment Variables for Examples

```bash
# Server URL (default: http://localhost:8000)
export CLAUDE_WRAPPER_URL=http://localhost:3000

# API key for authentication
export API_KEY=your-api-key

# Enable verbose output
export VERBOSE=true

# Custom session ID
export SESSION_ID=my-custom-session
```

## Development Setup

### IDE Configuration

**VS Code recommended extensions:**
- TypeScript and JavaScript Language Features
- ESLint
- Prettier
- Rest Client (for API testing)

**tsconfig.json setup:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### Development Commands

```bash
# Start development server with auto-reload
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format

# Type checking
npm run type-check
```

### Hot Reload Setup

```bash
# Install nodemon for development
npm install -g nodemon

# Start with hot reload
nodemon --exec "npm start"
```

## Production Deployment

### Docker Deployment

**Dockerfile:**
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 8000
CMD ["npm", "start"]
```

**Docker commands:**
```bash
# Build image
docker build -t claude-wrapper .

# Run container
docker run -p 8000:8000 \
  -e ANTHROPIC_API_KEY=your-key \
  claude-wrapper
```

### PM2 Deployment

```bash
# Install PM2
npm install -g pm2

# Create ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'claude-wrapper',
    script: 'dist/src/cli.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 8000
    }
  }]
}
EOF

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Systemd Service

**Create service file:**
```bash
sudo cat > /etc/systemd/system/claude-wrapper.service << 'EOF'
[Unit]
Description=Claude Wrapper API Server
After=network.target

[Service]
Type=simple
User=claude-wrapper
WorkingDirectory=/opt/claude-wrapper
ExecStart=/usr/bin/node dist/src/cli.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=8000
EnvironmentFile=/opt/claude-wrapper/.env

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl enable claude-wrapper
sudo systemctl start claude-wrapper
```

### Reverse Proxy (Nginx)

**Nginx configuration:**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # For streaming endpoints
    location /v1/chat/completions {
        proxy_pass http://localhost:8000;
        proxy_buffering off;
        proxy_cache off;
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding off;
    }
}
```

### Health Checks

```bash
# Basic health check
curl http://localhost:8000/health

# Detailed health check
curl http://localhost:8000/health/detailed

# Production health monitoring
curl http://localhost:8000/health/production
```

### Environment Variables for Production

```env
# Production settings
NODE_ENV=production
PORT=8000
DEBUG_MODE=false
VERBOSE=false

# Authentication
ANTHROPIC_API_KEY=your-production-key

# Security
API_KEY=your-secure-wrapper-key
CORS_ORIGINS=https://your-domain.com,https://api.your-domain.com

# Performance
MAX_TIMEOUT=60000
REQUEST_LIMIT=100

# Monitoring
HEALTH_CHECK_ENABLED=true
METRICS_ENABLED=true
```

## Troubleshooting

### Common Issues

**1. Server won't start:**
```bash
# Check if port is in use
lsof -i :8000

# Try different port
PORT=3000 npm start

# Check logs
DEBUG_MODE=true npm start
```

**2. Authentication errors:**
```bash
# Check auth status
curl http://localhost:8000/v1/auth/status

# Verify environment variables
env | grep -E "(ANTHROPIC|AWS|GOOGLE|CLAUDE)"

# Test with minimal setup
ANTHROPIC_API_KEY=your-key npm start
```

**3. Examples not working:**
```bash
# Check server connectivity
curl http://localhost:8000/health

# Verify jq installation
which jq

# Test with verbose output
VERBOSE=true ./scripts/examples/curl/basic-completion.sh
```

**4. TypeScript/JavaScript examples failing:**
```bash
# Install dependencies
npm install

# Check Node.js version
node --version

# Install tsx for TypeScript
npm install -g tsx
```

### Performance Optimization

**1. Memory optimization:**
```bash
# Increase Node.js memory limit
node --max-old-space-size=4096 dist/src/cli.js
```

**2. Connection optimization:**
```bash
# Increase connection limits
export UV_THREADPOOL_SIZE=16
```

**3. Logging optimization:**
```bash
# Reduce log verbosity in production
export DEBUG_MODE=false
export VERBOSE=false
```

### Security Considerations

**1. API Key Management:**
- Never commit API keys to version control
- Use environment variables or secret management systems
- Rotate API keys regularly
- Use wrapper API key protection for additional security

**2. CORS Configuration:**
```bash
# Restrict CORS origins in production
export CORS_ORIGINS=https://your-domain.com
```

**3. Rate Limiting:**
- Configure appropriate request limits
- Use reverse proxy for additional protection
- Monitor for unusual usage patterns

### Getting Help

**Documentation:**
- [API Reference](../API_REFERENCE.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
- [Performance Benchmarks](./PERFORMANCE_BENCHMARKS.md)

**Support Channels:**
- GitHub Issues: Report bugs and feature requests
- Community Forum: General questions and discussions
- Documentation: Comprehensive guides and examples

**Debugging Tips:**
- Enable verbose logging with `DEBUG_MODE=true`
- Check server health endpoints
- Verify authentication configuration
- Review server logs for error details
- Test with minimal configurations first