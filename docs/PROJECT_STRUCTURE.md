# Project Structure - Claude Code OpenAI Wrapper Node.js Port

This document serves as the centralized reference for all file organization and component mapping from the Python implementation to the Node.js/TypeScript port.

## 🎯 Structure Philosophy

The Node.js project structure follows modern TypeScript/Node.js conventions while maintaining clear mapping to the Python implementation. Each TypeScript module directly corresponds to a Python file, ensuring traceability and systematic porting.

## 📁 Complete Project Structure

```
claude-code-openai-wrapper-node/
├── REQUIREMENTS.md                    # Project requirements (this document)
├── .gitignore                        # Git ignore configuration
├── .env.example                      # Environment variable template
├── docs/                             # Documentation folder
│   ├── README.md                     # Comprehensive Python feature analysis
│   ├── IMPLEMENTATION_PLAN.md        # 15-phase feature-complete implementation plan
│   ├── PROJECT_STRUCTURE.md          # This file - centralized structure reference
│   ├── ARCHITECTURE.md               # SOLID/DRY principles and anti-patterns
│   ├── API_REFERENCE.md              # Complete endpoint documentation
│   ├── CODE_EXAMPLES.md              # Python-to-TypeScript conversion examples
│   └── CLAUDE_SDK_REFERENCE.md       # Node.js Claude Code SDK integration guide
├── scripts/                          # Project automation scripts
│   └── init-app.sh                   # Application scaffolding script
└── app/                              # Main application (created by init script)
    ├── package.json                  # Node.js dependencies and scripts
    ├── tsconfig.json                 # TypeScript configuration
    ├── src/                          # Main source code
    │   ├── index.ts                  # Application entry point
    │   ├── server.ts                 # Express server setup
    │   ├── models/                   # Data models and validation
    │   │   ├── index.ts              # Model exports
    │   │   ├── message.ts            # Message-related models
    │   │   ├── chat.ts               # Chat completion models
    │   │   ├── streaming.ts          # Streaming response models
    │   │   ├── error.ts              # Error response models
    │   │   └── session.ts            # Session management models
    │   ├── auth/                     # Authentication system
    │   │   ├── index.ts              # Auth exports
    │   │   ├── auth-manager.ts       # Main authentication manager
    │   │   ├── providers/            # Authentication providers
    │   │   │   ├── anthropic.ts      # Anthropic API key validation
    │   │   │   ├── bedrock.ts        # AWS Bedrock authentication
    │   │   │   ├── vertex.ts         # Google Vertex AI authentication
    │   │   │   └── cli.ts            # Claude Code CLI authentication
    │   │   └── middleware.ts         # Bearer token middleware
    │   ├── message/                  # Message processing
    │   │   ├── index.ts              # Message exports
    │   │   ├── adapter.ts            # OpenAI ↔ Claude conversion
    │   │   ├── filter.ts             # Content filtering system
    │   │   └── tokens.ts             # Token estimation
    │   ├── session/                  # Session management
    │   │   ├── index.ts              # Session exports
    │   │   ├── session.ts            # Session data structure
    │   │   ├── manager.ts            # Session manager with cleanup
    │   │   └── storage.ts            # Thread-safe session storage
    │   ├── claude/                   # Claude Code SDK integration
    │   │   ├── index.ts              # Claude exports
    │   │   ├── client.ts             # Claude Code SDK wrapper
    │   │   ├── parser.ts             # Response message parsing
    │   │   └── metadata.ts           # Cost and session metadata extraction
    │   ├── tools/                    # Claude Code tools management
    │   │   ├── index.ts              # Tools exports
    │   │   ├── constants.ts          # Claude Code tool constants and types
    │   │   ├── manager.ts            # Tool enablement and control
    │   │   ├── validator.ts          # Tool name validation
    │   │   └── filter.ts             # Tool content filtering
    │   ├── validation/               # Parameter validation
    │   │   ├── index.ts              # Validation exports
    │   │   ├── validator.ts          # OpenAI parameter validation
    │   │   ├── headers.ts            # Custom header processing
    │   │   └── compatibility.ts     # Compatibility reporting
    │   ├── middleware/               # Express middleware
    │   │   ├── index.ts              # Middleware exports
    │   │   ├── cors.ts               # CORS configuration
    │   │   ├── debug.ts              # Debug logging middleware
    │   │   ├── validation.ts         # Request validation middleware
    │   │   └── error.ts              # Error handling middleware
    │   ├── routes/                   # API route handlers
    │   │   ├── index.ts              # Route exports
    │   │   ├── chat.ts               # Chat completions endpoint
    │   │   ├── models.ts             # Models endpoint
    │   │   ├── health.ts             # Health check endpoint
    │   │   ├── auth.ts               # Authentication status endpoint
    │   │   ├── sessions.ts           # Session management endpoints
    │   │   └── debug.ts              # Debug and compatibility endpoints
    │   ├── utils/                    # Utility functions
    │   │   ├── index.ts              # Utility exports
    │   │   ├── logger.ts             # Winston logger configuration
    │   │   ├── env.ts                # Environment variable management
    │   │   ├── crypto.ts             # Secure token generation
    │   │   ├── port.ts               # Port availability detection
    │   │   └── interactive.ts        # Interactive CLI prompts
    │   ├── types/                    # TypeScript type definitions
    │   │   ├── index.ts              # Type exports
    │   │   ├── express.ts            # Express type extensions
    │   │   ├── claude.ts             # Claude Code SDK types
    │   │   └── config.ts             # Configuration types
    │   └── services/                 # Business logic layer
    │       ├── index.ts              # Service exports
    │       ├── session-service.ts    # Session business logic
    │       └── message-service.ts    # Message processing business logic
    ├── tests/                        # Test suite
    │   ├── unit/                     # Unit tests
    │   │   ├── models/               # Model validation tests
    │   │   ├── auth/                 # Authentication tests
    │   │   ├── message/              # Message processing tests
    │   │   ├── session/              # Session management tests
    │   │   ├── claude/               # Claude SDK integration tests
    │   │   ├── tools/                # Tools management tests
    │   │   ├── validation/           # Parameter validation tests
    │   │   ├── repositories/         # Repository layer tests
    │   │   ├── services/             # Business logic tests
    │   │   └── utils/                # Utility function tests
    │   ├── integration/              # Integration tests
    │   │   ├── endpoints/            # API endpoint tests
    │   │   ├── auth-flow/            # Authentication flow tests
    │   │   ├── session-flow/         # Session management flow tests
    │   │   └── streaming/            # Streaming response tests
    │   ├── e2e/                      # End-to-end tests
    │   │   ├── basic-chat/           # Basic chat functionality
    │   │   ├── session-continuity/   # Session continuity tests
    │   │   ├── streaming/            # Streaming response tests
    │   │   └── compatibility/        # OpenAI compatibility tests
    │   ├── fixtures/                 # Test data and fixtures
    │   │   ├── requests/             # Sample API requests
    │   │   ├── responses/            # Expected responses
    │   │   └── messages/             # Test message data
    │   ├── mocks/                    # Mock implementations (TESTING ONLY)
    │   │   ├── claude-sdk.ts         # Mock Claude Code SDK
    │   │   ├── session-storage.ts    # Mock session storage for tests
    │   │   ├── auth-providers.ts     # Mock authentication providers
    │   │   └── repositories/         # Mock repository implementations
    │   │       ├── session-repository.ts  # Mock session operations
    │   │       ├── message-repository.ts  # Mock message operations
    │   │       └── user-repository.ts     # Mock user/API key operations
    │   └── helpers/                  # Test helper functions
    │       ├── setup.ts              # Test environment setup
    │       ├── assertions.ts         # Custom test assertions
    │       └── factories.ts          # Test data factories
    └── dist/                         # Compiled JavaScript output (gitignored)
```

