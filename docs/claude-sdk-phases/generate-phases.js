#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

// Claude SDK Integration phase definitions with all the specific details
const phases = [
  {
    number: "01",
    title: "Claude Service Foundation",
    goal: "Create the core Claude service interface and basic SDK integration",
    completeFeature:
      "Actual Claude Code SDK integration replacing mock responses",
    claudeReference:
      "Based on CLAUDE_SDK_REFERENCE.md: Authentication Integration, Core SDK Integration Pattern, CLI Verification",
    performanceRequirement:
      "Single-turn completion response <2s with actual Claude",
    filesCreate: `CREATE: src/claude/sdk-client.ts - Direct Claude Code SDK wrapper implementing patterns from CLAUDE_SDK_REFERENCE.md
CREATE: src/claude/interfaces.ts - Claude service interfaces and types matching Python claude_cli.py
CREATE: src/claude/error-types.ts - Error classes (ClaudeSDKError, AuthenticationError, StreamingError)
CREATE: tests/unit/claude/sdk-client.test.ts - SDK client unit tests
CREATE: tests/integration/claude/basic-integration.test.ts - Basic integration tests using SDK verification pattern
UPDATE: src/claude/service.ts - Replace mock createCompletion with actual SDK calls
UPDATE: src/claude/index.ts - Export new SDK client and interfaces
UPDATE: package.json - Add Claude Code SDK dependency: @anthropic-ai/claude-code: ^1.0.41`,
    implementationDetails: `- Direct Claude Code SDK integration using @anthropic-ai/claude-code package
- Replace all mock responses with actual Claude API calls
- Implement ClaudeSDKWrapper interface from CLAUDE_SDK_REFERENCE.md
- Error handling for authentication failures using patterns from reference
- Connection timeout handling and SDK verification
- Authentication detection (API key, Bedrock, Vertex AI, CLI)
- Basic text completion working (simple prompt → response)
- Named constants for all Claude SDK configurations`,
    srpRequirement:
      "ClaudeSDKClient handles only SDK communication operations (<200 lines)",
    extensionType: "Claude SDK integration",
    componentType: "SDK handlers",
    interfaceName: "IClaudeSDKClient",
    interfaceList: "IClaudeService, ISDKVerifier",
    dependencyAbstractions: "Authentication and environment abstractions",
    patternType: "SDK integration",
    utilsName: "ClaudeSDKUtils",
    magicType: "Values",
    constantType: "SDK configuration values and timeouts",
    errorType: "ClaudeSDKError",
    errorInfo: "SDK operation status information",
    mainClass: "ClaudeSDKClient",
    focusArea: "Claude SDK integration",
    logicType: "SDK communication",
    ruleType: "SDK integration",
    configType: "SDK configuration and authentication",
    magicValues: "Values",
    constantExamples: "SDK_TIMEOUTS.DEFAULT, AUTH_METHODS.ANTHROPIC_API_KEY",
    featureType: "Claude SDK foundation",
    unitTestCoverage:
      "ClaudeSDKClient, error handling, authentication detection edge cases",
    integrationTestCoverage:
      "Basic Claude SDK integration with real authentication",
    mockRequirements:
      "Mock external SDK calls, test business logic with actual auth",
    errorScenarios:
      "Authentication failures, SDK unavailable, connection timeouts",
    performanceTests: "Single-turn completion response <2s with actual Claude",
    compatibilityRequirement:
      "SDK integration maintains OpenAI API compatibility",
    performanceCriteria:
      "single-turn completion response <2s with actual Claude",
    compatibilityChecklist: `- ✅ SDK client can be instantiated with different auth methods
- ✅ Basic text completion works (simple prompt → response)
- ✅ Error handling for authentication failures using patterns from CLAUDE_SDK_REFERENCE.md
- ✅ Connection timeout handling
- ✅ SDK verification function works (based on verifyClaudeSDK pattern)`,
    testableFeatures: `- Single-turn text completion working with actual Claude
- Proper error handling and logging matching Python patterns
- Authentication method detection and validation
- SDK availability verification and connection testing
- Basic Claude response parsing and content extraction`,
    demoType: "Claude SDK foundation",
    reviewFocus:
      "SDK integration correctness, authentication handling, error management",
    auditTitle: "Claude SDK Foundation",
    auditRequirements: `- **SDK integration** must replace all mock responses with actual Claude calls
- **Authentication handling** must support all methods from CLAUDE_SDK_REFERENCE.md
- **Error management** must handle all failure scenarios gracefully
- **Performance requirements** must achieve <2s response times
- **OpenAI compatibility** must maintain API contract while using Claude`,
    testReviewRequirements: `- **SDK integration tests**: Test actual Claude SDK calls and responses
- **Authentication tests**: Test all authentication methods and error scenarios
- **Performance tests**: Test response time requirements with real Claude
- **Error handling tests**: Test all SDK error scenarios and recovery
- **Compatibility tests**: Test OpenAI API compatibility with Claude backend`,
    integrationValidation: `- **Claude SDK Integration**: Verify SDK calls work with actual Claude service
- **Authentication Integration**: Verify all auth methods work with SDK
- **Error Handling Integration**: Verify error handling works correctly with SDK
- **Performance Integration**: Verify response times meet requirements`,
    performanceValidation: `- **Response speed**: <2s for single-turn completions with actual Claude
- **Authentication performance**: Fast auth method detection and verification
- **Error handling performance**: Minimal overhead for error detection and handling
- **SDK initialization**: Fast SDK setup and connection establishment`,
    documentationReview: `- **SDK integration guide**: Document Claude SDK setup and usage
- **Authentication guide**: Document all authentication methods and configuration
- **Error handling guide**: Document error scenarios and troubleshooting
- **Performance guide**: Document performance optimization and monitoring`,
    integrationTarget: "actual Claude Code SDK",
    nextPhase: "02",
    failureCriteria: `- ❌ Mock responses still present in any completion endpoints
- ❌ Any placeholder SDK implementations remain in codebase
- ❌ Performance criteria not met (responses >2s with Claude)
- ❌ Authentication failures not handled properly
- ❌ SDK integration failures or connection issues
- ❌ Test passing below 100% or tests failing`,
  },
  {
    number: "02",
    title: "Message Format Conversion",
    goal: "Implement proper OpenAI ↔ Claude message format conversion",
    completeFeature:
      "Complete message format conversion with session continuity",
    claudeReference:
      "Based on CLAUDE_SDK_REFERENCE.md: Parameter Mapping, Message Processing",
    performanceRequirement: "Message conversion processing <50ms per request",
    filesCreate: `CREATE: src/message/claude-converter.ts - OpenAI to Claude format conversion implementing OpenAIToClaudeMapping
CREATE: src/message/openai-converter.ts - Claude to OpenAI format conversion
CREATE: src/message/message-parser.ts - Claude message parsing using ClaudeMessageProcessor pattern
CREATE: tests/unit/message/claude-converter.test.ts - Conversion logic tests
CREATE: tests/unit/message/openai-converter.test.ts - OpenAI format tests
CREATE: tests/unit/message/message-parser.test.ts - Message parsing tests
UPDATE: src/services/message-service.ts - Use new converters and implement extractContent filtering
UPDATE: src/routes/chat.ts - Remove mock response, use real conversion and mapToClaudeOptions`,
    implementationDetails: `- OpenAI message format to Claude prompt conversion using mapToClaudeOptions
- Claude response to OpenAI format conversion with proper structure
- Message parsing with content filtering (thinking blocks, tool usage)
- System message handling and prompt construction
- Multi-turn conversation support with continue_conversation option
- Content filtering matching Python patterns (extractContent method)
- Session continuity with proper message history management
- Named constants for all message format configurations`,
    srpRequirement:
      "ClaudeConverter handles only format conversion operations (<200 lines)",
    extensionType: "message conversion strategies",
    componentType: "message converters",
    interfaceName: "IClaudeConverter",
    interfaceList: "IOpenAIConverter, IMessageParser",
    dependencyAbstractions: "IClaudeSDKClient and SDK abstractions",
    patternType: "message conversion",
    utilsName: "MessageConversionUtils",
    magicType: "Values",
    constantType: "message format values and conversion rules",
    errorType: "MessageConversionError",
    errorInfo: "message conversion status information",
    mainClass: "ClaudeConverter",
    focusArea: "message format conversion",
    logicType: "message conversion",
    ruleType: "format conversion",
    configType: "message format configuration and conversion rules",
    magicValues: "Values",
    constantExamples:
      "MESSAGE_FORMATS.OPENAI, CONVERSION_MODES.CLAUDE_TO_OPENAI",
    featureType: "message format conversion",
    unitTestCoverage:
      "ClaudeConverter, OpenAI conversion, message parsing edge cases",
    integrationTestCoverage:
      "Message conversion with complete Claude SDK integration",
    mockRequirements: "Mock IClaudeSDKClient for conversion testing",
    errorScenarios:
      "Invalid message formats, conversion failures, parsing errors",
    performanceTests: "Message conversion processing <50ms per request",
    compatibilityRequirement:
      "message conversion maintains OpenAI format compatibility",
    performanceCriteria: "message conversion processing <50ms per request",
    compatibilityChecklist: `- ✅ OpenAI messages convert correctly to Claude format using mapToClaudeOptions
- ✅ Claude responses convert correctly to OpenAI format
- ✅ System messages handled properly
- ✅ Multi-turn conversations preserved with continue_conversation
- ✅ Content filtering works (thinking blocks, tool usage) matching Python patterns
- ✅ Edge cases (empty messages, special characters)`,
    testableFeatures: `- Chat completion returns actual Claude responses (not mock data)
- Message history preserved correctly with session continuity
- All message formats handled properly matching Python behavior
- Content filtering removes thinking blocks and tool usage correctly
- OpenAI API structure maintained while using Claude backend`,
    demoType: "message format conversion",
    reviewFocus: "Conversion accuracy, format compatibility, content filtering",
    auditTitle: "Message Format Conversion",
    auditRequirements: `- **Conversion accuracy** must maintain message content and context
- **Format compatibility** must preserve OpenAI API structure
- **Content filtering** must match Python implementation patterns
- **Session continuity** must work with multi-turn conversations
- **Performance requirements** must achieve <50ms conversion times`,
    testReviewRequirements: `- **Conversion tests**: Test OpenAI ↔ Claude format conversion accuracy
- **Format tests**: Test OpenAI API format preservation
- **Content filtering tests**: Test thinking block and tool usage removal
- **Session tests**: Test multi-turn conversation continuity
- **Performance tests**: Test conversion speed requirements`,
    integrationValidation: `- **SDK Integration**: Verify conversion works with actual Claude SDK
- **Format Integration**: Verify OpenAI format compatibility maintained
- **Session Integration**: Verify session continuity with message history
- **Content Integration**: Verify content filtering matches Python behavior`,
    performanceValidation: `- **Conversion speed**: <50ms for message format conversion per request
- **Processing efficiency**: Fast message parsing and content extraction
- **Memory usage**: Efficient message conversion without memory accumulation
- **Concurrent conversion**: Support for multiple simultaneous conversions`,
    documentationReview: `- **Conversion documentation**: Document message format conversion process
- **Format guide**: Document OpenAI and Claude format differences
- **Content filtering guide**: Document content processing and filtering
- **Session guide**: Document session continuity and message history`,
    integrationTarget: "Claude SDK with message conversion",
    nextPhase: "03",
    failureCriteria: `- ❌ Message conversion doesn't maintain OpenAI format compatibility
- ❌ Any placeholder conversion logic remains in codebase
- ❌ Performance criteria not met (conversion >50ms)
- ❌ Content filtering doesn't match Python patterns
- ❌ Session continuity broken or message history lost
- ❌ Test passing below 100% or tests failing`,
  },
  {
    number: "03",
    title: "Model Selection and Validation",
    goal: "Implement proper model selection and validation with Claude SDK",
    completeFeature: "Complete model management with Claude SDK capabilities",
    claudeReference: "Based on CLAUDE_SDK_REFERENCE.md: Configuration Options",
    performanceRequirement: "Model validation processing <10ms per request",
    filesCreate: `CREATE: src/claude/model-manager.ts - Model validation and selection
CREATE: src/claude/model-config.ts - Model configurations and capabilities
CREATE: tests/unit/claude/model-manager.test.ts - Model management tests
UPDATE: src/validation/validator.ts - Use actual model validation against Claude SDK capabilities
UPDATE: src/routes/models.ts - Return actual available models from SDK
UPDATE: src/claude/service.ts - Add model parameter to SDK calls`,
    implementationDetails: `- Model validation against actual Claude SDK capabilities
- Model selection that affects Claude behavior through SDK
- Support for Claude model variants (claude-3-5-sonnet-20241022, etc.)
- Model capability detection and feature support validation
- Default model fallback behavior matching Python patterns
- Model configuration management and capability mapping
- Integration with Claude SDK model parameter passing
- Named constants for all supported models and configurations`,
    srpRequirement:
      "ModelManager handles only model management operations (<200 lines)",
    extensionType: "model management strategies",
    componentType: "model validators",
    interfaceName: "IModelManager",
    interfaceList: "IModelValidator, IModelConfig",
    dependencyAbstractions: "IClaudeConverter and conversion abstractions",
    patternType: "model management",
    utilsName: "ModelManagementUtils",
    magicType: "Values",
    constantType: "model values and validation rules",
    errorType: "ModelValidationError",
    errorInfo: "model validation status information",
    mainClass: "ModelManager",
    focusArea: "model validation",
    logicType: "model management",
    ruleType: "model validation",
    configType: "model configuration and validation rules",
    magicValues: "Values",
    constantExamples:
      "CLAUDE_MODELS.SONNET_3_5, MODEL_CAPABILITIES.TOOLS_SUPPORT",
    featureType: "model selection and validation",
    unitTestCoverage:
      "ModelManager, model validation, configuration edge cases",
    integrationTestCoverage: "Model management with Claude SDK integration",
    mockRequirements: "Mock IClaudeConverter, model capability services",
    errorScenarios:
      "Invalid model requests, unsupported models, validation failures",
    performanceTests: "Model validation processing <10ms per request",
    compatibilityRequirement:
      "model validation maintains OpenAI model API compatibility",
    performanceCriteria: "model validation processing <10ms per request",
    compatibilityChecklist: `- ✅ Model validation against actual Claude SDK capabilities
- ✅ Model selection works correctly and affects Claude behavior
- ✅ Invalid model requests rejected with proper errors
- ✅ Default model fallback behavior matches Python patterns`,
    testableFeatures: `- Only valid Claude models accepted (claude-3-5-sonnet-20241022, etc.)
- Model selection affects actual Claude behavior
- Proper error messages for invalid models
- Model capabilities correctly reported through /v1/models endpoint
- Default model handling works consistently`,
    demoType: "model selection and validation",
    reviewFocus:
      "Model validation accuracy, capability detection, error handling",
    auditTitle: "Model Selection and Validation",
    auditRequirements: `- **Model validation accuracy** must validate against actual Claude capabilities
- **Capability detection** must correctly identify model features
- **Error handling** must provide clear invalid model messages
- **Performance requirements** must achieve <10ms validation times
- **OpenAI compatibility** must maintain model API structure`,
    testReviewRequirements: `- **Validation tests**: Test model validation against Claude SDK capabilities
- **Capability tests**: Test model capability detection and reporting
- **Error tests**: Test invalid model handling and error messages
- **Performance tests**: Test validation speed requirements
- **Compatibility tests**: Test OpenAI model API compatibility`,
    integrationValidation: `- **SDK Integration**: Verify model validation works with Claude SDK
- **Conversion Integration**: Verify model selection works with message conversion
- **API Integration**: Verify /v1/models endpoint returns correct information
- **Error Integration**: Verify error handling integrates with request processing`,
    performanceValidation: `- **Validation speed**: <10ms for model validation per request
- **Capability lookup**: Fast model capability detection
- **Error processing**: Minimal overhead for invalid model handling
- **Model selection**: Fast model parameter application to SDK calls`,
    documentationReview: `- **Model documentation**: Document supported Claude models and capabilities
- **Validation guide**: Document model validation process and requirements
- **Error guide**: Document model error handling and troubleshooting
- **Capability guide**: Document model capabilities and feature support`,
    integrationTarget: "Claude SDK with model management",
    nextPhase: "04",
    failureCriteria: `- ❌ Model validation doesn't work with actual Claude SDK
- ❌ Any placeholder model implementations remain
- ❌ Performance criteria not met (validation >10ms)
- ❌ Invalid models not properly rejected
- ❌ Model selection doesn't affect Claude behavior
- ❌ Test passing below 100% or tests failing`,
  },
  {
    number: "04",
    title: "Non-Streaming Completions",
    goal: "Complete non-streaming chat completions with full SDK integration",
    completeFeature:
      "Production-ready non-streaming completions with actual Claude",
    claudeReference:
      "Based on CLAUDE_SDK_REFERENCE.md: Core SDK Integration Pattern, Usage Metadata Extraction",
    performanceRequirement: "Non-streaming completion response <3s end-to-end",
    filesCreate: `CREATE: src/claude/completion-manager.ts - Non-streaming completion logic using executeQuery pattern
CREATE: src/claude/metadata-extractor.ts - Token and cost extraction using extractUsageFromClaudeResponse
CREATE: tests/integration/claude/non-streaming.test.ts - Non-streaming integration tests
CREATE: tests/e2e/chat/basic-completions.test.ts - End-to-end completion tests
UPDATE: src/claude/service.ts - Implement real createCompletion method using SDK
UPDATE: src/routes/chat.ts - Remove all mock logic from non-streaming path`,
    implementationDetails: `- Complete non-streaming completion implementation using Claude SDK
- Token counting and cost calculation using extractUsageFromClaudeResponse
- Session continuity with continue_conversation option
- Error handling for all completion scenarios using ClaudeSDKError types
- Response timing and metadata extraction from Claude responses
- Multi-turn conversation support with proper session management
- Tool configuration (disabled by default for OpenAI compatibility)
- Named constants for all completion configurations and parameters`,
    srpRequirement:
      "CompletionManager handles only completion operations (<200 lines)",
    extensionType: "completion strategies",
    componentType: "completion handlers",
    interfaceName: "ICompletionManager",
    interfaceList: "IMetadataExtractor, ISessionManager",
    dependencyAbstractions: "IModelManager and model abstractions",
    patternType: "completion management",
    utilsName: "CompletionUtils",
    magicType: "Values",
    constantType: "completion values and configuration",
    errorType: "CompletionError",
    errorInfo: "completion status information",
    mainClass: "CompletionManager",
    focusArea: "non-streaming completions",
    logicType: "completion",
    ruleType: "completion processing",
    configType: "completion configuration and parameters",
    magicValues: "Values",
    constantExamples: "COMPLETION_MODES.NON_STREAMING, TOKEN_ESTIMATION.CLAUDE",
    featureType: "non-streaming completions",
    unitTestCoverage:
      "CompletionManager, metadata extraction, session management edge cases",
    integrationTestCoverage:
      "Non-streaming completions with complete Claude SDK",
    mockRequirements: "Mock IModelManager, external completion services",
    errorScenarios: "Completion failures, timeout issues, session errors",
    performanceTests: "Non-streaming completion response <3s end-to-end",
    compatibilityRequirement:
      "non-streaming completions maintain OpenAI API compatibility",
    performanceCriteria: "non-streaming completion response <3s end-to-end",
    compatibilityChecklist: `- ✅ Simple Q&A completions work correctly (e.g., "What is 2+2?" → "4")
- ✅ Multi-turn conversations work with session continuity
- ✅ Token counting is accurate using extractUsageFromClaudeResponse pattern
- ✅ Response timing and metadata correct
- ✅ Error scenarios handled properly using ClaudeSDKError types`,
    testableFeatures: `- Non-streaming completions fully functional (replaces mock responses)
- Accurate token and cost reporting matching Python patterns
- Proper session continuity with continue_conversation option
- Complete error handling for all completion scenarios
- Multi-turn conversations work correctly with message history`,
    demoType: "non-streaming completions",
    reviewFocus: "Completion accuracy, session continuity, error handling",
    auditTitle: "Non-Streaming Completions",
    auditRequirements: `- **Completion accuracy** must provide correct Claude responses
- **Session continuity** must maintain conversation context
- **Error handling** must handle all failure scenarios gracefully
- **Performance requirements** must achieve <3s response times
- **Token accuracy** must provide precise usage metrics`,
    testReviewRequirements: `- **Completion tests**: Test non-streaming completion accuracy and functionality
- **Session tests**: Test session continuity and conversation management
- **Error tests**: Test all completion error scenarios and recovery
- **Performance tests**: Test completion speed requirements
- **Token tests**: Test token counting and usage reporting accuracy`,
    integrationValidation: `- **SDK Integration**: Verify completions work with actual Claude SDK
- **Model Integration**: Verify completions work with model selection
- **Session Integration**: Verify session continuity across completions
- **Error Integration**: Verify error handling works across all components`,
    performanceValidation: `- **Completion speed**: <3s for non-streaming completions end-to-end
- **Token processing**: Fast and accurate token counting
- **Session performance**: Efficient session management and history retrieval
- **Error handling performance**: Minimal overhead for error detection`,
    documentationReview: `- **Completion documentation**: Document non-streaming completion process
- **Session guide**: Document session management and continuity
- **Error guide**: Document completion error handling and troubleshooting
- **Performance guide**: Document completion optimization and monitoring`,
    integrationTarget: "complete Claude SDK with completions",
    nextPhase: "05",
    failureCriteria: `- ❌ Non-streaming completions don't work with actual Claude
- ❌ Any mock completion logic remains in codebase
- ❌ Performance criteria not met (completions >3s)
- ❌ Session continuity broken or unreliable
- ❌ Token counting inaccurate or missing
- ❌ Test passing below 100% or tests failing`,
  },
  {
    number: "05",
    title: "Streaming Completions",
    goal: "Implement real-time streaming responses",
    completeFeature: "Production-ready streaming completions with Claude SDK",
    claudeReference:
      "Based on CLAUDE_SDK_REFERENCE.md: Streaming Implementation",
    performanceRequirement:
      "First streaming chunk response <500ms, subsequent chunks <100ms",
    filesCreate: `CREATE: src/claude/streaming-manager.ts - Streaming completion logic using processClaudeStream pattern
CREATE: src/claude/sse-formatter.ts - Server-Sent Events formatting for OpenAI compatibility
CREATE: tests/integration/claude/streaming.test.ts - Streaming integration tests
CREATE: tests/e2e/chat/streaming-completions.test.ts - End-to-end streaming tests
UPDATE: src/claude/service.ts - Implement createStreamingChatCompletion method
UPDATE: src/routes/chat.ts - Replace mock streaming logic with real SDK calls`,
    implementationDetails: `- Real-time streaming using Claude SDK async generator pattern
- Server-Sent Events formatting for OpenAI compatibility
- Streaming response parsing using processClaudeStream pattern
- Error handling during streaming using StreamingError
- Client disconnection handling and cleanup
- Stream termination and completion detection
- Chunk processing and delta calculation for incremental updates
- Named constants for all streaming configurations and parameters`,
    srpRequirement:
      "StreamingManager handles only streaming operations (<200 lines)",
    extensionType: "streaming strategies",
    componentType: "streaming handlers",
    interfaceName: "IStreamingManager",
    interfaceList: "ISSEFormatter, IStreamProcessor",
    dependencyAbstractions: "ICompletionManager and completion abstractions",
    patternType: "streaming",
    utilsName: "StreamingUtils",
    magicType: "Values",
    constantType: "streaming values and configuration",
    errorType: "StreamingError",
    errorInfo: "streaming status information",
    mainClass: "StreamingManager",
    focusArea: "streaming completions",
    logicType: "streaming",
    ruleType: "streaming processing",
    configType: "streaming configuration and parameters",
    magicValues: "Values",
    constantExamples:
      "STREAMING_MODES.REAL_TIME, SSE_FORMATS.OPENAI_COMPATIBLE",
    featureType: "streaming completions",
    unitTestCoverage:
      "StreamingManager, SSE formatting, stream processing edge cases",
    integrationTestCoverage: "Streaming completions with complete Claude SDK",
    mockRequirements: "Mock ICompletionManager, streaming services for testing",
    errorScenarios:
      "Stream interruption, client disconnection, streaming failures",
    performanceTests:
      "First streaming chunk response <500ms, subsequent chunks <100ms",
    compatibilityRequirement:
      "streaming completions maintain OpenAI streaming API compatibility",
    performanceCriteria:
      "first streaming chunk response <500ms, subsequent chunks <100ms",
    compatibilityChecklist: `- ✅ Streaming responses work in real-time with actual Claude
- ✅ Proper SSE formatting and chunking for OpenAI compatibility
- ✅ Stream termination handled correctly
- ✅ Error handling during streaming using StreamingError
- ✅ Client disconnection handling`,
    testableFeatures: `- Streaming completions work with real Claude responses (no mock data)
- Proper OpenAI-compatible streaming format
- Robust error handling and connection management
- Real-time response delivery with appropriate chunk timing
- Clean stream termination and resource cleanup`,
    demoType: "streaming completions",
    reviewFocus: "Streaming reliability, format compatibility, error handling",
    auditTitle: "Streaming Completions",
    auditRequirements: `- **Streaming reliability** must provide consistent real-time responses
- **Format compatibility** must maintain OpenAI streaming API structure
- **Error handling** must handle stream interruptions gracefully
- **Performance requirements** must achieve streaming timing requirements
- **Connection management** must handle client disconnections properly`,
    testReviewRequirements: `- **Streaming tests**: Test real-time streaming functionality and reliability
- **Format tests**: Test OpenAI streaming format compatibility
- **Error tests**: Test streaming error scenarios and recovery
- **Performance tests**: Test streaming timing requirements
- **Connection tests**: Test client connection and disconnection handling`,
    integrationValidation: `- **SDK Integration**: Verify streaming works with Claude SDK
- **Completion Integration**: Verify streaming builds on completion foundation
- **Format Integration**: Verify OpenAI streaming format compatibility
- **Error Integration**: Verify streaming error handling works correctly`,
    performanceValidation: `- **First chunk speed**: <500ms for first streaming chunk response
- **Subsequent chunks**: <100ms for subsequent streaming chunks
- **Stream processing**: Efficient real-time stream processing
- **Connection management**: Fast client connection and disconnection handling`,
    documentationReview: `- **Streaming documentation**: Document streaming completion process
- **Format guide**: Document OpenAI streaming format compatibility
- **Error guide**: Document streaming error handling and troubleshooting
- **Performance guide**: Document streaming optimization and monitoring`,
    integrationTarget: "complete Claude SDK with streaming",
    nextPhase: "06",
    failureCriteria: `- ❌ Streaming doesn't work with actual Claude SDK
- ❌ Any mock streaming logic remains in codebase
- ❌ Performance criteria not met (first chunk >500ms or subsequent >100ms)
- ❌ OpenAI streaming format compatibility broken
- ❌ Stream error handling unreliable
- ❌ Test passing below 100% or tests failing`,
  },
  {
    number: "06",
    title: "Tools Integration (Optional - Disabled by Default)",
    goal: "Support Claude Code tools when explicitly enabled",
    completeFeature:
      "Complete tools integration with Claude SDK (disabled by default)",
    claudeReference:
      "Based on CLAUDE_SDK_REFERENCE.md: Parameter Mapping (tools configuration)",
    performanceRequirement:
      "Tool-enabled completion response <5s with tools processing",
    filesCreate: `CREATE: src/tools/claude-tools-manager.ts - Claude tools integration using CLAUDE_CODE_TOOLS
CREATE: src/tools/tools-converter.ts - OpenAI ↔ Claude tools format conversion
CREATE: tests/unit/tools/claude-tools-manager.test.ts - Tools management tests
CREATE: tests/integration/tools/tools-integration.test.ts - Tools integration tests
UPDATE: src/claude/service.ts - Add tools support using allowed_tools/disallowed_tools options
UPDATE: src/routes/chat.ts - Handle enable_tools parameter with proper tool configuration`,
    implementationDetails: `- Tools disabled by default for OpenAI compatibility (disallowed_tools = all tools)
- Tools integration using Claude SDK allowed_tools/disallowed_tools options
- Support for all Claude Code tools when explicitly enabled
- Custom tool configuration via X-Claude-Allowed-Tools header
- Tool response formatting and content filtering
- Error handling for tool operation failures
- Tool call result processing and OpenAI format conversion
- Named constants for all tool configurations and tool lists`,
    srpRequirement:
      "ClaudeToolsManager handles only tools management operations (<200 lines)",
    extensionType: "tools integration strategies",
    componentType: "tools handlers",
    interfaceName: "IClaudeToolsManager",
    interfaceList: "IToolsConverter, IToolsConfig",
    dependencyAbstractions: "IStreamingManager and streaming abstractions",
    patternType: "tools integration",
    utilsName: "ToolsUtils",
    magicType: "Values",
    constantType: "tools values and configuration",
    errorType: "ToolsError",
    errorInfo: "tools operation status information",
    mainClass: "ClaudeToolsManager",
    focusArea: "tools integration",
    logicType: "tools management",
    ruleType: "tools processing",
    configType: "tools configuration and management",
    magicValues: "Values",
    constantExamples: "CLAUDE_CODE_TOOLS.ALL, TOOLS_CONFIG.DISABLED_BY_DEFAULT",
    featureType: "tools integration",
    unitTestCoverage:
      "ClaudeToolsManager, tools conversion, configuration edge cases",
    integrationTestCoverage: "Tools integration with complete Claude SDK",
    mockRequirements: "Mock IStreamingManager, tools services for testing",
    errorScenarios:
      "Tool failures, configuration errors, tools processing issues",
    performanceTests:
      "Tool-enabled completion response <5s with tools processing",
    compatibilityRequirement:
      "tools integration maintains OpenAI compatibility (disabled by default)",
    performanceCriteria:
      "tool-enabled completion response <5s with tools processing",
    compatibilityChecklist: `- ✅ Tools disabled by default (OpenAI compatibility)
- ✅ Tools work when explicitly enabled via enable_tools=true
- ✅ Custom tool configuration via X-Claude-Allowed-Tools header
- ✅ Tool responses formatted correctly
- ✅ Tool errors handled gracefully`,
    testableFeatures: `- Tools integration working when enabled
- Maintains OpenAI compatibility (disabled by default)
- Proper tool response formatting and filtering
- Custom tool configuration through headers
- Tool error handling and graceful degradation`,
    demoType: "tools integration",
    reviewFocus:
      "Tools functionality, default disabled behavior, error handling",
    auditTitle: "Tools Integration",
    auditRequirements: `- **Tools functionality** must work correctly when enabled
- **Default behavior** must disable tools for OpenAI compatibility
- **Configuration management** must handle tool selection properly
- **Error handling** must handle tool failures gracefully
- **Format compatibility** must maintain OpenAI tool response structure`,
    testReviewRequirements: `- **Tools tests**: Test tools functionality when enabled
- **Default tests**: Test tools disabled by default behavior
- **Configuration tests**: Test tool configuration and selection
- **Error tests**: Test tool error scenarios and handling
- **Format tests**: Test tool response format compatibility`,
    integrationValidation: `- **SDK Integration**: Verify tools work with Claude SDK
- **Streaming Integration**: Verify tools work with streaming completions
- **Configuration Integration**: Verify tool configuration works correctly
- **Error Integration**: Verify tool error handling works across system`,
    performanceValidation: `- **Tools performance**: <5s for tool-enabled completions with processing
- **Configuration performance**: Fast tool configuration and selection
- **Error handling performance**: Minimal overhead for tool error handling
- **Response processing**: Efficient tool response formatting and filtering`,
    documentationReview: `- **Tools documentation**: Document Claude tools integration and usage
- **Configuration guide**: Document tool configuration and selection
- **Error guide**: Document tool error handling and troubleshooting
- **Compatibility guide**: Document OpenAI compatibility with tools disabled`,
    integrationTarget: "complete Claude SDK with optional tools",
    nextPhase: "07",
    failureCriteria: `- ❌ Tools don't work when enabled or break OpenAI compatibility
- ❌ Tools not properly disabled by default
- ❌ Performance criteria not met (tool completions >5s)
- ❌ Tool configuration or error handling broken
- ❌ Tool response formatting incompatible
- ❌ Test passing below 100% or tests failing`,
  },
  {
    number: "07",
    title: "Advanced Features Integration",
    goal: "Implement advanced Claude SDK features (system prompts, advanced options)",
    completeFeature: "Complete advanced Claude SDK features integration",
    claudeReference:
      "Based on CLAUDE_SDK_REFERENCE.md: Configuration Options, Environment Configuration",
    performanceRequirement:
      "Advanced features processing overhead <100ms per request",
    filesCreate: `CREATE: src/claude/advanced-options.ts - Advanced Claude options handling
CREATE: src/claude/system-prompt-manager.ts - System prompt management
CREATE: src/claude/header-processor.ts - Custom Claude headers processing
CREATE: tests/unit/claude/advanced-options.test.ts - Advanced options tests
UPDATE: src/claude/service.ts - Support all advanced Claude options from ClaudeCodeOptions interface
UPDATE: src/routes/chat.ts - Handle Claude-specific headers and options
UPDATE: src/validation/headers.ts - Process X-Claude-* headers`,
    implementationDetails: `- Support for all ClaudeCodeOptions from CLAUDE_SDK_REFERENCE.md
- System prompt management and processing
- Claude-specific headers processing (X-Claude-Max-Turns, etc.)
- Advanced configuration options (max_turns, permission_mode, etc.)
- Environment variable handling per CLAUDE_SDK_REFERENCE.md
- Resume functionality for conversation continuation
- Max thinking tokens configuration and processing
- Named constants for all advanced configurations and options`,
    srpRequirement:
      "AdvancedOptionsManager handles only advanced options operations (<200 lines)",
    extensionType: "advanced features strategies",
    componentType: "advanced options handlers",
    interfaceName: "IAdvancedOptionsManager",
    interfaceList: "ISystemPromptManager, IHeaderProcessor",
    dependencyAbstractions: "IClaudeToolsManager and tools abstractions",
    patternType: "advanced features",
    utilsName: "AdvancedFeaturesUtils",
    magicType: "Values",
    constantType: "advanced options values and configuration",
    errorType: "AdvancedOptionsError",
    errorInfo: "advanced options status information",
    mainClass: "AdvancedOptionsManager",
    focusArea: "advanced features",
    logicType: "advanced options",
    ruleType: "advanced processing",
    configType: "advanced configuration and options",
    magicValues: "Values",
    constantExamples:
      "ADVANCED_OPTIONS.MAX_TURNS, PERMISSION_MODES.BYPASS_PERMISSIONS",
    featureType: "advanced features integration",
    unitTestCoverage:
      "AdvancedOptionsManager, system prompts, header processing edge cases",
    integrationTestCoverage: "Advanced features with complete Claude SDK",
    mockRequirements: "Mock IClaudeToolsManager, advanced options services",
    errorScenarios:
      "Invalid options, header processing failures, configuration errors",
    performanceTests:
      "Advanced features processing overhead <100ms per request",
    compatibilityRequirement:
      "advanced features maintain OpenAI API compatibility",
    performanceCriteria:
      "advanced features processing overhead <100ms per request",
    compatibilityChecklist: `- ✅ System prompts work correctly
- ✅ Claude-specific options (max_turns, permission_mode, etc.) work
- ✅ Custom headers processed properly (X-Claude-Max-Turns, etc.)
- ✅ Advanced configuration options supported
- ✅ Environment variables handled per CLAUDE_SDK_REFERENCE.md`,
    testableFeatures: `- Full Claude SDK feature parity with Python implementation
- Advanced options working correctly
- Comprehensive Claude integration matching CLAUDE_SDK_REFERENCE.md patterns
- System prompt processing and custom header handling
- Environment configuration management`,
    demoType: "advanced features integration",
    reviewFocus:
      "Advanced options functionality, header processing, configuration management",
    auditTitle: "Advanced Features Integration",
    auditRequirements: `- **Advanced options functionality** must support all Claude SDK features
- **Header processing** must handle all X-Claude-* headers correctly
- **Configuration management** must handle all advanced options
- **System prompt processing** must work with all completion types
- **Environment handling** must follow CLAUDE_SDK_REFERENCE.md patterns`,
    testReviewRequirements: `- **Advanced options tests**: Test all advanced Claude SDK options
- **Header tests**: Test X-Claude-* header processing
- **Configuration tests**: Test advanced configuration management
- **System prompt tests**: Test system prompt processing
- **Environment tests**: Test environment variable handling`,
    integrationValidation: `- **SDK Integration**: Verify advanced features work with Claude SDK
- **Tools Integration**: Verify advanced features work with tools
- **Options Integration**: Verify all options work together correctly
- **Header Integration**: Verify header processing works across system`,
    performanceValidation: `- **Processing overhead**: <100ms for advanced features processing per request
- **Options performance**: Fast advanced options processing
- **Header performance**: Efficient header processing and validation
- **Configuration performance**: Fast configuration management and application`,
    documentationReview: `- **Advanced features documentation**: Document all advanced Claude SDK features
- **Options guide**: Document advanced configuration options
- **Header guide**: Document X-Claude-* header processing
- **Environment guide**: Document environment variable configuration`,
    integrationTarget: "complete Claude SDK with advanced features",
    nextPhase: "08",
    failureCriteria: `- ❌ Advanced features don't work with Claude SDK
- ❌ Header processing broken or incomplete
- ❌ Performance criteria not met (processing >100ms)
- ❌ Configuration management unreliable
- ❌ System prompt processing broken
- ❌ Test passing below 100% or tests failing`,
  },
  {
    number: "08",
    title: "Production Hardening",
    goal: "Production-ready error handling, monitoring, and performance",
    completeFeature:
      "Production-grade Claude SDK integration with comprehensive monitoring",
    claudeReference:
      "Based on CLAUDE_SDK_REFERENCE.md: Error Handling, CLI Verification",
    performanceRequirement: "Production monitoring overhead <5ms per request",
    filesCreate: `CREATE: src/claude/error-handler.ts - Comprehensive Claude error handling using error types from reference
CREATE: src/claude/metrics-collector.ts - Claude SDK metrics and monitoring
CREATE: src/claude/retry-manager.ts - Retry logic for Claude API
CREATE: src/claude/verification.ts - SDK verification using verifyClaudeSDK pattern
CREATE: tests/unit/claude/error-handler.test.ts - Error handling tests
CREATE: tests/unit/claude/retry-manager.test.ts - Retry logic tests
UPDATE: src/claude/service.ts - Add retry logic and comprehensive error handling
UPDATE: src/utils/logger.ts - Add Claude-specific logging
UPDATE: src/monitoring/health-check.ts - Add Claude health checks using verification`,
    implementationDetails: `- Comprehensive error handling using ClaudeSDKError, AuthenticationError, StreamingError
- Claude SDK metrics collection and monitoring
- Retry logic and failover for Claude API calls
- Health checks including Claude status using verifyClaudeSDK
- Rate limiting and throttling for Claude requests
- Performance optimization for production workloads
- Claude-specific logging and audit trails
- Named constants for all production configurations and thresholds`,
    srpRequirement:
      "ErrorHandler handles only error management operations (<200 lines)",
    extensionType: "production hardening strategies",
    componentType: "production handlers",
    interfaceName: "IErrorHandler",
    interfaceList: "IMetricsCollector, IRetryManager",
    dependencyAbstractions:
      "IAdvancedOptionsManager and advanced features abstractions",
    patternType: "production hardening",
    utilsName: "ProductionUtils",
    magicType: "Values",
    constantType: "production values and thresholds",
    errorType: "ProductionError",
    errorInfo: "production status information",
    mainClass: "ErrorHandler",
    focusArea: "production hardening",
    logicType: "production",
    ruleType: "production validation",
    configType: "production configuration and thresholds",
    magicValues: "Values",
    constantExamples:
      "PRODUCTION_LIMITS.RETRY_COUNT, MONITORING_INTERVALS.HEALTH_CHECK",
    featureType: "production hardening",
    unitTestCoverage:
      "ErrorHandler, metrics collection, retry logic edge cases",
    integrationTestCoverage: "Production hardening with complete Claude SDK",
    mockRequirements:
      "Mock IAdvancedOptionsManager, production services for testing",
    errorScenarios: "Production failures, monitoring issues, retry exhaustion",
    performanceTests: "Production monitoring overhead <5ms per request",
    compatibilityRequirement:
      "production hardening maintains OpenAI API compatibility",
    performanceCriteria: "production monitoring overhead <5ms per request",
    compatibilityChecklist: `- ✅ Comprehensive error scenarios covered using SDK error types
- ✅ Retry logic works correctly
- ✅ Performance monitoring functional
- ✅ Health checks include Claude status using verifyClaudeSDK
- ✅ Rate limiting and throttling handled`,
    testableFeatures: `- Production-ready error handling matching Python patterns
- Comprehensive monitoring and metrics
- Robust retry and failover logic
- Health checks including Claude SDK status
- Rate limiting and performance optimization`,
    demoType: "production hardening",
    reviewFocus:
      "Error handling robustness, monitoring accuracy, production readiness",
    auditTitle: "Production Hardening",
    auditRequirements: `- **Error handling robustness** must handle all production scenarios
- **Monitoring accuracy** must provide comprehensive metrics
- **Production readiness** must meet all operational requirements
- **Retry logic reliability** must handle failures gracefully
- **Health check accuracy** must validate Claude SDK status`,
    testReviewRequirements: `- **Error handling tests**: Test all production error scenarios
- **Monitoring tests**: Test metrics collection and monitoring
- **Retry tests**: Test retry logic and failover mechanisms
- **Health check tests**: Test Claude SDK health validation
- **Performance tests**: Test production monitoring overhead`,
    integrationValidation: `- **SDK Integration**: Verify production hardening works with Claude SDK
- **Advanced Features Integration**: Verify hardening works with all features
- **Monitoring Integration**: Verify monitoring captures all system metrics
- **Error Integration**: Verify error handling works across entire system`,
    performanceValidation: `- **Monitoring overhead**: <5ms for production monitoring per request
- **Error handling performance**: Minimal overhead for error detection and handling
- **Retry performance**: Fast retry logic and failover
- **Health check performance**: Efficient Claude SDK status validation`,
    documentationReview: `- **Production documentation**: Complete production deployment and operations guide
- **Error handling guide**: Document error scenarios and troubleshooting
- **Monitoring guide**: Document metrics collection and monitoring setup
- **Health check guide**: Document Claude SDK health validation`,
    integrationTarget: "complete production-ready Claude SDK integration",
    nextPhase: "COMPLETE",
    failureCriteria: `- ❌ Error handling doesn't cover production scenarios
- ❌ Any placeholder production implementations remain
- ❌ Performance criteria not met (monitoring >5ms overhead)
- ❌ Retry logic unreliable or health checks broken
- ❌ Monitoring incomplete or metrics inaccurate
- ❌ Test passing below 100% or tests failing`,
  },
];

