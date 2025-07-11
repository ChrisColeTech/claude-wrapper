# Stdin Implementation Plan for Large Prompt Handling

## Problem Statement
The wrapper is failing to handle large prompts due to command line length limits. This affects two critical scenarios:
1. **MCP tool call follow-ups** - Tool descriptions can be thousands of lines long
2. **Large user-submitted code files** - Users pasting entire codebases or large files

The current approach of using `echo` with command line arguments hits shell limits when processing these large contexts.

## Solution Overview
Implement stdin file approach using Claude CLI's `cat file | claude -p "query"` syntax to handle large prompts without command line length restrictions.

## Flow Diagram

```
┌─────────────────────┐
│   OpenAI Request    │
│   (with tools)      │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│  messagesToPrompt() │
│  - Convert messages │
│  - Add tool context │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│  Prompt Size Check  │
│  > 50KB threshold?  │
└──────────┬──────────┘
           │
      ┌────┴────┐
      │ YES     │ NO
      v         v
┌─────────────────────┐    ┌─────────────────────┐
│   STDIN APPROACH    │    │ COMMAND LINE ARGS   │
│                     │    │  (current method)   │
│ 1. Create temp file │    │                     │
│ 2. Write prompt     │    │ echo 'prompt' |     │
│ 3. Use cat | claude │    │ claude --flags      │
│ 4. Cleanup temp     │    │                     │
└─────────────────────┘    └─────────────────────┘
           │                         │
           └──────────┬──────────────┘
                      │
                      v
           ┌─────────────────────┐
           │   Claude Response   │
           └─────────────────────┘
```

## Implementation Details

### 1. Temporary File Management Utility
**File**: `/src/utils/temp-file-manager.ts`

```typescript
export class TempFileManager {
  private static tempDir = '/tmp/claude-wrapper';
  
  static async createTempFile(content: string): Promise<string>;
  static async cleanupTempFile(filePath: string): Promise<void>;
  static async ensureTempDirectory(): Promise<void>;
}
```

### 2. Execution Strategy Detection
**File**: `/src/core/claude-resolver.ts`

```typescript
private shouldUseStdin(prompt: string): boolean {
  // Use stdin for prompts > 50KB to avoid command line limits
  return prompt.length > 50 * 1024;
}
```

### 3. Stdin Execution Method
**File**: `/src/core/claude-resolver.ts`

```typescript
private async executeWithStdin(
  prompt: string, 
  claudeCmd: string, 
  flags: string
): Promise<string> {
  const tempFile = await TempFileManager.createTempFile(prompt);
  
  try {
    const command = `cat "${tempFile}" | ${claudeCmd} ${flags}`;
    const result = await execAsync(command, { ... });
    return result.stdout.trim();
  } finally {
    await TempFileManager.cleanupTempFile(tempFile);
  }
}
```

### 4. Modified executeClaudeCommandWithSession
**File**: `/src/core/claude-resolver.ts`

```typescript
async executeClaudeCommandWithSession(...): Promise<string> {
  const claudeCmd = await this.findClaudeCommand();
  const flags = this.buildCommandFlags(model, sessionId, useJsonOutput);
  
  // Strategy selection based on prompt size
  if (this.shouldUseStdin(prompt)) {
    return this.executeWithStdin(prompt, claudeCmd, flags);
  } else {
    return this.executeWithCommandLine(prompt, claudeCmd, flags);
  }
}
```

## Key Benefits

1. **Eliminates Command Line Length Limits**: No more shell argument length restrictions
2. **Handles Large MCP Tool Contexts**: Thousands of lines of tool descriptions work seamlessly  
3. **Handles Large User Code Files**: Multi-megabyte code files and entire codebases work without issues
4. **Performance**: File I/O is faster than extremely long command lines
5. **Memory Efficient**: Streams large content instead of loading into memory
6. **Backwards Compatible**: Small prompts still use efficient command line approach
7. **Universal Solution**: Works for any large content scenario (system prompts, user input, tool contexts)

## Implementation Steps

1. ✅ **Create temporary file management utility**
2. ✅ **Add execution strategy detection logic**
3. ✅ **Implement stdin execution method**
4. ✅ **Update claude-resolver to use new approach**
5. ✅ **Test with large MCP tool contexts**
6. ✅ **Test with large code file submissions**

## Testing Strategy

1. **Unit Tests**: Test temp file creation/cleanup
2. **Integration Tests**: Test both execution strategies
3. **Load Tests**: Test with various prompt sizes (1KB, 10KB, 50KB, 100KB+, 1MB+)
4. **MCP Tool Tests**: Test with real MCP tool contexts (large function definitions)
5. **Large Code File Tests**: Test with multi-megabyte code files and entire repositories
6. **Mixed Content Tests**: Test with large system prompts + large user input + large tool contexts
7. **Error Handling**: Test temp file cleanup on failures

## Error Handling

- **Temp File Creation Failures**: Fallback to command line if temp operations fail
- **Stdin Execution Failures**: Detailed error logging with file paths
- **Cleanup Failures**: Non-blocking cleanup with warnings
- **Permission Issues**: Clear error messages for temp directory access

## Performance Considerations

- **Threshold Tuning**: 50KB threshold may need adjustment based on testing
- **Temp File Location**: Use system temp directory for best I/O performance
- **Cleanup Strategy**: Immediate cleanup vs. batch cleanup for multiple requests
- **Memory Usage**: Stream large files rather than loading entirely into memory
- **Large File Handling**: Efficiently handle multi-megabyte user submissions
- **I/O Optimization**: Use buffered writes for large content
- **Concurrent Requests**: Handle multiple large requests simultaneously

## Security Considerations

- **Temp File Permissions**: Restrict temp file access to current user only
- **Cleanup Guarantees**: Ensure temp files are cleaned up even on crashes
- **Path Validation**: Validate temp file paths to prevent directory traversal
- **Content Sanitization**: Maintain existing prompt escaping for security