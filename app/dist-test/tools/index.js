"use strict";
/**
 * Tools module exports
 * ISP: Focused exports only
 *
 * Central export point for OpenAI tools validation
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
exports.__esModule = true;
exports.ToolChoiceProcessorFactory = exports.toolChoiceProcessor = exports.ToolChoiceHandlerFactory = exports.toolChoiceHandler = exports.ToolProcessorFactory = exports.ToolProcessingUtils = exports.ToolParameterProcessor = exports.ToolParameterProcessingError = exports.toolChoiceValidator = exports.ToolChoiceValidationUtils = exports.ToolChoiceValidator = exports.ToolChoiceValidationError = exports.toolParameterExtractor = exports.ToolExtractionUtils = exports.ToolParameterExtractor = exports.ToolParameterExtractionError = exports.toolValidator = exports.ToolValidator = exports.ToolArrayValidator = exports.ToolSchemaValidator = exports.ToolValidationError = exports.ValidationUtils = exports.ToolsRequestSchema = exports.ToolsArraySchema = exports.OpenAIToolChoiceSchema = exports.OpenAIToolSchema = exports.OpenAIFunctionSchema = exports.RESPONSE_FORMATTING_ERRORS = exports.RESPONSE_FORMATTING_MESSAGES = exports.TOOL_CALL_STRUCTURE = exports.ID_FORMATS = exports.RESPONSE_FORMATS = exports.RESPONSE_FORMAT_LIMITS = exports.TOOL_CONVERSION_ERRORS = exports.TOOL_CONVERSION_MESSAGES = exports.FORMAT_MAPPINGS = exports.FORMAT_SPECIFICATIONS = exports.TOOL_CONVERSION_LIMITS = exports.TOOL_PARAMETER_ERRORS = exports.TOOL_PARAMETER_MESSAGES = exports.TOOL_PARAMETER_LIMITS = exports.TOOL_CHOICE = exports.TOOL_HEADERS = exports.CLAUDE_TOOL_CONFIG = exports.CLAUDE_CODE_TOOLS = exports.TOOL_VALIDATION_ERRORS = exports.SUPPORTED_JSON_SCHEMA_TYPES = exports.TOOL_VALIDATION_MESSAGES = exports.TOOL_VALIDATION_PATTERNS = exports.TOOL_VALIDATION_LIMITS = void 0;
exports.CoordinationError = exports.parallelProcessor = exports.ParallelProcessorFactory = exports.ParallelProcessor = exports.ParallelProcessingUtils = exports.ParallelProcessingError = exports.multiToolCallHandler = exports.MultiToolCallHandlerFactory = exports.MultiToolCallHandler = exports.MultiToolCallUtils = exports.MultiToolCallError = exports.ID_MANAGEMENT_ERRORS = exports.ID_MANAGEMENT_MESSAGES = exports.ID_MANAGEMENT_LIMITS = exports.toolCallIDManager = exports.ToolCallIDManager = exports.IDManagementUtils = exports.IDManagementError = exports.toolCallIDTracker = exports.ToolCallIDTracker = exports.IDTrackingUtils = exports.IDTrackingError = exports.toolCallResponseBuilder = exports.ToolCallResponseBuilder = exports.ResponseBuildingUtils = exports.ResponseBuildingError = exports.ToolCallFormatter = exports.ToolFormattingUtils = exports.ToolCallFormattingError = exports.toolCallIdGenerator = exports.ToolCallIdGenerator = exports.IdGenerationUtils = exports.ToolCallIdGenerationError = exports.ToolManager = exports.toolConverter = exports.ToolConverter = exports.ClaudeConverter = exports.OpenAIConverter = exports.ConversionUtils = exports.ToolConversionError = exports.formatValidator = exports.ToolFormatValidator = exports.FormatValidator = exports.FormatValidationUtils = exports.FormatValidationError = exports.toolParameterMapper = exports.ToolMapper = exports.ToolParameterMapper = exports.ParameterMappingUtils = exports.ParameterMappingError = void 0;
exports.VALIDATION_FRAMEWORK_ERRORS = exports.VALIDATION_FRAMEWORK_MESSAGES = exports.VALIDATION_FRAMEWORK_LIMITS = exports.RuntimeValidator = exports.SchemaValidator = exports.createValidationFramework = exports.ValidationFramework = exports.ValidationFrameworkError = exports.STATE_PRIORITIES = exports.ACTIVE_STATES = exports.TERMINAL_STATES = exports.VALID_STATE_TRANSITIONS = exports.STATE_MANAGEMENT_ERRORS = exports.STATE_MANAGEMENT_MESSAGES = exports.STATE_STORAGE_KEYS = exports.STATE_MANAGEMENT_LIMITS = exports.STATE_TRANSITIONS = exports.TOOL_STATES = exports.toolStatePersistence = exports.ToolStatePersistenceUtils = exports.ToolStatePersistence = exports.MemoryStateStorage = exports.toolStateTracker = exports.ToolStateTrackingUtils = exports.ToolStateTracker = exports.toolStateManager = exports.ToolStateUtils = exports.ToolStateManager = exports.TOOL_ERROR_LIMITS = exports.TOOL_ERROR_MESSAGES = exports.TOOL_ERRORS = exports.toolErrorClassifier = exports.ErrorClassificationUtils = exports.ToolErrorClassifier = exports.toolErrorFormatter = exports.ErrorFormattingUtils = exports.ToolErrorFormatter = exports.toolErrorHandler = exports.ToolErrorUtils = exports.ToolErrorHandler = exports.ToolCallErrorException = exports.MULTI_TOOL_ERRORS = exports.MULTI_TOOL_MESSAGES = exports.MULTI_TOOL_LIMITS = exports.toolCallCoordinator = exports.ToolCallCoordinatorFactory = exports.ToolCallCoordinator = exports.CoordinationUtils = void 0;
// Constants
var constants_1 = require("./constants");
__createBinding(exports, constants_1, "TOOL_VALIDATION_LIMITS");
__createBinding(exports, constants_1, "TOOL_VALIDATION_PATTERNS");
__createBinding(exports, constants_1, "TOOL_VALIDATION_MESSAGES");
__createBinding(exports, constants_1, "SUPPORTED_JSON_SCHEMA_TYPES");
__createBinding(exports, constants_1, "TOOL_VALIDATION_ERRORS");
__createBinding(exports, constants_1, "CLAUDE_CODE_TOOLS");
__createBinding(exports, constants_1, "CLAUDE_TOOL_CONFIG");
__createBinding(exports, constants_1, "TOOL_HEADERS");
__createBinding(exports, constants_1, "TOOL_CHOICE");
__createBinding(exports, constants_1, "TOOL_PARAMETER_LIMITS");
__createBinding(exports, constants_1, "TOOL_PARAMETER_MESSAGES");
__createBinding(exports, constants_1, "TOOL_PARAMETER_ERRORS");
__createBinding(exports, constants_1, "TOOL_CONVERSION_LIMITS");
__createBinding(exports, constants_1, "FORMAT_SPECIFICATIONS");
__createBinding(exports, constants_1, "FORMAT_MAPPINGS");
__createBinding(exports, constants_1, "TOOL_CONVERSION_MESSAGES");
__createBinding(exports, constants_1, "TOOL_CONVERSION_ERRORS");
__createBinding(exports, constants_1, "RESPONSE_FORMAT_LIMITS");
__createBinding(exports, constants_1, "RESPONSE_FORMATS");
__createBinding(exports, constants_1, "ID_FORMATS");
__createBinding(exports, constants_1, "TOOL_CALL_STRUCTURE");
__createBinding(exports, constants_1, "RESPONSE_FORMATTING_MESSAGES");
__createBinding(exports, constants_1, "RESPONSE_FORMATTING_ERRORS");
// Schemas
var schemas_1 = require("./schemas");
__createBinding(exports, schemas_1, "OpenAIFunctionSchema");
__createBinding(exports, schemas_1, "OpenAIToolSchema");
__createBinding(exports, schemas_1, "OpenAIToolChoiceSchema");
__createBinding(exports, schemas_1, "ToolsArraySchema");
__createBinding(exports, schemas_1, "ToolsRequestSchema");
__createBinding(exports, schemas_1, "ValidationUtils");
// Validators
var validator_1 = require("./validator");
__createBinding(exports, validator_1, "ToolValidationError");
__createBinding(exports, validator_1, "ToolSchemaValidator");
__createBinding(exports, validator_1, "ToolArrayValidator");
__createBinding(exports, validator_1, "ToolValidator");
__createBinding(exports, validator_1, "toolValidator");
var extractor_1 = require("./extractor");
__createBinding(exports, extractor_1, "ToolParameterExtractionError");
__createBinding(exports, extractor_1, "ToolParameterExtractor");
__createBinding(exports, extractor_1, "ToolExtractionUtils");
__createBinding(exports, extractor_1, "toolParameterExtractor");
var choice_validator_1 = require("./choice-validator");
__createBinding(exports, choice_validator_1, "ToolChoiceValidationError");
__createBinding(exports, choice_validator_1, "ToolChoiceValidator");
__createBinding(exports, choice_validator_1, "ToolChoiceValidationUtils");
__createBinding(exports, choice_validator_1, "toolChoiceValidator");
var processor_1 = require("./processor");
__createBinding(exports, processor_1, "ToolParameterProcessingError");
__createBinding(exports, processor_1, "ToolParameterProcessor");
__createBinding(exports, processor_1, "ToolProcessingUtils");
__createBinding(exports, processor_1, "ToolProcessorFactory");
// Phase 5A: Tool Choice - Implementation
var choice_1 = require("./choice");
__createBinding(exports, choice_1, "toolChoiceHandler");
__createBinding(exports, choice_1, "ToolChoiceHandlerFactory");
var choice_processor_1 = require("./choice-processor");
__createBinding(exports, choice_processor_1, "toolChoiceProcessor");
__createBinding(exports, choice_processor_1, "ToolChoiceProcessorFactory");
// Format Conversion (Phase 3A) - Implementation
var mapper_1 = require("./mapper");
__createBinding(exports, mapper_1, "ParameterMappingError");
__createBinding(exports, mapper_1, "ParameterMappingUtils");
__createBinding(exports, mapper_1, "ToolParameterMapper");
__createBinding(exports, mapper_1, "ToolParameterMapper", "ToolMapper");
__createBinding(exports, mapper_1, "toolParameterMapper");
var format_validator_1 = require("./format-validator");
__createBinding(exports, format_validator_1, "FormatValidationError");
__createBinding(exports, format_validator_1, "FormatValidationUtils");
__createBinding(exports, format_validator_1, "FormatValidator");
__createBinding(exports, format_validator_1, "FormatValidator", "ToolFormatValidator");
__createBinding(exports, format_validator_1, "formatValidator");
var converter_1 = require("./converter");
__createBinding(exports, converter_1, "ToolConversionError");
__createBinding(exports, converter_1, "ConversionUtils");
__createBinding(exports, converter_1, "OpenAIConverter");
__createBinding(exports, converter_1, "ClaudeConverter");
__createBinding(exports, converter_1, "ToolConverter");
__createBinding(exports, converter_1, "toolConverter");
// Manager
var manager_1 = require("./manager");
__createBinding(exports, manager_1, "ToolManager");
// Phase 4A: Tool Call Response Formatting - Implementation
var id_generator_1 = require("./id-generator");
__createBinding(exports, id_generator_1, "ToolCallIdGenerationError");
__createBinding(exports, id_generator_1, "IdGenerationUtils");
__createBinding(exports, id_generator_1, "ToolCallIdGenerator");
__createBinding(exports, id_generator_1, "toolCallIdGenerator");
var formatter_1 = require("./formatter");
__createBinding(exports, formatter_1, "ToolCallFormattingError");
__createBinding(exports, formatter_1, "ToolFormattingUtils");
__createBinding(exports, formatter_1, "ToolCallFormatter");
var response_builder_1 = require("./response-builder");
__createBinding(exports, response_builder_1, "ResponseBuildingError");
__createBinding(exports, response_builder_1, "ResponseBuildingUtils");
__createBinding(exports, response_builder_1, "ToolCallResponseBuilder");
__createBinding(exports, response_builder_1, "toolCallResponseBuilder");
// Phase 6A: ID Management - Implementation
var id_tracker_1 = require("./id-tracker");
__createBinding(exports, id_tracker_1, "IDTrackingError");
__createBinding(exports, id_tracker_1, "IDTrackingUtils");
__createBinding(exports, id_tracker_1, "ToolCallIDTracker");
__createBinding(exports, id_tracker_1, "toolCallIDTracker");
var id_manager_1 = require("./id-manager");
__createBinding(exports, id_manager_1, "IDManagementError");
__createBinding(exports, id_manager_1, "IDManagementUtils");
__createBinding(exports, id_manager_1, "ToolCallIDManager");
__createBinding(exports, id_manager_1, "toolCallIDManager");
// Phase 6A: ID Management - Constants
var constants_2 = require("./constants");
__createBinding(exports, constants_2, "ID_MANAGEMENT_LIMITS");
__createBinding(exports, constants_2, "ID_MANAGEMENT_MESSAGES");
__createBinding(exports, constants_2, "ID_MANAGEMENT_ERRORS");
// Phase 7A: Multi-Tool Support - Implementation
var multi_call_1 = require("./multi-call");
__createBinding(exports, multi_call_1, "MultiToolCallError");
__createBinding(exports, multi_call_1, "MultiToolCallUtils");
__createBinding(exports, multi_call_1, "MultiToolCallHandler");
__createBinding(exports, multi_call_1, "MultiToolCallHandlerFactory");
__createBinding(exports, multi_call_1, "multiToolCallHandler");
var parallel_processor_1 = require("./parallel-processor");
__createBinding(exports, parallel_processor_1, "ParallelProcessingError");
__createBinding(exports, parallel_processor_1, "ParallelProcessingUtils");
__createBinding(exports, parallel_processor_1, "ParallelProcessor");
__createBinding(exports, parallel_processor_1, "ParallelProcessorFactory");
__createBinding(exports, parallel_processor_1, "parallelProcessor");
var call_coordinator_1 = require("./call-coordinator");
__createBinding(exports, call_coordinator_1, "CoordinationError");
__createBinding(exports, call_coordinator_1, "CoordinationUtils");
__createBinding(exports, call_coordinator_1, "ToolCallCoordinator");
__createBinding(exports, call_coordinator_1, "ToolCallCoordinatorFactory");
__createBinding(exports, call_coordinator_1, "toolCallCoordinator");
// Phase 7A: Multi-Tool Support - Constants
var constants_3 = require("./constants");
__createBinding(exports, constants_3, "MULTI_TOOL_LIMITS");
__createBinding(exports, constants_3, "MULTI_TOOL_MESSAGES");
__createBinding(exports, constants_3, "MULTI_TOOL_ERRORS");
// Phase 8A: Tool Call Error Handling - Implementation
var error_handler_1 = require("./error-handler");
__createBinding(exports, error_handler_1, "ToolCallErrorException");
__createBinding(exports, error_handler_1, "ToolErrorHandler");
__createBinding(exports, error_handler_1, "ToolErrorUtils");
__createBinding(exports, error_handler_1, "toolErrorHandler");
var error_formatter_1 = require("./error-formatter");
__createBinding(exports, error_formatter_1, "ToolErrorFormatter");
__createBinding(exports, error_formatter_1, "ErrorFormattingUtils");
__createBinding(exports, error_formatter_1, "toolErrorFormatter");
var error_classifier_1 = require("./error-classifier");
__createBinding(exports, error_classifier_1, "ToolErrorClassifier");
__createBinding(exports, error_classifier_1, "ErrorClassificationUtils");
__createBinding(exports, error_classifier_1, "toolErrorClassifier");
// Phase 8A: Tool Call Error Handling - Constants
var constants_4 = require("./constants");
__createBinding(exports, constants_4, "TOOL_ERRORS");
__createBinding(exports, constants_4, "TOOL_ERROR_MESSAGES");
__createBinding(exports, constants_4, "TOOL_ERROR_LIMITS");
// Phase 11A: Tool Calling State Management - Implementation
var state_1 = require("./state");
__createBinding(exports, state_1, "ToolStateManager");
__createBinding(exports, state_1, "ToolStateUtils");
__createBinding(exports, state_1, "toolStateManager");
var state_tracker_1 = require("./state-tracker");
__createBinding(exports, state_tracker_1, "ToolStateTracker");
__createBinding(exports, state_tracker_1, "ToolStateTrackingUtils");
__createBinding(exports, state_tracker_1, "toolStateTracker");
var state_persistence_1 = require("./state-persistence");
__createBinding(exports, state_persistence_1, "MemoryStateStorage");
__createBinding(exports, state_persistence_1, "ToolStatePersistence");
__createBinding(exports, state_persistence_1, "ToolStatePersistenceUtils");
__createBinding(exports, state_persistence_1, "toolStatePersistence");
// Phase 11A: Tool Calling State Management - Constants
var constants_5 = require("./constants");
__createBinding(exports, constants_5, "TOOL_STATES");
__createBinding(exports, constants_5, "STATE_TRANSITIONS");
__createBinding(exports, constants_5, "STATE_MANAGEMENT_LIMITS");
__createBinding(exports, constants_5, "STATE_STORAGE_KEYS");
__createBinding(exports, constants_5, "STATE_MANAGEMENT_MESSAGES");
__createBinding(exports, constants_5, "STATE_MANAGEMENT_ERRORS");
__createBinding(exports, constants_5, "VALID_STATE_TRANSITIONS");
__createBinding(exports, constants_5, "TERMINAL_STATES");
__createBinding(exports, constants_5, "ACTIVE_STATES");
__createBinding(exports, constants_5, "STATE_PRIORITIES");
// Phase 12A: Validation Framework - Implementation
var validation_framework_1 = require("./validation-framework");
__createBinding(exports, validation_framework_1, "ValidationFrameworkError");
__createBinding(exports, validation_framework_1, "ValidationFramework");
__createBinding(exports, validation_framework_1, "createValidationFramework");
// Phase 12A: Enhanced Schema Validator - Implementation
var schema_validator_1 = require("./schema-validator");
__createBinding(exports, schema_validator_1, "SchemaValidator");
// Phase 12A: Runtime Validator - Implementation
var runtime_validator_1 = require("./runtime-validator");
__createBinding(exports, runtime_validator_1, "RuntimeValidator");
// Phase 12A: Validation Framework - Constants (using existing constants)
var constants_6 = require("./constants");
__createBinding(exports, constants_6, "VALIDATION_FRAMEWORK_LIMITS");
__createBinding(exports, constants_6, "VALIDATION_FRAMEWORK_MESSAGES");
__createBinding(exports, constants_6, "VALIDATION_FRAMEWORK_ERRORS");
