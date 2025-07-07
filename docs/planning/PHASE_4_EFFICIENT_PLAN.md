# Phase 4: Efficient Implementation Plan

## 🎯 **Simple Goal**
Convert OpenAI tools format ↔ Claude Code CLI format. Client executes tools. No server-side execution.

## 📋 **Step-by-Step Implementation**

### **Step 1: Claude Service Tool Support**
**File**: `/app/src/claude/service.ts`

**Change**: Update `createChatCompletion` and `createStreamingChatCompletion` methods

```typescript
// Add to options preparation:
if (request.tools?.length > 0) {
  const toolNames = request.tools.map(t => t.function.name);
  options.allowed_tools = toolNames;
  
  if (request.tool_choice === 'none') {
    options.disallowed_tools = ['*'];
  } else if (typeof request.tool_choice === 'object') {
    options.allowed_tools = [request.tool_choice.function.name];
  }
}
```

**Test**: Verify tools are passed to Claude CLI correctly.

### **Step 2: Tool Response Conversion**
**File**: `/app/src/message/adapter.ts`

**Change**: Add method to detect Claude's tool_use blocks and convert to OpenAI format

```typescript
static convertToolUseToOpenAI(claudeContent: any[]): {content: string, tool_calls?: any[]} {
  const textParts = [];
  const toolCalls = [];
  
  for (const block of claudeContent) {
    if (block.type === 'tool_use') {
      toolCalls.push({
        id: `call_${block.id}`,
        type: 'function',
        function: {
          name: block.name,
          arguments: JSON.stringify(block.input)
        }
      });
    } else if (block.type === 'text') {
      textParts.push(block.text);
    }
  }
  
  const result = { content: textParts.join('') };
  if (toolCalls.length > 0) result.tool_calls = toolCalls;
  return result;
}
```

**Test**: Verify tool_use blocks convert to OpenAI format.

### **Step 3: Integrate Response Parsing**
**File**: `/app/src/claude/parser.ts`

**Change**: Add method to preserve raw content for tool detection

```typescript
static getRawContent(messages: ClaudeCodeMessage[]): any {
  for (const msg of messages) {
    if (msg.content && Array.isArray(msg.content)) {
      return msg.content;
    }
  }
  return null;
}
```

**Update service to use raw content for tool detection**

**Test**: Verify raw content preserves tool_use blocks.

### **Step 4: Update Chat Route**
**File**: `/app/src/routes/chat.ts`

**Change**: Use tool-aware response conversion

```typescript
// In handleNonStreamingResponse:
const claudeResponse = await claudeService.createChatCompletion(request);

// Check if response has tool_use blocks
const rawContent = claudeResponse.rawContent;
if (Array.isArray(rawContent)) {
  const toolResult = MessageAdapter.convertToolUseToOpenAI(rawContent);
  const openaiResponse = {
    // ... standard response structure
    choices: [{
      message: {
        role: 'assistant',
        content: toolResult.content,
        ...(toolResult.tool_calls && { tool_calls: toolResult.tool_calls })
      },
      finish_reason: toolResult.tool_calls ? 'tool_calls' : 'stop'
    }]
  };
  res.json(openaiResponse);
} else {
  // Standard text response
  const openaiResponse = MessageAdapter.convertToOpenAIFormat(claudeResponse.content, request.model);
  res.json(openaiResponse);
}
```

**Test**: End-to-end tool request/response cycle.

## 🧪 **Testing Implementation**

### **Unit Tests**

#### **File**: `/app/tests/unit/message/adapter-tools.test.ts`
```typescript
describe('MessageAdapter Tool Conversion', () => {
  it('should convert Claude tool_use to OpenAI format', () => {
    const claudeContent = [
      { type: 'text', text: 'I\'ll help you with that.' },
      { 
        type: 'tool_use', 
        id: 'abc123', 
        name: 'list_files', 
        input: { path: '.' } 
      }
    ];
    
    const result = MessageAdapter.convertToolUseToOpenAI(claudeContent);
    
    expect(result.content).toBe('I\'ll help you with that.');
    expect(result.tool_calls).toHaveLength(1);
    expect(result.tool_calls[0]).toEqual({
      id: 'call_abc123',
      type: 'function',
      function: {
        name: 'list_files',
        arguments: '{"path":"."}'
      }
    });
  });

  it('should handle text-only responses', () => {
    const claudeContent = [{ type: 'text', text: 'Hello world' }];
    const result = MessageAdapter.convertToolUseToOpenAI(claudeContent);
    
    expect(result.content).toBe('Hello world');
    expect(result.tool_calls).toBeUndefined();
  });
});
```

