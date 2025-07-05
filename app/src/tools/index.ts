/**
 * Tools module exports
 * ISP: Focused exports only
 * 
 * Central export point for OpenAI tools validation
 */

// Types
export type {
  OpenAIFunction,
  OpenAITool,
  OpenAIToolChoice,
  ToolValidationResult,
  ToolArrayValidationResult,
  IToolValidator,
  IToolSchemaValidator,
  IToolArrayValidator
} from './types';

// Constants
export {
  TOOL_VALIDATION_LIMITS,
  TOOL_VALIDATION_PATTERNS,
  TOOL_VALIDATION_MESSAGES,
  SUPPORTED_JSON_SCHEMA_TYPES,
  TOOL_VALIDATION_ERRORS,
  CLAUDE_CODE_TOOLS,
  CLAUDE_TOOL_CONFIG,
  TOOL_HEADERS,
  TOOL_CHOICE,
  TOOL_PARAMETER_LIMITS,
  TOOL_PARAMETER_MESSAGES,
  TOOL_PARAMETER_ERRORS,
  TOOL_CONVERSION_LIMITS,
  FORMAT_SPECIFICATIONS,
  FORMAT_MAPPINGS,
  TOOL_CONVERSION_MESSAGES,
  TOOL_CONVERSION_ERRORS,
  RESPONSE_FORMAT_LIMITS,
  RESPONSE_FORMATS,
  ID_FORMATS,
  TOOL_CALL_STRUCTURE,
  RESPONSE_FORMATTING_MESSAGES,
  RESPONSE_FORMATTING_ERRORS
} from './constants';

// Schemas
export {
  OpenAIFunctionSchema,
  OpenAIToolSchema,
  OpenAIToolChoiceSchema,
  ToolsArraySchema,
  ToolsRequestSchema,
  ValidationUtils
} from './schemas';

// Validators
export {
  ToolValidationError,
  ToolSchemaValidator,
  ToolArrayValidator,
  ToolValidator,
  toolValidator
} from './validator';

// Parameter Processing (Phase 2A) - Types
export type {
  ToolParameterExtractionResult,
  ToolExtractionOptions,
  IToolExtractor
} from './extractor';

export type {
  ToolParameterProcessingResult,
  ToolDefaultBehavior,
  ToolProcessingOptions,
  IToolProcessor
} from './processor';

export type {
  IToolChoiceValidator
} from './choice-validator';

export {
  ToolParameterExtractionError,
  ToolParameterExtractor,
  ToolExtractionUtils,
  toolParameterExtractor
} from './extractor';

export {
  ToolChoiceValidationError,
  ToolChoiceValidator,
  ToolChoiceValidationUtils,
  toolChoiceValidator
} from './choice-validator';

export {
  ToolParameterProcessingError,
  ToolParameterProcessor,
  ToolProcessingUtils,
  ToolProcessorFactory
} from './processor';

// Phase 5A: Tool Choice - Implementation
export {
  toolChoiceHandler,
  ToolChoiceHandlerFactory
} from './choice';

export {
  toolChoiceProcessor,
  ToolChoiceProcessorFactory
} from './choice-processor';

// Format Conversion (Phase 3A) - Types
export type {
  ClaudeTool,
  ClaudeToolChoice,
  ToolConversionResult,
  BidirectionalConversionResult,
  ParameterMappingResult,
  FormatValidationResult,
  IOpenAIConverter,
  IClaudeConverter,
  IToolMapper,
  IFormatValidator,
  IToolConverter
} from './conversion-types';

// Format Conversion (Phase 3A) - Implementation
export {
  ParameterMappingError,
  ParameterMappingUtils,
  ToolParameterMapper,
  ToolParameterMapper as ToolMapper,
  toolParameterMapper
} from './mapper';

export {
  FormatValidationError,
  FormatValidationUtils,
  FormatValidator,
  FormatValidator as ToolFormatValidator,
  formatValidator
} from './format-validator';

export {
  ToolConversionError,
  ConversionUtils
} from './conversion-utils';

export {
  OpenAIConverter,
  ClaudeConverter,
  ToolConverter,
  toolConverter
} from './converter';

// Manager
export { ToolManager } from './manager';

// Phase 4A: Tool Call Response Formatting - Types
export type {
  ClaudeToolCall,
  OpenAIToolCall,
  IToolCallIdGenerator,
  IToolFormatter,
  IResponseBuilder
} from './types';

// Phase 4A: Tool Call Response Formatting - Implementation
export {
  ToolCallIdGenerationError,
  IdGenerationUtils,
  ToolCallIdGenerator,
  toolCallIdGenerator
} from './id-generator';

export {
  ToolCallFormattingError,
  ToolFormattingUtils,
  ToolCallFormatter
} from './formatter';

export {
  ResponseBuildingError,
  ResponseBuildingUtils,
  ToolCallResponseBuilder,
  toolCallResponseBuilder
} from './response-builder';

// Phase 6A: ID Management - Types
export type {
  IDTrackingResult,
  IDManagementResult,
  IIDTracker,
  IIDManager
} from './types';

// Phase 6A: ID Management - Implementation
export {
  IDTrackingError,
  IDTrackingUtils,
  ToolCallIDTracker,
  toolCallIDTracker
} from './id-tracker';

