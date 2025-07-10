# Session-Based Optimization Implementation Plan

## Overview

This document outlines the implementation plan for optimizing system prompt handling using Claude Code CLI's session management capabilities (`--resume` and session persistence). This approach leverages Claude CLI's built-in session management instead of file-based CLAUDE.md management.

## Current Problem

- **Large system prompts**: OpenAI clients send 40,000+ character system messages
- **Performance impact**: Each request takes 8+ seconds due to large prompt processing
- **Redundancy**: Same system prompt sent repeatedly in every request
- **File permission issues**: CLAUDE.md writing requires permissions that may not be available

## Proposed Solution

### Session-Based Context Management

**Stage 1: Session Initialization**
- Extract system prompts from first request in a conversation
- Create a new Claude CLI session with system prompt context
- Store session ID for subsequent requests

**Stage 2: Optimized Request Processing**
- Strip system prompts from subsequent requests in the same session
- Use `--resume <session_id>` to continue conversation with cached context
- Send only user/assistant messages to Claude CLI

## Implementation Plan

### Phase 1: Session Detection and Management

**Files to modify:**
- `src/core/wrapper.ts` - Add session management logic
- `src/core/claude-resolver.ts` - Add session support to CLI commands

**Implementation steps:**

1. **Session State Tracking**
   ```typescript
   interface SessionState {
     sessionId: string;
     systemPromptHash: string;
     isInitialized: boolean;
     lastUsed: Date;
   }
   
   private sessions: Map<string, SessionState> = new Map();
   ```

2. **Session Creation**
   ```typescript
   private async initializeSession(systemContent: string, sessionId?: string): Promise<string>
   private getOrCreateSession(request: OpenAIRequest): Promise<string>
   ```

3. **System Prompt Detection**
   - Reuse existing `extractSystemPrompts()` method
   - Check if session exists for conversation
   - Initialize new session if system prompt detected

### Phase 2: Claude CLI Session Integration

**Implementation steps:**

1. **Session Command Construction**
   ```typescript
   // Initial session creation
   echo 'System: ${systemPrompt}\n\nHuman: ${firstUserMessage}\n\nAssistant: ' | claude --print --model ${model}
   
   // Subsequent requests with session resume
   echo 'Human: ${userMessage}\n\nAssistant: ' | claude --print --model ${model} --resume ${sessionId}
   ```

2. **Session ID Extraction**
   - Parse Claude CLI output to extract session ID from first response
   - Store session ID for future requests
   - Handle session creation failures

3. **Resume Logic**
   ```typescript
   private async executeWithSession(
     prompt: string, 
     model: string, 
     sessionId?: string
   ): Promise<{response: string, sessionId: string}>
   ```

### Phase 3: Request Flow Optimization

**Implementation steps:**

1. **Smart Session Management**
   ```typescript
   async handleChatCompletion(request: OpenAIRequest): Promise<OpenAIResponse> {
     const { systemPrompts, otherMessages } = this.extractSystemPrompts(request.messages);
     
     if (systemPrompts.length > 0) {
       // New conversation or system prompt changed
       const sessionId = await this.initializeSessionWithSystemPrompt(systemPrompts, otherMessages[0]);
       return this.processWithSession(otherMessages.slice(1), sessionId);
     } else {
       // Continuing conversation - check for existing session
       const sessionId = this.detectExistingSession(request);
       if (sessionId) {
         return this.processWithSession(otherMessages, sessionId);
       } else {
         // No session, process normally
         return this.processWithoutSession(request);
       }
     }
   }
   ```

2. **Session Lifecycle Management**
   ```typescript
   private async cleanupExpiredSessions(): void
   private isSessionExpired(session: SessionState): boolean
   private removeExpiredSessions(): void
   ```

### Phase 4: Session Persistence and Recovery

**Implementation steps:**

1. **Session Storage**
   - Store session mappings in memory (lightweight)
   - Optional: Persist to file for server restarts
   - Handle session cleanup and expiration

2. **Error Handling**
   - Handle Claude CLI session failures
   - Fall back to non-session processing
   - Retry session creation on failure

3. **Session Validation**
   - Verify session exists before resume
   - Handle invalid session IDs
   - Automatic session recreation

## Request Flow Comparison

### Before Optimization
```
1. Receive OpenAI request (40k+ chars with system prompt)
2. Send entire prompt to Claude CLI
3. Process large prompt (8+ seconds)
4. Return response
```

### After Optimization
```
First request in conversation:
1. Extract system prompt from request
2. Create Claude session with system context
3. Store session ID
4. Process remaining messages (~50 chars)
5. Return response with session context

Subsequent requests:
1. Detect existing session
2. Strip system prompts (95% size reduction)
3. Resume session with --resume flag
4. Process optimized messages (1-2 seconds)
5. Return response
```

## Performance Expectations

### Before Optimization
- Request size: 40,000+ characters
- Response time: 8+ seconds
- Memory usage: High (repeated system prompt processing)

### After Optimization
- Initial request: ~2-3 seconds (session creation overhead)
- Subsequent requests: 1-2 seconds (75%+ improvement)
- Request size: 20-50 characters (95%+ reduction)
- Memory usage: Low (session context cached by Claude CLI)

## Implementation Sequence

1. **Phase 1** (2-3 hours): Session state management and detection
2. **Phase 2** (3-4 hours): Claude CLI session integration
3. **Phase 3** (2-3 hours): Request flow optimization
4. **Phase 4** (2-3 hours): Session persistence and error handling

**Total estimated time: 9-13 hours**

## Advantages over CLAUDE.md Approach

1. **No file permissions required** - Uses Claude CLI's built-in session management
2. **Better isolation** - Each conversation has its own session
3. **Automatic cleanup** - Claude CLI manages session lifecycle
4. **No file corruption risk** - No direct file manipulation needed
5. **Concurrent session support** - Multiple conversations can run simultaneously

## Testing Strategy

1. **Unit Tests**
   - Session creation and management
   - System prompt extraction and hashing
   - Session ID validation

2. **Integration Tests**
   - Claude CLI session creation and resume
   - Multi-turn conversations with sessions
   - Session cleanup and expiration

3. **Performance Tests**
   - Session vs non-session response times
   - Memory usage with multiple sessions
   - Session creation overhead measurement

## Rollout Plan

1. **Development**: Implement behind feature flag
2. **Testing**: Validate with various conversation types
3. **Staging**: Test with concurrent sessions
4. **Production**: Gradual rollout with fallback to non-session mode

## Risk Mitigation

1. **Session creation failures**: Fall back to non-session processing
2. **Invalid session IDs**: Automatic session recreation
3. **Claude CLI session limits**: Implement session rotation
4. **Memory leaks**: Automatic session cleanup and expiration
5. **Performance regression**: Maintain fallback to original behavior

## Future Enhancements

1. **Session sharing**: Share sessions across wrapper instances
2. **Session analytics**: Track session usage and performance
3. **Advanced session management**: Priority-based session retention
4. **Integration with wrapper's existing session management**: Merge with current session handling