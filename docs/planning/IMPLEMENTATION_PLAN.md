# Claude Wrapper Implementation Plan

## 🎯 Overview

This document provides an implementation plan for completing the claude-wrapper project. Based on comprehensive feature analysis, the project has **excellent production-ready infrastructure** but **completely mocked functionality**. The remaining work focuses on enabling real Claude integration across 8 feature areas.

**Root Issue**: Every feature has sophisticated architecture but returns mock responses instead of real Claude API calls.

## 📋 Implementation Phases

### **Phase 1: Claude Authentication System**
**Feature**: Fix all authentication providers to enable real Claude API access
**Goal**: Replace failing authentication with working Claude CLI, Anthropic API, AWS Bedrock, or Google Vertex authentication

**Related Documents**: 
- [Claude Authentication Analysis](./planning/CLAUDE_AUTHENTICATION_ANALYSIS.md)

**Source Code**:
- `app/src/auth/providers/claude-cli-provider.ts` - Fix shell alias issue: change `claude` to `/home/risky/.claude/local/claude`
- `app/src/auth/providers/anthropic-provider.ts` - Fix API key validation for real ANTHROPIC_API_KEY
- `app/src/auth/providers/bedrock-provider.ts` - Fix AWS credentials detection
- `app/src/auth/providers/vertex-provider.ts` - Fix GCP credentials detection

**Architecture Rules Enforced**:
- **SRP**: Each provider class <200 lines, single responsibility for one auth method only
- **OCP**: Strategy pattern allows new providers without modifying AuthManager
- **DIP**: AuthManager depends on IAuthProvider interface, not concrete implementations
- **DRY**: Extract common credential validation to shared utilities
- **ISP**: Separate interfaces for different auth capabilities (validation, token refresh, etc.)

**Testing Requirements (100% Complete & Passing)**:
- Unit tests for each provider with real credential scenarios (25 test cases)
- Integration tests for AuthManager provider selection (15 test cases)
- Error handling tests for all failure modes (20 test cases)
- Authentication flow end-to-end tests (10 test cases)
- **NO PLACEHOLDER TESTS** - All tests must verify real authentication behavior

**Specific Issue**: All 4 providers fail - Claude CLI uses shell alias Node.js can't access, others need credentials configured

---

### **Phase 2: Real Claude API Integration**
**Feature**: Replace hardcoded mock responses with actual Claude SDK calls
**Goal**: Remove `"I understand your request and will help you with that."` responses and implement real Claude API integration

**Related Documents**:
- [Claude API Integration Analysis](./planning/CLAUDE_API_INTEGRATION_ANALYSIS.md)

**Source Code**:
- `app/src/claude/client.ts` - Remove `createStubSDK()` and `stubQuery()` functions, use real SDK
- `app/src/claude/sdk-client.ts` - Remove `createFallbackSDK()`, implement real Claude calls
- `app/src/routes/chat/non-streaming-handler.ts` - Remove hardcoded mock response on lines 37-41
- `package.json` - Move `@anthropic-ai/claude-code` from optionalDependencies to dependencies

**Architecture Rules Enforced**:
- **SRP**: Claude client <200 lines, SDK client <200 lines, response parser <100 lines
- **DIP**: Service layer depends on IClaudeClient interface, not concrete SDK implementation
- **OCP**: Extensible for different Claude SDK versions without modifying core logic
- **DRY**: Extract SDK initialization and error handling to utilities
- **LSP**: All Claude client implementations work identically through interface

**Testing Requirements (100% Complete & Passing)**:
- Unit tests for real Claude SDK integration (30 test cases)
- Integration tests with actual Claude API calls (20 test cases)
- Error handling tests for API failures and timeouts (25 test cases)
- Response parsing tests with real Claude responses (15 test cases)
- **NO PLACEHOLDER TESTS** - All tests must use real Claude SDK, no mocks for SDK behavior

**Specific Issue**: Mock responses active throughout system - real Claude SDK integration exists but never used

---

### **Phase 3: Test Suite Memory Leak Fixes**
**Feature**: Fix MaxListenersExceededWarning and memory leaks preventing test execution
**Goal**: Enable stable test suite execution by fixing EventEmitter and signal handler leaks

**Related Documents**:
- [Test Suite Stability Analysis](./planning/TEST_SUITE_STABILITY_ANALYSIS.md)

