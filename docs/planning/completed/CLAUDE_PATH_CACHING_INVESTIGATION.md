# Claude Path Caching Investigation & Fix Plan

## Problem Statement
PATH resolution for Claude CLI is taking 4+ seconds on every request, despite having caching logic in place. This is causing unacceptable performance degradation.

## Current State Analysis

### Expected Behavior
- First request: PATH resolution (4+ seconds)
- Subsequent requests: Use cached path (< 100ms)

### Actual Behavior
- Every request: PATH resolution (4+ seconds)
- Caching is not working despite code being present

### Evidence
- Logs show "Found Claude via PATH resolution" on every request
- Performance: 4.5 seconds per request consistently
- Caching logic exists but is ineffective

## Investigation Plan

### Phase 1: Root Cause Analysis

1. **Instance Lifecycle Investigation**
   - Verify ClaudeResolver singleton behavior
   - Check if CoreWrapper is truly singleton
   - Trace object creation in request lifecycle

2. **Memory State Investigation**
   - Add debug logging to track `this.claudeCommand` value
   - Verify cache hits/misses
   - Check if cached value is being lost

3. **Execution Flow Analysis**
   - Add detailed logging to findClaudeCommand method
   - Track early return path when cached
   - Identify why caching path isn't taken

### Phase 2: Implementation Solutions

#### Solution A: Fix Current Caching (Preferred)
- Identify and fix why current caching isn't working
- Maintain existing architecture
- Add proper debug logging

#### Solution B: Singleton Pattern
- Create global ClaudeResolver singleton
- Ensure single instance across all requests
- Add lazy initialization

#### Solution C: Configuration-Based Caching
- Store discovered path in config file
- Persist across server restarts
- Add path validation on startup

#### Solution D: Environment Variable Override
- Allow manual path specification
- Skip discovery if path provided
- Immediate resolution for known installations

## Implementation Plan

### Step 1: Add Debug Logging
```typescript
// In findClaudeCommand()
logger.debug('Claude path cache check', { 
  hasCachedPath: !!this.claudeCommand,
  cachedPath: this.claudeCommand 
});

// In constructor
logger.debug('ClaudeResolver instance created', { 
  instanceId: Math.random().toString(36).substr(2, 9) 
});
```

### Step 2: Instance Tracking
```typescript
// Add static counter to track instances
private static instanceCount = 0;
private instanceId: string;

constructor() {
  this.instanceId = `resolver-${++ClaudeResolver.instanceCount}`;
  logger.debug('ClaudeResolver created', { instanceId: this.instanceId });
}
```

### Step 3: Fix Root Cause
Based on investigation results:
- Fix singleton implementation
- Fix caching logic
- Add proper error handling

### Step 4: Implement Fallback Solutions
```typescript
// Environment variable override
const CLAUDE_PATH = process.env.CLAUDE_COMMAND || process.env.CLAUDE_CLI_PATH;
if (CLAUDE_PATH) {
  this.claudeCommand = CLAUDE_PATH;
  return CLAUDE_PATH;
}

// Configuration file caching
const cachedPath = await this.loadCachedPath();
if (cachedPath && await this.testClaudeCommand(cachedPath)) {
  this.claudeCommand = cachedPath;
  return cachedPath;
}
```

### Step 5: Performance Optimization
```typescript
// Parallel path testing instead of sequential
const pathPromises = pathCommands.map(cmd => this.tryPathCommand(cmd));
const results = await Promise.allSettled(pathPromises);
const firstSuccess = results.find(r => r.status === 'fulfilled' && r.value);
```

## Testing Strategy

### Unit Tests
```typescript
describe('ClaudeResolver Caching', () => {
  it('should cache path after first discovery', async () => {
    const resolver = new ClaudeResolver();
    const path1 = await resolver.findClaudeCommand();
    const path2 = await resolver.findClaudeCommand();
    expect(path1).toBe(path2);
    // Verify second call was cached (no PATH resolution)
  });

  it('should reuse same instance across requests', () => {
    const wrapper1 = new CoreWrapper();
    const wrapper2 = new CoreWrapper();
    // Should be same instance or at least same cached path
  });
});
```

### Integration Tests
```typescript
describe('Path Caching Integration', () => {
  it('should resolve path once per server lifecycle', async () => {
    // Make multiple requests
    // Verify PATH resolution happens only once
    // Measure performance improvement
  });
});
```

### Performance Tests
```typescript
describe('Performance', () => {
  it('should complete subsequent requests in < 100ms', async () => {
    // First request (allows PATH resolution)
    await makeRequest();
    
    // Subsequent requests should be fast
    const start = Date.now();
    await makeRequest();
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(100);
  });
});
```

## Success Criteria

1. **Performance**: Subsequent requests complete in < 100ms
2. **Reliability**: PATH resolution happens only once per server instance
3. **Fallback**: Environment variable override works
4. **Logging**: Clear debug information for troubleshooting
5. **Tests**: Comprehensive test coverage for caching behavior

## Rollout Plan

### Phase 1: Investigation (Immediate)
- Add debug logging
- Deploy to test environment
- Identify root cause

### Phase 2: Quick Fix (Same Day)
- Implement immediate solution
- Add environment variable override
- Deploy hotfix

### Phase 3: Robust Solution (Next Release)
- Implement comprehensive caching
- Add configuration persistence
- Full test coverage

## Risk Mitigation

1. **Backward Compatibility**: Maintain existing API
2. **Error Handling**: Graceful fallback to PATH resolution
3. **Debug Information**: Comprehensive logging for troubleshooting
4. **Performance Monitoring**: Track request duration metrics

## Expected Outcomes

- **Performance**: 95% reduction in request latency (4s → 200ms)
- **Reliability**: Consistent fast responses after first request
- **Maintainability**: Clear debug information and fallback options
- **User Experience**: Significantly improved response times