export {
  IDManagementError,
  IDManagementUtils,
  ToolCallIDManager,
  toolCallIDManager
} from './id-manager';

// Phase 6A: ID Management - Constants
export {
  ID_MANAGEMENT_LIMITS,
  ID_MANAGEMENT_MESSAGES,
  ID_MANAGEMENT_ERRORS
} from './constants';

// Phase 7A: Multi-Tool Support - Types
export type {
  MultiToolCallRequest,
  MultiToolCallResult,
  ToolCallProcessingResult,
  ParallelProcessingResult,
  ToolCallCoordinationResult,
  IMultiToolCallHandler,
  IParallelProcessor,
  IToolCallCoordinator
} from './types';

// Phase 7A: Multi-Tool Support - Implementation
export {
  MultiToolCallError,
  MultiToolCallUtils,
  MultiToolCallHandler,
  MultiToolCallHandlerFactory,
  multiToolCallHandler
} from './multi-call';

export {
  ParallelProcessingError,
  ParallelProcessingUtils,
  ParallelProcessor,
  ParallelProcessorFactory,
  parallelProcessor
} from './parallel-processor';

export {
  CoordinationError,
  CoordinationUtils,
  ToolCallCoordinator,
  ToolCallCoordinatorFactory,
  toolCallCoordinator
} from './call-coordinator';

// Phase 7A: Multi-Tool Support - Constants
export {
  MULTI_TOOL_LIMITS,
  MULTI_TOOL_MESSAGES,
  MULTI_TOOL_ERRORS
} from './constants';

// Phase 8A: Tool Call Error Handling - Types
export type {
  ToolErrorHandlingRequest,
  ToolErrorHandlingResult,
  ToolErrorHandlingOptions,
  IToolErrorHandler
} from './error-handler';

export type {
  ErrorFormattingRequest,
  ErrorFormattingResult,
  ErrorFormattingOptions,
  IToolErrorFormatter
} from './error-formatter';

export type {
  ErrorClassificationRequest,
  ErrorClassificationResult,
  IToolErrorClassifier
} from './error-classifier';

// Phase 8A: Tool Call Error Handling - Implementation
export {
  ToolCallErrorException,
  ToolErrorHandler,
  ToolErrorUtils,
  toolErrorHandler
} from './error-handler';

export {
  ToolErrorFormatter,
  ErrorFormattingUtils,
  toolErrorFormatter
} from './error-formatter';

export {
  ToolErrorClassifier,
  ErrorClassificationUtils,
  toolErrorClassifier
} from './error-classifier';

// Phase 8A: Tool Call Error Handling - Constants
export {
  TOOL_ERRORS,
  TOOL_ERROR_MESSAGES,
  TOOL_ERROR_LIMITS
} from './constants';

// Phase 11A: Tool Calling State Management - Types
export type {
  ToolCallState,
  ToolCallStateEntry,
  ToolCallStateSnapshot,
  StateTransitionRequest,
  StateTransitionResult,
  StateCleanupResult,
  IToolStateManager
} from './state';

export type {
  ToolCallMetrics,
  FunctionUsageStats,
  StateTransitionEvent,
  TrackingPeriodStats,
  IToolStateTracker
} from './state-tracker';

export type {
  PersistenceConfig,
  PersistenceResult,
  IStateStorage,
  BackupMetadata,
  RecoveryOptions,
  IToolStatePersistence
} from './state-persistence';

// Phase 11A: Tool Calling State Management - Implementation
export {
  ToolStateManager,
  ToolStateUtils,
  toolStateManager
} from './state';

export {
  ToolStateTracker,
  ToolStateTrackingUtils,
  toolStateTracker
} from './state-tracker';

export {
  MemoryStateStorage,
  ToolStatePersistence,
  ToolStatePersistenceUtils,
  toolStatePersistence
} from './state-persistence';

// Phase 11A: Tool Calling State Management - Constants
export {
  TOOL_STATES,
  STATE_TRANSITIONS,
  STATE_MANAGEMENT_LIMITS,
  STATE_STORAGE_KEYS,
  STATE_MANAGEMENT_MESSAGES,
  STATE_MANAGEMENT_ERRORS,
  VALID_STATE_TRANSITIONS,
  TERMINAL_STATES,
  ACTIVE_STATES,
  STATE_PRIORITIES
} from './constants';

// Phase 12A: Validation Framework - Types
export type {
  ValidationFrameworkResult,
  ValidationFrameworkConfig,
  ValidationPerformanceMetrics,
  RuntimeValidationContext,
  ValidationFieldError,
  IValidationFramework,
  ISchemaValidator,
  IRuntimeValidator
} from './types';

// Phase 12A: Validation Framework - Implementation
export {
  ValidationFrameworkError,
  ValidationFramework,
  createValidationFramework
} from './validation-framework';

// Phase 12A: Enhanced Schema Validator - Implementation
export {
  SchemaValidator
} from './schema-validator';

// Phase 12A: Runtime Validator - Implementation
export {
  RuntimeValidator
} from './runtime-validator';

// Phase 12A: Validation Framework - Constants (using existing constants)
export {
  VALIDATION_FRAMEWORK_LIMITS,
  VALIDATION_FRAMEWORK_MESSAGES,
  VALIDATION_FRAMEWORK_ERRORS
} from './constants';