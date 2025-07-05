# Project Requirements - Claude Code OpenAI Wrapper Node.js Port

This document captures all requirements, specifications, and guidance provided for creating the Node.js port of the Python Claude Code OpenAI Wrapper.

## 🎯 Project Objective

Create a **complete rewrite** of the existing Python Claude Code OpenAI Wrapper (`../claude-code-openai-wrapper/`) as a Node.js/TypeScript application. This is **NOT a greenfield project** - it is a systematic port that must maintain 100% feature parity with the Python implementation.

## 📚 Documentation Requirements

### **Documentation Folder**: `docs/`

The user specifically requested:
> "before you begin any work, create a docs folder, inside it create..."

**CRITICAL**: All documentation must be created **BEFORE** any implementation work begins.

### **Required Documents** (6 documents total):

#### **1. COMPREHENSIVE README Document**
- **Requirement**: "create a COMPREHENSIVE readme document that includes all the features the python app has today"
- **Purpose**: Document ALL features that exist in the current Python implementation
- **Content Requirements**:
  - Complete feature analysis of the Python codebase
  - Every API endpoint that exists in main.py
  - All authentication methods from auth.py
  - Session management capabilities from session_manager.py
  - Message processing features from message_adapter.py
  - Claude SDK integration from claude_cli.py
  - All configuration options and environment variables
  - Complete compatibility analysis

#### **2. FULL Implementation Plan Document**
- **Requirement**: "a FULL implementaion plan document with phases (one feature per phase)"
- **CRITICAL SPECIFICATION**: **ONE FEATURE PER PHASE**
- **What this means**:
  - Each individual feature gets its own dedicated phase
  - NOT grouping multiple features together
  - NOT broad categories like "Authentication System" 
  - SPECIFIC features like "API Key Authentication", "Bedrock Authentication", etc.
- **Content Requirements**:
  - Each phase focuses on ONE specific feature from the Python app
  - Reference the specific Python source code for that feature
  - Explain how to port that ONE feature to TypeScript
  - Keep implementation details separate from planning
  - NO code examples in the plan itself (they go in separate document)
  - Link to the separate code examples document

#### **3. Project Structure Document**
- **Requirement**: "create a project structure document (centralized reference)"
- **Purpose**: Serve as the centralized reference for all file organization
- **Content Requirements**:
  - Complete file and folder structure for the Node.js project
  - Direct mapping from Python files to TypeScript files
  - Clear component organization
  - Reference point for all other documentation

#### **4. Architecture Document**
- **Requirement**: "create a architecture document with SOLID/DRY principles and anti-pattern prevention"
- **SPECIFIC REQUIREMENTS**:
  - **SOLID principles**: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion
  - **DRY principle**: Don't Repeat Yourself guidelines
  - **Anti-pattern prevention**: "directives for no spaghetti code or massive monster classes"
  - **Best practices**: Guidelines to follow for clean code
- **Content Requirements**:
  - Concrete examples of SOLID principles in TypeScript
  - Specific rules for preventing anti-patterns
  - Enforceable guidelines (size limits, complexity rules)
  - Code quality standards

#### **5. API Reference Document**
- **Requirement**: "create a API reference document"
- **Purpose**: Complete documentation of all API endpoints
- **Content Requirements**:
  - Every endpoint from the Python main.py
  - Request/response formats
  - Error handling
  - Authentication requirements
  - Usage examples

#### **6. Code Examples Document**
- **Requirement**: "remove all the code examples from the implementaion plan. keep them in a separate document"
- **Purpose**: Provide detailed code examples for porting Python to TypeScript
- **Content Requirements**:
  - Python-to-TypeScript conversion examples
  - Specific code patterns for each feature
  - Implementation examples that support the implementation plan
  - Detailed code snippets showing exact porting approaches
- **Critical**: This document must be referenced from the implementation plan but kept separate

## 🔄 Implementation Approach Requirements

### **Systematic Porting Philosophy**

The user clarified this is **NOT** a greenfield project:
> "does the implementaiton guide reference the old app in each phase? or does it basically imply 'create something from nothing'"

**Requirements**:
1. **Reference the Python implementation in each phase**
2. **Analyze specific Python source code before porting**
3. **Maintain behavioral compatibility**
4. **Build upon the existing proven implementation**
5. **Use in-memory storage exactly matching Python approach** (no database dependencies)

### **Storage Architecture Requirements**

Based on user feedback about mock data separation:
> "remove the mock data for development. mock data is only for the tests"

