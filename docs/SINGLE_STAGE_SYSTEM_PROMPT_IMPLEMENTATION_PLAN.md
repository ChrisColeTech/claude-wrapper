# Single-Stage System Prompt Implementation Plan

## Overview
Implement a single-stage system prompt approach using Claude CLI's file input capabilities to potentially improve performance by avoiding the two-stage optimization process.

## Message Flow and Data Handling Diagram

### Current Two-Stage Flow
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CURRENT TWO-STAGE APPROACH                           │
└─────────────────────────────────────────────────────────────────────────────────┘

1. OpenAI Request Received
   ┌─────────────────────────────────────────────────────────────────────────────┐
   │ POST /v1/chat/completions                                                   │
   │ {                                                                           │
   │   "model": "sonnet",                                                        │
   │   "messages": [                                                             │
   │     {"role": "system", "content": "You are a helpful math tutor"},         │
   │     {"role": "user", "content": "What is 2+2?"}                            │
   │   ],                                                                        │
   │   "stream": true                                                            │
   │ }                                                                           │
   └─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
2. System Prompt Detection & Hashing
   ┌─────────────────────────────────────────────────────────────────────────────┐
   │ CoreWrapper.detectSystemPromptSession()                                     │
   │ • Extract: ["You are a helpful math tutor"]                                │
   │ • Hash: sha256("You are a helpful math tutor").substring(0,16)             │
   │ • Result: "a1b2c3d4e5f6789a" (systemPromptHash)                            │
   │ • Check: claudeSessions.get("a1b2c3d4e5f6789a") → null (new session)      │
   └─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
3. STAGE 1: System Prompt Setup
   ┌─────────────────────────────────────────────────────────────────────────────┐
   │ Command: echo "You are a helpful math tutor" | claude --print --model      │
   │          sonnet --output-format json                                       │
   │                                                                             │
   │ Claude CLI Response:                                                        │
   │ {                                                                           │
   │   "session_id": "06984d88-31c4-4f55-ba22-83e30ef5d048",                   │
   │   "result": "I'm ready to help with math problems..."                      │
   │ }                                                                           │
   │                                                                             │
   │ Stored in Memory:                                                           │
   │ claudeSessions.set("a1b2c3d4e5f6789a", {                                  │
   │   claudeSessionId: "06984d88-31c4-4f55-ba22-83e30ef5d048",                │
   │   systemPromptHash: "a1b2c3d4e5f6789a",                                   │
   │   lastUsed: new Date(),                                                     │
   │   systemPromptContent: "You are a helpful math tutor"                      │
   │ })                                                                          │
   └─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
4. STAGE 2: User Message Processing
   ┌─────────────────────────────────────────────────────────────────────────────┐
   │ • Strip system prompt from request                                          │
   │ • Remaining: [{"role": "user", "content": "What is 2+2?"}]                 │
   │ • Convert to prompt: "What is 2+2?"                                        │
   │                                                                             │
   │ Command: echo "What is 2+2?" | claude --print --model sonnet               │
   │          --resume 06984d88-31c4-4f55-ba22-83e30ef5d048                    │
   │          --output-format stream-json                                        │
   │                                                                             │
   │ Claude CLI Streaming Response:                                              │
   │ {"type":"system","subtype":"init","session_id":"06984d88...","tools":[]}   │
   │ {"type":"assistant","message":{"content":[{"text":"4"}]}}                  │
   │ {"type":"result","result":"4","session_id":"06984d88..."}                  │
   └─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
5. Stream Processing & Response
   ┌─────────────────────────────────────────────────────────────────────────────┐
   │ • Extract content from "assistant" chunk: "4"                              │
   │ • Format as OpenAI streaming chunks                                         │
   │ • Send via Server-Sent Events to client                                    │
   │                                                                             │
   │ Performance: ~14-15 seconds first time, ~3-4 seconds subsequent            │
   └─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                          PROPOSED SINGLE-STAGE APPROACH                        │
└─────────────────────────────────────────────────────────────────────────────────┘

1. OpenAI Request Received (Same as above)
   ┌─────────────────────────────────────────────────────────────────────────────┐
   │ POST /v1/chat/completions                                                   │
   │ {                                                                           │
   │   "model": "sonnet",                                                        │
   │   "messages": [                                                             │
   │     {"role": "system", "content": "You are a helpful math tutor"},         │
   │     {"role": "user", "content": "What is 2+2?"}                            │
   │   ],                                                                        │
   │   "stream": true                                                            │
   │ }                                                                           │
   └─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