**Source Code**:
- `app/src/production/monitoring/system-monitor.ts` - Add `removeAllListeners()` in cleanup methods
- `app/src/production/monitoring/performance-monitor.ts` - Fix EventEmitter cleanup in destructor
- `app/src/production/monitoring/health-monitor.ts` - Add proper signal handler cleanup
- `app/src/server.ts` - Add test environment checks before adding signal handlers

**Architecture Rules Enforced**:
- **SRP**: Resource manager <200 lines, cleanup utilities <50 lines each
- **DRY**: Extract cleanup patterns to reusable utilities
- **RAII**: All resources acquired must have explicit cleanup
- **No God Classes**: Break large monitoring classes into focused components
- **Memory Safety**: Bounded collections, no unbounded growth

**Testing Requirements (100% Complete & Passing)**:
- Unit tests for resource cleanup with memory leak detection (20 test cases)
- Integration tests for EventEmitter cleanup in monitoring (15 test cases)
- Long-running stability tests without memory warnings (10 test cases)
- Signal handler cleanup validation tests (12 test cases)
- **NO PLACEHOLDER TESTS** - All tests must verify actual memory cleanup

**Specific Issue**: 21 process signal listeners accumulate causing "MaxListenersExceededWarning" and test failures

---

### **Phase 4: OpenAI Tools API Implementation** ✅ **COMPLETED**
**Feature**: Build complete OpenAI Tools API functionality with real Claude Code tool execution
**Goal**: Transform the existing API mock infrastructure into a fully functional tool system that actually executes tools

**Related Documents**:
- [OpenAI Tools API Analysis](./planning/OPENAI_TOOLS_API_ANALYSIS.md)

**Source Code**:
- `app/src/tools/execution/` - Build complete tool execution engine
- `app/src/routes/chat/non-streaming-handler.ts` - Replace text parsing with Claude SDK integration
- `app/src/routes/chat/streaming-handler.ts` - Add streaming tool call support
- `app/src/claude/service.ts` - Add tool calling methods to Claude service

**Implementation Steps**:
1. **Replace text parsing with Claude SDK tool calling** - Remove pattern matching, use native Claude tool_use blocks
2. **Build tool execution engine** - Create actual file reading, command execution, search functionality  
3. **Integrate tool results into conversation** - Handle tool message types and conversation continuity
4. **Add streaming tool execution** - Stream tool calls and results in real-time
5. **Production security and testing** - Sandboxing, rate limiting, comprehensive test coverage

**Architecture Rules Enforced**:
- **SRP**: Tool executor <200 lines, each tool function <100 lines, security sandbox <150 lines
- **ISP**: Separate interfaces for execution, security, result processing, and streaming
- **OCP**: New tools can be added without modifying core execution engine
- **DIP**: Tool executor depends on IToolFunction interface, not concrete implementations
- **Security**: Proper sandboxing, rate limiting, and input validation for all tool execution

**Testing Requirements (100% Complete & Passing)**:
- Unit tests for tool execution engine with real Claude Code tools (50 test cases)
- Integration tests for complete tool workflows (30 test cases) 
- Security tests for tool sandboxing and validation (25 test cases)
- End-to-end tests for OpenAI API compatibility (20 test cases)
- **NO PLACEHOLDER TESTS** - All tests must execute real tools and verify actual results

**Specific Issue**: Perfect OpenAI API infrastructure (100% complete) but zero actual tool functionality (0% complete)

---

### **Phase 5: Real Streaming Functionality**
**Feature**: Replace mock streaming responses with actual Claude API streaming
**Goal**: Stream real Claude responses instead of mock text through existing perfect streaming infrastructure

**Related Documents**:
- [Streaming Functionality Analysis](./planning/STREAMING_FUNCTIONALITY_ANALYSIS.md)

**Source Code**:
- `app/src/routes/chat/streaming-handler.ts` - Replace mock streaming with real Claude SDK streaming
- `app/src/claude/parsers/stream-parser.ts` - Process real Claude streaming responses instead of mock data
- `app/src/utils/streaming-utils.ts` - Connect streaming utilities to real Claude API

**Architecture Rules Enforced**:
- **SRP**: Stream handler <200 lines, stream parser <150 lines, utilities <100 lines
- **DIP**: Streaming handler depends on IStreamParser interface, not concrete implementation
- **Resource Management**: Proper stream cleanup and connection handling
- **Error Handling**: Graceful handling of stream interruptions and failures
- **Performance**: Efficient streaming without buffering entire responses

