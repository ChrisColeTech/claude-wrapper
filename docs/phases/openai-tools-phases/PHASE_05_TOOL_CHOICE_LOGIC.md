# Phase 5A & 5B: Tool Choice Logic Implementation

## Phase 5A: Tool Choice Logic Implementation
**Goal**: Implement tool_choice parameter behavior ("auto", "none", specific function)  
**Complete Feature**: Complete tool choice control matching OpenAI behavior  
**Dependencies**: Phase 4B must be 100% complete with all tests passing
**OpenAI Reference**: Based on `docs/API_REFERENCE.md` lines 115-119 tool_choice parameter behavior
**Performance Requirement**: Tool choice processing <5ms per request

### Files to Create/Update
```
CREATE: src/tools/choice.ts - Tool choice logic implementation (SRP: choice logic only)
CREATE: src/tools/choice-processor.ts - Tool choice processing service (SRP: processing only)
CREATE: src/tools/choice-enforcer.ts - Tool choice enforcement service (SRP: enforcement only)
UPDATE: src/tools/constants.ts - Add tool choice behavior constants (DRY: no magic behaviors)
UPDATE: src/claude/client.ts - Add tool choice handling integration
UPDATE: src/tools/processor.ts - Add tool choice processing integration
CREATE: tests/unit/tools/choice.test.ts - Tool choice logic unit tests
CREATE: tests/unit/tools/choice-processor.test.ts - Choice processing unit tests
CREATE: tests/unit/tools/choice-enforcer.test.ts - Choice enforcement unit tests
CREATE: tests/integration/tools/choice-behavior.test.ts - Tool choice behavior integration tests
```

### What Gets Implemented
- tool_choice: "auto" allows Claude to decide tool usage autonomously
- tool_choice: "none" forces text-only responses, no tool calls
- Specific function choice forces that exact function call
- Invalid tool_choice validation returns specific 422 errors
- Tool choice behavior matches OpenAI specification exactly
- Choice enforcement in Claude SDK integration
- Error handling for invalid choice scenarios with specific messages
- Named constants for all tool choice behaviors

### Architecture Compliance Requirements (MANDATORY)
- **SOLID Principles**: 
  - **SRP**: ToolChoiceLogic handles only choice logic (<200 lines)
  - **OCP**: Extensible for new choice types via strategy pattern
  - **LSP**: All choice handlers implement IToolChoiceHandler interface consistently
  - **ISP**: Separate interfaces for IChoiceProcessor, IChoiceEnforcer
  - **DIP**: Depend on IToolValidator and IToolConverter abstractions from prior phases
- **File Size Limits**: All files <200 lines, functions <50 lines, max 5 parameters
- **DRY Compliance**: Extract common choice patterns to ChoiceUtils
- **No Magic Behaviors**: All choice behavior specs in src/tools/constants.ts
- **Error Handling**: Consistent ToolChoiceError with specific choice information
- **TypeScript Strict**: All choice logic code passes strict TypeScript compilation
- **Interface Design**: Maximum 5 methods per interface, single-purpose interfaces

### Anti-Pattern Prevention (MANDATORY)
- **No God Classes**: ToolChoiceLogic <200 lines, focused on choice logic only
- **No Deep Nesting**: Maximum 3 levels in choice logic, use early returns
- **No Inline Complex Logic**: Extract choice rules to named methods
- **No Hardcoded Values**: All choice behaviors and validation rules in constants
- **No Magic Behaviors**: Use TOOL_CHOICE_BEHAVIORS.AUTO, TOOL_CHOICE_BEHAVIORS.NONE

### Testing Requirements (MANDATORY)
- **100% test coverage** for all choice logic before proceeding to Phase 5B
- **Unit tests**: ToolChoiceLogic, choice processing, enforcement edge cases
- **Integration tests**: Tool choice behavior in chat completion requests
- **Mock objects**: Mock IClaudeClient, IToolValidator for integration tests
- **Error scenario tests**: Invalid choices, unsupported functions, malformed choice specs
- **Performance tests**: Choice processing speed <5ms for requests with tool choice

### Quality Gates for Phase 5A Completion
- ✅ All SOLID principles followed (verified via code review checklist)
- ✅ No anti-patterns present (ESLint max-lines, complexity, depth rules pass)
- ✅ 100% test coverage achieved (Jest coverage report)
- ✅ **All tests must pass** before proceeding to Phase 5B (unit + integration + performance)
- ✅ TypeScript strict mode passes (tsc --strict --noEmit)
- ✅ ESLint passes without warnings (npm run lint)
- ✅ Tool choice logic demonstrable (integration test passing)
- ✅ OpenAI compatibility verified (matches API_REFERENCE.md choice behavior exactly)
- ✅ Performance criteria met (choice processing <5ms per request)

