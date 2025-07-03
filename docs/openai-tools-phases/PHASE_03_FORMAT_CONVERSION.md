# Phase 3A & 3B: Claude SDK Tool Format Conversion

## Phase 3A: Claude SDK Tool Format Conversion Implementation
**Goal**: Convert OpenAI tools format to Claude Code SDK tool format  
**Complete Feature**: Bidirectional conversion between OpenAI and Claude tool schemas  
**Dependencies**: Phase 2B must be 100% complete with all tests passing
**OpenAI Reference**: Based on `docs/API_REFERENCE.md` lines 90-108 tool definitions, conversion to Claude format
**Performance Requirement**: Format conversion <15ms per tool array

### Files to Create/Update
```
CREATE: src/tools/converter.ts - OpenAI ↔ Claude tool format conversion (SRP: conversion only)
CREATE: src/tools/mapper.ts - Tool parameter mapping utilities (SRP: parameter mapping only)
CREATE: src/tools/format-validator.ts - Format validation service (SRP: format validation only)
UPDATE: src/tools/constants.ts - Add conversion constants (DRY: no magic formats)
UPDATE: src/claude/client.ts - Add OpenAI tools to Claude tools conversion integration
CREATE: tests/unit/tools/converter.test.ts - Conversion logic unit tests
CREATE: tests/unit/tools/mapper.test.ts - Parameter mapping unit tests
CREATE: tests/unit/tools/format-validator.test.ts - Format validation unit tests
CREATE: tests/integration/tools/claude-integration.test.ts - Claude SDK integration tests
```

### What Gets Implemented
- OpenAI tool schema → Claude tool schema bidirectional conversion
- Claude tool response → OpenAI tool call conversion with complete fidelity
- Tool parameter format translation preserving all data
- Tool choice option mapping between OpenAI and Claude formats
- Schema compatibility validation for both formats
- Bidirectional conversion validation with round-trip testing
- Error handling for unsupported conversions with specific error messages
- Named constants for all format specifications (no magic formats)

### Architecture Compliance Requirements (MANDATORY)
- **SOLID Principles**: 
  - **SRP**: ToolConverter handles only format conversion (<200 lines)
  - **OCP**: Extensible for new format types via strategy pattern
  - **LSP**: All converters implement IToolConverter interface consistently
  - **ISP**: Separate interfaces for IOpenAIConverter, IClaudeConverter
  - **DIP**: Depend on IToolValidator and IToolProcessor abstractions from prior phases
- **File Size Limits**: All files <200 lines, functions <50 lines, max 5 parameters
- **DRY Compliance**: Extract common conversion patterns to ConversionUtils
- **No Magic Formats**: All format specifications in src/tools/constants.ts
- **Error Handling**: Consistent ToolConversionError with specific format information
- **TypeScript Strict**: All conversion code passes strict TypeScript compilation
- **Interface Design**: Maximum 5 methods per interface, single-purpose interfaces

### Anti-Pattern Prevention (MANDATORY)
- **No God Classes**: ToolConverter <200 lines, focused on format conversion only
- **No Deep Nesting**: Maximum 3 levels in conversion logic, use early returns
- **No Inline Complex Logic**: Extract conversion rules to named methods
- **No Hardcoded Values**: All format specifications and mappings in constants
- **No Magic Formats**: Use FORMAT_MAPPINGS.OPENAI_TO_CLAUDE, FORMAT_SPECS.FUNCTION_SCHEMA

### Testing Requirements (MANDATORY)
- **100% test coverage** for all conversion logic before proceeding to Phase 3B
- **Unit tests**: ToolConverter, parameter mapping, format validation edge cases
- **Integration tests**: OpenAI ↔ Claude conversion in full tool processing pipeline
- **Round-trip tests**: Verify data fidelity in bidirectional conversion
- **Mock objects**: Mock IClaudeClient, IToolValidator for integration tests
- **Error scenario tests**: Invalid formats, unsupported conversions, malformed data
- **Performance tests**: Conversion speed <15ms for arrays of 20 tools

### Quality Gates for Phase 3A Completion
- ✅ All SOLID principles followed (verified via code review checklist)
- ✅ No anti-patterns present (ESLint max-lines, complexity, depth rules pass)
- ✅ 100% test coverage achieved (Jest coverage report)
- ✅ **All tests must pass** before proceeding to Phase 3B (unit + integration + performance + round-trip)
- ✅ TypeScript strict mode passes (tsc --strict --noEmit)
- ✅ ESLint passes without warnings (npm run lint)
- ✅ Format conversion demonstrable (integration test passing)
- ✅ OpenAI compatibility verified (preserves all tool functionality from API_REFERENCE.md)
- ✅ Performance criteria met (conversion <15ms per tool array)

