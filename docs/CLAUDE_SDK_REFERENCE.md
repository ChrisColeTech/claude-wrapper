# Claude Code SDK Reference - Node.js Integration Guide

This document provides specific guidance for integrating the Claude Code SDK into our Node.js/TypeScript wrapper, based on the Python implementation in `claude_cli.py`.

## 🎯 Our Use Case

The wrapper acts as a **translation layer** between OpenAI Chat Completions API format and Claude Code SDK calls. The SDK integration must exactly replicate the Python implementation behavior.

## 📦 Installation and Setup

### Node.js SDK Installation
```bash
npm install @anthropic-ai/claude-code
```

### TypeScript Integration
```typescript
import { query, ClaudeCodeOptions } from "@anthropic-ai/claude-code";
```

## 🔐 Authentication Integration

**Python Reference**: `claude_cli.py:19-36` (verify_cli function)

Our wrapper supports the same authentication methods as the Python version:

### 1. Anthropic API Key (Primary)
```typescript
// Environment variable: ANTHROPIC_API_KEY
// SDK automatically detects this
```

### 2. Amazon Bedrock
```typescript
// Environment variables:
// - AWS_ACCESS_KEY_ID
// - AWS_SECRET_ACCESS_KEY  
// - AWS_REGION
// - CLAUDE_CODE_USE_BEDROCK=1
```

### 3. Google Vertex AI
```typescript
// Environment variables:
// - GOOGLE_CLOUD_PROJECT
// - GOOGLE_CLOUD_REGION
// - CLAUDE_CODE_USE_VERTEX=1
```

### 4. Claude Code CLI
```typescript
// SDK inherits authentication from installed CLI
// No additional configuration needed
```

## 🚀 Core SDK Integration Pattern

**Python Reference**: `claude_cli.py:63-175` (run_completion method)

### Basic Query Execution
```typescript
interface ClaudeSDKWrapper {
  async executeQuery(
    prompt: string,
    options: ClaudeCodeOptions
  ): Promise<AsyncIterable<ClaudeMessage>>;
}

class ClaudeCodeClient implements ClaudeSDKWrapper {
  async executeQuery(
    prompt: string, 
    options: ClaudeCodeOptions
  ): Promise<AsyncIterable<ClaudeMessage>> {
    try {
      return query({
        prompt,
        options
      });
    } catch (error) {
      throw new ClaudeSDKError(`SDK execution failed: ${error.message}`);
    }
  }
}
```

## 📋 Parameter Mapping

**Python Reference**: `claude_cli.py:63-120` (parameter handling)

Map OpenAI request parameters to Claude Code SDK options:

```typescript
interface OpenAIToClaudeMapping {
  // OpenAI -> Claude Code SDK
  model: string;           // → options.model (if supported)
  messages: Message[];     // → prompt (converted via MessageAdapter)
  session_id?: string;     // → options.continue_conversation
  enable_tools?: boolean;  // → options.allowed_tools/disallowed_tools configuration
  
  // Custom headers → SDK options
  'X-Claude-Max-Turns'?: number;          // → options.max_turns
  'X-Claude-Allowed-Tools'?: string;      // → options.allowed_tools (comma-separated)
  'X-Claude-Disallowed-Tools'?: string;   // → options.disallowed_tools (comma-separated)
  'X-Claude-Permission-Mode'?: string;    // → options.permission_mode
  'X-Claude-Max-Thinking-Tokens'?: number; // → options.max_thinking_tokens
}

// Supported Claude Code Tools (11 tools total)
const CLAUDE_CODE_TOOLS = [
  'Task', 'Bash', 'Glob', 'Grep', 'LS', 'exit_plan_mode',
  'Read', 'Edit', 'MultiEdit', 'Write', 'NotebookRead', 
  'NotebookEdit', 'WebFetch', 'TodoRead', 'TodoWrite', 'WebSearch'
] as const;

function mapToClaudeOptions(request: OpenAIRequest): ClaudeCodeOptions {
  const options: ClaudeCodeOptions = {
    max_turns: request.headers['X-Claude-Max-Turns'] || (request.enable_tools ? 10 : 1),
    permission_mode: request.headers['X-Claude-Permission-Mode'],
    max_thinking_tokens: request.headers['X-Claude-Max-Thinking-Tokens'],
    continue_conversation: request.session_id,
    cwd: process.cwd()
  };

  // Tool configuration (matching Python logic)
  if (request.enable_tools === false) {
    // Default: disable all tools for OpenAI compatibility
    options.disallowed_tools = [...CLAUDE_CODE_TOOLS];
  } else if (request.enable_tools === true) {
    // User explicitly enabled tools
    if (request.headers['X-Claude-Allowed-Tools']) {
      options.allowed_tools = request.headers['X-Claude-Allowed-Tools'].split(',').map(t => t.trim());
    }
    if (request.headers['X-Claude-Disallowed-Tools']) {
      options.disallowed_tools = request.headers['X-Claude-Disallowed-Tools'].split(',').map(t => t.trim());
    }
  }

  return options;
}
```