**Critical Requirements**:
1. **Development uses in-memory storage** exactly like Python (JavaScript Map = Python dict)
2. **No database dependencies** in main application (matches Python exactly)
3. **Mock repositories only for testing** - completely separate from development code
4. **Session management** uses in-memory Map storage, same as Python dict approach
5. **Authentication** via environment variables only, no database storage

### **Code Examples Separation**

The user specifically requested:
> "remove all the code examples from the implementaion plan. keep them in a separate document"

**Requirements**:
1. Implementation plan should focus on planning and analysis
2. Code examples belong in a separate dedicated document
3. Link to the separate code examples document from the implementation plan
4. No extensive code blocks in the implementation plan itself

### **Architecture Focus**

The user corrected when the architecture guide was missing required content:
> "the architecture guide does not mention any of the things i told you to add. where is the directives on avoiding antipatterns? it should contain best practices and guidelines to follow for SOLID DRY code, and directives for no spaghetti code or massive monster classes."

**Requirements**:
1. Must include SOLID principles with concrete examples
2. Must include DRY principle guidelines
3. Must include specific anti-pattern prevention
4. Must include directives against spaghetti code
5. Must include directives against monster classes
6. Must provide enforceable best practices

## 📋 Quality Standards

### **Documentation Quality Requirements**

1. **Accuracy**: All documentation must be based on actual analysis of the Python codebase
2. **Completeness**: Cover ALL features, not just major ones
3. **Specificity**: Reference specific Python files and line numbers where relevant
4. **Clarity**: Use crystal clear natural language
5. **Organization**: Logical structure that's easy to follow

### **Implementation Plan Specific Requirements**

Based on user feedback about fragmented implementations:
> "are we completing an entire feature (with all of the related services etc that must be created) in a single phase in the implementaion plan? including the tests for that phase?"

**Critical Updates**:
1. **Feature-Complete Phases**: Each phase implements a complete, testable feature (not fragmented parts)
2. **15 Phases Total**: Reduced from original 28 fragmented phases to 15 feature-complete phases
3. **Immediate Demonstration**: Every phase results in working, demonstrable functionality
4. **Complete Testing**: Each phase includes unit, integration, and E2E tests
5. **No Dependencies**: Phases minimize dependencies to enable independent testing
6. **MVP at Phase 10**: Core chat completions endpoint working after 10 phases
7. **Python-First Analysis**: Study the Python implementation before planning the port
8. **Behavioral Preservation**: Maintain exact compatibility with Python behavior
9. **No Code Examples**: Keep implementation details in the separate code examples document

### **Architecture Guide Specific Requirements**

1. **SOLID Principles**: Must include all 5 principles with TypeScript examples
2. **DRY Principle**: Clear guidelines for avoiding code duplication
3. **Anti-Pattern Prevention**: Specific rules against spaghetti code and monster classes
4. **Enforceable Guidelines**: Concrete size limits and complexity rules
5. **Best Practices**: Actionable guidelines for clean code

### **Code Examples Document Specific Requirements**

1. **Comprehensive Coverage**: Examples for all major porting patterns
2. **Python-to-TypeScript Focus**: Show exact translation approaches
3. **Feature-Specific Examples**: Support each phase of the implementation plan
4. **Detailed and Practical**: Real, usable code examples

## 🚫 Common Mistakes to Avoid

Based on user feedback, avoid these specific mistakes:

1. **Don't group multiple features into single phases** - each phase must be feature-complete
2. **Don't create fragmented implementations** - each phase must result in working, testable functionality
3. **Don't create greenfield-style documentation that ignores the Python implementation**
4. **Don't put extensive code examples in the implementation plan**
5. **Don't create architecture guides without SOLID/DRY principles**
6. **Don't forget anti-pattern prevention guidelines**
7. **Don't create incomplete or superficial documentation**
8. **Don't mix code examples with planning documents**
9. **Don't use mock repositories in development code** - only for testing
10. **Don't create database dependencies** - use in-memory storage like Python
11. **Don't create overly complex phase plans** - 15 feature-complete phases maximum

## 🎯 Success Criteria

The documentation will be considered complete and correct when:

