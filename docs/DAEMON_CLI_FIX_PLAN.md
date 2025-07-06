# Claude Wrapper CLI Daemon Fix Plan

## Executive Summary

The Claude Wrapper CLI has been successfully converted to daemon-by-default mode, but critical issues prevent proper operation. CLI flags are not being passed to the spawned daemon process, causing the server to ignore user-specified options like port, verbose logging, and debug mode.

## Current Status

### ✅ Working Components
- **CLI Help & Version**: `--help` and `--version` flags work correctly
- **Basic Daemon Spawn**: Daemon process starts and creates PID files
- **Core Server Logic**: Express server starts and configures routes
- **Authentication**: Defaults to `claude-cli` provider as intended
- **OpenAI API Compatibility**: Basic endpoint structure in place

### ❌ Critical Issues
1. **CLI Flag Inheritance Failure**: Daemon doesn't receive CLI options
2. **Health Endpoint 404**: Routing configuration error
3. **Environment Variable Fallback**: Manual env vars required for testing
4. **Daemon Lifecycle**: Status/stop commands partially broken

### 🔄 Partially Working
- **Endpoint Responses**: Some endpoints work with manual environment setup
- **Process Management**: PID files created but status detection unreliable

## Technical Analysis

### Issue 1: CLI Flag Inheritance Failure

**Problem**: The `startDaemon()` method in `cli.ts` spawns a new Node.js process but doesn't properly pass CLI flags as environment variables.

**Root Cause**: 
```typescript
// Current broken implementation
const child = spawn(nodePath, [serverScript], {
  env: {
    ...process.env,
    PORT: port,
    VERBOSE: options.verbose ? 'true' : 'false',  // ❌ Sets 'false' string
    DEBUG_MODE: options.debug ? 'true' : 'false', // ❌ Sets 'false' string
    CLAUDE_WRAPPER_DAEMON: 'true'
  }
});
```

**Issues**:
- Sets `VERBOSE='false'` when flag not provided (should be undefined)
- Sets `DEBUG_MODE='false'` when flag not provided (should be undefined)
- Environment variable checking in server treats `'false'` as truthy

### Issue 2: Health Endpoint Routing

**Problem**: `/health` endpoint returns 404 despite proper route registration.

**Root Cause**: Double-routing issue in `health.ts`:
```typescript
// Server mounts at /health
app.use('/health', HealthRouter.createRouter());

// Router then adds /health again (WRONG)
router.get('/health', this.basicHealthCheck.bind(this)); // Results in /health/health
```

**Status**: ✅ FIXED - Routes changed to use `/` instead of `/health`

### Issue 3: Daemon Process Detection

**Problem**: `--status` command reports "NOT RUNNING" even when daemon is active.

**Root Cause**: 
- PID file created correctly
- Process exists but may exit during startup
- Status check timing issues
- Potential authentication startup failures

### Issue 4: Environment Variable Dependencies

**Problem**: Manual environment variable setting required for testing.

**Root Cause**: CLI flag inheritance failure forces manual env var setup for development/testing.

## Comprehensive Endpoint Analysis

### Current Endpoint Status (Manual Env Test)

| Endpoint | Status | Response | Notes |
|----------|--------|----------|-------|
| `/health` | ❌ 404 | Not Found | Fixed routing awaiting test |
| `/health/detailed` | ❌ 404 | Not Found | Fixed routing awaiting test |
| `/v1/models` | ✅ Working | Model list | Returns claude-3-5-sonnet-20241022 |
| `/v1/auth/status` | ✅ Working | Auth status | Shows claude-code provider |
| `/v1/chat/completions` | ✅ Working | Mock response | Phase 16A placeholder |
| `/v1/sessions` | ✅ Working | Empty list | Basic session endpoint |
| `/monitoring/*` | ❓ Unknown | Not tested | Monitoring routes |
| `/debug/*` | ❓ Unknown | Not tested | Debug routes |

### Expected Endpoint Behavior

**Health Endpoints**:
- `GET /health` → Basic health status
- `GET /health/detailed` → Detailed system info
- `GET /health/production` → Production-grade health check
- `GET /health/monitoring` → Real-time monitoring data

**Core API Endpoints**:
- `GET /v1/models` → OpenAI-compatible model list
- `POST /v1/chat/completions` → Chat completions (Phase 16A: tool rejection)
- `GET /v1/auth/status` → Authentication status
- `GET /v1/sessions` → Session list
- `POST /v1/sessions` → Create session
- `DELETE /v1/sessions/{id}` → Delete session

**Administrative Endpoints**:
- `GET /monitoring/health` → Monitoring system health
- `GET /monitoring/status` → System status
- `GET /debug/*` → Debug information

## Implementation Plan

### Phase 1: Fix CLI Flag Inheritance ⚡ HIGH PRIORITY

**Files to Modify**:
- `app/src/cli.ts` - `startDaemon()` method

**Solution**:
```typescript
// Fixed implementation
const child = spawn(nodePath, [serverScript], {
  env: {
    ...process.env,
    PORT: port,
    ...(options.verbose && { VERBOSE: 'true' }),
    ...(options.debug && { DEBUG_MODE: 'true' }),
    ...(options.production && { NODE_ENV: 'production' }),
    CLAUDE_WRAPPER_DAEMON: 'true'
  }
});
```

