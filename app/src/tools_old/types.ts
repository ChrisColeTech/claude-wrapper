/**
 * OpenAI Tools API TypeScript interfaces
 * Single Responsibility: Interface definitions only
 * 
 * Based on OpenAI API specification for tools and function calling
 */

/**
 * OpenAI function tool definition
 */
export interface OpenAIFunction {
  name: string;
  description?: string;
  parameters?: Record<string, any>;
}

/**
 * OpenAI function with flexible parameter support (for test compatibility)
 */
export type OpenAIFunctionFlexible = OpenAIFunction | {
  name: string;
  description?: string;
  // parameters property may be missing
};

/**
 * OpenAI tool definition
 */
export interface OpenAITool {
  type: 'function';
  function: OpenAIFunction;
}

/**
 * OpenAI tool choice options
 */
export type OpenAIToolChoice = 'auto' | 'none' | 'required' | {
  type: 'function';
  function: {
    name: string;
  };
};

/**
 * Tool validation result
 */
export interface ToolValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Tool array validation result
 */
export interface ToolArrayValidationResult {
  valid: boolean;
  errors: string[];
  validTools: OpenAITool[];
}

/**
 * Tool schema validator interface
 */
export interface IToolSchemaValidator {
  validateTool(tool: OpenAITool): ToolValidationResult;
  validateFunction(func: OpenAIFunction): ToolValidationResult;
  validateParameters(parameters: Record<string, any>): ToolValidationResult;
}

/**
 * Tool array validator interface
 */
export interface IToolArrayValidator {
  validateToolArray(tools: OpenAITool[]): ToolArrayValidationResult;
  validateToolChoice(toolChoice: OpenAIToolChoice, tools: OpenAITool[]): ToolValidationResult;
}

/**
 * Main tool validator interface
 */
export interface IToolValidator extends IToolSchemaValidator, IToolArrayValidator {
  validateToolsRequest(tools: OpenAITool[], toolChoice?: OpenAIToolChoice): ToolArrayValidationResult;
}

/**
 * OpenAI tool call in response
 */
export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

/**
 * Claude tool call (internal format before conversion)
 */
export interface ClaudeToolCall {
  id?: string;
  name: string;
  arguments: Record<string, any>; // Object format
}

/**
 * Tool call formatting result
 */
export interface ToolCallFormattingResult {
  success: boolean;
  toolCalls?: OpenAIToolCall[];
  errors: string[];
  formattingTimeMs?: number;
}

/**
 * Tool formatter interface
 */
export interface IToolFormatter {
  formatToolCall(claudeCall: ClaudeToolCall): OpenAIToolCall;
  formatToolCalls(claudeCalls: ClaudeToolCall[]): ToolCallFormattingResult;
  validateFormattedCall(toolCall: OpenAIToolCall): boolean;
}

/**
 * Tool call ID generator interface
 */
export interface IToolCallIdGenerator {
  generateId(): string;
  generateIds(count: number): string[];
  isValidId(id: string): boolean;
  validateIdFormat(id: string): boolean;
  getUsedIdsCount(): number;
  clearUsedIds(): void;
}

/**
 * Response builder interface
 */
export interface IResponseBuilder {
  buildToolCallResponse(toolCalls: OpenAIToolCall[], content?: string): any;
  setFinishReason(response: any, hasToolCalls: boolean): any;
  validateResponseStructure(response: any): boolean;
}

/**
 * ID tracking result interface
 */
export interface IDTrackingResult {
  success: boolean;
  id?: string;
  sessionId?: string;
  errors: string[];
  trackingTimeMs?: number;
}

/**
 * ID management result interface
 */
export interface IDManagementResult {
  success: boolean;
  id?: string;
  sessionId?: string;
  errors: string[];
  managementTimeMs?: number;
}

/**
 * ID tracker interface for tracking tool call IDs across conversations
 */
export interface IIDTracker {
  addId(id: string, sessionId?: string): IDTrackingResult;
  hasId(id: string): boolean;
  getIds(sessionId?: string): string[];
  removeId(id: string): IDTrackingResult;
  clear(sessionId?: string): void;
}