function generatePhaseFile(phase) {
  const template = fs.readFileSync(
    path.join(__dirname, "PHASE_TEMPLATE.md"),
    "utf8"
  );

  let content = template
    .replace(/\{\{PHASE_NUMBER\}\}/g, phase.number)
    .replace(/\{\{PHASE_TITLE\}\}/g, phase.title)
    .replace(/\{\{PHASE_GOAL\}\}/g, phase.goal)
    .replace(/\{\{COMPLETE_FEATURE\}\}/g, phase.completeFeature)
    .replace(
      /\{\{PREV_PHASE\}\}/g,
      (parseInt(phase.number) - 1).toString().padStart(2, "0")
    )
    .replace(/\{\{CLAUDE_REFERENCE\}\}/g, phase.claudeReference)
    .replace(/\{\{PERFORMANCE_REQUIREMENT\}\}/g, phase.performanceRequirement)
    .replace(/\{\{FILES_TO_CREATE\}\}/g, phase.filesCreate)
    .replace(/\{\{IMPLEMENTATION_DETAILS\}\}/g, phase.implementationDetails)
    .replace(/\{\{SRP_REQUIREMENT\}\}/g, phase.srpRequirement)
    .replace(/\{\{EXTENSION_TYPE\}\}/g, phase.extensionType)
    .replace(/\{\{COMPONENT_TYPE\}\}/g, phase.componentType)
    .replace(/\{\{INTERFACE_NAME\}\}/g, phase.interfaceName)
    .replace(/\{\{INTERFACE_LIST\}\}/g, phase.interfaceList)
    .replace(/\{\{DEPENDENCY_ABSTRACTIONS\}\}/g, phase.dependencyAbstractions)
    .replace(/\{\{PATTERN_TYPE\}\}/g, phase.patternType)
    .replace(/\{\{UTILS_NAME\}\}/g, phase.utilsName)
    .replace(/\{\{MAGIC_TYPE\}\}/g, phase.magicType)
    .replace(/\{\{CONSTANT_TYPE\}\}/g, phase.constantType)
    .replace(/\{\{ERROR_TYPE\}\}/g, phase.errorType)
    .replace(/\{\{ERROR_INFO\}\}/g, phase.errorInfo)
    .replace(/\{\{MAIN_CLASS\}\}/g, phase.mainClass)
    .replace(/\{\{FOCUS_AREA\}\}/g, phase.focusArea)
    .replace(/\{\{LOGIC_TYPE\}\}/g, phase.logicType)
    .replace(/\{\{RULE_TYPE\}\}/g, phase.ruleType)
    .replace(/\{\{CONFIG_TYPE\}\}/g, phase.configType)
    .replace(/\{\{MAGIC_VALUES\}\}/g, phase.magicValues)
    .replace(/\{\{CONSTANT_EXAMPLES\}\}/g, phase.constantExamples)
    .replace(/\{\{FEATURE_TYPE\}\}/g, phase.featureType)
    .replace(/\{\{UNIT_TEST_COVERAGE\}\}/g, phase.unitTestCoverage)
    .replace(
      /\{\{INTEGRATION_TEST_COVERAGE\}\}/g,
      phase.integrationTestCoverage
    )
    .replace(/\{\{MOCK_REQUIREMENTS\}\}/g, phase.mockRequirements)
    .replace(/\{\{ERROR_SCENARIOS\}\}/g, phase.errorScenarios)
    .replace(/\{\{PERFORMANCE_TESTS\}\}/g, phase.performanceTests)
    .replace(
      /\{\{COMPATIBILITY_REQUIREMENT\}\}/g,
      phase.compatibilityRequirement
    )
    .replace(/\{\{PERFORMANCE_CRITERIA\}\}/g, phase.performanceCriteria)
    .replace(/\{\{COMPATIBILITY_CHECKLIST\}\}/g, phase.compatibilityChecklist)
    .replace(/\{\{TESTABLE_FEATURES\}\}/g, phase.testableFeatures)
    .replace(/\{\{DEMO_TYPE\}\}/g, phase.demoType)
    .replace(/\{\{REVIEW_FOCUS\}\}/g, phase.reviewFocus)
    .replace(/\{\{AUDIT_TITLE\}\}/g, phase.auditTitle)
    .replace(/\{\{AUDIT_REQUIREMENTS\}\}/g, phase.auditRequirements)
    .replace(/\{\{TEST_REVIEW_REQUIREMENTS\}\}/g, phase.testReviewRequirements)
    .replace(/\{\{INTEGRATION_VALIDATION\}\}/g, phase.integrationValidation)
    .replace(/\{\{PERFORMANCE_VALIDATION\}\}/g, phase.performanceValidation)
    .replace(/\{\{DOCUMENTATION_REVIEW\}\}/g, phase.documentationReview)
    .replace(/\{\{INTEGRATION_TARGET\}\}/g, phase.integrationTarget)
    .replace(/\{\{NEXT_PHASE\}\}/g, phase.nextPhase)
    .replace(/\{\{FAILURE_CRITERIA\}\}/g, phase.failureCriteria);

  const filename = `PHASE_${phase.number}_${phase.title
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z_]/g, "")}.md`;
  fs.writeFileSync(path.join(__dirname, filename), content);
  console.log(`Generated: ${filename}`);
}

// Generate all phase files
phases.forEach(generatePhaseFile);

console.log(
  "\nGenerated all Claude SDK integration phase files with comprehensive standards enforcement!"
);
console.log("Each phase includes:");
console.log("- Complete SOLID/DRY principle enforcement");
console.log("- Anti-pattern prevention rules");
console.log("- 100% test passing requirements");
console.log('- "All tests must pass" explicitly stated');
console.log("- Performance requirements for each phase");
console.log("- Claude SDK compatibility verification");
console.log("- Architecture compliance review processes");
console.log("- References to CLAUDE_SDK_REFERENCE.md patterns");
