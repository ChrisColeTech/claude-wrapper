# Implementation Rules & Gold Standards

## 📋 **PROJECT OVERVIEW**

### **Application Purpose**
- **OpenAI API-compatible wrapper** for Claude Code CLI allowing use with any OpenAI client library
- **Node.js/TypeScript port** of production-ready Python version with 100% feature parity 
- **Multi-provider authentication** supporting API key, AWS Bedrock, Google Vertex AI, and CLI auth
- **Session continuity** with conversation history across requests (beyond standard OpenAI API)
- **Tools enabled by default** - Full Claude Code power (Read, Write, Bash, etc.) with optional disabling
- **Real-time cost and token tracking** from Claude Code SDK
- **CLI tool** installable globally with `npm install -g claude-wrapper`

### **Core Features to Implement**
1. **OpenAI-compatible `/v1/chat/completions` endpoint** (streaming + non-streaming)
2. **Multi-provider authentication** with bearer token protection
3. **Session management** with TTL and conversation continuity
4. **Tools integration** (11 Claude Code tools enabled by default)
5. **Model validation** and selection
6. **Health, auth status, models endpoints**
7. **Interactive API key protection** for remote access

---

## ⚡ **GOLD STANDARDS & MANDATORY RULES**

### **🏗️ SOLID Principles (MANDATORY)**

#### **Single Responsibility Principle (SRP)**
- **Each class has ONE responsibility only**
- **Maximum class size**: 200 lines
- **Maximum function size**: 50 lines
- **Maximum function parameters**: 5 parameters
- **Single export per module**: Each module exports one primary class/function

#### **Open/Closed Principle (OCP)**
- **Use strategy pattern** for extensibility (auth providers, message adapters)
- **Abstract base classes** for common functionality
- **Extend without modifying** existing code

#### **Liskov Substitution Principle (LSP)**
- **Proper inheritance hierarchies** with interface compliance
- **Subclasses must be substitutable** for base classes

#### **Interface Segregation Principle (ISP)**
- **Specific interfaces** for each concern
- **No god interfaces** - break into focused interfaces

#### **Dependency Inversion Principle (DIP)**
- **Depend on abstractions**, not concrete implementations
- **Inject dependencies** through constructors or methods

### **🎯 DRY Principle (MANDATORY)**
- **No duplication**: Maximum 3 lines of duplicate code allowed
- **Shared utilities**: Extract common patterns to utility functions
- **Configuration**: Centralized in environment/config modules

### **❌ Anti-Pattern Prevention (MANDATORY)**
- **No God Classes**: Maximum 200 lines per class
- **No Long Functions**: Maximum 50 lines per function  
- **No Deep Nesting**: Maximum 3 levels of nesting
- **No Magic Numbers**: Use named constants
- **No Hardcoded Values**: Use environment variables
- **No Inline Complex Logic**: Extract to named functions

### **🧪 Testing Requirements (MANDATORY)**
- **100% test coverage** for each phase before proceeding to next phase
- **Unit tests**: All classes and functions must have unit tests
- **Integration tests**: Component interactions must be tested
- **E2E tests**: Full feature workflows must have end-to-end tests
- **Mock objects**: Use comprehensive mocks from test infrastructure
- **All tests must pass** before proceeding to next phase

### **📋 Phase Implementation Rules (MANDATORY)**
- **One complete feature per phase** - no fragmented implementations
- **Each phase results in working, demonstrable functionality**
- **Architecture compliance verified** in each phase
- **All tests must pass** before proceeding to next phase
- **Immediate demonstration capability** after each phase

### **📁 File Organization Rules**
- **Single Responsibility**: One class/function per file
- **Logical grouping**: Related functionality in same directory
- **Clear naming**: File names reflect their single purpose
- **Index files**: Barrel exports for clean imports

### **💻 Code Quality Rules**
- **TypeScript strict mode**: All code must pass strict TypeScript compilation
- **ESLint compliance**: All code must pass linting without warnings
- **Consistent formatting**: Use project's prettier configuration
- **Clear naming**: Variables, functions, classes use descriptive names
- **Documentation**: All public interfaces documented

---

## 🚀 **CURRENT PHASE: PHASE 1**

### **Phase 1: Complete CLI and Server Foundation**
**Python Reference**: `main.py:37-50, 169-175, 835-851`
**Goal**: Complete working CLI tool that starts HTTP server with environment and logging

### **What Gets Implemented**:
- CLI entry point with argument parsing (`src/cli.ts`)
- Environment variable loading with type safety (`src/utils/env.ts`)
- Winston logging with debug/verbose modes (`src/utils/logger.ts`)
- Port availability detection (`src/utils/port.ts`)
- Express server with health endpoint (`src/server.ts`)
- Application entry point (`src/index.ts`)
- Package.json bin configuration for global CLI install

### **Success Criteria**:
- ✅ CLI tool can be installed globally (`npm install -g`)
- ✅ `claude-wrapper` command starts server on available port
- ✅ CLI options work (--port, --help, --version)
- ✅ Health endpoint returns 200 OK
- ✅ Environment variables loaded correctly
- ✅ Debug/verbose logging works
- ✅ All tests pass
- ✅ **Ready for immediate demonstration**

---

## 🔄 **IMPLEMENTATION WORKFLOW**

### **Before Each Component**:
1. Review SOLID principles for the component
2. Identify single responsibility
3. Define clear interfaces
4. Plan for testability

### **During Implementation**:
1. Follow SRP - one responsibility per class/function
2. Keep functions under 50 lines
3. Keep classes under 200 lines
4. Use descriptive names
5. Extract magic numbers to constants
6. Handle errors properly

### **After Each Component**:
1. Write comprehensive unit tests
2. Verify TypeScript compilation
3. Run ESLint
4. Check architecture compliance
5. Update todo list progress

### **Phase Completion**:
1. All unit tests pass
2. All integration tests pass
3. All E2E tests pass
4. Feature demonstrable end-to-end
5. Architecture compliance verified
6. Ready for next phase

---

## 📝 **ARCHITECTURE ENFORCEMENT**

### **Code Review Checklist**:
- [ ] SRP: Single responsibility per class/function
- [ ] OCP: Strategy pattern used where appropriate
- [ ] LSP: Inheritance hierarchies correct
- [ ] ISP: Interfaces are focused and specific
- [ ] DIP: Dependencies injected, not hardcoded
- [ ] DRY: No code duplication beyond 3 lines
- [ ] No anti-patterns present
- [ ] All tests pass
- [ ] TypeScript strict mode passes
- [ ] ESLint passes without warnings

### **Quality Gates**:
- [ ] Component implements exactly one responsibility
- [ ] Component is fully testable
- [ ] Component follows project conventions
- [ ] Component integrates cleanly with existing code
- [ ] Component is documented appropriately

---

**Remember**: These rules are MANDATORY and must be followed at all times. Quality is non-negotiable.