## 🔄 Streaming Implementation

**Python Reference**: `claude_cli.py:63-175` (async generator pattern)

### Streaming Response Handler
```typescript
async function* processClaudeStream(
  claudeStream: AsyncIterable<ClaudeMessage>
): AsyncGenerator<OpenAIStreamChunk> {
  try {
    for await (const message of claudeStream) {
      // Parse Claude message
      const parsed = parseClaudeMessage(message);
      
      // Convert to OpenAI stream format
      const chunk = convertToOpenAIStreamChunk(parsed);
      
      yield chunk;
    }
  } catch (error) {
    throw new StreamingError(`Stream processing failed: ${error.message}`);
  }
}
```

## 📨 Message Processing

**Python Reference**: `claude_cli.py:177-236` (parse_claude_message)

### Response Parsing Pattern
```typescript
interface ClaudeMessageParser {
  parseMessage(rawMessage: any): ParsedClaudeMessage;
  extractContent(message: ParsedClaudeMessage): string;
  extractMetadata(message: ParsedClaudeMessage): ResponseMetadata;
}

class ClaudeMessageProcessor implements ClaudeMessageParser {
  parseMessage(rawMessage: any): ParsedClaudeMessage {
    // Replicate Python parsing logic exactly
    return {
      content: this.extractContent(rawMessage),
      metadata: this.extractMetadata(rawMessage),
      timestamp: new Date().toISOString()
    };
  }
  
  extractContent(message: ParsedClaudeMessage): string {
    // Apply same content filtering as Python version
    let content = message.raw_content;
    
    // Filter thinking blocks (message_adapter.py pattern)
    content = content.replace(/<thinking>.*?<\/thinking>/gs, '');
    
    // Filter tool usage blocks
    content = content.replace(/<tool_use>.*?<\/tool_use>/gs, '');
    
    return content.trim();
  }
}
```

## 🛠️ Configuration Options

**Python Reference**: `claude_cli.py:63-120` (options handling)

### Complete Options Interface
```typescript
interface ClaudeCodeOptions {
  // Core options from Python implementation
  model?: string;
  max_turns?: number;
  allowed_tools?: string[];
  disallowed_tools?: string[];
  permission_mode?: 'default' | 'acceptEdits' | 'bypassPermissions';
  max_thinking_tokens?: number;
  continue_conversation?: string;
  cwd?: string;
  
  // System prompt handling
  system_prompt?: string;
  
  // Resume functionality
  resume?: boolean;
}
```

## ⚠️ Error Handling

**Python Reference**: `claude_cli.py:19-61` (CLI verification and error handling)

