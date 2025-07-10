# CLAUDE.md System Prompt Optimization Implementation Plan

## Overview

This document outlines the implementation plan for optimizing system prompt handling by leveraging Claude Code CLI's automatic CLAUDE.md reading capability. This optimization aims to reduce request sizes from 40,000+ characters to ~20-50 characters, improving response times from 8+ seconds to 1-2 seconds.

## Current Problem

- **Large system prompts**: OpenAI clients send 40,000+ character system messages
- **Performance impact**: Each request takes 8+ seconds due to large prompt processing
- **Redundancy**: Same system prompt sent repeatedly in every request

## Proposed Solution

### Two-Stage Request Processing

**Stage 1: System Prompt Management**

- Extract system prompts from incoming OpenAI requests
- Send system prompt to Claude CLI with instruction to write to CLAUDE.md
- Wait for confirmation of successful save

**Stage 2: Optimized Request Processing**

- Strip system prompts from subsequent requests
- Send only user/assistant messages to Claude CLI
- Claude CLI automatically reads system context from CLAUDE.md

## Implementation Plan

### Phase 1: System Prompt Detection and Hashing

**Files to modify:**

- `src/core/wrapper.ts` - Add system prompt detection logic
- `src/core/claude-client.ts` - Add CLAUDE.md management calls

**Implementation steps:**

1. **System Prompt Detection**

   ```typescript
   private extractSystemPrompts(messages: OpenAIMessage[]): {
     systemPrompts: OpenAIMessage[],
     otherMessages: OpenAIMessage[]
   }
   ```

2. **Hash Management**

   ```typescript
   private getSystemPromptHash(content: string): string
   private hasSystemPromptChanged(newHash: string): boolean
   private updateStoredHash(hash: string): void
   ```

3. **State Tracking**
   - Store current system prompt hash in memory
   - Track when CLAUDE.md needs updating

### Phase 2: CLAUDE.md Management

**CLAUDE.md Section Structure:**

```markdown
# User's existing content

Some user instructions here...

<!-- CLAUDE_WRAPPER_SYSTEM_START -->

[System prompt content goes here]

<!-- CLAUDE_WRAPPER_SYSTEM_END -->

More user content...
```

**Implementation steps:**

1. **CLAUDE.md Update Request**

   ```typescript
   private async updateClaudeMd(systemContent: string): Promise<boolean>
   ```

   - Send request to Claude CLI with specific instructions:

     ```
     "Please update the CLAUDE.md file in the current directory. Find the section between
     '<!-- CLAUDE_WRAPPER_SYSTEM_START -->' and '<!-- CLAUDE_WRAPPER_SYSTEM_END -->'
     and replace only the content between those markers with:

     [system prompt content]

     If those markers don't exist, append them with the content to the end of the file.
     Do not modify any other content in the file."
     ```

   - Wait for Claude to execute file operation
   - Parse response to confirm successful save
   - Handle errors if write fails

### Phase 3: Request Processing Optimization

**Implementation steps:**

1. **Request Flow Logic**

   ```typescript
   async handleChatCompletion(request: OpenAIRequest): Promise<OpenAIResponse> {
     // Stage 1: System prompt management (if needed)
     if (hasSystemPromptChanged(request)) {
       await updateClaudeMd(systemPrompt);
     }

     // Stage 2: Optimized request processing
     const optimizedRequest = stripSystemPrompts(request);
     return await processOptimizedRequest(optimizedRequest);
   }
   ```

2. **Message Filtering**
   ```typescript
   private stripSystemPrompts(request: OpenAIRequest): OpenAIRequest
   ```
   - Remove all system role messages
   - Keep user, assistant, and tool messages
   - Maintain conversation flow

### Phase 4: Error Handling and Fallback

**Implementation steps:**

1. **CLAUDE.md Write Failure Handling**

   - If Claude fails to write CLAUDE.md, fall back to including system prompt in request
   - Log warning about performance impact
   - Retry CLAUDE.md write on next request

2. **Hash Mismatch Handling**

   - If stored hash doesn't match current system prompt, trigger update
   - Handle concurrent requests during CLAUDE.md update

3. **Missing CLAUDE.md Handling**
   - Detect if CLAUDE.md was manually deleted
   - Recreate from next system prompt

## Performance Expectations

### Before Optimization

- Request size: 40,000+ characters
- Response time: 8+ seconds
- Claude CLI processing: Large prompt parsing overhead

### After Optimization

- Request size: 20-50 characters (95%+ reduction)
- Response time: 1-2 seconds (75%+ improvement)
- Claude CLI processing: Minimal prompt + CLAUDE.md context

## Implementation Sequence

1. **Phase 1** (1-2 hours): System prompt detection and hashing
2. **Phase 2** (2-3 hours): CLAUDE.md management via Claude CLI
3. **Phase 3** (1-2 hours): Request processing optimization
4. **Phase 4** (1-2 hours): Error handling and testing

**Total estimated time: 5-9 hours**

## Testing Strategy

1. **Unit Tests**

   - System prompt extraction
   - Hash generation and comparison
   - Message filtering

2. **Integration Tests**

   - CLAUDE.md write operations
   - Request processing with/without system prompts
   - Error handling scenarios

3. **Performance Tests**
   - Measure request size reduction
   - Measure response time improvement
   - Load testing with concurrent requests

## Rollout Plan

1. **Development**: Implement behind feature flag
2. **Testing**: Validate with sample requests
3. **Staging**: Test with real system prompts
4. **Production**: Gradual rollout with monitoring

## Monitoring and Metrics

- **System prompt hash changes**: Track frequency of CLAUDE.md updates
- **Request size reduction**: Monitor average request size before/after
- **Response time improvement**: Track latency improvements
- **Error rates**: Monitor CLAUDE.md write failures

## Risk Mitigation

1. **CLAUDE.md corruption**: Validate content before writing
2. **Concurrent writes**: Queue CLAUDE.md updates
3. **Performance regression**: Maintain fallback to original behavior
4. **File system issues**: Handle disk space and permission errors

## Future Enhancements

1. **Multiple system prompt support**: Handle different system prompts per session
2. **CLAUDE.md versioning**: Track system prompt changes over time
3. **Compression**: Further optimize system prompt storage
4. **Distributed caching**: Share CLAUDE.md across multiple wrapper instances