### OpenAI Compatibility Verification
- ✅ tool_choice: "auto" behavior matches OpenAI specification exactly
- ✅ tool_choice: "none" forces text-only responses as per OpenAI behavior
- ✅ Specific function choice enforcement works correctly
- ✅ Invalid tool_choice validation returns proper 422 errors
- ✅ Choice behavior integrates correctly with Claude SDK

### Testable Features
- tool_choice: "auto" allows Claude to decide tool usage per API_REFERENCE.md
- tool_choice: "none" forces text-only responses without tool calls
- Specific function choice forces that exact function call
- Invalid tool_choice returns specific 422 errors matching OpenAI format
- Tool choice behavior matches OpenAI specification exactly
- **Ready for immediate demonstration** with choice behavior examples

---

## Phase 5B: Tool Choice Logic Implementation - Comprehensive Review
**Goal**: Ensure 100% tool choice logic compatibility and production-quality implementation
**Review Focus**: Tool choice behavior, Claude SDK integration, choice enforcement
**Dependencies**: Phase 5A must be 100% complete with all tests passing
**Reference Standards**: `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION_RULES.md`, `docs/API_REFERENCE.md`

### Comprehensive Review Requirements (MANDATORY)

#### 1. Choice Behavior Audit
- **Choice behavior verification** with `docs/API_REFERENCE.md` tool_choice examples
- **"auto" behavior** must allow Claude autonomous tool usage decisions
- **"none" behavior** must force text-only responses without tool calls
- **Specific function behavior** must enforce exact function calls
- **Error handling** for invalid choices must match OpenAI 422 format

#### 2. Test Quality Review
- **Replace ALL placeholder tests** with real tool choice functionality tests
- **Choice behavior tests**: Test "auto", "none", and specific function behaviors
- **Integration tests**: Verify choice logic works in chat completions
- **Error handling tests**: Test invalid choices and unsupported functions
- **Claude SDK tests**: Verify choice enforcement in Claude integration
- **Performance tests**: Validate choice processing speed meets <5ms requirement

#### 3. Integration Validation
- **Chat Completion Integration**: Verify choice logic works in POST /v1/chat/completions
- **Claude SDK Integration**: Verify choice enforcement works with Claude Code SDK
- **Tool Processing Pipeline**: Verify choice logic integrates with all prior phases
- **Error Response Integration**: Verify choice errors return proper responses

#### 4. Architecture Compliance Review
- **Single Responsibility**: Choice logic components have single purposes
- **Dependency Injection**: Choice handlers depend on abstractions, not concrete implementations
- **Interface Segregation**: Choice interfaces are focused (max 5 methods)
- **Error Handling**: Consistent ToolChoiceError formatting
- **File Size Compliance**: All files under 200 lines, functions under 50 lines
- **DRY Compliance**: No duplicate choice logic

#### 5. Performance Validation
- **Choice processing speed**: <5ms for requests with tool choice
- **Memory usage**: Efficient choice processing without memory accumulation
- **Concurrent processing**: Support for multiple simultaneous choice processing
- **Complex choice handling**: Handle specific function choices without performance degradation

#### 6. Documentation Review
- **Choice logic documentation**: Complete tool choice behavior documentation
- **Choice enforcement guide**: Document choice enforcement in Claude SDK integration
- **Integration documentation**: Document choice logic middleware integration
- **Error handling guide**: Document all choice logic error scenarios

### Quality Gates for Phase 5B Completion
- ✅ **100% OpenAI choice behavior compatibility verified**
- ✅ **All tool choice tests are comprehensive and production-ready** - no placeholders
- ✅ **Choice logic integrates correctly** with chat completion request flow
- ✅ **Architecture compliance achieved** - SOLID/DRY principles followed, ESLint passes
- ✅ **Performance validation completed** - all speed requirements met (<5ms processing)
- ✅ **All tests must pass** before proceeding to Phase 6A (unit + integration + performance)
- ✅ **Documentation accuracy verified** - all docs reflect actual implementation

### Failure Criteria (Phase 5B Must Restart)
- ❌ Choice behavior doesn't match OpenAI specification
- ❌ Any placeholder tests remain in codebase
- ❌ Performance criteria not met (processing >5ms)
- ❌ Architecture violations present (ESLint failures, SOLID violations)
- ❌ Integration failures with Claude SDK or chat completion processing
- ❌ Test coverage below 100% or tests failing