### SDK Error Types
```typescript
class ClaudeSDKError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'ClaudeSDKError';
  }
}

class AuthenticationError extends ClaudeSDKError {
  constructor(message: string) {
    super(message, 'AUTHENTICATION_FAILED');
  }
}

class StreamingError extends ClaudeSDKError {
  constructor(message: string) {
    super(message, 'STREAMING_FAILED');
  }
}

// Error handling pattern
async function handleClaudeSDKCall<T>(
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error.message.includes('authentication')) {
      throw new AuthenticationError(`Claude Code authentication failed: ${error.message}`);
    }
    if (error.message.includes('stream')) {
      throw new StreamingError(`Streaming failed: ${error.message}`);
    }
    throw new ClaudeSDKError(`SDK operation failed: ${error.message}`);
  }
}
```

## 🔍 CLI Verification

**Python Reference**: `claude_cli.py:19-36` (verify_cli function)

### SDK Installation Verification
```typescript
async function verifyClaudeSDK(): Promise<VerificationResult> {
  try {
    // Test basic SDK functionality
    const testQuery = query({
      prompt: "Hello",
      options: { max_turns: 1 }
    });
    
    // Attempt to get first message
    const iterator = testQuery[Symbol.asyncIterator]();
    await iterator.next();
    
    return {
      available: true,
      version: await getSDKVersion(),
      authentication: await checkAuthentication()
    };
  } catch (error) {
    return {
      available: false,
      error: error.message,
      suggestion: "Install Claude Code SDK: npm install @anthropic-ai/claude-code"
    };
  }
}
```

## 📊 Usage Metadata Extraction

**Python Reference**: `claude_cli.py:177-236` (metadata extraction)

### Cost and Usage Tracking
```typescript
interface UsageMetadata {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost?: number;
  session_id?: string;
}

function extractUsageFromClaudeResponse(response: ParsedClaudeMessage): UsageMetadata {
  // Replicate Python token estimation logic
  const promptTokens = estimateTokens(response.original_prompt);
  const completionTokens = estimateTokens(response.content);
  
  return {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: promptTokens + completionTokens,
    session_id: response.session_id
  };
}
```

## 🎛️ Environment Configuration

**Python Reference**: All authentication methods from `auth.py`

### Required Environment Variables
```bash
# Primary authentication (choose one)
ANTHROPIC_API_KEY=your_key_here

# OR Bedrock
CLAUDE_CODE_USE_BEDROCK=1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1

# OR Vertex AI
CLAUDE_CODE_USE_VERTEX=1
GOOGLE_CLOUD_PROJECT=your_project
GOOGLE_CLOUD_REGION=us-central1

# Optional configurations
DEBUG_MODE=false
VERBOSE=false
MAX_TIMEOUT=600000
```

## 🧪 Testing the Integration

### SDK Integration Test
```typescript
async function testClaudeSDKIntegration(): Promise<void> {
  const client = new ClaudeCodeClient();
  
  try {
    const response = await client.executeQuery(
      "Write a simple hello world function",
      { max_turns: 1 }
    );
    
    for await (const message of response) {
      console.log('SDK Response:', message);
      break; // Test first message only
    }
    
    console.log('✅ Claude Code SDK integration successful');
  } catch (error) {
    console.error('❌ SDK integration failed:', error.message);
    throw error;
  }
}
```

## 📋 Implementation Checklist

When implementing Claude Code SDK integration:

- [ ] **Exact Parameter Mapping**: All Python `claude_cli.py` parameters mapped to SDK options
- [ ] **Authentication Parity**: Support same auth methods as Python version
- [ ] **Streaming Implementation**: Async iterator pattern matching Python async generator
- [ ] **Error Handling**: Same error types and messages as Python implementation  
- [ ] **Message Parsing**: Identical content filtering and metadata extraction
- [ ] **Usage Tracking**: Token estimation matching Python version
- [ ] **CLI Verification**: SDK availability check equivalent to Python CLI check

This reference ensures our Node.js wrapper maintains 100% feature parity with the Python implementation while leveraging the Claude Code SDK effectively.