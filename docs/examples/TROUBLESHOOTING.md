# Claude Wrapper Troubleshooting Guide

This guide helps resolve common issues when using the claude-wrapper server and examples.

## Table of Contents

- [Server Issues](#server-issues)
- [Authentication Problems](#authentication-problems)
- [Example Script Issues](#example-script-issues)
- [Performance Problems](#performance-problems)
- [Network and Connectivity](#network-and-connectivity)
- [Development Issues](#development-issues)
- [Common Error Messages](#common-error-messages)
- [Getting Help](#getting-help)

## Server Issues

### Server Won't Start

**Problem:** Server fails to start or exits immediately

**Diagnosis:**
```bash
# Check if port is already in use
lsof -i :8000
netstat -tulpn | grep :8000

# Check for detailed error messages
DEBUG_MODE=true npm start
```

**Solutions:**

1. **Port conflict:**
   ```bash
   # Use different port
   PORT=3000 npm start
   
   # Kill existing process
   pkill -f "node.*claude-wrapper"
   ```

2. **Missing dependencies:**
   ```bash
   # Reinstall dependencies
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Permission issues:**
   ```bash
   # Check file permissions
   ls -la dist/src/cli.js
   
   # Fix permissions if needed
   chmod +x dist/src/cli.js
   ```

### Server Crashes or Exits

**Problem:** Server starts but crashes during operation

**Diagnosis:**
```bash
# Check logs with verbose output
VERBOSE=true DEBUG_MODE=true npm start

# Monitor server health
curl http://localhost:8000/health/detailed
```

**Solutions:**

1. **Memory issues:**
   ```bash
   # Increase Node.js memory limit
   node --max-old-space-size=4096 dist/src/cli.js
   ```

2. **Unhandled errors:**
   ```bash
   # Check for specific error patterns
   grep -i error server.log
   ```

3. **Environment configuration:**
   ```bash
   # Verify all required environment variables
   env | grep -E "(ANTHROPIC|AWS|GOOGLE|CLAUDE)"
   ```

### Server Responds but APIs Don't Work

**Problem:** Health check passes but API endpoints fail

**Diagnosis:**
```bash
# Test basic endpoint
curl -v http://localhost:8000/v1/models

# Check authentication status
curl http://localhost:8000/v1/auth/status

# Test with debug headers
curl -H "X-Debug: true" http://localhost:8000/v1/models
```

**Solutions:**

1. **Authentication not configured:**
   ```bash
   # Configure basic auth
   export ANTHROPIC_API_KEY=your-key
   npm restart
   ```

2. **CORS issues:**
   ```bash
   # Allow all origins temporarily
   export CORS_ORIGINS=*
   npm restart
   ```

## Authentication Problems

### API Key Not Working

**Problem:** Authentication fails with valid API key

**Diagnosis:**
```bash
# Check auth status
curl http://localhost:8000/v1/auth/status | jq .

# Test key directly with Anthropic
curl -H "Authorization: Bearer $ANTHROPIC_API_KEY" \
  https://api.anthropic.com/v1/messages \
  -d '{"model":"claude-3-5-sonnet-20241022","messages":[{"role":"user","content":"test"}],"max_tokens":10}'
```

**Solutions:**

1. **Wrong API key format:**
   ```bash
   # Ensure key starts with sk-ant-
   echo $ANTHROPIC_API_KEY | head -c 20
   
   # Regenerate key if needed
   # Visit: https://console.anthropic.com/
   ```

2. **Key not properly exported:**
   ```bash
   # Export in current session
   export ANTHROPIC_API_KEY=your-key
   
   # Add to shell profile
   echo 'export ANTHROPIC_API_KEY=your-key' >> ~/.bashrc
   ```

### AWS Bedrock Authentication Issues

**Problem:** Bedrock authentication fails

**Diagnosis:**
```bash
# Check AWS credentials
aws sts get-caller-identity

# Verify Claude model access
aws bedrock list-foundation-models --region us-east-1
```

**Solutions:**

1. **Missing permissions:**
   ```bash
   # Required IAM permissions:
   # - bedrock:InvokeModel
   # - bedrock:ListFoundationModels
   ```

2. **Region mismatch:**
   ```bash
   # Ensure correct region
   export AWS_REGION=us-east-1
   export CLAUDE_CODE_USE_BEDROCK=1
   ```

### Google Vertex AI Issues

**Problem:** Vertex AI authentication fails

**Diagnosis:**
```bash
# Check application default credentials
gcloud auth application-default print-access-token

# Verify project and location
gcloud config get-value project
```

**Solutions:**

1. **Missing credentials:**
   ```bash
   # Set up application default credentials
   gcloud auth application-default login
   
   # Or use service account
   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
   ```

2. **API not enabled:**
   ```bash
   # Enable Vertex AI API
   gcloud services enable aiplatform.googleapis.com
   ```

### Wrapper API Key Protection

**Problem:** Wrapper API key authentication fails

**Diagnosis:**
```bash
# Check if protection is enabled
curl http://localhost:8000/v1/auth/status | jq .server_info.api_key_required

# Test without key (should fail)
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-3-5-sonnet-20241022","messages":[{"role":"user","content":"test"}]}'
```

**Solutions:**

1. **Include API key in requests:**
   ```bash
   # Use Authorization header
   curl -H "Authorization: Bearer your-wrapper-api-key" \
     http://localhost:8000/v1/chat/completions
   ```

2. **Disable protection temporarily:**
   ```bash
   # Start without API_KEY env var
   unset API_KEY
   npm start
   ```

## Example Script Issues

### cURL Examples Not Working

**Problem:** Shell scripts fail to execute

**Diagnosis:**
```bash
# Check script permissions
ls -la scripts/examples/curl/basic-completion.sh

# Test with bash directly
bash scripts/examples/curl/basic-completion.sh

# Check required tools
which curl jq
```

**Solutions:**

1. **Missing permissions:**
   ```bash
   # Make executable
   chmod +x scripts/examples/curl/*.sh
   ```

2. **Missing dependencies:**
   ```bash
   # Install jq
   # Ubuntu/Debian: sudo apt-get install jq
   # macOS: brew install jq
   # Windows: choco install jq
   ```

3. **Environment variables:**
   ```bash
   # Set required variables
   export CLAUDE_WRAPPER_URL=http://localhost:8000
   export API_KEY=your-key  # if needed
   ```

### TypeScript Examples Failing

**Problem:** TypeScript examples won't run

**Diagnosis:**
```bash
# Check TypeScript installation
which tsx
node --version

# Test basic TypeScript compilation
npx tsx --version
```

**Solutions:**

1. **Install tsx:**
   ```bash
   # Global installation
   npm install -g tsx
   
   # Or use npx
   npx tsx scripts/examples/typescript/basic-usage.ts
   ```

2. **Node.js version:**
   ```bash
   # Upgrade to Node.js 18+
   nvm install 18
   nvm use 18
   ```

3. **TypeScript dependencies:**
   ```bash
   # Install in project
   npm install typescript @types/node
   ```

### JavaScript Examples Issues

**Problem:** JavaScript examples fail with module errors

**Diagnosis:**
```bash
# Check Node.js modules
npm list openai

# Test basic require
node -e "console.log(require('openai'))"
```

**Solutions:**

1. **Install dependencies:**
   ```bash
   # Install OpenAI SDK
   npm install openai
   ```

2. **Module type issues:**
   ```bash
   # Ensure package.json has correct type
   # For ES modules: "type": "module"
   # For CommonJS: "type": "commonjs"
   ```

### Session Management Issues

**Problem:** Session examples fail or sessions don't persist

**Diagnosis:**
```bash
# Check session endpoints
curl http://localhost:8000/v1/sessions

# Check session stats
curl http://localhost:8000/v1/sessions/stats

# Test session creation
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-3-5-sonnet-20241022","messages":[{"role":"user","content":"test"}],"session_id":"test-session"}'
```

**Solutions:**

1. **Session cleanup:**
   ```bash
   # Sessions expire after 1 hour by default
   # Check server uptime and session expiration
   ```

2. **Memory limits:**
   ```bash
   # Increase memory if handling many sessions
   node --max-old-space-size=4096 dist/src/cli.js
   ```

## Performance Problems

### Slow Response Times

**Problem:** API responses are slower than expected

**Diagnosis:**
```bash
# Test with time measurement
time curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-3-5-sonnet-20241022","messages":[{"role":"user","content":"Hello"}]}'

# Check system resources
top
htop
```

**Solutions:**

1. **Optimize request size:**
   ```bash
   # Reduce max_tokens for faster responses
   # Use appropriate temperature settings
   # Minimize message history
   ```

2. **Server optimization:**
   ```bash
   # Use cluster mode
   pm2 start ecosystem.config.js

   # Increase UV thread pool
   export UV_THREADPOOL_SIZE=16
   ```

### High Memory Usage

**Problem:** Server consumes excessive memory

**Diagnosis:**
```bash
# Monitor memory usage
ps aux | grep node
watch 'ps -o pid,ppid,cmd,%mem,%cpu --sort=-%mem -e | grep node'
```

**Solutions:**

1. **Limit session storage:**
   ```bash
   # Reduce session TTL
   # Implement session cleanup
   ```

2. **Garbage collection:**
   ```bash
   # Force garbage collection
   node --expose-gc --optimize-for-size dist/src/cli.js
   ```

### Connection Timeouts

**Problem:** Requests timeout frequently

**Diagnosis:**
```bash
# Test with increased timeout
curl --max-time 60 http://localhost:8000/v1/chat/completions

# Check server timeout settings
grep -r timeout config/
```

**Solutions:**

1. **Increase timeouts:**
   ```bash
   # Server timeout
   export MAX_TIMEOUT=60000
   
   # Client timeout
   export TIMEOUT=60000
   ```

2. **Connection pooling:**
   ```bash
   # Use HTTP keep-alive
   # Configure connection limits
   ```

## Network and Connectivity

### Cannot Connect to Server

**Problem:** Unable to reach the server

**Diagnosis:**
```bash
# Test local connectivity
curl http://localhost:8000/health
telnet localhost 8000

# Check firewall
sudo ufw status
sudo iptables -L
```

**Solutions:**

1. **Firewall configuration:**
   ```bash
   # Allow port through firewall
   sudo ufw allow 8000
   
   # For iptables
   sudo iptables -A INPUT -p tcp --dport 8000 -j ACCEPT
   ```

2. **Binding issues:**
   ```bash
   # Bind to all interfaces
   HOST=0.0.0.0 PORT=8000 npm start
   ```

### CORS Errors

**Problem:** Browser requests blocked by CORS

**Diagnosis:**
```bash
# Check CORS headers
curl -H "Origin: http://example.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: X-Requested-With" \
  -X OPTIONS \
  http://localhost:8000/v1/chat/completions
```

**Solutions:**

1. **Configure CORS origins:**
   ```bash
   # Allow specific origins
   export CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
   
   # Allow all origins (development only)
   export CORS_ORIGINS=*
   ```

### Proxy Issues

**Problem:** Server behind proxy not working

**Diagnosis:**
```bash
# Test direct connection
curl http://localhost:8000/health

# Test through proxy
curl http://your-domain.com/health
```

**Solutions:**

1. **Nginx configuration:**
   ```nginx
   location /v1/chat/completions {
       proxy_pass http://localhost:8000;
       proxy_buffering off;
       proxy_cache off;
       proxy_set_header Connection '';
       proxy_http_version 1.1;
       chunked_transfer_encoding off;
   }
   ```

## Development Issues

### Build Failures

**Problem:** TypeScript compilation fails

**Diagnosis:**
```bash
# Check TypeScript errors
npm run build
npx tsc --noEmit

# Check linting
npm run lint
```

**Solutions:**

1. **Fix TypeScript errors:**
   ```bash
   # Update type definitions
   npm update @types/node
   
   # Fix strict mode issues
   # Check tsconfig.json configuration
   ```

2. **Dependency conflicts:**
   ```bash
   # Clear cache and reinstall
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

### Test Failures

**Problem:** Tests don't pass

**Diagnosis:**
```bash
# Run tests with verbose output
npm test -- --verbose

# Run specific test
npm test -- --testNamePattern="basic"
```

**Solutions:**

1. **Mock configuration:**
   ```bash
   # Update test mocks
   # Check test environment setup
   ```

2. **Test data:**
   ```bash
   # Verify test fixtures
   # Update expected responses
   ```

## Common Error Messages

### "EADDRINUSE" Error

**Error:** `Error: listen EADDRINUSE: address already in use :::8000`

**Solution:**
```bash
# Find and kill process using port
lsof -ti:8000 | xargs kill -9

# Or use different port
PORT=3000 npm start
```

### "Authentication Required" Error

**Error:** `{"error":{"type":"authentication_error","message":"Authentication required"}}`

**Solution:**
```bash
# Provide authentication
export ANTHROPIC_API_KEY=your-key
npm restart

# Or disable wrapper auth
unset API_KEY
npm restart
```

### "Model Not Found" Error

**Error:** `{"error":{"type":"invalid_request_error","message":"Model not found"}}`

**Solution:**
```bash
# Check available models
curl http://localhost:8000/v1/models

# Use correct model name
# claude-3-5-sonnet-20241022
# claude-3-haiku-20240307
```

### "Connection Refused" Error

**Error:** `curl: (7) Failed to connect to localhost port 8000: Connection refused`

**Solution:**
```bash
# Start the server
npm start

# Check if server is running
ps aux | grep node

# Check health endpoint
curl http://localhost:8000/health
```

### "jq: command not found" Error

**Error:** `./script.sh: line 10: jq: command not found`

**Solution:**
```bash
# Install jq
# Ubuntu/Debian: sudo apt-get install jq
# macOS: brew install jq
# Windows: choco install jq

# Or use alternative JSON parsing
python -m json.tool  # if Python available
```

## Getting Help

### Enable Debug Mode

```bash
# Maximum verbosity
DEBUG_MODE=true VERBOSE=true npm start

# Debug specific components
DEBUG=claude-wrapper:* npm start
```

### Collect Information

When reporting issues, include:

1. **System information:**
   ```bash
   node --version
   npm --version
   uname -a
   ```

2. **Configuration:**
   ```bash
   # Sanitized environment variables
   env | grep -E "(NODE|CLAUDE)" | sed 's/=.*/=***/'
   ```

3. **Error logs:**
   ```bash
   # Server logs
   npm start 2>&1 | tee server.log
   
   # Example output
   VERBOSE=true ./scripts/examples/curl/basic-completion.sh 2>&1 | tee example.log
   ```

4. **Network tests:**
   ```bash
   # Connectivity
   curl -v http://localhost:8000/health
   
   # Authentication
   curl -v http://localhost:8000/v1/auth/status
   ```

### Documentation Resources

- **Setup Guide:** [SETUP_GUIDE.md](./SETUP_GUIDE.md)
- **API Reference:** [../API_REFERENCE.md](../API_REFERENCE.md)
- **Performance Guide:** [PERFORMANCE_BENCHMARKS.md](./PERFORMANCE_BENCHMARKS.md)
- **Examples:** [../../scripts/examples/README.md](../../scripts/examples/README.md)

### Support Channels

- **GitHub Issues:** Report bugs with detailed information
- **Discussions:** General questions and feature requests
- **Community:** Share solutions and best practices

### Quick Fixes Checklist

Before reporting issues, try:

- [ ] Restart the server
- [ ] Check server health endpoint
- [ ] Verify authentication configuration
- [ ] Test with minimal example
- [ ] Check for typos in environment variables
- [ ] Ensure all dependencies are installed
- [ ] Try with debug mode enabled
- [ ] Check firewall and network settings
- [ ] Review recent changes to configuration