2. Single-Stage Detection & Message Processing
   ┌─────────────────────────────────────────────────────────────────────────────┐
   │ CoreWrapper.shouldUseSingleStageFile()                                      │
   │ • Extract system prompts: ["You are a helpful math tutor"]                 │
   │ • Extract user messages: ["What is 2+2?"]                                  │
   │ • Check user message size: 12 chars < 8192 → Use separate files           │
   └─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
3. File Creation & Storage
   ┌─────────────────────────────────────────────────────────────────────────────┐
   │ A. System Prompt File Creation                                              │
   │    • Content: "You are a helpful math tutor"                               │
   │    • TempFileManager.createTempFile(systemPromptContent)                   │
   │    • Location: /tmp/claude-wrapper/prompt-a1b2c3d4.txt                     │
   │    • Permissions: 0o600 (read/write owner only)                            │
   │                                                                             │
   │ B. User Message Preparation                                                 │
   │    • Content: "What is 2+2?"                                               │
   │    • Shell escape: "What is 2+2?" (no special chars)                      │
   │    • Method: Pass via -p flag (small message)                              │
   └─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
4. SINGLE STAGE: Combined Command Execution
   ┌─────────────────────────────────────────────────────────────────────────────┐
   │ Command: cat /tmp/claude-wrapper/prompt-a1b2c3d4.txt | claude              │
   │          -p "What is 2+2?" --model sonnet --print                          │
   │          --output-format stream-json --verbose                             │
   │                                                                             │
   │ File Content (stdin):     "You are a helpful math tutor"                   │
   │ -p Parameter:             "What is 2+2?"                                   │
   │                                                                             │
   │ Claude CLI Streaming Response:                                              │
   │ {"type":"system","subtype":"init","session_id":"new-uuid","tools":[]}      │
   │ {"type":"assistant","message":{"content":[{"text":"4"}]}}                  │
   │ {"type":"result","result":"4","session_id":"new-uuid"}                     │
   └─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
5. Stream Processing & Cleanup
   ┌─────────────────────────────────────────────────────────────────────────────┐
   │ • Extract content from "assistant" chunk: "4"                              │
   │ • Format as OpenAI streaming chunks                                         │
   │ • Send via Server-Sent Events to client                                    │
   │ • TempFileManager automatically cleans up temp files                       │
   │                                                                             │
   │ Performance: ~6-8 seconds (expected improvement)                            │
   └─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                         LARGE MESSAGE ALTERNATIVE FLOW                         │
└─────────────────────────────────────────────────────────────────────────────────┘

When user message > 8192 characters:

3. Combined File Creation
   ┌─────────────────────────────────────────────────────────────────────────────┐
   │ • Combine: systemPrompt + "\n\n" + userMessage                             │
   │ • Content: "You are a helpful math tutor\n\nWhat is 2+2?"                 │
   │ • TempFileManager.createTempFile(combinedContent)                          │
   │ • Location: /tmp/claude-wrapper/prompt-b2c3d4e5.txt                        │
   │ • Permissions: 0o600 (read/write owner only)                               │
   └─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
4. Combined File Command Execution
   ┌─────────────────────────────────────────────────────────────────────────────┐
   │ Command: cat /tmp/claude-wrapper/prompt-b2c3d4e5.txt | claude              │
   │          --print --model sonnet --output-format stream-json --verbose      │
   │                                                                             │
   │ File Content (stdin): "You are a helpful math tutor\n\nWhat is 2+2?"      │
   │ No -p parameter (everything via stdin)                                     │
   └─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                            DATA STORAGE LOCATIONS                              │
└─────────────────────────────────────────────────────────────────────────────────┘

1. Memory Storage (Current Two-Stage)
   ┌─────────────────────────────────────────────────────────────────────────────┐
   │ Location: CoreWrapper.claudeSessions (Map<string, ClaudeSessionState>)     │
   │ Key: systemPromptHash (e.g., "a1b2c3d4e5f6789a")                          │
   │ Value: {                                                                    │
   │   claudeSessionId: "06984d88-31c4-4f55-ba22-83e30ef5d048",                │
   │   systemPromptHash: "a1b2c3d4e5f6789a",                                   │
   │   lastUsed: new Date(),                                                     │
   │   systemPromptContent: "You are a helpful math tutor"                      │
   │ }                                                                           │
   │ Persistence: In-memory only (lost on restart)                              │
   │ Cleanup: Manual cleanup based on lastUsed timestamp                        │
   └─────────────────────────────────────────────────────────────────────────────┘

