# Phase 06A & 06B: Tools Integration (Optional - Disabled by Default)

## Phase 06A: Tools Integration (Optional - Disabled by Default) Implementation
**Goal**: Support Claude Code tools when explicitly enabled  
**Complete Feature**: Complete tools integration with Claude SDK (disabled by default)  
**Dependencies**: Phase 05B must be 100% complete with all tests passing
**Claude SDK Reference**: Based on CLAUDE_SDK_REFERENCE.md: Parameter Mapping (tools configuration)
**Performance Requirement**: Tool-enabled completion response <5s with tools processing

### Files to Create/Update
```
CREATE: src/tools/claude-tools-manager.ts - Claude tools integration using CLAUDE_CODE_TOOLS
CREATE: src/tools/tools-converter.ts - OpenAI ↔ Claude tools format conversion
CREATE: tests/unit/tools/claude-tools-manager.test.ts - Tools management tests
CREATE: tests/integration/tools/tools-integration.test.ts - Tools integration tests
UPDATE: src/claude/service.ts - Add tools support using allowed_tools/disallowed_tools options
UPDATE: src/routes/chat.ts - Handle enable_tools parameter with proper tool configuration
```

### What Gets Implemented
- Tools disabled by default for OpenAI compatibility (disallowed_tools = all tools)
- Tools integration using Claude SDK allowed_tools/disallowed_tools options
- Support for all Claude Code tools when explicitly enabled
- Custom tool configuration via X-Claude-Allowed-Tools header
- Tool response formatting and content filtering
- Error handling for tool operation failures
- Tool call result processing and OpenAI format conversion
- Named constants for all tool configurations and tool lists

### Architecture Compliance Requirements (MANDATORY)
- **SOLID Principles**: 
  - **SRP**: ClaudeToolsManager handles only tools management operations (<200 lines)
  - **OCP**: Extensible for new tools integration strategies via strategy pattern
  - **LSP**: All tools handlers implement IClaudeToolsManager interface consistently
  - **ISP**: Separate interfaces for IToolsConverter, IToolsConfig
  - **DIP**: Depend on IStreamingManager and streaming abstractions from prior phases
- **File Size Limits**: All files <200 lines, functions <50 lines, max 5 parameters
- **DRY Compliance**: Extract common tools integration patterns to ToolsUtils
- **No Magic Values**: All tools values and configuration in src/claude/constants.ts
- **Error Handling**: Consistent ToolsError with specific tools operation status information
- **TypeScript Strict**: All tools handlers code passes strict TypeScript compilation
- **Interface Design**: Maximum 5 methods per interface, single-purpose interfaces

### Anti-Pattern Prevention (MANDATORY)
- **No God Classes**: ClaudeToolsManager <200 lines, focused on tools integration only
- **No Deep Nesting**: Maximum 3 levels in tools management logic, use early returns
- **No Inline Complex Logic**: Extract tools processing rules to named methods
- **No Hardcoded Values**: All tools configuration and management in constants
- **No Magic Values**: Use CLAUDE_CODE_TOOLS.ALL, TOOLS_CONFIG.DISABLED_BY_DEFAULT

### Testing Requirements (MANDATORY)
- **100% test coverage** for all tools integration logic before proceeding to Phase 06B
- **Unit tests**: ClaudeToolsManager, tools conversion, configuration edge cases
- **Integration tests**: Tools integration with complete Claude SDK
- **Mock objects**: Mock IStreamingManager, tools services for testing
- **Error scenario tests**: Tool failures, configuration errors, tools processing issues
- **Performance tests**: Tool-enabled completion response <5s with tools processing

### Quality Gates for Phase 06A Completion
- ✅ All SOLID principles followed (verified via code review checklist)
- ✅ No anti-patterns present (ESLint max-lines, complexity, depth rules pass)
- ✅ 100% test coverage achieved (Jest coverage report)
- ✅ **All tests must pass** before proceeding to Phase 06B (unit + integration + performance)
- ✅ TypeScript strict mode passes (tsc --strict --noEmit)
- ✅ ESLint passes without warnings (npm run lint)
- ✅ tools integration demonstrable (integration test passing)
- ✅ Claude SDK compatibility verified (tools integration maintains OpenAI compatibility (disabled by default))
- ✅ Performance criteria met (tool-enabled completion response <5s with tools processing)

