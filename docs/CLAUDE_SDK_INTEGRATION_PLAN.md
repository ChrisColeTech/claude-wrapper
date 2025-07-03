# Claude Code SDK Integration Implementation Plan

## Executive Summary

This document outlines the comprehensive implementation plan for integrating the Claude Code Node.js SDK into the claude-wrapper project. The current implementation uses mock responses and requires a complete Claude SDK integration to provide actual AI functionality.

## Current State Analysis

**✅ Working Components:**
- Server startup and daemon management (`claude-wrapper --start/--stop/--status`)
- Authentication detection (simplified to match Python behavior)
- OpenAI-compatible API structure and routing
- Request validation and parameter processing
- Session management framework
- Message processing pipeline
- Enhanced CLI with progress indicators and troubleshooting

**❌ Missing Critical Component:**
- **Actual Claude Code SDK integration** - Currently using hardcoded mock responses
- **Real Claude API calls** - All responses return "Hello! How can I help you today?"

## Implementation Phases

### Phase 1: Claude Service Foundation
**Goal:** Create the core Claude service interface and basic SDK integration

**Reference:** [CLAUDE_SDK_REFERENCE.md sections: Authentication Integration, Core SDK Integration Pattern, CLI Verification](./CLAUDE_SDK_REFERENCE.md#-authentication-integration)

**Files to Create:**
- `src/claude/sdk-client.ts` - Direct Claude Code SDK wrapper implementing the patterns from CLAUDE_SDK_REFERENCE.md
- `src/claude/interfaces.ts` - Claude service interfaces and types matching Python `claude_cli.py`
- `src/claude/error-types.ts` - Error classes (ClaudeSDKError, AuthenticationError, StreamingError)
- `tests/unit/claude/sdk-client.test.ts` - SDK client unit tests
- `tests/integration/claude/basic-integration.test.ts` - Basic integration tests using SDK verification pattern

**Files to Update:**
- `src/claude/service.ts` - Replace mock `createCompletion` with actual SDK calls
- `src/claude/index.ts` - Export new SDK client and interfaces
- `package.json` - Add Claude Code SDK dependency: `@anthropic-ai/claude-code: ^1.0.41`

**SDK Reference Implementation:**
```typescript
// Based on CLAUDE_SDK_REFERENCE.md: ClaudeSDKWrapper interface
import { query, ClaudeCodeOptions } from "@anthropic-ai/claude-code";

class ClaudeCodeClient implements ClaudeSDKWrapper {
  async executeQuery(prompt: string, options: ClaudeCodeOptions): Promise<AsyncIterable<ClaudeMessage>> {
    return handleClaudeSDKCall(() => query({ prompt, options }));
  }
}
```

**Test Requirements:**
- ✅ SDK client can be instantiated with different auth methods
- ✅ Basic text completion works (simple prompt → response)
- ✅ Error handling for authentication failures using patterns from CLAUDE_SDK_REFERENCE.md
- ✅ Connection timeout handling
- ✅ SDK verification function works (based on verifyClaudeSDK pattern)

**Acceptance Criteria:**
- Single-turn text completion working with actual Claude
- Proper error handling and logging matching Python patterns
- 100% test coverage for new components

---

### Phase 2: Message Format Conversion
**Goal:** Implement proper OpenAI ↔ Claude message format conversion

**Reference:** [CLAUDE_SDK_REFERENCE.md sections: Parameter Mapping, Message Processing](./CLAUDE_SDK_REFERENCE.md#-parameter-mapping)

**Files to Create:**
- `src/message/claude-converter.ts` - OpenAI to Claude format conversion implementing OpenAIToClaudeMapping
- `src/message/openai-converter.ts` - Claude to OpenAI format conversion
- `src/message/message-parser.ts` - Claude message parsing using ClaudeMessageProcessor pattern
- `tests/unit/message/claude-converter.test.ts` - Conversion logic tests
- `tests/unit/message/openai-converter.test.ts` - OpenAI format tests
- `tests/unit/message/message-parser.test.ts` - Message parsing tests

**Files to Update:**
- `src/services/message-service.ts` - Use new converters and implement extractContent filtering
- `src/routes/chat.ts` - Remove mock response, use real conversion and mapToClaudeOptions

**SDK Reference Implementation:**
```typescript
// Based on CLAUDE_SDK_REFERENCE.md: Parameter Mapping
function mapToClaudeOptions(request: OpenAIRequest): ClaudeCodeOptions {
  const options: ClaudeCodeOptions = {
    max_turns: request.headers['X-Claude-Max-Turns'] || (request.enable_tools ? 10 : 1),
    permission_mode: request.headers['X-Claude-Permission-Mode'],
    continue_conversation: request.session_id,
    cwd: process.cwd()
  };
  
  // Tool configuration matching Python logic
  if (request.enable_tools === false) {
    options.disallowed_tools = [...CLAUDE_CODE_TOOLS];
  }
  
  return options;
}

// Based on CLAUDE_SDK_REFERENCE.md: ClaudeMessageProcessor
class ClaudeMessageProcessor {
  extractContent(message: ParsedClaudeMessage): string {
    let content = message.raw_content;
    content = content.replace(/<thinking>.*?<\/thinking>/gs, '');
    content = content.replace(/<tool_use>.*?<\/tool_use>/gs, '');
    return content.trim();
  }
}
```

**Test Requirements:**
- ✅ OpenAI messages convert correctly to Claude format using mapToClaudeOptions
- ✅ Claude responses convert correctly to OpenAI format
- ✅ System messages handled properly
- ✅ Multi-turn conversations preserved with continue_conversation
- ✅ Content filtering works (thinking blocks, tool usage) matching Python patterns
- ✅ Edge cases (empty messages, special characters)

**Acceptance Criteria:**
- Chat completion returns actual Claude responses (not mock data)
- Message history preserved correctly with session continuity
- All message formats handled properly matching Python behavior

---

### Phase 3: Model Selection and Validation
**Goal:** Implement proper model selection and validation with Claude SDK

**Reference:** [CLAUDE_SDK_REFERENCE.md sections: Configuration Options](./CLAUDE_SDK_REFERENCE.md#-configuration-options)

**Files to Create:**
- `src/claude/model-manager.ts` - Model validation and selection
- `src/claude/model-config.ts` - Model configurations and capabilities
- `tests/unit/claude/model-manager.test.ts` - Model management tests

**Files to Update:**
- `src/validation/validator.ts` - Use actual model validation against Claude SDK capabilities
- `src/routes/models.ts` - Return actual available models from SDK
- `src/claude/service.ts` - Add model parameter to SDK calls

**Test Requirements:**
- ✅ Model validation against actual Claude SDK capabilities
- ✅ Model selection works correctly and affects Claude behavior
- ✅ Invalid model requests rejected with proper errors
- ✅ Default model fallback behavior matches Python patterns

**Acceptance Criteria:**
- Only valid Claude models accepted (claude-3-5-sonnet-20241022, etc.)
- Model selection affects actual Claude behavior
- Proper error messages for invalid models

---

### Phase 4: Non-Streaming Completions
**Goal:** Complete non-streaming chat completions with full SDK integration

**Reference:** [CLAUDE_SDK_REFERENCE.md sections: Core SDK Integration Pattern, Usage Metadata Extraction](./CLAUDE_SDK_REFERENCE.md#-core-sdk-integration-pattern)

**Files to Create:**
- `src/claude/completion-manager.ts` - Non-streaming completion logic using executeQuery pattern
- `src/claude/metadata-extractor.ts` - Token and cost extraction using extractUsageFromClaudeResponse
- `tests/integration/claude/non-streaming.test.ts` - Non-streaming integration tests
- `tests/e2e/chat/basic-completions.test.ts` - End-to-end completion tests

**Files to Update:**
- `src/claude/service.ts` - Implement real `createCompletion` method using SDK
- `src/routes/chat.ts` - Remove all mock logic from non-streaming path

**SDK Reference Implementation:**
```typescript
// Based on CLAUDE_SDK_REFERENCE.md: Usage Metadata Extraction
function extractUsageFromClaudeResponse(response: ParsedClaudeMessage): UsageMetadata {
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

**Test Requirements:**
- ✅ Simple Q&A completions work correctly (e.g., "What is 2+2?" → "4")
- ✅ Multi-turn conversations work with session continuity
- ✅ Token counting is accurate using extractUsageFromClaudeResponse pattern
- ✅ Response timing and metadata correct
- ✅ Error scenarios handled properly using ClaudeSDKError types

**Acceptance Criteria:**
- Non-streaming completions fully functional (replaces mock responses)
- Accurate token and cost reporting matching Python patterns
- Proper session continuity with continue_conversation option

---

### Phase 5: Streaming Completions
**Goal:** Implement real-time streaming responses

**Reference:** [CLAUDE_SDK_REFERENCE.md sections: Streaming Implementation](./CLAUDE_SDK_REFERENCE.md#-streaming-implementation)

**Files to Create:**
- `src/claude/streaming-manager.ts` - Streaming completion logic using processClaudeStream pattern
- `src/claude/sse-formatter.ts` - Server-Sent Events formatting for OpenAI compatibility
- `tests/integration/claude/streaming.test.ts` - Streaming integration tests
- `tests/e2e/chat/streaming-completions.test.ts` - End-to-end streaming tests

**Files to Update:**
- `src/claude/service.ts` - Implement `createStreamingChatCompletion` method
- `src/routes/chat.ts` - Replace mock streaming logic with real SDK calls

**SDK Reference Implementation:**
```typescript
// Based on CLAUDE_SDK_REFERENCE.md: Streaming Response Handler
async function* processClaudeStream(
  claudeStream: AsyncIterable<ClaudeMessage>
): AsyncGenerator<OpenAIStreamChunk> {
  try {
    for await (const message of claudeStream) {
      const parsed = parseClaudeMessage(message);
      const chunk = convertToOpenAIStreamChunk(parsed);
      yield chunk;
    }
  } catch (error) {
    throw new StreamingError(`Stream processing failed: ${error.message}`);
  }
}
```

**Test Requirements:**
- ✅ Streaming responses work in real-time with actual Claude
- ✅ Proper SSE formatting and chunking for OpenAI compatibility
- ✅ Stream termination handled correctly
- ✅ Error handling during streaming using StreamingError
- ✅ Client disconnection handling

**Acceptance Criteria:**
- Streaming completions work with real Claude responses (no mock data)
- Proper OpenAI-compatible streaming format
- Robust error handling and connection management

---

### Phase 6: Tools Integration (Optional - Disabled by Default)
**Goal:** Support Claude Code tools when explicitly enabled

**Reference:** [CLAUDE_SDK_REFERENCE.md sections: Parameter Mapping (tools configuration)](./CLAUDE_SDK_REFERENCE.md#-parameter-mapping)

**Files to Create:**
- `src/tools/claude-tools-manager.ts` - Claude tools integration using CLAUDE_CODE_TOOLS
- `src/tools/tools-converter.ts` - OpenAI ↔ Claude tools format conversion
- `tests/unit/tools/claude-tools-manager.test.ts` - Tools management tests
- `tests/integration/tools/tools-integration.test.ts` - Tools integration tests

**Files to Update:**
- `src/claude/service.ts` - Add tools support using allowed_tools/disallowed_tools options
- `src/routes/chat.ts` - Handle `enable_tools` parameter with proper tool configuration

**SDK Reference Implementation:**
```typescript
// Based on CLAUDE_SDK_REFERENCE.md: Tool configuration
const CLAUDE_CODE_TOOLS = [
  'Task', 'Bash', 'Glob', 'Grep', 'LS', 'exit_plan_mode',
  'Read', 'Edit', 'MultiEdit', 'Write', 'NotebookRead', 
  'NotebookEdit', 'WebFetch', 'TodoRead', 'TodoWrite', 'WebSearch'
] as const;

// Default: disable all tools for OpenAI compatibility
if (request.enable_tools === false) {
  options.disallowed_tools = [...CLAUDE_CODE_TOOLS];
}
```

**Test Requirements:**
- ✅ Tools disabled by default (OpenAI compatibility)
- ✅ Tools work when explicitly enabled via enable_tools=true
- ✅ Custom tool configuration via X-Claude-Allowed-Tools header
- ✅ Tool responses formatted correctly
- ✅ Tool errors handled gracefully

**Acceptance Criteria:**
- Tools integration working when enabled
- Maintains OpenAI compatibility (disabled by default)
- Proper tool response formatting and filtering

---

### Phase 7: Advanced Features Integration
**Goal:** Implement advanced Claude SDK features (system prompts, advanced options)

**Reference:** [CLAUDE_SDK_REFERENCE.md sections: Configuration Options, Environment Configuration](./CLAUDE_SDK_REFERENCE.md#-configuration-options)

**Files to Create:**
- `src/claude/advanced-options.ts` - Advanced Claude options handling
- `src/claude/system-prompt-manager.ts` - System prompt management
- `src/claude/header-processor.ts` - Custom Claude headers processing
- `tests/unit/claude/advanced-options.test.ts` - Advanced options tests

**Files to Update:**
- `src/claude/service.ts` - Support all advanced Claude options from ClaudeCodeOptions interface
- `src/routes/chat.ts` - Handle Claude-specific headers and options
- `src/validation/headers.ts` - Process X-Claude-* headers

**SDK Reference Implementation:**
```typescript
// Based on CLAUDE_SDK_REFERENCE.md: Complete Options Interface
interface ClaudeCodeOptions {
  model?: string;
  max_turns?: number;
  allowed_tools?: string[];
  disallowed_tools?: string[];
  permission_mode?: 'default' | 'acceptEdits' | 'bypassPermissions';
  max_thinking_tokens?: number;
  continue_conversation?: string;
  cwd?: string;
  system_prompt?: string;
  resume?: boolean;
}
```

**Test Requirements:**
- ✅ System prompts work correctly
- ✅ Claude-specific options (max_turns, permission_mode, etc.) work
- ✅ Custom headers processed properly (X-Claude-Max-Turns, etc.)
- ✅ Advanced configuration options supported
- ✅ Environment variables handled per CLAUDE_SDK_REFERENCE.md

**Acceptance Criteria:**
- Full Claude SDK feature parity with Python implementation
- Advanced options working correctly
- Comprehensive Claude integration matching CLAUDE_SDK_REFERENCE.md patterns

---

### Phase 8: Production Hardening
**Goal:** Production-ready error handling, monitoring, and performance

**Reference:** [CLAUDE_SDK_REFERENCE.md sections: Error Handling, CLI Verification](./CLAUDE_SDK_REFERENCE.md#-error-handling)

**Files to Create:**
- `src/claude/error-handler.ts` - Comprehensive Claude error handling using error types from reference
- `src/claude/metrics-collector.ts` - Claude SDK metrics and monitoring
- `src/claude/retry-manager.ts` - Retry logic for Claude API
- `src/claude/verification.ts` - SDK verification using verifyClaudeSDK pattern
- `tests/unit/claude/error-handler.test.ts` - Error handling tests
- `tests/unit/claude/retry-manager.test.ts` - Retry logic tests

**Files to Update:**
- `src/claude/service.ts` - Add retry logic and comprehensive error handling
- `src/utils/logger.ts` - Add Claude-specific logging
- `src/monitoring/health-check.ts` - Add Claude health checks using verification

**SDK Reference Implementation:**
```typescript
// Based on CLAUDE_SDK_REFERENCE.md: Error Types and Handling
async function handleClaudeSDKCall<T>(operation: () => Promise<T>): Promise<T> {
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

**Test Requirements:**
- ✅ Comprehensive error scenarios covered using SDK error types
- ✅ Retry logic works correctly
- ✅ Performance monitoring functional
- ✅ Health checks include Claude status using verifyClaudeSDK
- ✅ Rate limiting and throttling handled

**Acceptance Criteria:**
- Production-ready error handling matching Python patterns
- Comprehensive monitoring and metrics
- Robust retry and failover logic

---

## Dependencies and Prerequisites

### Required Dependencies
```json
{
  "@anthropic-ai/claude-code": "^1.0.41",
  "uuid": "^9.0.0",
  "@types/uuid": "^9.0.0"
}
```

### Environment Setup (per CLAUDE_SDK_REFERENCE.md)
- Ensure Claude Code CLI is installed and authenticated
- OR ensure ANTHROPIC_API_KEY is set
- OR ensure cloud provider credentials (AWS/GCP) are configured with proper flags:
  - `CLAUDE_CODE_USE_BEDROCK=1` for AWS
  - `CLAUDE_CODE_USE_VERTEX=1` for GCP

## Testing Strategy

### Unit Tests (Per Phase)
- **Coverage Target:** 95%+ for new code
- **Test Framework:** Jest
- **Mock Strategy:** Mock external SDK calls, test business logic
- **Reference Implementation:** Follow patterns from CLAUDE_SDK_REFERENCE.md

### Integration Tests (Per Phase)
- **Coverage Target:** All major code paths
- **Environment:** Test against actual Claude SDK (with test limits)
- **Focus:** End-to-end SDK integration using verification patterns

### End-to-End Tests (Final Phases)
- **Coverage Target:** All user scenarios
- **Environment:** Full server stack with real Claude integration
- **Focus:** OpenAI compatibility and user experience

## Success Metrics

### Phase Success Criteria
1. **All tests pass** (100% pass rate)
2. **Code coverage** meets targets (95%+ for new code)
3. **Integration tests** work with real Claude SDK
4. **Performance benchmarks** met (response time < 2s for simple completions)
5. **SDK Reference compliance** - all patterns from CLAUDE_SDK_REFERENCE.md implemented

### Final Success Criteria
1. **Full OpenAI API compatibility** - existing OpenAI clients work seamlessly
2. **Actual Claude responses** - no more mock data, real AI responses
3. **Session continuity** - multi-turn conversations work correctly
4. **Production readiness** - error handling, monitoring, logging complete
5. **Python feature parity** - matches all functionality from Python implementation

## Implementation Timeline

- **Phase 1-2:** Foundation and Message Conversion (Week 1)
- **Phase 3-4:** Model Selection and Non-Streaming (Week 2) 
- **Phase 5:** Streaming Completions (Week 3)
- **Phase 6-7:** Advanced Features (Week 4)
- **Phase 8:** Production Hardening (Week 5)

Each phase must be **100% complete with passing tests** before proceeding to the next phase.

## References

- [CLAUDE_SDK_REFERENCE.md](./CLAUDE_SDK_REFERENCE.md) - Complete SDK integration patterns
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Project architecture guidelines
- [TESTING.md](./TESTING.md) - Testing standards and practices
- Python implementation in `claude-code-openai-wrapper` project - behavior reference