/**
 * ID manager interface for coordinating ID generation and tracking
 */
export interface IIDManager {
  generateId(): string;
  trackId(id: string, sessionId?: string): IDManagementResult;
  isIdTracked(id: string): boolean;
  getSessionIds(sessionId: string): string[];
  clearSession(sessionId: string): void;
  // Additional methods for complete functionality
  generateAndTrackId(sessionId?: string): IDManagementResult;
  trackMultipleIds(ids: string[], sessionId?: string): IDManagementResult[];
  untrackId(id: string): IDManagementResult;
  getManagementStats(): {
    totalIdsGenerated: number;
    totalIdsTracked: number;
    successfulOperations: number;
    failedOperations: number;
    totalOperationTime: number;
    averageOperationTime: number;
  };
  clearAll(): void;
  resetStats(): void;
}

/**
 * Multi-tool support interfaces (Phase 7A)
 * Single Responsibility: Each interface focused on one aspect of multi-tool calling
 */

/**
 * Multi-tool call request structure
 */
export interface MultiToolCallRequest {
  tools: OpenAITool[];
  toolCalls: OpenAIToolCall[];
  sessionId?: string;
  requestId?: string;
  parallel?: boolean;
}

/**
 * Multi-tool call processing result
 */
export interface MultiToolCallResult {
  success: boolean;
  toolCalls: OpenAIToolCall[];
  results: ToolCallProcessingResult[];
  errors: string[];
  processingTimeMs: number;
  parallelProcessed: boolean;
}

/**
 * Individual tool call processing result
 */
export interface ToolCallProcessingResult {
  success: boolean;
  toolCallId: string;
  toolName: string;
  result?: any;
  errors: string[];
  processingTimeMs: number;
}

/**
 * Parallel processing result
 */
export interface ParallelProcessingResult {
  success: boolean;
  processedCalls: number;
  successfulCalls: number;
  failedCalls: number;
  results: ToolCallProcessingResult[];
  errors: string[];
  totalProcessingTimeMs: number;
  averageProcessingTimeMs: number;
}

/**
 * Tool call coordination result
 */
export interface ToolCallCoordinationResult {
  success: boolean;
  coordinatedCalls: OpenAIToolCall[];
  processingOrder: string[];
  dependencies: Map<string, string[]>;
  errors: string[];
  coordinationTimeMs: number;
}

/**
 * Multi-tool call handler interface
 * SRP: Handles multiple tool call operations only
 */
export interface IMultiToolCallHandler {
  processMultipleToolCalls(request: MultiToolCallRequest): Promise<MultiToolCallResult>;
  validateMultiToolRequest(request: MultiToolCallRequest): boolean;
  createMultiToolResponse(result: MultiToolCallResult): any;
}

/**
 * Parallel processor interface  
 * SRP: Parallel processing operations only
 */
export interface IParallelProcessor {
  processInParallel(toolCalls: OpenAIToolCall[], tools: OpenAITool[]): Promise<ParallelProcessingResult>;
  canProcessInParallel(toolCalls: OpenAIToolCall[]): boolean;
  getProcessingCapacity(): number;
}

/**
 * Tool call coordinator interface
 * SRP: Coordination and orchestration only
 */
export interface IToolCallCoordinator {
  coordinateToolCalls(toolCalls: OpenAIToolCall[], sessionId?: string): Promise<ToolCallCoordinationResult>;
  detectDependencies(toolCalls: OpenAIToolCall[]): Map<string, string[]>;
  optimizeProcessingOrder(toolCalls: OpenAIToolCall[]): string[];
}

/**
 * Phase 12A: Validation Framework Interfaces
 * Single Responsibility: Each interface focused on one validation aspect
 */

/**
 * Enhanced validation result with detailed field information
 */
export interface ValidationFrameworkResult {
  valid: boolean;
  errors: ValidationFieldError[];
  warnings?: string[];
  validationTimeMs: number;
  cacheHit?: boolean;
  performanceMetrics?: ValidationPerformanceMetrics;
}

