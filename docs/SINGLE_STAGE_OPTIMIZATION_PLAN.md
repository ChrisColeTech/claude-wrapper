# Single-Stage Session Reuse Implementation Plan

**Date**: 2025-07-14  
**Issue**: Single-stage processing wastefully sends system prompt file on every request  
**Solution**: Store and reuse session IDs in single-stage mode

## Current Problem

Single-stage mode currently executes this on **every request**:
```bash
cat "/tmp/system-prompt-file" | claude --print --model sonnet -p "user message"
```

This is wasteful because:
- System prompt file is recreated and sent every time
- Claude CLI processes the same system prompt repeatedly
- No session reuse despite Claude CLI returning session IDs

## Proposed Solution

Implement session reuse in single-stage mode using the same session storage logic as two-stage:

### **Current Single-Stage Flow (Wasteful):**
```
Request 1: System Prompt File + User Message → Response (session ID discarded)
Request 2: System Prompt File + User Message → Response (session ID discarded)  
Request 3: System Prompt File + User Message → Response (session ID discarded)
```

### **New Single-Stage Flow (Efficient):**
```
Request 1: System Prompt File + User Message → Response + Store Session ID
Request 2: Resume Session ID + User Message → Response
Request 3: Resume Session ID + User Message → Response
```

## Implementation Details

### 1. Update `processSingleStage()` Method

**File**: `/src/core/wrapper.ts`

```typescript
private async processSingleStage(request: OpenAIRequest): Promise<OpenAIResponse> {
  logger.info('Processing with single-stage session reuse');
  
  // Extract system prompts and create hash
  const systemPrompts = this.extractSystemPrompts(request.messages);
  const systemPromptHash = this.getSystemPromptHash(systemPrompts);
  
  // Check for existing session
  let sessionState = this.claudeSessions.get(systemPromptHash);
  
  if (!sessionState) {
    // First request: Create session with system prompt file
    const sessionId = await this.createSingleStageSession(systemPrompts, request);
    
    // Store session for reuse
    const systemPromptContent = systemPrompts.map(msg => msg.content).join('\n\n');
    this.claudeSessions.set(systemPromptHash, {
      claudeSessionId: sessionId,
      systemPromptHash,
      lastUsed: new Date(),
      systemPromptContent
    });
    
    sessionState = this.claudeSessions.get(systemPromptHash);
  }
  
  // Update last used timestamp
  sessionState.lastUsed = new Date();
  
  // Process remaining messages with existing session
  return this.processWithSession(request, sessionState.claudeSessionId);
}
```

### 2. Add `createSingleStageSession()` Method

**File**: `/src/core/wrapper.ts`

```typescript
private async createSingleStageSession(systemPrompts: OpenAIMessage[], request: OpenAIRequest): Promise<string> {
  logger.info('Creating single-stage session with system prompt file');
  
  const systemPromptContent = systemPrompts.map(msg => msg.content).join('\n\n');
  let tempFilePath: string | null = null;
  
  try {
    // Create temporary file with system prompt
    tempFilePath = await TempFileManager.createTempFile(systemPromptContent);
    
    // Get user messages only
    const userMessages = request.messages.filter(msg => msg.role !== 'system');
    const prompt = this.claudeClient.messagesToPrompt(userMessages);
    
    // Execute with file-based system prompt and JSON output to get session ID
    const rawResponse = await this.claudeResolver.executeCommandWithFileForSession(
      prompt,
      request.model,
      tempFilePath
    );
    
    // Parse response to extract session ID
    const { sessionId } = this.parseClaudeSessionResponse(rawResponse);
    
    if (!sessionId) {
      throw new Error('Failed to extract session ID from Claude CLI response');
    }
    
    logger.info('Single-stage session created successfully', {
      sessionId,
      systemPromptHash: this.getSystemPromptHash(systemPrompts)
    });
    
    return sessionId;
  } finally {
    // Clean up temporary file
    if (tempFilePath) {
      await TempFileManager.cleanupTempFile(tempFilePath);
    }
  }
}
```

### 3. Add `executeCommandWithFileForSession()` Method

**File**: `/src/core/claude-resolver/claude-resolver.ts`