**Test Plan**:
1. Start daemon with flags: `claude-wrapper 8000 --verbose --debug`
2. Verify logs show correct port and debug settings
3. Confirm daemon responds to requests

### Phase 2: Verify Health Endpoint Fix ⚡ HIGH PRIORITY

**Files Modified** (Already Done):
- `app/src/routes/health.ts` - Route paths corrected

**Test Plan**:
1. Start daemon
2. Test: `curl http://localhost:PORT/health`
3. Test: `curl http://localhost:PORT/health/detailed`
4. Verify JSON health responses

### Phase 3: Comprehensive Endpoint Testing 📋 MEDIUM PRIORITY

**Test Matrix**:
```bash
# Core functionality
curl -s http://localhost:8000/health
curl -s http://localhost:8000/v1/models
curl -s http://localhost:8000/v1/auth/status

# Chat completion
curl -s -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-3-5-sonnet-20241022","messages":[{"role":"user","content":"Hello"}]}'

# Session management
curl -s http://localhost:8000/v1/sessions
curl -s -X POST http://localhost:8000/v1/sessions \
  -H "Content-Type: application/json" \
  -d '{"session_id":"test-123"}'

# Monitoring
curl -s http://localhost:8000/monitoring/health
curl -s http://localhost:8000/monitoring/status
```

### Phase 4: Daemon Lifecycle Validation 🔄 MEDIUM PRIORITY

**Test Commands**:
```bash
# Start daemon
claude-wrapper 8000 --verbose --debug

# Check status
claude-wrapper --status
# Expected: "Server Status: RUNNING, PID: XXXXX, Health: OK"

# Stop daemon
claude-wrapper --stop
# Expected: "Server stopped (PID: XXXXX)"

# Verify stopped
claude-wrapper --status
# Expected: "Server Status: NOT RUNNING"
```

### Phase 5: Authentication Provider Validation 🔐 LOW PRIORITY

**Test Scenarios**:
1. Default behavior (should use claude-cli)
2. Explicit provider flags (future enhancement)
3. Authentication failure handling

## Success Criteria

### Functional Requirements
- [ ] CLI flags properly inherited by daemon process
- [ ] All health endpoints return valid JSON
- [ ] Core OpenAI API endpoints respond correctly
- [ ] Daemon lifecycle commands work reliably
- [ ] Default claude-cli authentication works

### Performance Requirements
- [ ] Server starts within 5 seconds
- [ ] Health endpoints respond within 500ms
- [ ] Chat completion mock responds within 1 second

### Reliability Requirements
- [ ] Daemon survives authentication failures
- [ ] Status detection is accurate
- [ ] Stop command cleanly terminates daemon
- [ ] No memory leaks during startup

## Risk Assessment

### Low Risk
- Health endpoint routing fix (already implemented)
- Basic endpoint testing

### Medium Risk
- CLI flag inheritance fix (well-understood problem)
- Daemon lifecycle improvements

### High Risk
- Authentication provider changes (not planned for this fix)
- Major server architecture changes (not needed)

## Timeline

**Estimated Duration**: 2-3 hours

1. **Analysis & Investigation** (30 minutes)
   - Deep dive into CLI flag inheritance
   - Verify daemon process behavior
   - Confirm health endpoint fix

2. **Implementation** (45 minutes)
   - Fix CLI flag inheritance
   - Build and test daemon startup
   - Verify environment variable handling

3. **Testing & Validation** (60 minutes)
   - Comprehensive endpoint testing
   - Daemon lifecycle validation
   - Performance verification

4. **Documentation** (15 minutes)
   - Update CLI usage examples
   - Document working endpoints

## Dependencies

### Required Tools
- Node.js (current installation)
- TypeScript compiler (working)
- curl (for endpoint testing)

### No External Dependencies
- No new npm packages required
- No Claude CLI changes needed
- No authentication setup changes

## Post-Implementation Verification

### Automated Tests
```bash
# Quick smoke test
npm start -- 8000 --verbose --debug
curl -s http://localhost:8000/health | jq .
claude-wrapper --status
claude-wrapper --stop
```

### Manual Verification Checklist
- [ ] CLI help displays correctly
- [ ] Daemon starts with custom port
- [ ] Verbose logging appears in daemon logs
- [ ] Debug mode enables detailed logging
- [ ] Health endpoint returns status
- [ ] Models endpoint lists claude models
- [ ] Chat completions work (mock Phase 16A response)
- [ ] Session endpoints respond
- [ ] Daemon status command accurate
- [ ] Daemon stop command works
- [ ] Authentication uses claude-cli by default

## Conclusion

This fix plan addresses the core daemon CLI issues systematically. The primary blocker is CLI flag inheritance, which has a clear solution. Once fixed, the Claude Wrapper will function as designed: a daemon-by-default OpenAI-compatible API server with proper CLI flag support and working health endpoints.

The implementation is low-risk with well-understood solutions and comprehensive testing planned to ensure reliability.