2. File Storage (Single-Stage)
   ┌─────────────────────────────────────────────────────────────────────────────┐
   │ Location: /tmp/claude-wrapper/                                              │
   │ Files: prompt-{randomHex}.txt                                               │
   │ Content: System prompt or combined prompt + user message                   │
   │ Permissions: 0o600 (owner read/write only)                                 │
   │ Cleanup: TempFileManager automatic cleanup (5 minute intervals)            │
   │ Security: Restricted access, automatic cleanup prevents data leakage       │
   └─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                         EXTRACTION AND PROCESSING DETAILS                      │
└─────────────────────────────────────────────────────────────────────────────────┘

1. System Prompt Extraction
   ┌─────────────────────────────────────────────────────────────────────────────┐
   │ Input: OpenAIRequest.messages[]                                             │
   │ Process: messages.filter(msg => msg.role === 'system')                     │
   │ Extract: msg.content for each system message                               │
   │ Combine: systemPrompts.map(msg => msg.content).join('\n\n')               │
   │ Result: Single string with all system prompt content                       │
   └─────────────────────────────────────────────────────────────────────────────┘

2. User Message Extraction
   ┌─────────────────────────────────────────────────────────────────────────────┐
   │ Input: OpenAIRequest.messages[]                                             │
   │ Process: messages.filter(msg => msg.role !== 'system')                     │
   │ Convert: claudeClient.messagesToPrompt(userMessages)                       │
   │ Result: Formatted prompt string for Claude CLI                             │
   └─────────────────────────────────────────────────────────────────────────────┘

3. File Content Creation
   ┌─────────────────────────────────────────────────────────────────────────────┐
   │ Small Messages (<8192 chars):                                               │
   │ • System File: systemPromptContent                                         │
   │ • User Content: via -p flag                                                │
   │                                                                             │
   │ Large Messages (>=8192 chars):                                              │
   │ • Combined File: systemPromptContent + "\n\n" + userPrompt                │
   │ • User Content: included in file                                           │
   └─────────────────────────────────────────────────────────────────────────────┘

4. Command Construction
   ┌─────────────────────────────────────────────────────────────────────────────┐
   │ Small Messages:                                                             │
   │ cat {systemFile} | claude -p "{userMessage}" --model {model} --print      │
   │                    --output-format stream-json --verbose                   │
   │                                                                             │
   │ Large Messages:                                                             │
   │ cat {combinedFile} | claude --print --model {model}                        │
   │                      --output-format stream-json --verbose                 │
   └─────────────────────────────────────────────────────────────────────────────┘

5. Response Processing
   ┌─────────────────────────────────────────────────────────────────────────────┐
   │ Input: Claude CLI stream-json output                                        │
   │ Parse: JSON.parse(line) for each output line                               │
   │ Extract: Content from chunks where type === "assistant"                    │
   │ Format: Convert to OpenAI streaming format                                 │
   │ Output: Server-Sent Events to client                                       │
   └─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                           PERFORMANCE COMPARISON                               │
└─────────────────────────────────────────────────────────────────────────────────┘

Scenario: First request with new system prompt
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Current Two-Stage:                                                              │
│ • Stage 1 (Setup): ~8-10 seconds                                               │
│ • Stage 2 (Process): ~4-6 seconds                                              │
│ • Total: ~14-15 seconds                                                        │
│                                                                                 │
│ Proposed Single-Stage:                                                         │
│ • Single Command: ~6-8 seconds                                                 │
│ • Total: ~6-8 seconds                                                          │
│ • Improvement: ~50% faster                                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

Scenario: Subsequent request with same system prompt
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Current Two-Stage:                                                              │
│ • Stage 1 (Skip): 0 seconds (cached)                                           │
│ • Stage 2 (Process): ~3-4 seconds                                              │
│ • Total: ~3-4 seconds                                                          │
│                                                                                 │
│ Proposed Single-Stage:                                                         │
│ • Single Command: ~6-8 seconds                                                 │
│ • Total: ~6-8 seconds                                                          │
│ • Result: Two-stage wins for repeated prompts                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

## Current Two-Stage Approach vs Proposed Single-Stage

### Current Two-Stage Approach
```bash
# Stage 1: System prompt setup
echo "You are a helpful math tutor" | claude --print --model sonnet --output-format json
# Claude returns: {"session_id": "abc123", "result": "I'm ready to help with math..."}

# Stage 2: User message processing
echo "What is 2+2?" | claude --print --model sonnet --resume abc123 --output-format stream-json
# Claude returns: streaming response with answer
```

**Performance**: ~14-15 seconds for first request (both stages), ~3-4 seconds for subsequent requests (stage 2 only)

### Proposed Single-Stage Approach