```typescript
async executeCommandWithFileForSession(
  prompt: string,
  model: string,
  systemPromptFilePath: string
): Promise<string> {
  const claudeCmd = await this.findClaudeCommand();
  const flags = this.buildCommandFlags(model, null, true, false); // JSON output enabled
  
  // Use cat to pipe file content and prompt together with JSON output for session ID
  const combinedCommand = `cat "${systemPromptFilePath}" | ${claudeCmd} ${flags} -p "${prompt.replace(/"/g, '\\"')}"`;
  
  logger.debug('Executing file-based Claude command for session creation', {
    systemPromptFile: systemPromptFilePath,
    promptLength: prompt.length,
    model
  });
  
  return this.commandExecutor.execute(combinedCommand, []);
}
```

### 4. Update Command Flag Building

**File**: `/src/core/claude-resolver/claude-resolver.ts`

Ensure `buildCommandFlags()` includes `--output-format json` when creating sessions so session IDs can be extracted.

## Performance Impact

### **Before (Current Single-Stage):**
- Request 1: ~3-4 seconds (system prompt processing)
- Request 2: ~3-4 seconds (system prompt processing)  
- Request 3: ~3-4 seconds (system prompt processing)
- **Total for 3 requests: ~9-12 seconds**

### **After (Optimized Single-Stage):**
- Request 1: ~3-4 seconds (session creation)
- Request 2: ~1-2 seconds (session reuse)
- Request 3: ~1-2 seconds (session reuse)
- **Total for 3 requests: ~5-8 seconds (33-44% improvement)**

## Implementation Steps

### Phase 1: Core Logic
1. Update `processSingleStage()` to check for existing sessions
2. Add `createSingleStageSession()` method
3. Add `executeCommandWithFileForSession()` to resolver
4. Test session creation and storage

### Phase 2: Remove Two-Stage Processing
1. Remove `processTwoStage()` method from CoreWrapper
2. Remove `initializeSystemPromptSession()` method
3. Remove `processWithSession()` method (or adapt for single-stage use)
4. Remove `createSystemPromptSession()` method
5. Update `handleChatCompletion()` to only use single-stage
6. Remove `useSingleStageProcessing` boolean flag and related methods

### Phase 3: Update Configuration and Defaults
1. Remove `setSingleStageProcessing()` and `isSingleStageProcessing()` methods
2. Update shared CoreWrapper to remove two-stage configuration
3. Update all references to processing mode in logs and comments

### Phase 4: Update Mock System
1. **Mock Claude Resolver**: Update to support session ID extraction from file-based calls
2. **Mock Response Templates**: Ensure mock responses include session IDs
3. **Mock Session Simulation**: Make mock system simulate session reuse behavior
4. **Enhanced Response Generator**: Update to handle single-stage session logic

### Phase 5: Update All Tests
1. **Unit Tests**: Remove two-stage specific test cases
2. **Integration Tests**: Update to test single-stage session reuse only
3. **Mock Tests**: Update mock mode tests to verify session reuse
4. **Performance Tests**: Update benchmarks to reflect single-stage optimization
5. **Session API Tests**: Verify session endpoints work with single-stage only

### Phase 6: Update Streaming Support
1. Update `handleStreamingChatCompletion()` to remove two-stage logic
2. Update `streamSingleStage()` method (rename to just `streamWithSession()`)
3. Remove `streamTwoStage()` method
4. Update streaming tests to work with single-stage session reuse

## Files to Modify

### Core System Files
1. **Core Logic**: `/src/core/wrapper.ts`
   - Update `processSingleStage()` method
   - Add `createSingleStageSession()` method
   - **REMOVE**: All two-stage methods and logic
   - **REMOVE**: `useSingleStageProcessing` flag

2. **Resolver**: `/src/core/claude-resolver/claude-resolver.ts`
   - Add `executeCommandWithFileForSession()` method
   - Ensure JSON output flag support

3. **Shared Wrapper**: `/src/core/shared-wrapper.ts`
   - Remove two-stage configuration
   - Simplify to just export CoreWrapper instance

### Mock System Files
4. **Mock Claude Resolver**: `/src/mocks/core/mock-claude-resolver.ts`
   - Update to simulate session ID return from file-based calls
   - Ensure session reuse behavior in mock mode

5. **Enhanced Response Generator**: `/src/mocks/core/enhanced-response-generator.ts`
   - Update session handling for single-stage mode
   - Ensure mock sessions are created and reused properly

### Test Files (Comprehensive Update)
6. **Core Wrapper Tests**: `/tests/unit/core/wrapper.test.ts`
   - Remove all two-stage test cases
   - Add single-stage session reuse tests
   - Test system prompt hash-based session storage

7. **Integration Tests**: `/tests/integration/*/`
   - Update all integration tests to use single-stage
   - Remove two-stage performance comparisons
   - Add single-stage session reuse verification

8. **Mock Mode Tests**: `/tests/mocks/*/`
   - Update mock tests to verify session reuse in mock mode
   - Test mock session creation and storage

9. **Session API Tests**: `/tests/unit/session/routes.test.ts`
   - Verify session endpoints work with single-stage sessions
   - Test session creation, listing, deletion with single-stage

10. **Streaming Tests**: `/tests/unit/streaming/*/`
    - Update streaming tests for single-stage only
    - Remove two-stage streaming test cases

### Documentation Files
11. **Implementation Docs**: `/docs/guides/sessions/`
    - Update session implementation documentation
    - Remove two-stage references
    - Document single-stage session reuse behavior

12. **API Documentation**: 
    - Update any references to processing modes
    - Document unified single-stage behavior

### Configuration Files
13. **Constants**: `/src/config/constants.ts`
    - Remove any two-stage related configuration
    - Clean up processing mode references

## Test Update Requirements

### Mock System Testing
- **Mock Session Simulation**: Ensure mock mode creates and reuses fake session IDs
- **Mock Performance**: Verify mock mode shows session reuse behavior (faster subsequent requests)
- **Mock Session API**: Test that session endpoints work correctly in mock mode

### Core System Testing  
- **Session Reuse Logic**: Test that identical system prompts reuse sessions
- **Session Isolation**: Test that different system prompts create separate sessions
- **Session Storage**: Test that session data is properly stored and retrieved
- **Error Handling**: Test fallback behavior when session creation fails

### Integration Testing
- **End-to-End Session Flow**: Test complete session lifecycle in both real and mock modes
- **Performance Validation**: Verify actual performance improvements
- **API Compatibility**: Ensure all existing API endpoints continue to work

### Streaming Testing
- **Streaming Session Reuse**: Test that streaming requests reuse sessions properly
- **Streaming Mock Mode**: Verify streaming works correctly in mock mode with sessions

## Backward Compatibility

- ✅ No breaking changes to public API
- ✅ Session storage format remains the same
- ✅ All existing endpoints continue to work
- ⚠️ **Internal change**: Two-stage processing completely removed
- ⚠️ **Performance change**: First requests may be slightly faster (no separate setup call)

## Success Criteria

1. ✅ Single-stage mode reuses sessions for identical system prompts
2. ✅ Performance improvement of 30-50% for multi-request scenarios  
3. ✅ Session isolation maintained between different system prompts
4. ✅ Error handling gracefully falls back to non-session mode if needed
5. ✅ All existing tests pass with single-stage only
6. ✅ Mock mode properly simulates session reuse behavior
7. ✅ Streaming works correctly with single-stage session reuse
8. ✅ Session API endpoints work identically to before
9. ✅ No two-stage code remains in codebase
10. ✅ Documentation updated to reflect simplified architecture

## Migration Strategy

### Step 1: Implement Single-Stage Session Reuse
- Add session reuse logic to single-stage
- Keep two-stage as fallback during testing

### Step 2: Validate Single-Stage Performance  
- Run comprehensive tests comparing single-stage vs two-stage
- Verify single-stage meets or exceeds two-stage performance

### Step 3: Remove Two-Stage System
- Delete all two-stage methods and logic
- Update all tests and mocks
- Clean up configuration and documentation

### Step 4: Final Validation
- Run full test suite to ensure no regressions
- Performance test to confirm optimization goals met
- Update all documentation and API references

---

**Expected Timeline**: 4-6 hours implementation + comprehensive testing  
**Risk Level**: Medium (significant code removal, but well-tested)  
**Performance Gain**: 30-50% improvement + simplified architecture  
**Code Reduction**: ~30% reduction in session-related code complexity