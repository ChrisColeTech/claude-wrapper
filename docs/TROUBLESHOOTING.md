# Troubleshooting Guide - Claude Code OpenAI Wrapper

This guide helps you diagnose and resolve common issues with the Claude Code OpenAI Wrapper, including problems with the Interactive API Key Protection system.

## 🔧 Quick Diagnostics

### Check Server Status

```bash
# Basic connectivity test
curl http://localhost:8000/health

# Expected response:
# {"status":"healthy","service":"claude-code-openai-wrapper"}
```

### Check Authentication Status

```bash
# Check Claude and API key status
curl http://localhost:8000/v1/auth/status

# With API key protection
curl -H "Authorization: Bearer your-key" http://localhost:8000/v1/auth/status
```

### Enable Debug Mode

```bash
# Start with maximum logging
claude-wrapper --debug --verbose
```

## 🚨 Common Issues and Solutions

### 1. Server Won't Start

#### Issue: "Port already in use"
```
Error: listen EADDRINUSE: address already in use :::8000
```

**Solutions:**
```bash
# Check what's using the port
lsof -i :8000
# or
netstat -tulpn | grep :8000

# Kill the process
kill -9 <PID>

# Or use a different port
claude-wrapper --port 3000
```

#### Issue: "Command not found: claude-wrapper"
```bash
# Install globally
npm install -g claude-wrapper

# Or check if it's installed
npm list -g claude-wrapper

# Use npx if not globally installed
npx claude-wrapper
```

#### Issue: "Claude Code CLI not found"
```bash
# Install Claude Code CLI
pip install claude-cli

# Verify installation
claude --version

# Check PATH
which claude
```

### 2. Authentication Issues

#### Issue: "ANTHROPIC_API_KEY environment variable not set"

**Solutions:**
```bash
# Set Anthropic API key
export ANTHROPIC_API_KEY="your-anthropic-api-key"

# Or use other authentication methods:
# AWS Bedrock
export CLAUDE_CODE_USE_BEDROCK=1
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"

# Google Vertex AI
export CLAUDE_CODE_USE_VERTEX=1
export ANTHROPIC_VERTEX_PROJECT_ID="your-project"
export GOOGLE_APPLICATION_CREDENTIALS="path/to/creds.json"
```

#### Issue: "Claude Code authentication failed"

**Diagnostic Steps:**
```bash
# Test Claude CLI directly
claude auth status

# Check Claude CLI login
claude auth login

# Verify API key validity
curl -H "Authorization: Bearer $ANTHROPIC_API_KEY" \
  https://api.anthropic.com/v1/messages \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-3-sonnet-20240229","max_tokens":10,"messages":[{"role":"user","content":"test"}]}'
```

### 3. API Key Protection Issues

#### Issue: "401 Unauthorized" with API key

**Check API key format:**
```bash
# API key should be 8-256 characters, alphanumeric + -_
echo "your-api-key" | wc -c  # Check length
echo "your-api-key" | grep -E '^[A-Za-z0-9_-]+$'  # Check format
```

**Check server configuration:**
```bash
# Verify API key is set
curl http://localhost:8000/v1/auth/status | jq '.security_config'

# Should show:
# {
#   "protection_enabled": true,
#   "api_key_configured": true,
#   "key_source": "environment|runtime"
# }
```

#### Issue: Interactive setup not working

**Solutions:**
```bash
# Skip interactive setup
claude-wrapper --no-interactive

# Set API key directly
claude-wrapper --api-key your-secure-key

# Use environment variable
export API_KEY="your-secure-key"
claude-wrapper
```

#### Issue: "API key protection disabled" but expecting it enabled

**Check startup logs:**
```bash
claude-wrapper --debug --verbose 2>&1 | grep -i "api.*key\|security"
```

**Force enable protection:**
```bash
# Use CLI flag
claude-wrapper --api-key force-protection-on

# Or set environment variable
export API_KEY="your-key"
claude-wrapper
```

### 4. Request/Response Issues

#### Issue: "Invalid request format"

**Check request structure:**
```bash
# Correct format
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-key" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [
      {"role": "user", "content": "Hello"}
    ]
  }'
```

**Use debug endpoint:**
```bash
# Test request validation
curl -X POST http://localhost:8000/v1/debug/request \
  -H "Content-Type: application/json" \
  -d '{"your": "request"}'
```

#### Issue: Streaming not working

**Check streaming request:**
```bash
# Ensure stream: true is set
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-key" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [{"role": "user", "content": "Count to 5"}],
    "stream": true
  }'
```

### 5. Session Management Issues

#### Issue: Sessions not persisting

**Check session endpoints:**
```bash
# List sessions
curl -H "Authorization: Bearer your-key" \
  http://localhost:8000/v1/sessions

# Check session stats
curl -H "Authorization: Bearer your-key" \
  http://localhost:8000/v1/sessions/stats
```

**Verify session usage:**
```bash
# Create session with specific ID
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-key" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [{"role": "user", "content": "Remember: my name is Alice"}],
    "session_id": "test-session-123"
  }'

# Test session memory
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-key" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [{"role": "user", "content": "What is my name?"}],
    "session_id": "test-session-123"
  }'
```

