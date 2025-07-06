# Security Documentation - Claude Code OpenAI Wrapper

This document provides comprehensive security information for the Claude Code OpenAI Wrapper, including API key protection, authentication mechanisms, and security best practices.

## 🔐 Security Overview

The Claude Code OpenAI Wrapper implements a multi-layered security model:

1. **Claude Service Authentication** (Required): Authenticate with Claude services
2. **API Key Protection** (Optional): Protect local endpoints with Bearer tokens
3. **Security Policy Management**: Configurable security policies and validation
4. **Security Event Logging**: Audit trail for security-related events

## 🛡️ API Key Protection System

### Interactive Setup

The wrapper includes an interactive setup system that guides users through API key configuration:

```bash
claude-wrapper
```

**Interactive Prompt Flow:**
```
🔐 API Key Protection Setup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You can optionally protect your API endpoints with a bearer token.
This adds an extra layer of security for remote access.

If enabled, clients must include: Authorization: Bearer <token>

Would you like to enable API key protection? (y/N): 
```

**When User Chooses 'Yes':**
```
✅ API key protection enabled!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔑 Your API key: abc123def456ghi789jkl012mno345pqr

⚠️  IMPORTANT: Save this key securely!
   • This key will not be shown again
   • You can also set it via API_KEY environment variable
   • Include it in requests: Authorization: Bearer <key>
```

### Configuration Methods

#### 1. Interactive Setup (Recommended)
```bash
claude-wrapper
# Follow prompts to generate secure API key
```

#### 2. CLI Flag
```bash
claude-wrapper --api-key your-secure-api-key-here
```

#### 3. Environment Variable
```bash
export API_KEY="your-secure-api-key-here"
claude-wrapper
```

#### 4. Disable Protection
```bash
claude-wrapper --no-interactive
# Skips API key setup entirely
```

### Key Generation

**Security Features:**
- **Cryptographically Secure**: Uses Node.js `crypto.randomBytes()` for key generation
- **Configurable Length**: Default 32 characters, configurable 8-256 characters
- **Secure Character Set**: Alphanumeric + hyphens and underscores (`A-Za-z0-9-_`)
- **Immediate Validation**: Keys validated upon generation and storage

**Key Format:**
```
Length: 8-256 characters
Characters: A-Z, a-z, 0-9, -, _
Example: abc123def456ghi789jkl012mno345pqr
```

### Storage and Management

#### Storage Sources
1. **Runtime**: Generated during interactive setup or CLI flag
2. **Environment**: `API_KEY` environment variable
3. **None**: No API key configured

#### Security Metadata
The system tracks API key information without storing the actual key:

```typescript
interface ApiKeyStorage {
  source: 'environment' | 'runtime' | 'none';
  hash: string;           // SHA-256 hash for identification
  length: number;         // Key length for validation
  createdAt: Date;        // Creation timestamp
  lastUsed?: Date;        // Last usage timestamp
}
```

#### Key Masking
API keys are masked in logs and status displays:
```
Original: abc123def456ghi789jkl012mno345pqr
Masked:   abc***********************************pqr
```

## 🔒 Security Policies

### Default Policy
```typescript
{
  requireApiKey: false,        // API key not required by default
  minKeyLength: 16,           // Minimum 16 characters
  maxKeyLength: 128,          // Maximum 128 characters
  allowEnvironmentKey: true,   // Allow API_KEY env var
  allowRuntimeKey: true,      // Allow CLI/interactive keys
  keyRotationEnabled: false,  // Key rotation (future feature)
  logSecurityEvents: true     // Log security events
}
```

### Configurable Options
- **Minimum/Maximum Key Length**: Enforce key complexity requirements
- **Source Restrictions**: Control which key sources are allowed
- **Event Logging**: Enable/disable security event logging

## 🔍 Authentication Flow

### Without API Key Protection
```mermaid
sequenceDiagram
    Client->>Wrapper: POST /v1/chat/completions
    Wrapper->>Claude: Forward request
    Claude->>Wrapper: Response
    Wrapper->>Client: Formatted response
```

### With API Key Protection
```mermaid
sequenceDiagram
    Client->>Wrapper: POST /v1/chat/completions<br/>Authorization: Bearer <key>
    Wrapper->>Auth Middleware: Validate API key
    Auth Middleware->>Wrapper: Key valid ✓
    Wrapper->>Claude: Forward request
    Claude->>Wrapper: Response
    Wrapper->>Client: Formatted response
```

### Authentication Middleware

The authentication middleware validates Bearer tokens:

```typescript
// Request with API key protection enabled
Authorization: Bearer abc123def456ghi789jkl012mno345pqr
```