## 🔗 Python to TypeScript File Mapping

### **Core Application Files**

| Python File | TypeScript Equivalent | Purpose |
|-------------|----------------------|---------|
| `main.py` | `src/index.ts` + `src/server.ts` + `src/routes/` | FastAPI app → Express server + routes |
| `models.py` | `src/models/` | Pydantic models → TypeScript interfaces with Zod |
| `auth.py` | `src/auth/` | Authentication system with providers |
| `message_adapter.py` | `src/message/` | Message processing and content filtering |
| `session_manager.py` | `src/session/` | Session management with TTL and cleanup |
| `claude_cli.py` | `src/claude/` | Claude Code SDK integration |
| `parameter_validator.py` | `src/validation/` | Parameter validation and compatibility |

### **Detailed Component Mapping**

#### **Main Application (`main.py` → Multiple Files)**

| Python Code | TypeScript File | Function |
|-------------|-----------------|----------|
| `main.py:1-50` (imports, setup) | `src/index.ts` | Application entry point |
| `main.py:169-175` (FastAPI app) | `src/server.ts` | Express server setup |
| `main.py:177-185` (CORS) | `src/middleware/cors.ts` | CORS middleware |
| `main.py:188-247` (debug middleware) | `src/middleware/debug.ts` | Debug logging |
| `main.py:251-305` (validation handler) | `src/middleware/validation.ts` | Request validation |
| `main.py:308-499` (streaming) | `src/routes/chat.ts` | Streaming responses |
| `main.py:502-641` (chat endpoint) | `src/routes/chat.ts` | Main chat endpoint |
| `main.py:644-832` (other endpoints) | `src/routes/*.ts` | All other API endpoints |
| `main.py:55-104` (token generation) | `src/utils/crypto.ts` + `src/utils/interactive.ts` | Security utilities |
| `main.py:835-851` (port detection) | `src/utils/port.ts` | Port availability |