#### For Small User Messages
```bash
# Single stage: System prompt via file + user message via -p flag
cat system_prompt.txt | claude -p "What is 2+2?" --model sonnet --output-format stream-json
# Claude returns: streaming response with answer
```

#### For Large User Messages
```bash
# Single stage: Combined file with both system prompt and user message via stdin
cat combined_prompt.txt | claude --print --model sonnet --output-format stream-json
# Where combined_prompt.txt contains: system prompt + user message
```

**Expected Performance**: ~6-8 seconds for all requests (no session optimization, but no two-stage overhead)

## Implementation Strategy

### Phase 1: Add Single-Stage Option
Add a configuration flag to enable single-stage processing for testing and comparison.

### Phase 2: Implement File-Based System Prompt
Modify the command execution to use the file input approach when enabled.

### Phase 3: Performance Testing
Compare performance between two-stage and single-stage approaches.

## Detailed Implementation

### 1. Configuration Addition
**File**: `src/config/constants.ts`

```typescript
export const SYSTEM_PROMPT_CONFIG = {
  // Existing two-stage optimization
  USE_SESSION_OPTIMIZATION: true,
  
  // New single-stage file approach
  USE_SINGLE_STAGE_FILE: false,
  
  // Enable for testing both approaches
  ENABLE_PERFORMANCE_COMPARISON: false
};
```

### 2. Core Wrapper Modifications
**File**: `src/core/wrapper.ts`

#### 2.1 Add Single-Stage Detection
```typescript
private shouldUseSingleStageFile(request: OpenAIRequest): boolean {
  // Check if single-stage file approach is enabled
  if (!SYSTEM_PROMPT_CONFIG.USE_SINGLE_STAGE_FILE) {
    return false;
  }
  
  // Only use for requests with system prompts
  const systemPrompts = this.extractSystemPrompts(request.messages);
  return systemPrompts.length > 0;
}
```

#### 2.2 Modify handleStreamingChatCompletion
```typescript
async handleStreamingChatCompletion(request: OpenAIRequest): Promise<NodeJS.ReadableStream> {
  logger.info('Processing streaming chat completion (real)', {
    model: request.model,
    messageCount: request.messages.length
  });

  // Check if we should use single-stage file approach
  if (this.shouldUseSingleStageFile(request)) {
    return this.handleSingleStageStreamingCompletion(request);
  }

  // Existing two-stage optimization logic
  const sessionInfo = this.detectSystemPromptSession(request.messages);
  // ... rest of existing code
}
```

#### 2.3 Implement Single-Stage Handler
```typescript
private async handleSingleStageStreamingCompletion(request: OpenAIRequest): Promise<NodeJS.ReadableStream> {
  // Extract system prompts and user messages
  const systemPrompts = this.extractSystemPrompts(request.messages);
  const userMessages = request.messages.filter(msg => msg.role !== 'system');
  
  // Convert user messages to prompt format
  const userPrompt = this.claudeClient.messagesToPrompt(userMessages);
  
  // Determine approach based on user message size
  const usesCombinedFile = this.shouldUseCombinedFile(userPrompt);
  
  if (usesCombinedFile) {
    // Large user message: combine system prompt and user message in single file
    const systemPromptContent = systemPrompts.map(msg => msg.content).join('\n\n');
    const combinedContent = `${systemPromptContent}\n\n${userPrompt}`;
    const combinedFile = await TempFileManager.createTempFile(combinedContent);
    
    return this.claudeResolver.executeCommandStreamingWithCombinedFile(
      combinedFile,
      request.model
    );
  } else {
    // Small user message: system prompt via file, user message via -p flag
    const systemPromptContent = systemPrompts.map(msg => msg.content).join('\n\n');
    const systemPromptFile = await TempFileManager.createTempFile(systemPromptContent);
    
    return this.claudeResolver.executeCommandStreamingWithFile(
      systemPromptFile,
      userPrompt,
      request.model
    );
  }
}

private shouldUseCombinedFile(userPrompt: string): boolean {
  // Use combined file approach for large user messages to avoid command line length limits
  const COMMAND_LINE_LIMIT = 8192; // Conservative limit for command line arguments
  return userPrompt.length > COMMAND_LINE_LIMIT;
}
```

### 3. Claude Resolver Modifications
**File**: `src/core/claude-resolver/claude-resolver.ts`

