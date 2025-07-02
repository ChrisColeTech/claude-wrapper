# Claude Code OpenAI Wrapper

[![CI Status](https://github.com/ChrisColeTech/claude-wrapper/workflows/Continuous%20Integration/badge.svg)](https://github.com/ChrisColeTech/claude-wrapper/actions)
[![Node Version](https://img.shields.io/node/v/claude-wrapper.svg)](https://nodejs.org/)
[![Platform Support](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue.svg)](https://github.com/ChrisColeTech/claude-wrapper)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[![GitHub Stars](https://img.shields.io/github/stars/ChrisColeTech/claude-wrapper.svg)](https://github.com/ChrisColeTech/claude-wrapper/stargazers)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/ChrisColeTech/claude-wrapper/pulls)
[![Development Status](https://img.shields.io/badge/status-in%20development-yellow.svg)](https://github.com/ChrisColeTech/claude-wrapper)

OpenAI-compatible API wrapper for Claude Code CLI. Drop-in replacement for OpenAI API that routes requests to Claude while maintaining full compatibility.

> **🚧 In Development** • **🔧 Claude Code Integration** • **📦 Zero Config** • **⚡ Streaming Support**

## Quick Start

```bash
# Clone and set up the project
git clone https://github.com/ChrisColeTech/claude-wrapper.git
cd claude-wrapper

# Initialize the Node.js application
chmod +x scripts/init-app.sh
./scripts/init-app.sh

# Install and run
cd app
npm install
npm run dev
```

## ✨ Features

### 🔄 **OpenAI API Compatibility**
- **Drop-in replacement** for OpenAI API endpoints
- **Chat completions** with streaming and non-streaming support
- **Compatible request/response formats** - works with existing OpenAI clients
- **Session continuity** for multi-turn conversations

### 🛠️ **Claude Code Integration**
- **Multi-provider authentication** (Anthropic, AWS Bedrock, Google Vertex AI, Claude CLI)
- **11 Claude Code tools** enabled by default (Task, Bash, Read, Write, Glob, Grep, etc.)
- **Full Claude Code power** out of the box - no setup required
- **Tool control headers** (X-Claude-Allowed-Tools, X-Claude-Permission-Mode)
- **Real-time streaming** responses with Server-Sent Events

### 🏗️ **Enterprise Ready**
- **SOLID architecture** with dependency injection and clean separation
- **In-memory session management** with TTL and automatic cleanup
- **Comprehensive validation** and error handling
- **Production-ready logging** and monitoring

### 🔧 **Developer Experience**
- **TypeScript first** with full type safety
- **Hot reload development** with tsx watch mode
- **Comprehensive testing** (unit, integration, E2E)
- **ESLint architecture rules** preventing anti-patterns

## 🚀 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/chat/completions` | POST | OpenAI-compatible chat completions |
| `/v1/models` | GET | List available Claude models |
| `/health` | GET | Health check and service status |
| `/auth/status` | GET | Authentication configuration |
| `/sessions` | GET | List active sessions |
| `/sessions/{id}` | GET/DELETE | Manage individual sessions |

## 🔐 Authentication

### **Getting Started (No API Key Required)**

```bash
# 1. Install and authenticate Claude Code CLI
npm install -g @anthropic-ai/claude-code
claude auth login

# 2. Start the wrapper - no additional setup needed
npm run dev

# 3. Make requests - no API key required
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### **Alternative Authentication Methods**

If you prefer not to use Claude CLI:

```bash
# Option 1: Direct Anthropic API Key
export ANTHROPIC_API_KEY="your-anthropic-api-key"

# Option 2: AWS Bedrock
export ANTHROPIC_BEDROCK_REGION="us-east-1"
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"

# Option 3: Google Vertex AI  
export ANTHROPIC_VERTEX_REGION="us-east-1"
export ANTHROPIC_VERTEX_PROJECT_ID="your-project-id"
export GOOGLE_APPLICATION_CREDENTIALS="path/to/credentials.json"
```

### **Optional Security (For Remote Access)**

By default, no API key is required for requests. For remote access security:

```bash
# Set this to require Bearer token authentication
export API_KEY="your-server-protection-key"

# Then requests need Authorization header:
curl -H "Authorization: Bearer your-server-protection-key" ...
```

## 📊 Current Development Status

### ✅ **Completed (Phase 0)**
- 📋 **Complete project documentation** (7 comprehensive documents)
- 🏗️ **15-phase implementation plan** with feature-complete phases
- 🔧 **Application scaffolding script** with full project structure
- 📐 **SOLID/DRY architecture guidelines** with anti-pattern prevention
- 🔍 **Comprehensive feature analysis** for systematic implementation

### 🚧 **In Progress**
- **Phase 1-15 implementation** following systematic development approach
- **Server foundation** with Express, TypeScript, and testing framework
- **Authentication system** with multi-provider support
- **Core API endpoints** with OpenAI compatibility

### 📅 **Planned Features**
- **Production deployment** configuration and Docker support
- **Rate limiting** and request throttling
- **Metrics and monitoring** integration
- **Advanced session management** with persistence options
- **Plugin system** for custom tools and middleware
- **Performance optimization** with `disable_tools` parameter for speed

## 🛠️ Development

### **Prerequisites**
- Node.js 18+ 
- npm or yarn
- Claude Code CLI (for CLI authentication)

### **Setup**
```bash
# Initialize the complete application structure
./scripts/init-app.sh

# Navigate to app directory
cd app

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### **Architecture**

The project follows a systematic **15-phase implementation plan**:

1. **Server Foundation** - Express server with environment and logging
2. **Authentication System** - Multi-provider auth with bearer tokens
3. **Data Models** - OpenAI-compatible models with Zod validation
4. **Message Processing** - Format conversion and content filtering
5. **Session Management** - In-memory sessions with TTL cleanup
6. **Claude SDK Integration** - Streaming and response parsing
7. **Tools Management** - 11 Claude Code tools with header parsing
8. **Parameter Validation** - Request validation and compatibility
9. **Middleware System** - CORS, debug, validation, error handling
10. **Chat Completions** - Core endpoint with streaming support
11. **Models & Health** - Utility endpoints
12. **Auth Status** - Authentication reporting
13. **Session Endpoints** - Session CRUD operations
14. **Debug Endpoints** - Compatibility and debugging
15. **Production Ready** - Integration testing and deployment

Each phase implements a **complete, testable feature** with full test coverage.

## 📚 Documentation

Comprehensive documentation in the `docs/` folder:

- **[README.md](./docs/README.md)** - Complete feature analysis and requirements
- **[IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md)** - 15-phase development roadmap
- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - SOLID/DRY principles and guidelines
- **[API_REFERENCE.md](./docs/API_REFERENCE.md)** - Complete endpoint documentation
- **[CODE_EXAMPLES.md](./docs/CODE_EXAMPLES.md)** - TypeScript implementation examples
- **[PROJECT_STRUCTURE.md](./docs/PROJECT_STRUCTURE.md)** - File organization reference
- **[CLAUDE_SDK_REFERENCE.md](./docs/CLAUDE_SDK_REFERENCE.md)** - Node.js SDK integration

## 🤝 Contributing

We welcome contributions! This project follows a systematic development approach:

1. **Read the documentation** in `docs/` to understand the architecture
2. **Follow the implementation plan** phases for new features
3. **Maintain SOLID principles** and architecture guidelines
4. **Add comprehensive tests** for all new functionality
5. **Update documentation** as needed

### **Development Guidelines**
- 🏗️ **SOLID principles** enforced with ESLint rules
- 🧪 **Test coverage** required for all features
- 📝 **TypeScript first** with strict type checking
- 🔄 **Feature-complete phases** - no fragmented implementations

## 📄 License

MIT © [ChrisColeTech](https://github.com/ChrisColeTech)

## 🙏 Acknowledgments

- **Claude Code CLI** for the amazing development experience
- **OpenAI** for the API specification standard
- **Anthropic** for Claude and the powerful AI capabilities

---

⭐ **Star this repo** if you find it useful! 

🐛 **Report issues** via [GitHub Issues](https://github.com/ChrisColeTech/claude-wrapper/issues)

💡 **Request features** via [GitHub Issues](https://github.com/ChrisColeTech/claude-wrapper/issues)

🔀 **Submit PRs** - all contributions welcome!