# Claude Wrapper Project Structure

## 🏗️ Complete Application Overview

This document provides the complete project structure for the claude-wrapper application, including all components and planned features. This serves as the single source of truth for the project organization.

```
claude-wrapper/
├── app/                                    # Main application code
│   ├── src/
│   │   ├── index.ts                       # Application entry point
│   │   ├── cli.ts                         # CLI interface and daemon mode
│   │   ├── server.ts                      # Express server setup
│   │   │
│   │   ├── auth/                          # Authentication system
│   │   │   ├── auth-manager.ts            # Multi-provider authentication orchestration
│   │   │   ├── interfaces/
│   │   │   │   ├── auth-provider.ts       # Provider interface definition
│   │   │   │   └── auth-config.ts         # Authentication configuration
│   │   │   ├── providers/
│   │   │   │   ├── anthropic-provider.ts  # Anthropic API key authentication
│   │   │   │   ├── bedrock-provider.ts    # AWS Bedrock authentication
│   │   │   │   ├── vertex-provider.ts     # Google Vertex AI authentication
│   │   │   │   └── claude-cli-provider.ts # Claude CLI authentication
│   │   │   ├── middleware/
│   │   │   │   ├── auth-middleware.ts     # Express authentication middleware
│   │   │   │   └── bearer-token.ts       # Bearer token validation
│   │   │   └── utils/
│   │   │       ├── auth-utils.ts          # Authentication utilities
│   │   │       └── credential-validator.ts # Credential validation
│   │   │
│   │   ├── claude/                        # Claude integration layer
│   │   │   ├── service.ts                 # Claude service orchestration
│   │   │   ├── client.ts                  # Claude client wrapper
│   │   │   ├── sdk-client.ts              # Claude SDK integration
│   │   │   ├── interfaces/
│   │   │   │   ├── claude-client.ts       # Claude client interface
│   │   │   │   ├── claude-options.ts      # Claude configuration options
│   │   │   │   └── claude-response.ts     # Claude response types
│   │   │   ├── adapters/
│   │   │   │   ├── message-adapter.ts     # OpenAI ↔ Claude message conversion
│   │   │   │   ├── model-adapter.ts       # Model mapping and validation
│   │   │   │   └── response-adapter.ts    # Response format conversion
│   │   │   ├── parsers/
│   │   │   │   ├── response-parser.ts     # Claude response parsing
│   │   │   │   ├── stream-parser.ts       # Streaming response parsing
│   │   │   │   └── tool-parser.ts         # Tool usage parsing
│   │   │   └── utils/
│   │   │       ├── token-estimator.ts     # Token usage estimation
│   │   │       └── model-validator.ts     # Model capability validation
│   │   │
│   │   ├── sessions/                      # Session management system
│   │   │   ├── session-manager.ts         # Session lifecycle management
│   │   │   ├── session-service.ts         # Session business logic
│   │   │   ├── interfaces/
│   │   │   │   ├── session-storage.ts     # Storage interface
│   │   │   │   └── session-info.ts        # Session data types
│   │   │   ├── storage/
│   │   │   │   ├── enhanced-memory-session-storage.ts # In-memory storage
│   │   │   │   ├── redis-session-storage.ts          # Redis storage (planned)
│   │   │   │   └── database-session-storage.ts       # Database storage (planned)
│   │   │   ├── cleanup/
│   │   │   │   ├── cleanup-service.ts     # Session cleanup orchestration
│   │   │   │   └── session-cleaner.ts     # Cleanup implementation
│   │   │   └── utils/
│   │   │       ├── session-utils.ts       # Session utilities
│   │   │       └── ttl-manager.ts         # TTL management
│   │   │
│   │   ├── tools/                         # OpenAI Tools API implementation
│   │   │   ├── tool-manager.ts            # Tool orchestration
│   │   │   ├── tool-executor.ts           # Tool execution engine
│   │   │   ├── tool-registry.ts           # Tool function registry
│   │   │   ├── interfaces/
│   │   │   │   ├── tool-definition.ts     # Tool schema definitions
│   │   │   │   ├── tool-function.ts       # Tool function interface
│   │   │   │   └── tool-result.ts         # Tool execution result
│   │   │   ├── validation/
│   │   │   │   ├── schema-validator.ts    # OpenAI schema validation
│   │   │   │   ├── parameter-validator.ts # Tool parameter validation
│   │   │   │   └── choice-validator.ts    # Tool choice validation
│   │   │   ├── conversion/
│   │   │   │   ├── format-converter.ts    # OpenAI ↔ Claude tool format
│   │   │   │   ├── parameter-converter.ts # Parameter conversion
│   │   │   │   └── response-converter.ts  # Tool response conversion
│   │   │   ├── processors/
│   │   │   │   ├── tool-processor.ts      # Tool call processing
│   │   │   │   ├── multi-tool-processor.ts # Parallel tool processing
│   │   │   │   └── choice-processor.ts    # Tool choice logic
│   │   │   ├── state/
│   │   │   │   ├── tool-state-manager.ts  # Tool call state tracking
│   │   │   │   └── execution-tracker.ts   # Execution progress tracking
│   │   │   └── errors/
│   │   │       ├── tool-errors.ts         # Tool-specific error types
│   │   │       └── execution-errors.ts    # Execution error handling
│   │   │
│   │   ├── routes/                        # HTTP route handlers
│   │   │   ├── chat/
│   │   │   │   ├── streaming-handler.ts   # Streaming chat completions
│   │   │   │   ├── non-streaming-handler.ts # Non-streaming completions
│   │   │   │   └── chat-processor.ts      # Chat request processing
│   │   │   ├── models/
│   │   │   │   ├── models-handler.ts      # Model listing endpoint
│   │   │   │   └── model-validator.ts     # Model validation
│   │   │   ├── sessions/
│   │   │   │   ├── session-routes.ts      # Session CRUD endpoints
│   │   │   │   └── session-stats.ts       # Session statistics
│   │   │   ├── health/
│   │   │   │   ├── health-routes.ts       # Health check endpoints
│   │   │   │   └── system-status.ts       # System status reporting
│   │   │   ├── auth/
│   │   │   │   ├── auth-routes.ts         # Authentication status
│   │   │   │   └── token-routes.ts        # Token management
│   │   │   └── debug/
│   │   │       ├── debug-routes.ts        # Debug information
│   │   │       └── diagnostics.ts         # System diagnostics
│   │   │
│   │   ├── middleware/                    # Express middleware
│   │   │   ├── cors.ts                    # CORS configuration
│   │   │   ├── validation.ts              # Request validation
│   │   │   ├── logging.ts                 # Request logging
│   │   │   ├── error-handler.ts           # Global error handling
│   │   │   ├── rate-limiter.ts            # Rate limiting (planned)
│   │   │   └── security.ts                # Security headers
│   │   │
│   │   ├── models/                        # Data models and types
│   │   │   ├── openai/
│   │   │   │   ├── chat-completion.ts     # OpenAI chat completion types
│   │   │   │   ├── streaming.ts           # OpenAI streaming types
│   │   │   │   ├── tools.ts               # OpenAI tools types
│   │   │   │   └── models.ts              # OpenAI model types
│   │   │   ├── claude/
│   │   │   │   ├── messages.ts            # Claude message types
│   │   │   │   ├── responses.ts           # Claude response types
│   │   │   │   └── tools.ts               # Claude tools types
│   │   │   ├── session.ts                 # Session data models
│   │   │   ├── auth.ts                    # Authentication models
│   │   │   └── errors.ts                  # Error response models
│   │   │
│   │   ├── utils/                         # Shared utilities
│   │   │   ├── logger.ts                  # Logging configuration
│   │   │   ├── config.ts                  # Application configuration
│   │   │   ├── constants.ts               # Application constants
│   │   │   ├── validation-utils.ts        # Validation helpers
│   │   │   ├── response-utils.ts          # Response formatting
│   │   │   ├── streaming-utils.ts         # Streaming utilities
│   │   │   └── performance-utils.ts       # Performance measurement
│   │   │
│   │   ├── production/                    # Production-specific features
│   │   │   ├── monitoring/
│   │   │   │   ├── health-monitor.ts      # Health monitoring
│   │   │   │   ├── performance-monitor.ts # Performance tracking
│   │   │   │   ├── system-monitor.ts      # System resource monitoring
│   │   │   │   └── alert-manager.ts       # Alert management
│   │   │   ├── security/
│   │   │   │   ├── security-hardening.ts  # Security configurations
│   │   │   │   ├── audit-logger.ts        # Security audit logging
│   │   │   │   └── threat-detector.ts     # Security threat detection
│   │   │   ├── deployment/
│   │   │   │   ├── production-config.ts   # Production configuration
│   │   │   │   ├── environment-manager.ts # Environment management
│   │   │   │   └── deployment-validator.ts # Deployment validation
│   │   │   └── observability/
│   │   │       ├── metrics-collector.ts   # Metrics collection
│   │   │       ├── trace-manager.ts       # Distributed tracing
│   │   │       └── log-aggregator.ts      # Log aggregation
│   │   │
│   │   ├── errors/                        # Error handling system
│   │   │   ├── error-types.ts             # Custom error classes
│   │   │   ├── error-codes.ts             # Error code definitions
│   │   │   ├── error-mapper.ts            # Error mapping utilities
│   │   │   └── error-reporter.ts          # Error reporting
│   │   │
│   │   └── types/                         # TypeScript type definitions
│   │       ├── global.d.ts                # Global type declarations
│   │       ├── express.d.ts               # Express type extensions
│   │       ├── claude.d.ts                # Claude SDK type definitions
│   │       └── environment.d.ts           # Environment variable types
│   │
│   ├── config/                            # Configuration files
│   │   ├── default.config.ts              # Default configuration
│   │   ├── development.config.ts          # Development configuration
│   │   ├── production.config.ts           # Production configuration
│   │   └── test.config.ts                 # Test configuration
│   │
│   └── tests/                             # Test suites
│       ├── unit/                          # Unit tests
│       │   ├── auth/                      # Authentication tests
│       │   ├── claude/                    # Claude integration tests
│       │   ├── sessions/                  # Session management tests
│       │   ├── tools/                     # Tools API tests
│       │   └── utils/                     # Utility tests
│       ├── integration/                   # Integration tests
│       │   ├── api/                       # API endpoint tests
│       │   ├── auth/                      # Authentication flow tests
│       │   ├── claude/                    # Claude integration tests
│       │   ├── sessions/                  # Session workflow tests
│       │   └── tools/                     # Tools execution tests
│       ├── e2e/                           # End-to-end tests
│       │   ├── chat/                      # Chat completion workflows
│       │   ├── streaming/                 # Streaming scenarios
│       │   ├── tools/                     # Tools usage scenarios
│       │   └── production/                # Production scenario tests
│       ├── performance/                   # Performance tests
│       │   ├── load/                      # Load testing
│       │   ├── stress/                    # Stress testing
│       │   └── memory/                    # Memory usage tests
│       ├── fixtures/                      # Test data and fixtures
│       ├── helpers/                       # Test helper functions
│       └── mocks/                         # Mock implementations
│
├── docs/                                  # Documentation
│   ├── PROJECT_STRUCTURE.md              # This file - project organization
│   ├── ARCHITECTURE.md                   # Architecture guidelines and patterns
│   ├── API_REFERENCE.md                  # Complete API documentation
│   ├── IMPLEMENTATION_PLAN.md            # Phased implementation plan
│   ├── DEPLOYMENT.md                     # Deployment guide
│   ├── DEVELOPMENT.md                    # Development setup guide
│   ├── TROUBLESHOOTING.md                # Troubleshooting guide
│   ├── planning/                          # Implementation planning
│   │   ├── ACCURATE_REMAINING_WORK.md    # Current remaining work analysis
│   │   ├── completed/                     # Completed planning documents
│   │   └── feature-analyses/              # Individual feature analysis
│   └── examples/                          # Usage examples
│       ├── curl/                          # cURL examples
│       ├── python/                        # Python client examples
│       ├── javascript/                    # JavaScript examples
│       └── typescript/                    # TypeScript examples
│
├── scripts/                               # Build and utility scripts
│   ├── build.ts                          # Build script
│   ├── test.ts                           # Test runner script
│   ├── setup.ts                          # Setup script
│   ├── docker/                           # Docker scripts
│   └── deployment/                       # Deployment scripts
│
├── docker/                               # Docker configuration
│   ├── Dockerfile                        # Main application Dockerfile
│   ├── docker-compose.yml                # Development compose file
│   ├── docker-compose.prod.yml           # Production compose file
│   └── nginx/                            # Nginx configuration
│
├── kubernetes/                           # Kubernetes manifests
│   ├── namespace.yaml                    # Namespace definition
│   ├── deployment.yaml                   # Application deployment
│   ├── service.yaml                      # Service definition
│   ├── configmap.yaml                    # Configuration
│   └── ingress.yaml                      # Ingress configuration
│
├── .github/                              # GitHub configuration
│   ├── workflows/                        # GitHub Actions
│   │   ├── ci.yml                        # Continuous integration
│   │   ├── cd.yml                        # Continuous deployment
│   │   └── security.yml                  # Security scanning
│   └── ISSUE_TEMPLATE/                   # Issue templates
│
├── package.json                          # Node.js dependencies and scripts
├── tsconfig.json                         # TypeScript configuration
├── jest.config.js                        # Jest test configuration
├── eslint.config.js                      # ESLint configuration
├── prettier.config.js                    # Prettier configuration
├── .gitignore                            # Git ignore rules
├── .dockerignore                         # Docker ignore rules
├── README.md                             # Project overview and setup
├── CHANGELOG.md                          # Version history
├── LICENSE                               # License file
└── SECURITY.md                           # Security policy
```