#### 3.1 Add File-Based Streaming Methods
```typescript
// For small user messages: system prompt via file, user message via -p flag
async executeCommandStreamingWithFile(
  systemPromptFile: string,
  userPrompt: string,
  model: string
): Promise<NodeJS.ReadableStream> {
  const claudeCmd = await this.findClaudeCommand();
  const flags = this.buildFileCommandFlags(model, true);
  
  // Build command: cat systemPromptFile | claude -p "userPrompt" --flags
  const command = `cat "${systemPromptFile}" | ${claudeCmd} -p "${this.escapeShellString(userPrompt)}" ${flags}`;
  
  logger.debug('Executing single-stage streaming command with file', { 
    command,
    systemPromptFile,
    userPromptLength: userPrompt.length
  });
  
  return this.commandExecutor.executeStreamingCommand(command);
}

// For large user messages: combined file with both system prompt and user message
async executeCommandStreamingWithCombinedFile(
  combinedFile: string,
  model: string
): Promise<NodeJS.ReadableStream> {
  const claudeCmd = await this.findClaudeCommand();
  const flags = this.buildFileCommandFlags(model, true);
  
  // Build command: cat combinedFile | claude --print --flags
  const command = `cat "${combinedFile}" | ${claudeCmd} --print ${flags}`;
  
  logger.debug('Executing single-stage streaming command with combined file', { 
    command,
    combinedFile
  });
  
  return this.commandExecutor.executeStreamingCommand(command);
}
```

#### 3.2 Add File Command Flags Builder
```typescript
private buildFileCommandFlags(model: string, isStreaming: boolean): string {
  let flags = `--model ${model}`;
  
  // Add print flag (required for streaming)
  flags += ` --print`;
  
  // Add streaming output format
  if (isStreaming) {
    flags += ` --output-format stream-json --verbose`;
  }
  
  // Note: No --resume flag needed for single-stage approach
  
  return flags;
}
```

### 4. Command Executor Modifications
**File**: `src/core/claude-resolver/command-executor.ts`

#### 4.1 Add Direct Command Execution
```typescript
async executeStreamingCommand(command: string): Promise<NodeJS.ReadableStream> {
  try {
    logger.debug('Executing streaming command directly', { command });
    
    const process = spawn('bash', ['-c', command], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Handle process errors
    process.on('error', (error) => {
      logger.error('Claude CLI streaming process error (file-based)', error);
    });
    
    process.stderr.on('data', (data) => {
      logger.warn('Claude CLI streaming stderr (file-based)', { stderr: data.toString() });
    });
    
    // Ensure stdout is not buffered
    process.stdout.setEncoding('utf8');
    
    return process.stdout;
    
  } catch (error) {
    logger.error('Claude CLI streaming execution failed (file-based)', error as Error);
    throw new ClaudeCliError(`Claude CLI streaming execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
```

### 5. Performance Comparison Implementation
**File**: `src/utils/performance-tracker.ts`

```typescript
export class PerformanceTracker {
  private static measurements: Map<string, number[]> = new Map();
  
  static startMeasurement(key: string): string {
    const measurementId = `${key}-${Date.now()}-${Math.random()}`;
    const startTime = performance.now();
    
    if (!this.measurements.has(key)) {
      this.measurements.set(key, []);
    }
    
    // Store start time temporarily
    this.measurements.get(key)!.push(startTime);
    
    return measurementId;
  }
  
  static endMeasurement(key: string, measurementId: string): number {
    const endTime = performance.now();
    const measurements = this.measurements.get(key);
    
    if (measurements && measurements.length > 0) {
      const startTime = measurements.pop()!;
      const duration = endTime - startTime;
      
      logger.info('Performance measurement', {
        key,
        duration: `${duration.toFixed(2)}ms`,
        measurementId
      });
      
      return duration;
    }
    
    return 0;
  }
  
  static getAverageTime(key: string): number {
    const measurements = this.measurements.get(key);
    if (!measurements || measurements.length === 0) return 0;
    
    const sum = measurements.reduce((acc, val) => acc + val, 0);
    return sum / measurements.length;
  }
}
```

## Testing Strategy

### Test Scenarios

#### 1. Basic Functionality Test
```bash
# Test single-stage approach
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sonnet",
    "stream": true,
    "messages": [
      {"role": "system", "content": "You are a helpful math tutor"},
      {"role": "user", "content": "What is 2+2?"}
    ]
  }'
```

#### 2. Performance Comparison Test
```bash
# Enable performance comparison mode
export ENABLE_PERFORMANCE_COMPARISON=true

# Test multiple requests with same system prompt
for i in {1..5}; do
  echo "Test $i:"
  time curl -X POST http://localhost:8000/v1/chat/completions \
    -H "Content-Type: application/json" \
    -d '{
      "model": "sonnet",
      "stream": true,
      "messages": [
        {"role": "system", "content": "You are a helpful math tutor"},
        {"role": "user", "content": "What is 5+'"$i"'?"}
      ]
    }'
  echo "---"