### OpenAI Compatibility Verification
- ✅ Tool definition conversion preserves all fields from `docs/API_REFERENCE.md` examples
- ✅ Function parameter conversion supports all JSON Schema types
- ✅ tool_choice conversion maintains OpenAI behavior semantics
- ✅ Round-trip conversion preserves complete data fidelity
- ✅ Error handling for conversion failures matches expected patterns

### Testable Features
- OpenAI tools array converts to Claude tools format per API_REFERENCE.md examples
- Claude tool responses convert back to OpenAI format with complete fidelity
- Tool parameters map correctly between formats without data loss
- Conversion preserves all tool functionality described in API documentation
- Error handling for invalid conversions provides specific, actionable feedback
- **Ready for immediate demonstration** with conversion examples

---

## Phase 3B: Claude SDK Tool Format Conversion - Comprehensive Review
**Goal**: Ensure 100% tool format conversion compatibility and production-quality implementation
**Review Focus**: Bidirectional conversion accuracy, tool parameter mapping, schema compatibility
**Dependencies**: Phase 3A must be 100% complete with all tests passing
**Reference Standards**: `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION_RULES.md`, `docs/API_REFERENCE.md`

### Comprehensive Review Requirements (MANDATORY)

#### 1. Conversion Accuracy Audit
- **OpenAI ↔ Claude conversion verification** with complete data fidelity testing
- **Round-trip conversion testing** must preserve all tool functionality exactly
- **Parameter mapping validation** must handle all JSON Schema types correctly
- **Schema compatibility** must be verified for both OpenAI and Claude formats
- **Error handling verification** for all unsupported conversion scenarios

#### 2. Test Quality Review
- **Replace ALL placeholder tests** with real format conversion functionality tests
- **Conversion logic tests**: Test all OpenAI ↔ Claude format conversions
- **Round-trip tests**: Verify complete data fidelity in bidirectional conversion
- **Parameter mapping tests**: Test all JSON Schema parameter type mappings
- **Error handling tests**: Test unsupported formats and conversion failures
- **Integration tests**: Verify conversion works in full tool processing pipeline
- **Performance tests**: Validate conversion speed meets <15ms requirement

#### 3. Integration Validation
- **Claude SDK Integration**: Verify conversion integrates correctly with Claude Code SDK
- **Tool Processing Pipeline**: Verify conversion works with Phase 1A/1B/2A/2B components
- **Error Response Integration**: Verify conversion errors return proper responses
- **Request Flow**: Verify converted tools flow correctly through entire system

#### 4. Architecture Compliance Review
- **Single Responsibility**: Format conversion components have single purposes
- **Dependency Injection**: Converters depend on abstractions, not concrete implementations
- **Interface Segregation**: Conversion interfaces are focused (max 5 methods)
- **Error Handling**: Consistent ToolConversionError formatting
- **File Size Compliance**: All files under 200 lines, functions under 50 lines
- **DRY Compliance**: No duplicate conversion logic

#### 5. Performance Validation
- **Conversion speed**: <15ms for tool arrays with 20 functions
- **Memory usage**: Efficient conversion without memory accumulation
- **Concurrent conversion**: Support for multiple simultaneous conversions
- **Large schema handling**: Handle complex tool schemas without performance degradation

#### 6. Documentation Review
- **Format conversion documentation**: Complete OpenAI ↔ Claude conversion behavior
- **Parameter mapping guide**: Document all parameter type conversions
- **Integration documentation**: Document conversion middleware integration
- **Error handling guide**: Document all conversion error scenarios

### Quality Gates for Phase 3B Completion
- ✅ **100% OpenAI ↔ Claude conversion compatibility verified**
- ✅ **All format conversion tests are comprehensive and production-ready** - no placeholders
- ✅ **Format conversion integrates correctly** with tool processing pipeline
- ✅ **Architecture compliance achieved** - SOLID/DRY principles followed, ESLint passes
- ✅ **Performance validation completed** - all speed requirements met (<15ms conversion)
- ✅ **All tests must pass** before proceeding to Phase 4A (unit + integration + performance + round-trip)
- ✅ **Documentation accuracy verified** - all docs reflect actual implementation

### Failure Criteria (Phase 3B Must Restart)
- ❌ Format conversion doesn't preserve data fidelity
- ❌ Any placeholder tests remain in codebase
- ❌ Performance criteria not met (conversion >15ms)
- ❌ Architecture violations present (ESLint failures, SOLID violations)
- ❌ Integration failures with Claude SDK or tool processing pipeline
- ❌ Test coverage below 100% or tests failing