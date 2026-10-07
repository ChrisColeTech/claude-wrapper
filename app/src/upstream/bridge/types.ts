/**
 * The tool bridge's types (spec section 7, section 16 bridge; ADR 0001): the client's tools as
 * the request declares them, the `tool_result` blocks it sends back, the MCP result upstream
 * receives, and the bridge's ordered events.
 */
import { JsonObject } from '../frames';

/** The bridge server's fixed name: upstream sees each client tool as `mcp__client__<name>`. */
export const BRIDGE_SERVER_NAME = 'client';
export const CLIENT_TOOL_PREFIX = `mcp__${BRIDGE_SERVER_NAME}__`;

/** A client tool as the request declares it; served to upstream verbatim, never through Zod. */
export interface ClientTool {
  name: string;
  description?: string;
  input_schema: JsonObject;
}

/** One `tool_use` block upstream announced, its name without the bridge prefix. */
export interface ToolUse {
  id: string;
  name: string;
  input: unknown;
}

/** One MCP content item of a tool call's result. */
export type McpContent =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string };

/** What the bridge server answers a `tools/call` with. */
export interface McpToolResult {
  content: McpContent[];
  isError: boolean;
}

/** A content block inside a client's `tool_result` (validation has refused every other type). */
export type ToolResultContent =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

/** A `tool_result` block from the head of the client's last user message. */
export interface ToolResultBlock {
  type?: 'tool_result';
  tool_use_id: string;
  content?: string | ToolResultContent[];
  is_error?: boolean;
}

/** One `tools/call` upstream made, keyed by `_meta["claudecode/toolUseId"]`. */
export interface BridgeCall {
  toolUseId: string;
  name: string;
  args: unknown;
}

/** A client result for one call, already in MCP form. */
export interface DeliveredResult {
  toolUseId: string;
  result: McpToolResult;
}

/**
 * The outcome of a delivery. `resumed`: every announced call has its result and the run
 * continues. `partial`: some announced ids have no result; nothing was delivered and the run
 * stays parked. `unknown`: ids that belong to no park of this bridge; nothing was delivered.
 */
export type DeliverOutcome =
  | { status: 'resumed' }
  | { status: 'partial'; stillMissing: string[] }
  | { status: 'unknown'; unknownIds: string[] };

/** The bridge's ordered trace, as the spike recorded it. `park` is the one a caller acts on. */
export type BridgeEvent = { at: number } & (
  | { kind: 'turn_started' }
  | { kind: 'client_tool_use_announced'; id: string; name: string }
  | { kind: 'builtin_tool_use'; id: string; name: string }
  | { kind: 'assistant_message_complete'; stopReason: string }
  | { kind: 'mcp_call_registered'; toolUseId: string; name: string; early: boolean }
  | { kind: 'mcp_call_served_from_predelivered'; toolUseId: string; name: string }
  | { kind: 'park'; toolUses: ToolUse[] }
  | { kind: 'client_result_delivered_to_waiting_handler'; toolUseId: string; isError: boolean }
  | { kind: 'client_result_predelivered'; toolUseId: string; isError: boolean }
  | { kind: 'client_result_unknown'; toolUseId: string }
  | { kind: 'resumed' }
  | { kind: 'pending_rejected'; toolUseId: string }
  | { kind: 'abandoned'; reason: string }
  | { kind: 'turn_ended' }
);

export type BridgeEventListener = (event: BridgeEvent) => void;