/**
 * Field-level validation error with context
 */
export interface ValidationFieldError {
  field: string;
  code: string;
  message: string;
  value?: any;
  expectedType?: string;
  ruleName?: string;
  severity: 'error' | 'warning';
}

/**
 * Validation performance metrics
 */
export interface ValidationPerformanceMetrics {
  validationTimeMs: number;
  schemaValidationTimeMs: number;
  runtimeValidationTimeMs: number;
  customRulesTimeMs: number;
  cacheTimeMs: number;
  memoryUsageBytes: number;
}

/**
 * Custom validation rule definition
 */
export interface CustomValidationRule {
  name: string;
  description: string;
  validator: (value: any, context: ValidationContext) => ValidationRuleResult;
  priority: number;
  enabled: boolean;
  async?: boolean;
}

/**
 * Validation context for custom rules
 */
export interface ValidationContext {
  toolName: string;
  parameterPath: string;
  fullParameters: Record<string, any>;
  requestMetadata?: Record<string, any>;
}

/**
 * Custom validation rule result
 */
export interface ValidationRuleResult {
  valid: boolean;
  error?: ValidationFieldError;
  warning?: string;
  processingTimeMs?: number;
}

/**
 * Schema validation cache entry
 */
export interface SchemaValidationCacheEntry {
  schemaHash: string;
  result: ValidationFrameworkResult;
  createdAt: number;
  hitCount: number;
  lastUsed: number;
}

/**
 * Runtime validation context
 */
export interface RuntimeValidationContext {
  tool: OpenAITool;
  parameters: Record<string, any>;
  requestId?: string;
  sessionId?: string;
  customRules?: CustomValidationRule[];
}

/**
 * Validation framework configuration
 */
export interface ValidationFrameworkConfig {
  enableCaching: boolean;
  cacheSize: number;
  cacheTtlMs: number;
  enableCustomRules: boolean;
  customRulesTimeout: number;
  enablePerformanceMetrics: boolean;
  strictMode: boolean;
  maxValidationTimeMs: number;
}

/**
 * Enhanced schema validator interface (Phase 12A)
 * SRP: Schema validation with caching and performance optimization
 */
export interface ISchemaValidator {
  validateToolSchema(tool: OpenAITool): Promise<ValidationFrameworkResult>;
  validateFunctionSchema(func: OpenAIFunction): Promise<ValidationFrameworkResult>;
  validateParametersSchema(parameters: Record<string, any>): Promise<ValidationFrameworkResult>;
  validateWithCache(schemaHash: string, validator: () => Promise<ValidationFrameworkResult>): Promise<ValidationFrameworkResult>;
  clearCache(): void;
  getCacheStats(): { size: number; hitRate: number; totalHits: number; totalMisses: number };
}

/**
 * Runtime validator interface (Phase 12A)
 * SRP: Runtime parameter validation with custom rules
 */
export interface IRuntimeValidator {
  validateRuntimeParameters(context: RuntimeValidationContext): Promise<ValidationFrameworkResult>;
  addCustomRule(rule: CustomValidationRule): boolean;
  removeCustomRule(ruleName: string): boolean;
  getCustomRules(): CustomValidationRule[];
  validateWithCustomRules(value: any, context: ValidationContext): Promise<ValidationRuleResult[]>;
}

/**
 * Main validation framework interface (Phase 12A)
 * SRP: Validation orchestration and coordination
 */
export interface IValidationFramework {
  validateComplete(tool: OpenAITool, parameters: Record<string, any>, context?: RuntimeValidationContext): Promise<ValidationFrameworkResult>;
  validateTools(tools: OpenAITool[]): Promise<ValidationFrameworkResult[]>;
  validateToolsWithChoice(tools: OpenAITool[], toolChoice?: OpenAIToolChoice): Promise<ValidationFrameworkResult>;
  configure(config: Partial<ValidationFrameworkConfig>): void;
  getConfiguration(): ValidationFrameworkConfig;
  getValidationMetrics(): ValidationPerformanceMetrics;
  resetMetrics(): void;
}