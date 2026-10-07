# Project Structure - Claude Wrapper

## 📁 Complete Backend Project Tree

This document provides the centralized reference for the complete claude-wrapper backend project structure. All features and components listed here should be working and code complete when the implementation plan is finished.

```
claude-wrapper/
├── .gitignore                              # Git ignore rules for entire project
├── .npmignore                              # NPM publish ignore rules  
├── package.json                            # Marketing package.json with global CLI entry
├── README.md                               # Marketing README for npm/GitHub
├── app/                                    # Main application directory
│   ├── bin/
│   │   └── hook-client.js                # The web tools' PreToolUse hook client (run by Claude Code, not on PATH)
│   ├── catalogue/
│   │   └── models.json                   # The Anthropic surface's shipped model catalogue
│   ├── src/                               # Source code
│   │   ├── anthropic/                     # The Anthropic Messages API surface (spec section 16, ADR 0006)
│   │   │   ├── index.ts                  # Composition root: createAnthropicSurface(deps) → {router, health, start, shutdown}
│   │   │   ├── deps.ts                   # SurfaceDeps, the injectable slots (runner, catalogue, sessions, ...)
│   │   │   ├── surface-state.ts          # State directory, fingerprint map and transcript retention
│   │   │   ├── retention.ts              # Orphan sweep at wrapper start, hourly expiry sweep
│   │   │   ├── redaction.ts              # Arms redaction from the CLI account file and the redact setting
│   │   │   ├── web-tools.ts              # The API's web tools and upstream's built-ins behind them
│   │   │   ├── surface-error/            # SurfaceError, the one error type of the surface
│   │   │   ├── http/                     # Surface tag, body parser, credentials, routers, error renderer, OpenAPI document
│   │   │   ├── catalogue/                # Model catalogue: load, resolve, list
│   │   │   ├── request/                  # planTurn: validation (one file per concern), normalise, render, run spec
│   │   │   ├── sessions/                 # Fingerprint map and parked-run registry
│   │   │   ├── conductor/                # The orchestrator: plan → admit → run → translator → sink
│   │   │   ├── scheduler/                # Run cap, rate-limit admission, session mutex, parking, teardown ladder
│   │   │   ├── translate/                # Frames → turn stream, the eleven passes one file each
│   │   │   ├── respond/                  # SSE, JSON and count sinks; the SDK-mirroring accumulator
│   │   │   └── failure/                  # Upstream failure mapping (spec section 13) as data
│   │   ├── upstream/                      # Surface-neutral driving of Claude Code (spec section 16)
│   │   │   ├── frames.ts                 # The stream-json frame union
│   │   │   ├── runner/                   # startRun(spec) → Run: spawn and replay adapters, timers, framing, ladder bottom
│   │   │   ├── control-server/           # Loopback HTTP server with per-run tokened MCP and hook paths
│   │   │   ├── bridge/                   # The tool bridge state machine and its MCP server adapter
│   │   │   ├── hook-policy/              # The web tools' PreToolUse policy and audit
│   │   │   ├── state-directory.ts        # The fixed working directory and per-run directories
│   │   │   ├── transcripts.ts            # Upstream transcript store; transcript-sweep.ts sweeps it
│   │   │   └── ...                       # mcp-config, hook-settings, account-file, connector-tools, structured-output
│   │   ├── api/                           # API layer
│   │   │   ├── routes/                    # Route handlers
│   │   │   │   ├── chat.ts               # Chat completions endpoint
│   │   │   │   ├── models.ts             # Models listing endpoint
│   │   │   │   ├── health.ts             # Health check endpoint
│   │   │   │   ├── sessions.ts           # Session management endpoints
│   │   │   │   └── auth.ts               # Authentication status endpoints
│   │   │   ├── middleware/                # Express middleware
│   │   │   │   ├── error.ts              # Error handling middleware
│   │   │   │   ├── session.ts            # Session handling middleware
│   │   │   │   ├── streaming.ts          # Streaming middleware
│   │   │   │   └── auth.ts               # Authentication middleware
│   │   │   └── server.ts                 # Express server setup
│   │   ├── auth/                          # Authentication system
│   │   │   ├── providers.ts              # Multi-provider authentication
│   │   │   ├── manager.ts                # Authentication lifecycle management
│   │   │   └── middleware.ts             # Authentication middleware
│   │   ├── cli/                           # Command-line interface
│   │   │   ├── commands.ts               # CLI command definitions
│   │   │   └── interactive.ts            # Interactive setup prompts
│   │   ├── config/                        # Configuration management
│   │   │   ├── env.ts                    # Environment variables
│   │   │   └── constants.ts              # Application constants
│   │   ├── core/                          # Core business logic
│   │   │   ├── wrapper.ts                # Main wrapper logic (enhanced POC)
│   │   │   ├── claude-client.ts          # Claude API client (enhanced POC)
│   │   │   ├── claude-resolver.ts        # Claude response resolver (enhanced POC)
│   │   │   └── validator.ts              # Request validation (enhanced POC)
│   │   ├── process/                       # Process management
│   │   │   ├── manager.ts                # Background process management
│   │   │   ├── daemon.ts                 # Daemon mode implementation
│   │   │   ├── pid.ts                    # PID file management
│   │   │   ├── signals.ts                # Signal handling for graceful shutdown
│   │   │   ├── shutdown-budget.ts        # How long the whole shutdown may take
│   │   │   └── surface-drain.ts          # Starts the Anthropic surface with the wrapper, drains it first at shutdown
│   │   ├── session/                       # Session management
│   │   │   ├── manager.ts                # Session lifecycle management
│   │   │   └── storage.ts                # In-memory TTL storage
│   │   ├── streaming/                     # Streaming support
│   │   │   ├── handler.ts                # SSE streaming implementation
│   │   │   ├── formatter.ts              # OpenAI streaming format compatibility
│   │   │   └── manager.ts                # Streaming lifecycle management
│   │   ├── types/                         # TypeScript type definitions
│   │   │   └── index.ts                  # Main type exports (enhanced POC)
│   │   ├── utils/                         # Utility functions
│   │   │   ├── logger.ts                 # Structured logging system
│   │   │   ├── log-context.ts            # A logger whose every line carries the same context
│   │   │   ├── clock.ts                  # The injectable clock (the system's by default)
│   │   │   ├── json-object.ts            # JsonObject and the one object check
│   │   │   └── errors.ts                 # Error handling utilities
│   │   └── cli.ts                        # Main CLI entry point
│   ├── tests/                             # Test suites
│   │   ├── unit/                          # Unit tests
│   │   │   ├── auth/                     # Authentication unit tests
│   │   │   ├── cli/                      # CLI unit tests
│   │   │   ├── core/                     # Core logic unit tests
│   │   │   ├── process/                  # Process management unit tests
│   │   │   ├── session/                  # Session management unit tests
│   │   │   └── streaming/                # Streaming unit tests
│   │   ├── integration/                   # Integration tests
│   │   │   ├── api/                      # API integration tests
│   │   │   ├── auth/                     # Authentication integration tests
│   │   │   ├── cli/                      # CLI integration tests
│   │   │   ├── process/                  # Process integration tests
│   │   │   ├── session/                  # Session integration tests
│   │   │   ├── streaming/                # Streaming integration tests
│   │   │   ├── anthropic/                # The Anthropic surface through the official SDK
│   │   │   └── upstream/                 # The spawn runner and the hook client against real local processes
│   │   ├── e2e/                           # End-to-end tests
│   │   │   └── upstream/                 # Real-CLI scenarios, skipped unless UPSTREAM_E2E=1
│   │   ├── mocks/                         # Mocks ({module}-mock.ts) and test harnesses
│   │   │   ├── anthropic/                # Surface harness, recordings readers, frame builders, SDK oracles
│   │   │   ├── upstream/                 # Scripted and replayed runs, recordings
│   │   │   └── shared/                   # Fake clock, waitFor
│   │   ├── setup/                         # Jest setup: the real-CLI guard, the account-file isolation, the fixture guard
│   │   ├── scripts/                       # Fixture scrub script and its library
│   │   └── fixtures/                      # Test data and fixtures
│   │       ├── upstream/                 # Scrubbed CLI recordings (index: README.md)
│   │       └── turn-streams/             # Translator goldens
│   ├── package.json                       # Dependencies and scripts
│   ├── tsconfig.json                      # TypeScript configuration
│   ├── jest.config.js                     # Jest testing configuration
│   └── .eslintrc.js                       # ESLint configuration
├── docs/                                  # Documentation
│   ├── phases/                            # Implementation phases
│   │   └── rewrite-phases/                # Rewrite phase documents
│   │       ├── PHASE_01_PRODUCTION_ARCHITECTURE_REFACTORING.md
│   │       ├── PHASE_02_CLI_INTERFACE_IMPLEMENTATION.md
│   │       ├── PHASE_03_SESSION_MANAGEMENT_INTEGRATION.md
│   │       ├── PHASE_04_STREAMING_SUPPORT_IMPLEMENTATION.md
│   │       ├── PHASE_05_AUTHENTICATION_SYSTEM_INTEGRATION.md
│   │       ├── PHASE_06_PROCESS_MANAGEMENT_IMPLEMENTATION.md
│   │       ├── PHASE_TEMPLATE.md          # Template for generating phases
│   │       └── generate-phases.js         # Phase generation script
│   ├── guides/                            # Writing guides
│   │   ├── README_WRITING_GUIDE.md        # Guide for writing READMEs
│   │   └── MINI_README_GUIDE.md           # Guide for mini READMEs
│   ├── API_REFERENCE.md                   # API endpoint documentation
│   ├── ARCHITECTURE.md                    # Architecture principles and patterns
│   ├── CODE_EXAMPLES.md                   # Code examples and patterns
│   ├── IMPLEMENTATION_PLAN.md             # Phase-by-phase implementation plan
│   ├── PROJECT_STRUCTURE.md               # This document
│   └── README.md                          # Comprehensive project documentation
├── src/                                   # POC source code (to be refactored)
│   ├── claude-client.ts                   # POC Claude client
│   ├── claude-resolver.ts                 # POC response resolver
│   ├── server.ts                          # POC Express server
│   ├── types.ts                           # POC type definitions
│   ├── validator.ts                       # POC request validator
│   └── wrapper.ts                         # POC main wrapper
├── .env.example                           # Environment variables template
├── HANDOFF.md                             # Development handoff documentation
├── REQUIREMENTS.md                        # Project requirements
├── docs/                                  # Project documentation
├── scripts/                               # Project setup scripts  
├── src/                                   # Original POC source (to be refactored)
└── test-requests/                         # Example API requests
```