### Claude SDK Compatibility Verification
- ✅ Tools disabled by default (OpenAI compatibility)
- ✅ Tools work when explicitly enabled via enable_tools=true
- ✅ Custom tool configuration via X-Claude-Allowed-Tools header
- ✅ Tool responses formatted correctly
- ✅ Tool errors handled gracefully

### Testable Features
- Tools integration working when enabled
- Maintains OpenAI compatibility (disabled by default)
- Proper tool response formatting and filtering
- Custom tool configuration through headers
- Tool error handling and graceful degradation
- **Ready for immediate demonstration** with tools integration examples

---

## Phase 06B: Tools Integration (Optional - Disabled by Default) - Comprehensive Review
**Goal**: Ensure 100% tools integration compatibility and production-quality implementation
**Review Focus**: Tools functionality, default disabled behavior, error handling
**Dependencies**: Phase 06A must be 100% complete with all tests passing
**Reference Standards**: `docs/CLAUDE_SDK_REFERENCE.md`, `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION_RULES.md`

### Comprehensive Review Requirements (MANDATORY)

#### 1. Tools Integration Audit
- **Tools functionality** must work correctly when enabled
- **Default behavior** must disable tools for OpenAI compatibility
- **Configuration management** must handle tool selection properly
- **Error handling** must handle tool failures gracefully
- **Format compatibility** must maintain OpenAI tool response structure

#### 2. Test Quality Review
- **Replace ALL placeholder tests** with real tools integration functionality tests
- **Tools tests**: Test tools functionality when enabled
- **Default tests**: Test tools disabled by default behavior
- **Configuration tests**: Test tool configuration and selection
- **Error tests**: Test tool error scenarios and handling
- **Format tests**: Test tool response format compatibility

#### 3. Integration Validation
- **SDK Integration**: Verify tools work with Claude SDK
- **Streaming Integration**: Verify tools work with streaming completions
- **Configuration Integration**: Verify tool configuration works correctly
- **Error Integration**: Verify tool error handling works across system

#### 4. Architecture Compliance Review
- **Single Responsibility**: tools handlers components have single purposes
- **Dependency Injection**: ClaudeToolsManager depend on abstractions, not concrete implementations
- **Interface Segregation**: IToolsConverter, IToolsConfig interfaces are focused (max 5 methods)
- **Error Handling**: Consistent ToolsError formatting
- **File Size Compliance**: All files under 200 lines, functions under 50 lines
- **DRY Compliance**: No duplicate tools management logic

#### 5. Performance Validation
- **Tools performance**: <5s for tool-enabled completions with processing
- **Configuration performance**: Fast tool configuration and selection
- **Error handling performance**: Minimal overhead for tool error handling
- **Response processing**: Efficient tool response formatting and filtering

#### 6. Documentation Review
- **Tools documentation**: Document Claude tools integration and usage
- **Configuration guide**: Document tool configuration and selection
- **Error guide**: Document tool error handling and troubleshooting
- **Compatibility guide**: Document OpenAI compatibility with tools disabled

### Quality Gates for Phase 06B Completion
- ✅ **100% tools integration functionality verified**
- ✅ **All tools integration tests are comprehensive and production-ready** - no placeholders
- ✅ **tools integration integrates correctly** with complete Claude SDK with optional tools
- ✅ **Architecture compliance achieved** - SOLID/DRY principles followed, ESLint passes
- ✅ **Performance validation completed** - all speed requirements met (tool-enabled completion response <5s with tools processing)
- ✅ **All tests must pass** before proceeding to Phase 07A (unit + integration + performance)
- ✅ **Documentation accuracy verified** - all docs reflect actual implementation

### Failure Criteria (Phase 06B Must Restart)
- ❌ Tools don't work when enabled or break OpenAI compatibility
- ❌ Tools not properly disabled by default
- ❌ Performance criteria not met (tool completions >5s)
- ❌ Tool configuration or error handling broken
- ❌ Tool response formatting incompatible
- ❌ Test coverage below 100% or tests failing