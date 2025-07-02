# Claude Code OpenAI Wrapper - Comprehensive Feature Analysis

This document provides a complete analysis of all features present in the Python implementation of the Claude Code OpenAI Wrapper, serving as the definitive reference for the Node.js port.

## 📋 Overview

The Claude Code OpenAI Wrapper is a FastAPI-based service that provides an OpenAI-compatible API interface for Claude Code CLI. This allows applications designed for OpenAI's Chat Completions API to seamlessly integrate with Anthropic's Claude models through the Claude Code SDK.

## 🏗️ Core Architecture Components

### 1. **FastAPI Application Framework** (`main.py`)
- **ASGI-compliant web server** with production-ready configuration
- **Lifespan management** for startup/shutdown operations
- **CORS middleware** with configurable origins
- **Custom exception handling** for validation errors and HTTP exceptions
- **Debug logging middleware** with detailed request/response tracking
- **Health check endpoint** for monitoring
- **Runtime API key generation** with interactive security configuration

### 2. **Authentication System** (`auth.py`)
- **Multi-provider authentication support**:
  - **Anthropic API Key** authentication (`ANTHROPIC_API_KEY`)
  - **AWS Bedrock** authentication (`CLAUDE_CODE_USE_BEDROCK=1`)
  - **Google Vertex AI** authentication (`CLAUDE_CODE_USE_VERTEX=1`)
  - **Claude Code CLI** authentication (fallback)
- **Authentication validation** with detailed error reporting
- **Environment variable management** for each auth method
- **FastAPI endpoint protection** with Bearer token authentication
- **Runtime API key support** for dynamic security

### 3. **Session Management System** (`session_manager.py`)
- **Conversation session tracking** with unique session IDs
- **Message history persistence** within session TTL
- **Automatic session cleanup** with configurable intervals
- **Session expiration** with customizable TTL (default 1 hour)
- **Thread-safe operations** with locking mechanisms
- **Session statistics** and monitoring capabilities
- **Stateless and stateful** operation modes

### 4. **Message Processing** (`message_adapter.py`)
- **OpenAI to Claude format conversion**
- **Content filtering** for unsupported features:
  - Thinking blocks removal
  - Tool usage block filtering
  - Image reference handling
  - Attempt completion extraction
- **Token estimation** for usage reporting
- **System prompt extraction** from message arrays
- **Content normalization** and cleanup

### 5. **Claude Code SDK Integration** (`claude_cli.py`)
- **Python SDK wrapper** for Claude Code CLI
- **Authentication environment management**
- **Streaming and non-streaming** response support
- **Error handling and recovery**
- **Message parsing** for multiple SDK formats
- **Metadata extraction** (costs, tokens, session info)
- **SDK verification** and health checking

### 6. **Parameter Validation** (`parameter_validator.py`)
- **OpenAI parameter validation** with detailed error reporting
- **Claude Code SDK compatibility** checking
- **Custom header extraction** for Claude-specific options
- **Model validation** against supported models
- **Tool validation** for allowed/disallowed tools
- **Permission mode validation**
- **Compatibility reporting** with suggestions

### 7. **Data Models** (`models.py`)
- **Pydantic models** for request/response validation
- **OpenAI API compatibility** structures
- **Content normalization** for multimodal support
- **Session management** models
- **Error response** standardization
- **Streaming response** models

## 🚀 API Endpoints

### **Core Chat Completions**
- **`POST /v1/chat/completions`** - Main chat endpoint with streaming/non-streaming support
- **`GET /v1/models`** - List available Claude models

### **Authentication & Status**
- **`GET /v1/auth/status`** - Claude Code authentication status
- **`GET /health`** - Service health check

### **Session Management**
- **`GET /v1/sessions`** - List all active sessions
- **`GET /v1/sessions/{session_id}`** - Get specific session information
- **`DELETE /v1/sessions/{session_id}`** - Delete specific session
- **`GET /v1/sessions/stats`** - Session manager statistics

### **Development & Debug**
- **`POST /v1/debug/request`** - Request validation debugging
- **`POST /v1/compatibility`** - OpenAI compatibility analysis

## 🔧 Configuration Features

### **Environment Variables**
- **`DEBUG_MODE`** - Enable detailed debug logging
- **`VERBOSE`** - Enable verbose logging
- **`PORT`** - Server port configuration (default: 8000)
- **`CORS_ORIGINS`** - CORS configuration (JSON array)
- **`MAX_TIMEOUT`** - Claude Code CLI timeout (default: 600000ms)
- **`CLAUDE_CWD`** - Working directory for Claude Code CLI
- **`API_KEY`** - Static API key for endpoint protection

### **Claude Code Authentication**
- **`ANTHROPIC_API_KEY`** - Anthropic API key
- **`CLAUDE_CODE_USE_BEDROCK`** - Enable AWS Bedrock
- **`AWS_ACCESS_KEY_ID`** - AWS credentials
- **`AWS_SECRET_ACCESS_KEY`** - AWS credentials
- **`AWS_REGION`** - AWS region
- **`CLAUDE_CODE_USE_VERTEX`** - Enable Google Vertex AI
- **`ANTHROPIC_VERTEX_PROJECT_ID`** - GCP project ID
- **`CLOUD_ML_REGION`** - GCP region
- **`GOOGLE_APPLICATION_CREDENTIALS`** - GCP credentials

## 📊 Advanced Features

### **Streaming Support**
- **Server-Sent Events (SSE)** for real-time responses
- **Chunked response processing** with proper formatting
- **Stream error handling** with graceful fallbacks
- **Content filtering** during streaming
- **Session integration** with streaming responses