done
```

#### 3. Complex System Prompt Test
```bash
# Test with complex system prompt containing quotes and newlines
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sonnet",
    "stream": true,
    "messages": [
      {"role": "system", "content": "You are a helpful assistant.\nAlways be polite and say \"please\" and \"thank you\".\nUse proper grammar and punctuation."},
      {"role": "user", "content": "Hello, how are you?"}
    ]
  }'
```

## Expected Performance Results

### First Request (New System Prompt)
- **Current Two-Stage**: ~14-15 seconds (session creation + response)
- **Single-Stage File**: ~6-8 seconds (single command execution)
- **Expected Improvement**: ~50% faster

### Subsequent Requests (Same System Prompt)
- **Current Two-Stage**: ~3-4 seconds (session reuse)
- **Single-Stage File**: ~6-8 seconds (no session optimization)
- **Expected Result**: Two-stage wins for repeated system prompts

### Different System Prompts
- **Current Two-Stage**: ~14-15 seconds (new session creation each time)
- **Single-Stage File**: ~6-8 seconds (consistent performance)
- **Expected Result**: Single-stage wins for varied system prompts

## Implementation Phases

### Phase 1: Core Implementation (2-3 hours)
1. Add configuration constants
2. Implement single-stage detection logic
3. Add file-based streaming method
4. Modify core wrapper to support both approaches

### Phase 2: Testing and Validation (1-2 hours)
1. Test basic functionality
2. Validate error handling
3. Test complex system prompts
4. Verify temp file cleanup

### Phase 3: Performance Analysis (1 hour)
1. Implement performance tracking
2. Run comparison tests
3. Document performance characteristics
4. Make recommendations for default approach

## Configuration Options

### Environment Variables
```bash
# Enable single-stage file approach
export USE_SINGLE_STAGE_FILE=true

# Enable performance comparison logging
export ENABLE_PERFORMANCE_COMPARISON=true