#### **Data Models (`models.py` → `src/models/`)**

| Python Class | TypeScript File | Purpose |
|--------------|-----------------|---------|
| `ContentPart` | `src/models/message.ts` | Content part interface |
| `Message` | `src/models/message.ts` | Message interface with validation |
| `ChatCompletionRequest` | `src/models/chat.ts` | Request model with Zod schema |
| `ChatCompletionResponse` | `src/models/chat.ts` | Response model |
| `Choice` | `src/models/chat.ts` | Choice model |
| `Usage` | `src/models/chat.ts` | Usage model |
| `StreamChoice` | `src/models/streaming.ts` | Streaming choice model |
| `ChatCompletionStreamResponse` | `src/models/streaming.ts` | Streaming response model |
| `ErrorDetail`, `ErrorResponse` | `src/models/error.ts` | Error models |
| `SessionInfo`, `SessionListResponse` | `src/models/session.ts` | Session models |

#### **Authentication (`auth.py` → `src/auth/`)**

| Python Function/Class | TypeScript File | Purpose |
|----------------------|-----------------|---------|
| `ClaudeCodeAuthManager` | `src/auth/auth-manager.ts` | Main auth manager |
| `_detect_auth_method` | `src/auth/auth-manager.ts` | Provider detection |
| `_validate_anthropic_auth` | `src/auth/providers/anthropic.ts` | Anthropic validation |
| `_validate_bedrock_auth` | `src/auth/providers/bedrock.ts` | Bedrock validation |
| `_validate_vertex_auth` | `src/auth/providers/vertex.ts` | Vertex validation |
| `_validate_claude_cli_auth` | `src/auth/providers/cli.ts` | CLI validation |
| `verify_api_key` | `src/auth/middleware.ts` | Bearer token middleware |
| `security` (HTTPBearer) | `src/auth/middleware.ts` | Security scheme |

#### **Message Processing (`message_adapter.py` → `src/message/`)**

| Python Function | TypeScript File | Purpose |
|-----------------|-----------------|---------|
| `messages_to_prompt` | `src/message/adapter.ts` | Format conversion |
| `filter_content` | `src/message/filter.ts` | Content filtering |
| `estimate_tokens` | `src/message/tokens.ts` | Token estimation |

#### **Session Management (`session_manager.py` → `src/session/`)**

| Python Class/Function | TypeScript File | Purpose |
|-----------------------|-----------------|---------|
| `Session` dataclass | `src/session/session.ts` | Session data structure |
| `SessionManager` | `src/session/manager.ts` | Session manager with cleanup |
| Session storage operations | `src/session/storage.ts` | Thread-safe storage |

#### **Claude SDK (`claude_cli.py` → `src/claude/`)**