**Validation Process:**
1. Extract Bearer token from Authorization header
2. Validate token format (length, character set)
3. Compare against configured API key
4. Log authentication attempt
5. Allow/deny request based on validation result

## 📊 Security Event Logging

### Event Types
- `API_KEY_GENERATED`: New API key generated
- `API_KEY_SET`: API key configured from external source
- `API_KEY_VALIDATED`: Successful key validation
- `API_KEY_REJECTED`: Invalid key rejection
- `POLICY_UPDATED`: Security policy changes
- `SECURITY_VIOLATION`: Security policy violations

### Event Structure
```typescript
interface SecurityEvent {
  type: SecurityEventType;
  timestamp: Date;
  source: string;          // 'system', 'environment', 'cli'
  keyHash?: string;        // Hashed key identifier
  details: Record<string, any>;
}
```

### Example Events
```json
{
  "type": "API_KEY_GENERATED",
  "timestamp": "2024-01-15T10:30:00Z",
  "source": "system",
  "keyHash": "sha256:a1b2c3...",
  "details": {
    "keyLength": 32,
    "method": "interactive_setup"
  }
}
```

## 🛠️ Security Status Endpoint

### GET /v1/auth/status
Returns comprehensive security configuration:

```bash
curl http://localhost:8000/v1/auth/status
```

**Response includes:**
- Claude service authentication status
- API key protection configuration
- Security policy settings
- Key storage information (without exposing the actual key)

## 🔧 Development and Testing

### Security Testing
- **Unit Tests**: Key generation, validation, policy enforcement
- **Integration Tests**: End-to-end authentication flows
- **Mock Security**: Test auth middleware with mock keys

### Environment Variables for Testing
```bash
# Disable interactive prompts in CI/CD
export CI=true
claude-wrapper --no-interactive

# Set test API key
export API_KEY="test-key-for-development-only"
claude-wrapper
```

## 🚨 Security Best Practices

### For Development
1. **Use `--no-interactive`** in automated environments
2. **Set short key lengths** for local testing
3. **Enable verbose logging** to debug auth issues
4. **Use environment variables** for consistent testing

### For Production
1. **Enable API key protection** for remote deployments
2. **Use environment variables** instead of CLI flags
3. **Monitor security events** for unusual activity
4. **Rotate keys regularly** (manual process currently)
5. **Use strong keys** (32+ characters)

### Security Headers
```bash
# Required header when API key protection is enabled
Authorization: Bearer your-secure-api-key-here

# Optional security headers
X-API-Version: v1
Content-Type: application/json
```

## 🔍 Troubleshooting

### Common Issues

#### API Key Not Working
```bash
# Check auth status
curl http://localhost:8000/v1/auth/status

# Verify key format
echo "your-key" | wc -c  # Should be 8-256 characters

# Check server logs
claude-wrapper --debug --verbose
```

#### Interactive Setup Issues
```bash
# Skip interactive setup
claude-wrapper --no-interactive

# Use CLI flag instead
claude-wrapper --api-key your-key-here

# Set environment variable
export API_KEY="your-key-here"
claude-wrapper
```

#### Permission Errors
```bash
# Check if API key protection is enabled
curl -H "Authorization: Bearer wrong-key" http://localhost:8000/v1/models
# Should return 401 if protection is enabled

# Disable protection for testing
claude-wrapper --no-interactive
```

### Error Messages

#### 401 Unauthorized
```json
{
  "error": {
    "message": "Unauthorized - API key required",
    "type": "authentication_error",
    "code": "401"
  }
}
```

#### Invalid API Key Format
```json
{
  "error": {
    "message": "Invalid API key format (must be 8-256 characters, alphanumeric + -_)",
    "type": "validation_error", 
    "code": "400"
  }
}
```

## 🔄 Migration Guide

### From Previous Versions
If upgrading from a version without API key protection:

1. **No breaking changes**: API key protection is optional
2. **Existing setup**: Environment variables continue to work
3. **New features**: Interactive setup available but not required

### Enabling Security on Existing Deployments
```bash
# Add API key to existing deployment
export API_KEY="$(openssl rand -base64 32 | tr -d '/' | head -c 32)"

# Restart with protection
claude-wrapper

# Update client code to include Authorization header
curl -H "Authorization: Bearer $API_KEY" http://localhost:8000/v1/models
```

## 📖 Related Documentation

- [API Reference](API_REFERENCE.md) - Complete endpoint documentation
- [Architecture Guide](ARCHITECTURE.md) - Security component architecture
- [Implementation Rules](IMPLEMENTATION_RULES.md) - Security coding standards
- [Testing Guide](TESTING.md) - Security testing procedures

---

This security documentation ensures users understand how to properly configure, use, and troubleshoot the API key protection system while maintaining the highest security standards.