# Set temp file cleanup interval (default: 5 minutes)
export TEMP_FILE_CLEANUP_INTERVAL=300000
```

### Runtime Configuration
```typescript
// Dynamic switching based on request characteristics
const config = {
  // Use single-stage for first-time system prompts
  useSingleStageForNewPrompts: true,
  
  // Use two-stage for repeated system prompts
  useTwoStageForRepeatedPrompts: true,
  
  // Threshold for switching approaches
  systemPromptReuseThreshold: 2
};
```

## Error Handling

### File Creation Errors
- Fallback to two-stage approach if file creation fails
- Log error and continue with session optimization

### Command Execution Errors
- Proper error propagation to client
- Cleanup temporary files on error
- Fallback to non-streaming if streaming fails

### Shell Escaping
- Proper escaping of user input in command construction
- Validation of file paths and content
- Security considerations for temp file handling

## Security Considerations

### Temp File Security
- Use existing TempFileManager security (0o600 permissions)
- Automatic cleanup of temporary files
- No sensitive data in file names

### Command Injection Prevention
- Proper shell escaping of all user input
- Validation of system prompt content
- Sanitization of command parameters

## Monitoring and Observability

### Performance Metrics
- Track execution time for both approaches
- Monitor temp file creation/cleanup
- Log approach selection decisions

### Error Tracking
- File creation failures
- Command execution errors
- Performance degradation detection

## Test Files Impact and Updates

### Test Files That Need Updates

#### 1. **Core Wrapper Tests** (`tests/unit/core/wrapper.test.ts`)
**Changes needed:**
- Add tests for new `shouldUseSingleStageFile()` method
- Add tests for new `handleSingleStageStreamingCompletion()` method  
- Add tests for `shouldUseCombinedFile()` logic
- Mock `TempFileManager` for file creation tests
- Test both small and large user message scenarios

```typescript
describe('Single-Stage System Prompt Handling', () => {
  it('should detect when to use single-stage file approach', () => {
    // Test shouldUseSingleStageFile() logic
  });
  
  it('should handle small user messages with separate files', async () => {
    // Test system prompt file + -p flag approach
  });
  
  it('should handle large user messages with combined files', async () => {
    // Test combined file approach for large messages
  });
  
  it('should properly determine file approach based on message size', () => {
    // Test shouldUseCombinedFile() with various message sizes
  });
});
```

#### 2. **Claude Resolver Tests** (`tests/unit/core/claude-resolver.test.ts`)
**Changes needed:**
- Add tests for new `executeCommandStreamingWithFile()` method
- Add tests for new `executeCommandStreamingWithCombinedFile()` method
- Add tests for `buildFileCommandFlags()` method
- Mock command execution for file-based approaches
- Test command construction for both approaches

```typescript
describe('File-Based Command Execution', () => {
  it('should build correct command for file + -p flag approach', async () => {
    // Test: cat file.txt | claude -p "message" --flags
  });
  
  it('should build correct command for combined file approach', async () => {
    // Test: cat combined.txt | claude --print --flags
  });
  
  it('should handle file paths with spaces and special characters', async () => {
    // Test proper shell escaping
  });
});
```

#### 3. **Streaming Handler Tests** (`tests/unit/streaming/handler.test.ts`)
**Changes needed:**
- Update mocks to handle new single-stage approach
- Test interaction with CoreWrapper's new methods
- Verify streaming still works with file-based inputs

```typescript
describe('Single-Stage Streaming Integration', () => {
  it('should delegate to single-stage handler when enabled', async () => {
    // Test integration with new single-stage methods
  });
  
  it('should maintain streaming functionality with file inputs', async () => {
    // Test streaming works with file-based approach
  });
});
```

#### 4. **Command Executor Tests** (`tests/unit/core/command-executor.test.ts`)
**Changes needed:**
- Add tests for new `executeStreamingCommand()` method
- Test direct command execution without args parsing
- Test error handling for file-based commands

```typescript
describe('Direct Command Execution', () => {
  it('should execute commands directly without args parsing', async () => {
    // Test executeStreamingCommand() method
  });
  
  it('should handle command execution errors properly', async () => {
    // Test error handling for file-based commands
  });
});
```

#### 5. **Integration Tests** (`tests/integration/streaming/integration.test.ts`)
**Changes needed:**
- Add end-to-end tests for single-stage approach
- Test both small and large user message scenarios
- Test performance comparison between approaches
- Test temp file cleanup

```typescript
describe('Single-Stage Integration Tests', () => {
  it('should work end-to-end with small user messages', async () => {
    // Test complete flow with file + -p approach
  });
  
  it('should work end-to-end with large user messages', async () => {
    // Test complete flow with combined file approach
  });
  
  it('should clean up temporary files after execution', async () => {
    // Test temp file cleanup
  });
});
```

### Mock Files That Need Updates

#### 1. **Claude Resolver Mock** (`tests/mocks/core/claude-resolver-mock.ts`)
```typescript
// Add new methods to mock
const mockResolver = {
  // Existing methods...
  executeCommandStreamingWithFile: jest.fn(),
  executeCommandStreamingWithCombinedFile: jest.fn(),
  buildFileCommandFlags: jest.fn()
};
```

#### 2. **Streaming Mocks** (`tests/mocks/streaming-mocks.ts`)
```typescript
// Update to handle single-stage approach
const mockStreamingHandler = {
  // Existing methods...
  handleSingleStageStreamingCompletion: jest.fn()
};
```

#### 3. **TempFileManager Mock** (`tests/mocks/utils/temp-file-manager-mock.ts`)
```typescript
// New mock for temp file operations
export const TempFileManagerMock = {
  createTempFile: jest.fn().mockResolvedValue('/tmp/claude-wrapper/mock-file.txt'),
  cleanupTempFiles: jest.fn(),
  ensureTempDirectory: jest.fn()
};
```

### New Test Files to Create

#### 1. **Single-Stage Specific Tests**
**File**: `tests/unit/core/single-stage-handler.test.ts`
```typescript
describe('Single-Stage System Prompt Handler', () => {
  describe('Message Size Detection', () => {
    it('should use combined file for large messages', () => {
      // Test COMMAND_LINE_LIMIT threshold
    });
    
    it('should use separate files for small messages', () => {
      // Test below threshold behavior
    });
  });
  
  describe('File Creation', () => {
    it('should create system prompt file correctly', async () => {
      // Test system prompt file creation
    });
    
    it('should create combined file correctly', async () => {
      // Test combined file creation
    });
    
    it('should handle special characters in content', async () => {
      // Test proper content handling
    });
  });
  
  describe('Command Construction', () => {
    it('should build correct commands for each approach', () => {
      // Test command building logic
    });
  });
  
  describe('Error Handling', () => {
    it('should handle file creation errors', async () => {
      // Test error scenarios
    });
    
    it('should handle command execution errors', async () => {
      // Test execution error handling
    });
  });
});
```

#### 2. **Performance Comparison Tests**
**File**: `tests/integration/performance/single-stage-comparison.test.ts`
```typescript
describe('Single-Stage vs Two-Stage Performance', () => {
  describe('First-Time System Prompt Performance', () => {
    it('should be faster than two-stage for new system prompts', async () => {
      // Performance comparison test
    });
  });
  
  describe('Repeated System Prompt Performance', () => {
    it('should compare performance with session optimization', async () => {
      // Test repeated prompts
    });
  });
  
  describe('Large User Message Handling', () => {
    it('should handle large messages efficiently', async () => {
      // Test large message performance
    });
  });
  
  describe('Performance Metrics', () => {
    it('should track and report performance metrics', async () => {
      // Test performance tracking
    });
  });
});
```

#### 3. **Configuration Tests**
**File**: `tests/unit/config/single-stage-config.test.ts`
```typescript
describe('Single-Stage Configuration', () => {
  it('should respect USE_SINGLE_STAGE_FILE flag', () => {
    // Test configuration flag
  });
  
  it('should enable performance comparison when configured', () => {
    // Test performance comparison flag
  });
  
  it('should handle configuration changes at runtime', () => {
    // Test dynamic configuration
  });
});
```

### Test Setup and Configuration

#### 1. **Test Environment Setup**
**File**: `tests/setup/single-stage-test-setup.ts`
```typescript
export class SingleStageTestSetup {
  static setupEnvironment() {
    // Set test environment variables
    process.env.USE_SINGLE_STAGE_FILE = 'true';
    process.env.ENABLE_PERFORMANCE_COMPARISON = 'true';
    process.env.TEMP_FILE_CLEANUP_INTERVAL = '1000'; // Fast cleanup for tests
  }
  