| Python Class/Function | TypeScript File | Purpose |
|-----------------------|-----------------|---------|
| `ClaudeCodeCLI` | `src/claude/client.ts` | SDK wrapper |
| `verify_cli` | `src/claude/client.ts` | CLI verification |
| `run_completion` | `src/claude/client.ts` | Query execution |
| `parse_claude_message` | `src/claude/parser.ts` | Response parsing |
| `extract_metadata` | `src/claude/metadata.ts` | Metadata extraction |

#### **Parameter Validation (`parameter_validator.py` → `src/validation/`)**

| Python Class/Function | TypeScript File | Purpose |
|-----------------------|-----------------|---------|
| `ParameterValidator` | `src/validation/validator.ts` | Parameter validation |
| `extract_claude_headers` | `src/validation/headers.ts` | Header processing |
| `CompatibilityReporter` | `src/validation/compatibility.ts` | Compatibility analysis |

## 🔧 Configuration Files

### **Package Configuration**

```json
// app/package.json
{
  "name": "claude-code-openai-wrapper-node",
  "version": "1.0.0",
  "description": "OpenAI-compatible API wrapper for Claude Code CLI",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "dotenv": "^16.0.0",
    "winston": "^3.8.0",
    "zod": "^3.20.0",
    "claude-code-sdk": "^1.0.0",
    "readline-sync": "^1.4.10"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/cors": "^2.8.0",
    "@types/node": "^18.0.0",
    "@types/jest": "^29.0.0",
    "@types/readline-sync": "^1.4.0",
    "typescript": "^4.9.0",
    "tsx": "^3.12.0",
    "jest": "^29.0.0",
    "ts-jest": "^29.0.0",
    "eslint": "^8.0.0",
    "@typescript-eslint/parser": "^5.0.0",
    "@typescript-eslint/eslint-plugin": "^5.0.0"
  }
}
```

### **TypeScript Configuration**

```json
// app/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "paths": {
      "@/*": ["./src/*"],
      "@/models/*": ["./src/models/*"],
      "@/auth/*": ["./src/auth/*"],
      "@/utils/*": ["./src/utils/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

## 🧪 Test Structure Mapping

### **Python Tests → TypeScript Tests**

| Python Test File | TypeScript Test Location | Test Focus |
|------------------|--------------------------|------------|
| `test_basic.py` | `tests/e2e/basic-chat/` | Basic functionality |
| `test_endpoints.py` | `tests/integration/endpoints/` | API endpoint testing |
| `test_parameter_mapping.py` | `tests/unit/validation/` | Parameter validation |
| `test_session_*.py` | `tests/integration/session-flow/` | Session management |
| `test_non_streaming.py` | `tests/integration/endpoints/` | Non-streaming responses |
| `test_textblock_fix.py` | `tests/unit/message/` | Content filtering |

### **Test Categories**

1. **Unit Tests**: Individual function/class testing
2. **Integration Tests**: Component interaction testing
3. **End-to-End Tests**: Full API workflow testing
4. **Mock Database**: In-memory session storage for testing

## 📦 Dependency Management

### **Runtime Dependencies**
- **express**: Web framework (replaces FastAPI)
- **cors**: CORS middleware
- **dotenv**: Environment variables
- **winston**: Logging (replaces Python logging)
- **zod**: Runtime validation (replaces Pydantic)
- **claude-code-sdk**: Claude Code integration
- **readline-sync**: Interactive prompts

### **Development Dependencies**
- **typescript**: TypeScript compiler
- **tsx**: TypeScript execution
- **jest**: Testing framework (replaces pytest)
- **eslint**: Code linting
- **@types/***: TypeScript type definitions

## 🚀 Build and Deployment

### **Development Workflow**
1. `npm run dev` - Start development server with hot reload
2. `npm run test:watch` - Run tests in watch mode
3. `npm run lint` - Check code quality

### **Production Build**
1. `npm run build` - Compile TypeScript to JavaScript
2. `npm start` - Run compiled application
3. `npm run test:coverage` - Full test suite with coverage

This structure ensures clean separation of concerns, maintainable code organization, and direct traceability to the Python implementation for systematic porting.