**Testing Requirements (100% Complete & Passing)**:
- Unit tests for stream parsing with real Claude streaming data (22 test cases)
- Integration tests for end-to-end streaming workflows (18 test cases)
- Error handling tests for stream failures and reconnection (15 test cases)
- Performance tests for streaming latency and throughput (10 test cases)
- **NO PLACEHOLDER TESTS** - All tests must use real Claude streaming responses

**Specific Issue**: Perfect Server-Sent Events implementation streams the same mock response regardless of input

---

### **Phase 6: Session Context Integration**
**Feature**: Fix session context integration so Claude actually receives conversation history
**Goal**: Connect excellent session management infrastructure to Claude API calls

**Related Documents**:
- [Session Management Analysis](./planning/SESSION_MANAGEMENT_ANALYSIS.md)

**Source Code**:
- `app/src/claude/service.ts` - Pass session context and message history to Claude API calls
- `app/src/routes/chat/non-streaming-handler.ts` - Include session message history in Claude requests
- `app/src/sessions/session-service.ts` - Ensure session context is properly formatted for Claude API

**Architecture Rules Enforced**:
- **SRP**: Session context builder <150 lines, message merger <100 lines
- **DIP**: Claude service depends on ISessionContext interface, not concrete session storage
- **LSP**: All session implementations work identically for context building
- **DRY**: Extract session formatting logic to reusable utilities
- **Performance**: Efficient context building without loading entire session history

**Testing Requirements (100% Complete & Passing)**:
- Unit tests for session context building and formatting (20 test cases)
- Integration tests for Claude API calls with session context (15 test cases)
- Conversation continuity tests across multiple requests (12 test cases)
- Performance tests for large session histories (8 test cases)
- **NO PLACEHOLDER TESTS** - All tests must verify real session context integration

**Specific Issue**: Perfect session CRUD operations but Claude integration completely ignores session context

---

### **Phase 7: Production Memory Management**
**Feature**: Fix memory leaks that will crash long-running production deployments
**Goal**: Implement bounded collections and proper resource cleanup to prevent memory exhaustion

**Related Documents**:
- [Memory Management Analysis](./planning/MEMORY_MANAGEMENT_ANALYSIS.md)

**Source Code**:
- `app/src/sessions/session-manager.ts` - Fix unbounded `accessCounts` map with LRU eviction
- `app/src/production/monitoring/system-monitor.ts` - Add memory leak detection and bounded metrics storage
- `app/src/sessions/cleanup/cleanup-service.ts` - Implement proper session cleanup with resource limits

**Architecture Rules Enforced**:
- **SRP**: Memory manager <200 lines, LRU cache <150 lines, cleanup service <100 lines
- **Bounded Collections**: All maps and arrays must have maximum size limits
- **RAII**: All resources have explicit lifecycle management
- **DIP**: Memory manager depends on ICache interface for different storage strategies
- **Monitoring**: Memory usage tracking and alerts for leak detection

**Testing Requirements (100% Complete & Passing)**:
- Unit tests for LRU eviction and bounded collections (25 test cases)
- Memory leak detection tests for long-running scenarios (18 test cases)
- Resource cleanup validation tests (20 test cases)
- Performance tests for memory efficiency under load (12 test cases)
- **NO PLACEHOLDER TESTS** - All tests must verify actual memory management behavior

**Specific Issue**: Session storage and performance metrics accumulate indefinitely causing production memory leaks

---

### **Phase 8: End-to-End Integration Validation**
**Feature**: Test and validate complete workflows with real Claude API integration
**Goal**: Replace sophisticated mock system with real Claude integration testing

**Related Documents**:
- [End-to-End Integration Analysis](./planning/END_TO_END_INTEGRATION_ANALYSIS.md)

**Source Code**:
- `app/tests/e2e/` - Enable real Claude API integration tests (currently disabled with `describe.skip`)
- `app/tests/integration/` - Test complete request-response cycles with real Claude responses
- `app/src/middleware/error-handler.ts` - Validate error handling with real Claude API errors

**Architecture Rules Enforced**:
- **Complete SOLID Compliance**: All architecture rules from previous phases verified
- **Integration Patterns**: Consistent error handling, logging, and monitoring across all components
- **Performance**: Response times <2s for standard requests, <100ms for health checks
- **Reliability**: Graceful degradation and error recovery in all failure scenarios
- **Security**: Input validation, output sanitization, and secure error messages

**Testing Requirements (100% Complete & Passing)**:
- End-to-end tests for complete user workflows (30 test cases)
- Integration tests for all components working together (25 test cases)
- Error scenario tests for all failure modes (20 test cases)
- Performance tests under load with real Claude API (15 test cases)
- **NO PLACEHOLDER TESTS** - All tests must use real Claude API and verify actual behavior