  static mockTempFileManager() {
    // Mock TempFileManager for consistent test behavior
  }
  
  static createTestFiles() {
    // Create test system prompt and user message files
  }
  
  static cleanupTestFiles() {
    // Clean up test files after tests
  }
}
```

#### 2. **Test Data Factory Updates**
**File**: `tests/mocks/test-data-factory.ts`
```typescript
export class TestDataFactory {
  // Existing methods...
  
  createLargeUserMessageRequest(size: number = 10000): OpenAIRequest {
    // Create request with large user message for testing
  }
  
  createComplexSystemPromptRequest(): OpenAIRequest {
    // Create request with complex system prompt
  }
  
  createCombinedFileTestContent(): string {
    // Create test content for combined file approach
  }
}
```

### Key Testing Considerations

#### 1. **File System Mocking**
- Mock `TempFileManager` for unit tests to avoid actual file system operations
- Test file creation, content writing, and cleanup
- Verify proper file permissions and security

#### 2. **Command Execution Mocking**
- Mock the new direct command execution methods
- Test command construction with proper shell escaping
- Verify error handling for command failures

#### 3. **Size Threshold Testing**
- Test the 8192 character limit boundary conditions
- Test with messages just below and above the threshold
- Verify correct approach selection

#### 4. **Error Scenarios**
- Test file creation failures and fallback behavior
- Test command execution errors and error propagation
- Test temp file cleanup on errors

#### 5. **Performance Testing**
- Mock timers for consistent performance testing
- Test performance tracking and metrics collection
- Verify performance comparison functionality

#### 6. **Integration Testing**
- Test end-to-end functionality with real Claude CLI (if available)
- Test streaming functionality with file inputs
- Verify compatibility with existing session management

### Test Execution Strategy

#### 1. **Unit Tests**
```bash
# Run single-stage specific unit tests
npm run test:unit -- --testPathPattern="single-stage"

# Run updated core tests
npm run test:unit -- src/core/wrapper.test.ts
npm run test:unit -- src/core/claude-resolver.test.ts
```

#### 2. **Integration Tests**
```bash
# Run streaming integration tests
npm run test:integration -- --testPathPattern="streaming"

# Run performance comparison tests
npm run test:integration -- --testPathPattern="performance"
```

#### 3. **Performance Tests**
```bash
# Run with performance comparison enabled
ENABLE_PERFORMANCE_COMPARISON=true npm run test:integration
```

### Test Coverage Requirements

- **Unit Tests**: 100% coverage for new methods and logic
- **Integration Tests**: End-to-end coverage for both approaches
- **Performance Tests**: Comparative analysis of both approaches
- **Error Handling**: Coverage of all error scenarios
- **Configuration Tests**: Coverage of all configuration options

## Conclusion

This implementation provides a way to test whether the single-stage file-based approach can improve performance for first-time system prompts while maintaining the option to use the existing two-stage optimization for repeated prompts.

The configuration-driven approach allows for easy A/B testing and performance comparison to determine the optimal strategy for different use cases. The comprehensive testing strategy ensures reliability and maintainability of the new functionality.