#### **File**: `/app/tests/unit/claude/service-tools.test.ts`
```typescript
describe('Claude Service Tool Support', () => {
  it('should pass tools to Claude CLI options', async () => {
    const request = {
      model: 'claude-3-5-sonnet-20241022',
      messages: [{ role: 'user', content: 'test' }],
      tools: [{ type: 'function', function: { name: 'test_tool' } }]
    };

    const mockSDKClient = { runCompletion: jest.fn() };
    // Test that allowed_tools includes 'test_tool'
  });

  it('should handle tool_choice="none"', async () => {
    const request = {
      // ... with tool_choice: 'none'
    };
    // Test that disallowed_tools includes '*'
  });
});
```

### **Integration Tests**

#### **File**: `/app/tests/integration/tools/tools-basic.test.ts`
```typescript
describe('Tools Integration', () => {
  it('should handle complete tool request cycle', async () => {
    const response = await request(app)
      .post('/v1/chat/completions')
      .send({
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'List files in current directory' }],
        tools: [{
          type: 'function',
          function: {
            name: 'list_files',
            description: 'List files in a directory',
            parameters: {
              type: 'object',
              properties: {
                path: { type: 'string' }
              }
            }
          }
        }]
      });

    expect(response.status).toBe(200);
    expect(response.body.choices[0].message).toHaveProperty('role', 'assistant');
    
    // Should have either tool_calls OR content, not necessarily tool_calls
    const message = response.body.choices[0].message;
    expect(message.content || message.tool_calls).toBeTruthy();
  });

  it('should work without tools (regression test)', async () => {
    const response = await request(app)
      .post('/v1/chat/completions')
      .send({
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'Hello' }]
      });

    expect(response.status).toBe(200);
    expect(response.body.choices[0].message.content).toBeTruthy();
    expect(response.body.choices[0].finish_reason).toBe('stop');
  });

  it('should handle tool_choice parameter', async () => {
    // Test with tool_choice: 'none'
    // Test with tool_choice: { type: 'function', function: { name: 'specific_tool' } }
  });
});
```

### **Manual API Tests (quick verification)**

#### **Test Case 1**: Basic tool request
```bash
curl -X POST localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [{"role": "user", "content": "List files"}],
    "tools": [{"type": "function", "function": {"name": "list_files"}}]
  }'
```

**Expected**: Valid OpenAI response (may or may not contain tool_calls)

#### **Test Case 2**: tool_choice="none"
```bash
curl -X POST localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet-20241022", 
    "messages": [{"role": "user", "content": "Hello"}],
    "tools": [{"type": "function", "function": {"name": "list_files"}}],
    "tool_choice": "none"
  }'
```

**Expected**: Regular text response, no tool_calls

#### **Test Case 3**: No tools (regression)
```bash
curl -X POST localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

**Expected**: Regular text response

### **Test Running**
```bash
# Run unit tests
npm run test:unit

# Run integration tests  
npm run test:integration

# Manual API test
npm start
# Then run curl commands above
```

## 🚀 **That's It**

**Total Changes:**
- 4 files modified
- ~20 lines of actual code

**What NOT to do:**
- ❌ No pattern detection
- ❌ No complex tool mapping
- ❌ No intent parsing  
- ❌ No server-side execution
- ❌ No sophisticated test frameworks

**Simple principle**: 
OpenAI format → Claude format → Claude response → OpenAI format

## ✅ **Done Criteria**
1. Client can send OpenAI tools format
2. Tools passed to Claude CLI
3. Claude tool_use blocks converted to OpenAI tool_calls
4. Client receives proper OpenAI response
5. Basic test passes

**Keep it simple - format conversion only.**