### **Tool Management**
- **Tool disabling by default** for OpenAI compatibility
- **Configurable tool restrictions** (allowed/disallowed lists)
- **Tool usage filtering** from responses
- **Permission mode support** for tool execution

### **Custom Headers Support**
- **`X-Claude-Max-Turns`** - Control conversation length
- **`X-Claude-Allowed-Tools`** - Specify allowed tools
- **`X-Claude-Disallowed-Tools`** - Specify disallowed tools
- **`X-Claude-Permission-Mode`** - Set permission mode
- **`X-Claude-Max-Thinking-Tokens`** - Limit thinking tokens

### **Error Handling**
- **Structured error responses** matching OpenAI format
- **Detailed validation errors** with field-level feedback
- **Authentication error handling** with helpful messages
- **Timeout handling** for long-running requests
- **Graceful degradation** for partial failures

### **Security Features**
- **Interactive API key setup** during server startup
- **Runtime API key generation** with secure tokens
- **Bearer token authentication** for API endpoints
- **CORS protection** with configurable origins
- **Request validation** to prevent malicious input

### **Monitoring & Observability**
- **Comprehensive logging** with configurable levels
- **Request/response debugging** in debug mode
- **Performance timing** for request processing
- **Session statistics** for usage monitoring
- **Authentication status** reporting

## 🔄 OpenAI API Compatibility

### **Supported Parameters**
- **`model`** - Claude model selection
- **`messages`** - Conversation messages
- **`stream`** - Streaming response control
- **`session_id`** - Custom session management
- **`enable_tools`** - Tool activation control
- **`user`** - User identification for logging

### **Unsupported Parameters (with warnings)**
- **`temperature`** - Not supported by Claude Code SDK
- **`top_p`** - Not supported by Claude Code SDK
- **`n`** - Only single responses supported
- **`max_tokens`** - Use `max_turns` instead
- **`presence_penalty`** - Not supported
- **`frequency_penalty`** - Not supported
- **`logit_bias`** - Not supported
- **`stop`** - Not supported

### **Extensions to OpenAI API**
- **`session_id`** - Conversation continuity
- **`enable_tools`** - Claude Code tool control
- **Custom headers** for Claude-specific parameters

## 🧪 Testing Infrastructure

### **Test Categories**
- **Basic functionality** (`test_basic.py`)
- **Endpoint testing** (`test_endpoints.py`)
- **Parameter mapping** (`test_parameter_mapping.py`)
- **Session management** (`test_session_*.py`)
- **Content filtering** (`test_textblock_fix.py`)
- **Streaming responses** (`test_non_streaming.py`)

### **Example Implementations**
- **cURL examples** (`curl_example.sh`)
- **OpenAI SDK integration** (`openai_sdk.py`)
- **Session continuity** (`session_continuity.py`)
- **Streaming examples** (`streaming.py`)

## 🏃 Runtime Behavior

### **Server Startup Sequence**
1. **Environment variable loading** from `.env` file
2. **Debug mode configuration** and logging setup
3. **Interactive API key setup** (if not configured)
4. **Claude Code authentication** validation
5. **CLI verification** with test query
6. **Session manager initialization**
7. **Automatic cleanup task** startup
8. **Port availability checking** with fallback

### **Request Processing Flow**
1. **API key validation** (if configured)
2. **Request model validation** against Pydantic schemas
3. **Claude Code authentication** verification
4. **Custom header extraction** for Claude options
5. **Session message processing** (if session_id provided)
6. **Message format conversion** (OpenAI → Claude)
7. **Content filtering** for unsupported features
8. **Claude Code SDK execution** with proper options
9. **Response processing** and format conversion
10. **Session state updates** (if applicable)

### **Error Recovery**
- **Port conflicts** resolved with automatic port finding
- **Authentication failures** with detailed guidance
- **Request validation** with helpful error messages
- **SDK errors** with graceful fallbacks
- **Session cleanup** for expired sessions

## 📈 Performance Considerations

### **Optimization Features**
- **Automatic session cleanup** to prevent memory leaks
- **Connection pooling** through FastAPI/Uvicorn
- **Streaming responses** for better perceived performance
- **Efficient message filtering** with compiled regex patterns
- **Minimal token estimation** for usage reporting

### **Resource Management**
- **Configurable timeouts** for long-running operations
- **Session TTL management** with automatic expiration
- **Memory-efficient message storage** in sessions
- **Graceful shutdown** with cleanup operations

## 🔧 Deployment Features

### **Production Readiness**
- **ASGI-compatible** for production deployment
- **Environment-based configuration**
- **Health check endpoints** for load balancers
- **Structured logging** for monitoring systems
- **Error tracking** with detailed context
- **Graceful shutdown** handling

### **Docker Compatibility**
- **Environment variable configuration**
- **Port configuration** with fallbacks
- **Working directory** support for Claude Code CLI
- **Credential management** for cloud deployments

## 📚 Dependencies

### **Core Dependencies**
- **FastAPI** - Web framework with automatic API documentation
- **Uvicorn** - ASGI server for production deployment
- **Pydantic** - Data validation and serialization
- **Claude Code SDK** - Python integration for Claude Code CLI
- **python-dotenv** - Environment variable management

### **Development Dependencies**
- **pytest** - Testing framework
- **requests** - HTTP client for testing
- **poetry** - Dependency management and packaging

This comprehensive analysis covers all features, capabilities, and implementation details of the Python Claude Code OpenAI Wrapper, providing the complete foundation needed for the Node.js port.