**Specific Issue**: Production-ready HTTP infrastructure serves elaborate mock responses instead of real Claude conversations

---

## 📊 Work Progression and Status Tracking

| Phase | Feature | Status | Priority | Estimated Duration | Dependencies |
|-------|---------|--------|----------|-------------------|--------------|
| 1 | Claude Authentication System | Completed | Critical | 1-2 days | None - environment setup |
| 2 | Real Claude API Integration | Completed | Critical | 1-2 days | Phase 1 |
| 3 | Test Suite Memory Leak Fixes | **Completed** | High | 1 day | None |
| 4 | OpenAI Tools API Implementation | **Completed** | Critical | 2.5-4 weeks | Phase 2 |
| 5 | Real Streaming Functionality | Not Started | Medium | 1-2 days | Phase 2 |
| 6 | Session Context Integration | Not Started | Medium | 1-2 days | Phase 2 |
| 7 | Production Memory Management | Not Started | High | 2-3 days | None |
| 8 | End-to-End Integration Validation | Not Started | Low | 2-3 days | Phases 1-7 |

**Total Estimated Duration**: 2-3 weeks

**Critical Path**: Phases 1-2 (authentication + real API integration) will restore all core functionality since infrastructure is already production-ready.

---

## 🎯 Phase Completion Criteria

### **MANDATORY Requirements for Each Phase**

**NO PHASE IS COMPLETE until ALL requirements are met:**

#### **1. Architecture Compliance (Non-Negotiable)**
- ✅ **SOLID Principles**: All classes follow SRP (<200 lines), OCP (extensible), LSP (substitutable), ISP (<5 methods), DIP (inject dependencies)
- ✅ **DRY Enforcement**: No code duplication >3 lines, extract to utilities
- ✅ **Anti-Pattern Prevention**: No God classes, no deep nesting (max 3 levels), no magic numbers
- ✅ **TypeScript Strict**: `tsc --strict --noEmit` passes without errors
- ✅ **ESLint Clean**: `npm run lint` passes without warnings

#### **2. Testing Standards (Mandatory)**
- ✅ **All Tests Passing**: 100% pass rate, zero failing or skipped tests
- ✅ **NO PLACEHOLDER TESTS**: All tests must verify real functionality, no TODO comments or mock assertions
- ✅ **Tests Complete**: All tests written for the phase must be fully implemented
- ✅ **Real Integration**: Tests must use actual Claude API, real authentication, real tool execution
- ✅ **Performance Criteria**: Response times meet specified benchmarks

#### **3. Integration Validation (Mandatory)**
- ✅ **Feature Works End-to-End**: Complete workflows demonstrable via integration tests
- ✅ **No Regressions**: All existing functionality still works
- ✅ **Error Handling**: All error scenarios tested and handled gracefully
- ✅ **Memory Stability**: No memory leaks or resource leaks detected

#### **4. Documentation Requirements (Mandatory)**
- ✅ **Architecture Updates**: ARCHITECTURE.md reflects any new patterns or components
- ✅ **API Documentation**: API_REFERENCE.md updated if endpoints change
- ✅ **Code Comments**: All public APIs documented with JSDoc
- ✅ **README Updates**: Feature changes reflected in user documentation

### **Quality Gates Enforcement**

**Before proceeding to next phase, verify:**

1. **Code Review Checklist**:
   - [ ] All architecture rules enforced
   - [ ] No anti-patterns introduced
   - [ ] Clean, readable, maintainable code
   - [ ] Proper error handling and logging

2. **Testing Checklist**:
   - [ ] All tests written are complete (not placeholders)
   - [ ] All tests passing consistently
   - [ ] Performance benchmarks met

3. **Integration Checklist**:
   - [ ] Feature works in isolation
   - [ ] Feature works with other components
   - [ ] No breaking changes introduced
   - [ ] Error scenarios handled properly

**Failure Criteria**: If ANY requirement is not met, the phase is INCOMPLETE and must be reworked from the beginning.

### **Critical Testing Mandate**

**🚨 ZERO TOLERANCE for placeholder tests or incomplete functionality:**

- **Every test must verify real behavior** - no mock assertions or TODO comments
- **Every feature must work end-to-end** - no partially implemented functionality
- **Every error case must be tested** - no untested error paths
- **Every architectural rule must be enforced** - no exceptions or compromises

This ensures each phase delivers **production-ready, fully functional, thoroughly tested** code that can be immediately deployed and used.