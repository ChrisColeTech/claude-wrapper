# Mock Mode Implementation Plan

## Overview
Implement a `--mock` flag to replace Claude CLI execution with instant mock responses, allowing performance testing to isolate whether delays are from our wrapper code or the actual Claude CLI.

## Comprehensive Implementation Steps

### Step 1: Add Mock Flag to CLI Interface
**File:** `/mnt/c/Projects/claude-wrapper-poc/app/src/cli.ts`

**Changes:**
1. Add to `CliOptions` interface:
```typescript
mock?: boolean;
```

2. Add to CLI program options:
```typescript
.option('-m, --mock', 'use mock Claude CLI for testing')
```

3. Update `startServer()` calls to pass mock flag:
   - In `startForegroundServer()` method
   - In daemon startup via `processManager.start()`

4. Update `ProcessManagerOptions` interface to include mock flag

### Step 2: Update Process Manager Chain
**File:** `/mnt/c/Projects/claude-wrapper-poc/app/src/process/manager.ts`

**Changes:**
1. Add `mock?: boolean` to `ProcessManagerOptions` interface
2. Pass mock flag to `DaemonOptions` in `start()` method

**File:** `/mnt/c/Projects/claude-wrapper-poc/app/src/process/daemon.ts`

**Changes:**
1. Add `mock?: boolean` to `DaemonOptions` interface
2. Pass mock flag as command line argument in `buildDaemonArgs()`
3. Add `--mock` flag handling

### Step 3: Update Server Daemon
**File:** `/mnt/c/Projects/claude-wrapper-poc/app/src/server-daemon.ts`

**Changes:**
1. Add mock flag parsing in `parseDaemonArgs()`
2. Set mock mode environment or pass to server startup

### Step 4: Modify Server Startup
**File:** `/mnt/c/Projects/claude-wrapper-poc/app/src/api/server.ts`

**Changes:**
1. Update `startServer()` function signature to accept mock parameter
2. Pass mock flag to ClaudeResolver initialization
3. Update both foreground and daemon server startup paths

### Step 5: Update ClaudeResolver Architecture
**File:** `/mnt/c/Projects/claude-wrapper-poc/app/src/core/claude-resolver/claude-resolver.ts`

**Changes:**
1. Add `mockMode` property to constructor
2. Update `getInstance()` and `getInstanceAsync()` to accept mock parameter
3. Pass mock flag to ClaudeCommandExecutor constructor
4. Update singleton pattern to handle mock mode variants

### Step 6: Modify ClaudeCommandExecutor
**File:** `/mnt/c/Projects/claude-wrapper-poc/app/src/core/claude-resolver/command-executor.ts`

**Changes:**
1. Add `mockMode` property to constructor
2. Add mock check at start of `execute()` method
3. Add mock check at start of `executeStreaming()` method
4. Implement `mockExecute()` method with instant JSON response
5. Implement `mockExecuteStreaming()` method with instant stream response

### Step 7: Mock Response Implementation
**Mock Execute Method:**
```typescript
private mockExecute(claudeCmd: string, args: string[]): Promise<string> {
  // Parse prompt from args
  const prompt = args[0] || "test";
  
  // Generate realistic mock response matching real Claude CLI JSON format
  const mockResponse = {
    "type": "result",
    "subtype": "success",
    "is_error": false,
    "duration_ms": 10,
    "duration_api_ms": 5,
    "num_turns": 1,
    "result": `Mock response to: ${prompt.substring(0, 50)}...`,
    "session_id": `mock-${Date.now()}`,
    "total_cost_usd": 0.001,
    "usage": {
      "input_tokens": Math.floor(prompt.length / 4),
      "output_tokens": 15,
      "server_tool_use": {"web_search_requests": 0},
      "service_tier": "standard"
    }
  };
  
  return Promise.resolve(JSON.stringify(mockResponse));
}
```

**Mock Streaming Method:**
```typescript
private mockExecuteStreaming(claudeCmd: string, args: string[]): Promise<NodeJS.ReadableStream> {
  const { Readable } = require('stream');
  
  const mockStream = new Readable({
    read() {
      // Emit mock streaming JSON events instantly
      this.push('{"type":"message_start","message":{"id":"mock-123","type":"message","role":"assistant","content":[],"model":"claude-3-5-sonnet-20241022","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":10,"output_tokens":0}}}\n');
      this.push('{"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n');
      this.push('{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Mock "}}\n');
      this.push('{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"streaming "}}\n');
      this.push('{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"response"}}\n');
      this.push('{"type":"content_block_stop","index":0}\n');
      this.push('{"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":20}}\n');
      this.push('{"type":"message_stop"}\n');
      this.push(null); // End stream
    }
  });
  
  return Promise.resolve(mockStream);
}
```

### Step 8: Update Core Wrapper and Client
**File:** `/mnt/c/Projects/claude-wrapper-poc/app/src/core/wrapper.ts`

**Changes:**
1. Update ClaudeResolver.getInstance() calls to pass mock flag if needed
2. Ensure mock mode is properly propagated

**File:** `/mnt/c/Projects/claude-wrapper-poc/app/src/core/claude-client.ts`

**Changes:**
1. Update ClaudeResolver.getInstance() calls to pass mock flag if needed

### Step 9: Add Mock Mode Logging
**All relevant files:**

**Changes:**
1. Add debug logging when mock mode is enabled
2. Add mock mode indicator in request/response logs
3. Ensure mock responses are clearly identified in logs

### Step 10: Testing and Validation

**Build and Test Commands:**
```bash
# Build the project
npm run build

# Test with mock mode
node dist/cli.js --mock --debug --no-interactive

# Test regular request
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "claude-3-5-sonnet-20241022", "messages": [{"role": "user", "content": "hello"}], "max_tokens": 10}'

# Test streaming request
curl -s -N -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "claude-3-5-sonnet-20241022", "messages": [{"role": "user", "content": "Count to 5"}], "max_tokens": 50, "stream": true}'

# Test background mode
node dist/cli.js --mock --no-interactive
```

**Performance Comparison:**
1. Measure response times with `--mock` flag (should be <100ms)
2. Measure response times without `--mock` flag (current 3-4s)
3. Compare to isolate where the delay occurs

## Expected Outcomes

- **If mock mode is fast (<100ms)**: The delay is in Claude CLI execution, not our wrapper code
- **If mock mode is still slow**: The delay is in our wrapper code and needs optimization
- **Streaming test**: Verify that streaming works correctly in both modes

## Implementation Notes

1. **Singleton Pattern**: ClaudeResolver singleton needs to handle mock mode properly
2. **Interface Compatibility**: Mock responses must match exact format of real Claude CLI
3. **Error Handling**: Mock mode should still test error paths appropriately
4. **Configuration Propagation**: Mock flag must be passed through entire chain consistently
5. **Logging**: Clear indication when mock mode is active vs real Claude CLI