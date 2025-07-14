# System Prompt Session Optimization Implementation Plan

## Request Processing Flow

### Scenario 1: First Request with System Prompt
```
OpenAI Request:
{
  "messages": [
    {"role": "system", "content": "You are a math tutor..."},
    {"role": "user", "content": "What is 5+3?"}
  ]
}

Flow:
1. Extract system prompt: "You are a math tutor..."
2. Create hash: systemPromptHash = hash("You are a math tutor...")
3. Check sessions map: sessions.get(systemPromptHash) = null
4. Stage 1 - System Prompt Setup:
   - Send to Claude CLI: echo "You are a math tutor..." | claude --print --model sonnet --output-format json
   - Claude returns: {"session_id": "abc123", "result": "I'm ready to help with math..."}
   - Extract session_id: "abc123"
   - Store: sessions.set(systemPromptHash, {claudeSessionId: "abc123", ...})
5. Stage 2 - Message Processing:
   - Strip system prompt from request
   - Send to Claude CLI: echo "What is 5+3?" | claude --print --model sonnet --resume abc123
   - Claude returns: "8"
   - Return OpenAI response to client
```

### Scenario 2: Subsequent Request with Same System Prompt
```
OpenAI Request:
{
  "messages": [
    {"role": "system", "content": "You are a math tutor..."},
    {"role": "user", "content": "What is 10-4?"}
  ]
}

Flow:
1. Extract system prompt: "You are a math tutor..."
2. Create hash: systemPromptHash = hash("You are a math tutor...")
3. Check sessions map: sessions.get(systemPromptHash) = {claudeSessionId: "abc123", ...}
4. Skip Stage 1 - Session exists
5. Stage 2 - Message Processing:
   - Strip system prompt from request  
   - Send to Claude CLI: echo "What is 10-4?" | claude --print --model sonnet --resume abc123
   - Claude returns: "6"
   - Return OpenAI response to client
```

### Scenario 3: Request with Different System Prompt
```
OpenAI Request:
{
  "messages": [
    {"role": "system", "content": "You are a creative writer..."},
    {"role": "user", "content": "Write a poem"}
  ]
}

Flow:
1. Extract system prompt: "You are a creative writer..."
2. Create hash: systemPromptHash = hash("You are a creative writer...")
3. Check sessions map: sessions.get(systemPromptHash) = null
4. Stage 1 - System Prompt Setup:
   - Send to Claude CLI: echo "You are a creative writer..." | claude --print --model sonnet --output-format json
   - Claude returns: {"session_id": "xyz789", "result": "I'm ready to help with creative writing..."}
   - Extract session_id: "xyz789"
   - Store: sessions.set(systemPromptHash, {claudeSessionId: "xyz789", ...})
5. Stage 2 - Message Processing:
   - Strip system prompt from request
   - Send to Claude CLI: echo "Write a poem" | claude --print --model sonnet --resume xyz789
   - Claude returns: poem content
   - Return OpenAI response to client
```

### Scenario 4: Request with No System Prompt
```
OpenAI Request:
{
  "messages": [
    {"role": "user", "content": "What is the weather?"}
  ]
}

Flow:
1. Extract system prompt: none found
2. No optimization needed
3. Send to Claude CLI: echo "What is the weather?" | claude --print --model sonnet
4. Claude returns: response
5. Return OpenAI response to client
```

## Implementation Code Structure

### 1. Main Handler
```typescript
async handleChatCompletion(request: OpenAIRequest): Promise<OpenAIResponse> {
  const systemPrompts = this.extractSystemPrompts(request.messages);
  
  if (systemPrompts.length > 0) {
    const systemPromptHash = this.getSystemPromptHash(systemPrompts);
    const session = this.claudeSessions.get(systemPromptHash);
    
    if (!session) {
      // Stage 1: Setup system prompt session
      const sessionId = await this.initializeSystemPromptSession(systemPrompts);
      this.claudeSessions.set(systemPromptHash, {
        claudeSessionId: sessionId,
        systemPromptHash,
        lastUsed: new Date()
      });
    }
    
    // Stage 2: Process with session
    return this.processWithSession(request, session.claudeSessionId);
  } else {
    // No system prompt - normal processing
    return this.processNormally(request);
  }
}
```

### 2. System Prompt Session Setup
```typescript
async initializeSystemPromptSession(systemPrompts: OpenAIMessage[]): Promise<string> {
  const systemContent = systemPrompts.map(msg => msg.content).join('\n\n');
  const setupRequest = {
    model: 'sonnet',
    messages: [{ role: 'system', content: systemContent }]
  };
  
  const response = await this.claudeClient.executeWithSession(setupRequest, null, true);
  const { sessionId } = this.parseClaudeSessionResponse(response);
  return sessionId;
}
```

### 3. Message Processing with Session
```typescript
async processWithSession(request: OpenAIRequest, sessionId: string): Promise<OpenAIResponse> {
  const strippedRequest = this.stripSystemPrompts(request);
  const response = await this.claudeClient.executeWithSession(strippedRequest, sessionId, false);
  return this.validateAndCorrect(response, strippedRequest);
}
```

## Performance Expectations
- **First request with system prompt**: ~8-10 seconds (session setup + processing)
- **Subsequent requests with same system prompt**: ~2-3 seconds (70%+ improvement)
- **System prompt changes**: New session creation (~8-10 seconds)
- **No system prompt**: Normal processing (~3-5 seconds)

## Implementation Steps

### 1. Update Session Detection Logic
**File**: `src/core/wrapper.ts`
- Replace `detectConversationSession()` with `detectSystemPromptSession()`
- Extract system prompts from request messages
- Create hash from system prompt content only
- Look up existing Claude session by system prompt hash

### 2. Implement Two-Stage Request Processing
**File**: `src/core/wrapper.ts`

**Stage 1: System Prompt Setup (if needed)**
- Check if system prompt hash exists in session map
- If not exists: Send ONLY system prompt to Claude CLI with `--output-format json`
- Extract `session_id` from JSON response
- Store mapping: `systemPromptHash → claudeSessionId`

**Stage 2: Message Processing**
- Strip system prompts from request messages
- If session exists: Use `--resume claudeSessionId` with remaining messages
- If no session: Process normally without optimization

### 3. Update Session State Management
**File**: `src/core/wrapper.ts`
- Change session mapping from `conversationHash` to `systemPromptHash`
- Update `ClaudeSessionState` interface to track system prompt metadata
- Modify session storage to use system prompt hash as key

### 4. Update Method Signatures
- Rename `handleNewConversation()` → `initializeSystemPromptSession()`
- Rename `handleContinuingConversation()` → `processWithExistingSession()`
- Update method logic to handle system prompt setup vs message processing

### 5. System Prompt Utilities
**File**: `src/core/wrapper.ts`
- `extractSystemPrompts(messages)` - Extract system messages
- `getSystemPromptHash(content)` - Create hash from system prompt
- `stripSystemPrompts(request)` - Remove system messages from request
- `hasSystemPromptChanged(hash)` - Check if system prompt is new

### 6. Session Lifecycle Management
- Add session cleanup for expired system prompt sessions
- Handle system prompt changes (new hash = new session)
- Error handling for session creation failures

## Files to Modify
1. `src/core/wrapper.ts` - Main session detection and processing logic
2. `src/core/claude-client.ts` - Session command execution
3. `src/core/claude-resolver.ts` - CLI command construction with session flags

## Implementation Priority
1. **High**: Update session detection to use system prompts
2. **High**: Implement two-stage processing
3. **Medium**: Add session lifecycle management
4. **Low**: Performance monitoring and optimization