## 📦 Packaging Structure

### **Root Level (NPM Package)**
- **package.json**: Marketing package with global CLI binary entry point
- **README.md**: User-facing documentation for installation and usage
- **.gitignore**: Git ignore rules for development workflow
- **.npmignore**: NPM publish rules (excludes source, tests, docs)

### **Published Files**
When published to NPM, only these files are included:
- `app/dist/` - Built application
- `app/package.json` - Application dependencies
- `README.md` - Usage documentation

### **Global CLI Installation**
```bash
npm install -g claude-wrapper
claude-wrapper --help
```

## 🏗️ Architecture Overview

### **Core Components**

#### **API Layer** (`app/src/api/`)
- **Routes**: RESTful endpoints for chat, models, health, sessions, and auth
- **Middleware**: Error handling, session management, streaming, and authentication
- **Server**: Express.js server configuration and setup

#### **Anthropic Surface** (`app/src/anthropic/`, `app/src/upstream/`)
- **anthropic**: the Messages API surface. The composition root builds it per app from injected dependencies; the conductor is its only orchestrator; the scheduler and the surface error live here too (ADR 0006's amendment)
- **upstream**: surface-neutral driving of one Claude Code run: frames, the runner, the control server, the bridge and the hook policy
- Spec: `.scratch/anthropic-compat-api/spec.md`; operator runbook: `docs/ANTHROPIC_SURFACE_RUNBOOK.md`

#### **Core Logic** (`app/src/core/`)
- **Wrapper**: Main request processing logic (enhanced from POC)
- **Claude Client**: Claude API integration (enhanced from POC)
- **Claude Resolver**: Response processing and formatting (enhanced from POC)
- **Validator**: Request validation and sanitization (enhanced from POC)

#### **Feature Modules**

##### **Authentication System** (`app/src/auth/`)
- Multi-provider Claude authentication (Anthropic, AWS Bedrock, Google Vertex AI)
- Optional API protection with bearer tokens
- Interactive authentication setup

##### **Session Management** (`app/src/session/`)
- Conversation continuity for multi-turn conversations
- In-memory TTL storage with automatic cleanup
- Session lifecycle management

##### **Streaming Support** (`app/src/streaming/`)
- Real-time response streaming with Server-Sent Events
- OpenAI-compatible streaming format
- Progressive tool call generation

##### **Process Management** (`app/src/process/`)
- Background process operation
- Graceful shutdown handling (SIGTERM/SIGINT)
- PID file management and health monitoring

##### **CLI Interface** (`app/src/cli/`)
- Command-line interface with Commander.js
- Global installation support (`claude-wrapper` command)
- Interactive setup prompts

#### **Supporting Infrastructure**

##### **Configuration** (`app/src/config/`)
- Environment variable management
- Application constants and settings

##### **Utilities** (`app/src/utils/`)
- Structured logging system
- Error handling utilities

##### **Types** (`app/src/types/`)
- TypeScript type definitions
- Interface specifications

### **Testing Strategy**

#### **Unit Tests** (`app/tests/unit/`)
- Individual component testing
- Business logic validation
- Edge case coverage

#### **Integration Tests** (`app/tests/integration/`)
- Component interaction testing
- API endpoint testing
- End-to-end functionality

### **Documentation Structure**

#### **Implementation Phases** (`docs/phases/`)
- Detailed phase-by-phase implementation plans
- Architecture compliance requirements
- Testing and review criteria

#### **Guides** (`docs/guides/`)
- Documentation writing standards
- Code patterns and conventions

#### **Reference Documentation** (`docs/`)
- API endpoint specifications
- Architecture principles
- Code examples and patterns

## 🎯 Implementation Status

When the implementation plan is complete, all components and features in this project structure should be:

- ✅ **Code Complete**: All files implemented and functional
- ✅ **Test Covered**: Unit and integration tests passing
- ✅ **Production Ready**: Following SOLID principles and best practices
- ✅ **Documented**: Comprehensive documentation and examples
- ✅ **Performance Optimized**: Meeting all performance requirements

## 🔄 POC Enhancement Strategy

The current POC files in the `src/` directory will be enhanced and moved to the `app/src/core/` directory:

- `src/wrapper.ts` → `app/src/core/wrapper.ts`
- `src/claude-client.ts` → `app/src/core/claude-client.ts`
- `src/claude-resolver.ts` → `app/src/core/claude-resolver.ts`
- `src/validator.ts` → `app/src/core/validator.ts`
- `src/server.ts` → `app/src/api/server.ts`
- `src/types.ts` → `app/src/types/index.ts`

All POC functionality will be preserved while adding production-ready features and clean architecture patterns.