1. **All 7 documents exist** in the `docs/` folder (including CLAUDE_SDK_REFERENCE.md)
2. **Professional marketing README exists** in project root with all required sections
3. **Implementation plan has 15 feature-complete phases** - each phase results in working, testable functionality
4. **Implementation plan contains no code examples** (they're in separate document)
5. **All documents reference the actual Python implementation** rather than creating something from nothing
6. **Architecture guide includes SOLID/DRY principles** and anti-pattern prevention
7. **API reference covers all endpoints** from the Python main.py
8. **Project structure provides a centralized reference** for file organization with in-memory storage approach
9. **README comprehensively covers all Python features**
10. **Code examples document provides detailed porting guidance**
11. **Claude SDK reference provides Node.js integration guidance**
12. **Init script creates complete application structure** with in-memory storage
13. **Mock repositories exist only in tests/** - completely separate from development code
14. **Application uses in-memory storage** exactly matching Python approach (Map = dict)
15. **Marketing README includes CI badges** and professional presentation

## 📝 Process Requirements

1. **Create all 7 documents in the docs folder FIRST** before any implementation work
2. **Follow the exact specifications** provided for each document
3. **Reference the Python codebase systematically**
4. **Keep code examples in their own separate document**
5. **Use crystal clear natural language** throughout
6. **Ensure 15 feature-complete phases** (not fragmented implementations)
7. **Separate development and testing concerns** (in-memory vs mocks)
8. **After all 7 docs are complete**, create the Node.js project structure and begin implementation

## 📋 Project Root README Requirements

**After all documentation is complete**, create a comprehensive marketing README for the project root with the following requirements:

### **Marketing README Specifications**
- **File Location**: `README.md` in project root (NOT in docs/)
- **Purpose**: Professional marketing README for GitHub visitors and npm package discovery
- **Audience**: Developers, potential contributors, and users looking for OpenAI alternatives

### **Required Content Sections** (in order):

#### **1. Header Section**
- **Project title** with clear description
- **CI/CD badges** following GitHub Actions standard format
- **Technology badges** (Node.js, TypeScript, Platform Support, License)
- **Social badges** (GitHub Stars, PRs Welcome, Development Status)
- **Tagline** describing core value proposition
- **Key features summary** in highlighted format

#### **2. Quick Start Section**
- **Installation commands** for immediate setup
- **Basic usage example** showing core functionality
- **Minimal viable example** to get users started quickly

#### **3. Features Section**
- **OpenAI API Compatibility** features
- **Claude Code Integration** capabilities
- **Enterprise Ready** aspects
- **Developer Experience** improvements
- Each feature group with specific bullet points and benefits

#### **4. API Documentation**
- **Endpoint table** with methods and descriptions
- **Authentication examples** for all 4 providers
- **Usage examples** showing API calls

#### **5. Development Status**
- **Current status** with completed phases
- **In progress** work with specific details
- **Planned features** and roadmap items
- **Progress indicators** showing project maturity

#### **6. Development Setup**
- **Prerequisites** with version requirements
- **Setup instructions** with step-by-step commands
- **Architecture overview** referencing the 15-phase plan
- **Phase descriptions** with brief explanations

#### **7. Documentation References**
- **Links to all docs/** files with descriptions
- **Clear navigation** to detailed documentation
- **Purpose explanation** for each document

#### **8. Contributing Guidelines**
- **Contribution welcome** message
- **Development guidelines** referencing architecture rules
- **How to contribute** with specific steps

#### **9. Footer Section**
- **License information**
- **Acknowledgments** to related projects
- **Call to action** (star, issues, PRs)

### **Style Requirements**
- **Professional tone** suitable for enterprise adoption
- **Clear structure** with proper heading hierarchy
- **Visual appeal** with badges, emojis, and formatting
- **Concise content** - comprehensive but scannable
- **Action-oriented** language encouraging engagement

## 🏗️ Application Scaffolding Requirements

**After the project structure has been defined**, create an initialization shell script with the following requirements:

### **Init Script Requirements**
- **Script Name**: `init-app.sh` (to be created in `scripts/` folder in project root)
- **Purpose**: Automate complete application scaffolding based on the project structure document

### **Script Functions** (in order):
1. **Create App Folder**: Create an `app/` folder in the project root
2. **Scaffold Application Structure**: Create the entire application structure inside the `app/` folder as defined in the project structure document
3. **Initialize NPM**: Create package.json with all required dependencies
4. **Create Project Configuration**: TypeScript, ESLint, Jest configuration files
5. **Create Project Folders**: Create all directories specified in the project structure document
6. **Create Placeholder Files**: Create placeholder implementation files with proper comments
7. **Create In-Memory Services**: Create service layer using in-memory storage (Map objects)
8. **Create Test Infrastructure**: 
   - Create `tests/` folder in the app folder
   - Create subfolders for the complete test suite structure
   - Create placeholder test files
9. **Create Mock Repositories (Testing Only)**: 
   - Create mock repository classes ONLY in tests/mocks/ folder
   - Create test fixtures and sample data
   - Ensure mocks are completely separate from main application code

### **Expected Final Structure**:
```
claude-code-openai-wrapper-node/
├── README.md                    # Professional marketing README (project root)
├── REQUIREMENTS.md              # This requirements document
├── .gitignore                   # Git ignore configuration
├── .env.example                 # Environment variable template
├── docs/                        # All 7 documentation files
│   ├── README.md                # Comprehensive Python feature analysis
│   ├── IMPLEMENTATION_PLAN.md   # 15 feature-complete phases
│   ├── PROJECT_STRUCTURE.md     # Centralized file organization reference
│   ├── ARCHITECTURE.md          # SOLID/DRY principles + anti-pattern prevention
│   ├── API_REFERENCE.md         # Complete endpoint documentation
│   ├── CODE_EXAMPLES.md         # Python-to-TypeScript porting examples
│   └── CLAUDE_SDK_REFERENCE.md  # Node.js Claude Code SDK integration guide
├── scripts/                     # Script folder
│   └── init-app.sh              # Initialization script
└── app/                         # Created by init script
    ├── package.json             # Complete dependencies configuration
    ├── tsconfig.json            # TypeScript configuration
    ├── .eslintrc.json           # ESLint configuration with architecture rules
    ├── jest.config.js           # Jest testing configuration
    ├── src/                     # Main application source (in-memory storage)
    │   ├── services/            # Business logic with in-memory Map storage
    │   ├── models/              # Data models with Zod validation
    │   ├── auth/                # Multi-provider authentication (env vars only)
    │   ├── session/             # Session management (in-memory Map)
    │   ├── message/             # Message processing
    │   ├── claude/              # Claude Code SDK integration
    │   ├── tools/               # Claude Code tools management (11 tools)
    │   ├── validation/          # Parameter validation and compatibility
    │   ├── middleware/          # Express middleware
    │   ├── routes/              # API endpoints
    │   ├── utils/               # Utility functions
    │   └── types/               # TypeScript type definitions
    ├── tests/                   # Test infrastructure
    │   ├── unit/                # Unit tests
    │   ├── integration/         # Integration tests
    │   ├── e2e/                 # End-to-end tests
    │   ├── fixtures/            # Test data and sample requests
    │   ├── mocks/               # Mock implementations (TESTING ONLY)
    │   │   └── repositories/    # Mock repository classes for tests
    │   └── helpers/             # Test helper functions
    └── README.md                # Application documentation
```

### **Script Requirements**:
- **Executable**: Script must be executable (`chmod +x init-app.sh`)
- **Error Handling**: Include proper error handling for each step
- **Progress Feedback**: Show progress messages for each major step
- **Validation**: Verify each step completed successfully before proceeding
- **Idempotent**: Safe to run multiple times without breaking existing structure

## 📁 Final Documentation Structure

The completed docs folder should contain exactly these 7 files:

```
docs/
├── README.md                    # Comprehensive Python feature analysis
├── IMPLEMENTATION_PLAN.md       # 15 feature-complete phases (no code examples)
├── PROJECT_STRUCTURE.md         # Centralized file organization reference
├── ARCHITECTURE.md              # SOLID/DRY principles + anti-pattern prevention
├── API_REFERENCE.md             # Complete endpoint documentation
├── CODE_EXAMPLES.md             # Python-to-TypeScript porting examples
└── CLAUDE_SDK_REFERENCE.md      # Node.js Claude Code SDK integration guide
```

## 🏆 Project Completion Status

**✅ COMPLETED REQUIREMENTS:**

### **Documentation Phase (Complete)**
- ✅ All 7 required documents created in docs/ folder
- ✅ Implementation plan restructured to 15 feature-complete phases
- ✅ Architecture guidelines with SOLID/DRY principles established
- ✅ Claude Code tools integration documented (11 tools)
- ✅ In-memory storage approach documented

### **Project Scaffolding Phase (Complete)**
- ✅ Complete Node.js application structure created
- ✅ In-memory storage services implemented (matching Python exactly)
- ✅ Mock repositories separated to testing only
- ✅ TypeScript configuration with architecture rule enforcement
- ✅ Comprehensive test structure with fixtures and mocks
- ✅ Claude Code SDK integration placeholder created

### **Key Architectural Decisions Finalized**
- ✅ **Storage**: In-memory Map objects (JavaScript) = Python dict storage
- ✅ **Authentication**: Environment variables only, no database
- ✅ **Session Management**: In-memory with TTL, matching Python exactly
- ✅ **Testing**: Mock repositories completely separate from development
- ✅ **Tools**: All 11 Claude Code tools enabled by default (enhanced from Python)
- ✅ **Phases**: 15 feature-complete phases instead of 28 fragmented ones
- ✅ **Marketing**: Professional README with CI badges and comprehensive features

This requirements document serves as the definitive specification and has been successfully implemented with all critical user feedback incorporated.