### 6. Production Deployment Issues

#### Issue: Docker container exits immediately

**Check container logs:**
```bash
docker logs <container-id>

# Common issues:
# - Missing environment variables
# - Port conflicts
# - Permission errors
```

**Debug Docker deployment:**
```bash
# Run interactively
docker run -it --rm -p 8000:8000 \
  -e API_KEY=test-key \
  claude-wrapper \
  claude-wrapper --debug --verbose

# Check environment
docker run --rm claude-wrapper env | grep -i claude
```

#### Issue: SystemD service fails

**Check service status:**
```bash
sudo systemctl status claude-wrapper
sudo journalctl -u claude-wrapper -f
```

**Common fixes:**
```bash
# Check user permissions
sudo -u claude claude --version

# Check working directory
ls -la /opt/claude-wrapper

# Check environment variables
sudo systemctl edit claude-wrapper
# Add:
# [Service]
# Environment=ANTHROPIC_API_KEY=your-key
```

## 🔍 Diagnostic Commands

### Complete System Check

```bash
#!/bin/bash
# diagnostic-check.sh

echo "=== Claude Wrapper Diagnostic Check ==="

echo "1. Checking Node.js..."
node --version || echo "❌ Node.js not found"

echo "2. Checking Claude CLI..."
claude --version || echo "❌ Claude CLI not found"

echo "3. Checking claude-wrapper installation..."
claude-wrapper --version || echo "❌ claude-wrapper not found"

echo "4. Checking port availability..."
nc -z localhost 8000 && echo "❌ Port 8000 in use" || echo "✅ Port 8000 available"

echo "5. Checking environment variables..."
[ -n "$ANTHROPIC_API_KEY" ] && echo "✅ ANTHROPIC_API_KEY set" || echo "⚠️ ANTHROPIC_API_KEY not set"
[ -n "$API_KEY" ] && echo "✅ API_KEY set" || echo "ℹ️ API_KEY not set (optional)"

echo "6. Testing Claude CLI authentication..."
claude auth status || echo "❌ Claude CLI authentication failed"

echo "=== Diagnostic Check Complete ==="
```

### Log Analysis

```bash
# Filter security-related logs
claude-wrapper --debug 2>&1 | grep -i "security\|auth\|api.*key"

# Filter error logs
claude-wrapper --debug 2>&1 | grep -i "error\|fail\|exception"

# Filter performance logs
claude-wrapper --debug 2>&1 | grep -i "slow\|timeout\|performance"

# Monitor specific endpoint access
claude-wrapper --debug 2>&1 | grep -i "POST\|GET\|/v1/"
```

## 🛠️ Advanced Troubleshooting

### Network Connectivity Issues

```bash
# Test local connectivity
curl -v http://localhost:8000/health

# Test external connectivity (if deployed)
curl -v http://your-server:8000/health

# Check firewall
sudo ufw status
sudo iptables -L

# Test with different networks
curl --interface eth0 http://localhost:8000/health
```

### Memory and Performance Issues

```bash
# Monitor memory usage
top -p $(pgrep -f claude-wrapper)

# Check for memory leaks
node --inspect claude-wrapper

# Performance profiling
time curl http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-3-5-sonnet-20241022","messages":[{"role":"user","content":"test"}]}'
```

### SSL/TLS Issues (for HTTPS deployments)

```bash
# Test SSL certificate
openssl s_client -connect your-domain:443 -servername your-domain

# Check certificate chain
curl -vI https://your-domain/health

# Test with different TLS versions
curl --tlsv1.2 https://your-domain/health
```

## 📞 Getting Help

### Gathering Debug Information

Before seeking help, gather this information:

```bash
# System information
echo "OS: $(uname -a)"
echo "Node.js: $(node --version)"
echo "NPM: $(npm --version)"
echo "Claude CLI: $(claude --version)"
echo "Claude Wrapper: $(claude-wrapper --version)"

# Configuration
echo "Environment variables:"
env | grep -E "(CLAUDE|ANTHROPIC|API_KEY|AWS)" | sed 's/=.*/=***HIDDEN***/'

# Recent logs
echo "Recent logs:"
claude-wrapper --debug --verbose 2>&1 | tail -50
```

### Common Support Scenarios

1. **New Installation Issues**: Provide system info and installation method
2. **Authentication Problems**: Share auth status output (with keys hidden)
3. **API Errors**: Include request/response examples and error messages
4. **Performance Issues**: Provide timing information and system resources
5. **Configuration Questions**: Share relevant config and environment setup

### Creating Minimal Reproduction Cases

```bash
# Create minimal test case
cat > test-reproduction.sh << 'EOF'
#!/bin/bash
# Minimal reproduction case

# Clean environment
unset API_KEY
pkill -f claude-wrapper

# Start server
claude-wrapper --no-interactive --debug &
SERVER_PID=$!

# Wait for startup
sleep 3

# Test request
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [{"role": "user", "content": "test"}]
  }'

# Cleanup
kill $SERVER_PID
EOF

chmod +x test-reproduction.sh
./test-reproduction.sh
```

This troubleshooting guide should help you resolve most common issues with the Claude Code OpenAI Wrapper and its Interactive API Key Protection system.