/**
 * Tool ID management and multi-tool processing constants
 */

/**
 * ID Management constants (Phase 6A)
 * DRY compliance: No magic numbers or ID management behaviors
 */
export const ID_MANAGEMENT_LIMITS = {
  MANAGEMENT_TIMEOUT_MS: 2,
  MAX_IDS_PER_SESSION: 1000,
  MAX_CONCURRENT_TRACKING: 50,
  TRACKING_TIMEOUT_MS: 2,
} as const;

export const ID_MANAGEMENT_MESSAGES = {
  ID_TRACKING_FAILED: "Tool call ID tracking failed",
  ID_ALREADY_TRACKED: "Tool call ID is already being tracked",
  ID_NOT_TRACKED: "Tool call ID is not being tracked",
  SESSION_NOT_FOUND: "Session not found for ID tracking",
  TRACKING_LIMIT_EXCEEDED: `Cannot track more than ${ID_MANAGEMENT_LIMITS.MAX_IDS_PER_SESSION} IDs per session`,
  MANAGEMENT_TIMEOUT: `ID management exceeded ${ID_MANAGEMENT_LIMITS.MANAGEMENT_TIMEOUT_MS}ms timeout`,
  TRACKING_TIMEOUT: `ID tracking exceeded ${ID_MANAGEMENT_LIMITS.TRACKING_TIMEOUT_MS}ms timeout`,
  INVALID_SESSION_ID: "Invalid session ID for tool call tracking",
  COLLISION_DETECTED: "Tool call ID collision detected",
  PERSISTENCE_FAILED: "ID tracking persistence failed",
} as const;

export const ID_MANAGEMENT_ERRORS = {
  TRACKING_FAILED: "TRACKING_FAILED",
  ALREADY_TRACKED: "ALREADY_TRACKED",
  NOT_TRACKED: "NOT_TRACKED",
  SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
  LIMIT_EXCEEDED: "LIMIT_EXCEEDED",
  TIMEOUT: "TIMEOUT",
  INVALID_SESSION: "INVALID_SESSION",
  COLLISION_DETECTED: "COLLISION_DETECTED",
  PERSISTENCE_FAILED: "PERSISTENCE_FAILED",
} as const;

/**
 * Multi-tool support constants (Phase 7A)
 * DRY compliance: No magic numbers or multi-tool behaviors
 */
export const MULTI_TOOL_LIMITS = {
  MAX_PARALLEL_CALLS: 10,
  PROCESSING_TIMEOUT_MS: 30000,
  MAX_CONCURRENT_PROCESSING: 5,
  COORDINATION_TIMEOUT_MS: 5000,
  MAX_TOOLS_PER_REQUEST: 25,
} as const;

export const MULTI_TOOL_MESSAGES = {
  MULTI_CALL_PROCESSING_FAILED: "Multi-tool call processing failed",
  PARALLEL_PROCESSING_FAILED: "Parallel tool call processing failed",
  COORDINATION_FAILED: "Tool call coordination failed",
  TOO_MANY_PARALLEL_CALLS: `Cannot process more than ${MULTI_TOOL_LIMITS.MAX_PARALLEL_CALLS} parallel tool calls`,
  PROCESSING_TIMEOUT: `Multi-tool processing exceeded ${MULTI_TOOL_LIMITS.PROCESSING_TIMEOUT_MS}ms timeout`,
  COORDINATION_TIMEOUT: `Tool coordination exceeded ${MULTI_TOOL_LIMITS.COORDINATION_TIMEOUT_MS}ms timeout`,
  DEPENDENCY_RESOLUTION_FAILED: "Tool dependency resolution failed",
  ORDER_OPTIMIZATION_FAILED: "Tool execution order optimization failed",
  RESULT_AGGREGATION_FAILED: "Tool result aggregation failed",
  INVALID_MULTI_CALL_STRUCTURE: "Invalid multi-tool call structure",
  DUPLICATE_TOOL_CALL_IDS: "Duplicate tool call IDs detected in multi-call request",
  CONCURRENT_LIMIT_EXCEEDED: `Cannot process more than ${MULTI_TOOL_LIMITS.MAX_CONCURRENT_PROCESSING} concurrent tool calls`,
  EMPTY_TOOL_CALLS_ARRAY: "Tool calls array cannot be empty for multi-tool processing",
} as const;

export const MULTI_TOOL_ERRORS = {
  PROCESSING_FAILED: "PROCESSING_FAILED",
  PARALLEL_FAILED: "PARALLEL_FAILED",
  COORDINATION_FAILED: "COORDINATION_FAILED",
  TOO_MANY_CALLS: "TOO_MANY_CALLS",
  TIMEOUT: "TIMEOUT",
  DEPENDENCY_FAILED: "DEPENDENCY_FAILED",
  ORDER_FAILED: "ORDER_FAILED",
  AGGREGATION_FAILED: "AGGREGATION_FAILED",
  INVALID_STRUCTURE: "INVALID_STRUCTURE",
  DUPLICATE_IDS: "DUPLICATE_IDS",
  CONCURRENT_LIMIT: "CONCURRENT_LIMIT",
  EMPTY_ARRAY: "EMPTY_ARRAY",
} as const;