## 📋 Component Overview

### **Core Application Components**
- **Authentication System**: Multi-provider authentication with fallback hierarchy
- **Claude Integration**: Real Claude API integration with SDK and CLI support
- **Session Management**: Complete session lifecycle with storage options
- **Tools API**: OpenAI Tools API implementation with execution engine
- **HTTP API**: OpenAI-compatible REST API endpoints
- **Production Features**: Monitoring, security, and deployment capabilities

### **Infrastructure Components**
- **Configuration Management**: Environment-specific configurations
- **Error Handling**: Comprehensive error classification and reporting
- **Monitoring**: Health checks, performance tracking, and observability
- **Security**: Authentication, authorization, and security hardening
- **Testing**: Unit, integration, end-to-end, and performance tests

### **Deployment Components**
- **Docker**: Containerization with development and production configurations
- **Kubernetes**: Production-ready Kubernetes manifests
- **CI/CD**: Automated testing, building, and deployment pipelines
- **Documentation**: Comprehensive guides and API documentation

## 🎯 Implementation Status

**Current State**: Infrastructure and architecture complete, real Claude integration needed
**Target State**: All components fully functional with real Claude API integration
**Implementation Approach**: Single-feature phases with complete testing per phase

---

**Note**: This project structure represents the complete application after all implementation phases are finished. During development, components will be implemented incrementally following the phased implementation plan.