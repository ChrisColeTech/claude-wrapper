/**
 * The tool bridge (spec section 16): `createBridge(tools) → {onFrame, deliver, abandon, events,
 * mcpHandler}`, the state machine lifted from the spike plus its MCP adapter.
 */
export { createBridge } from './bridge';
export type { Bridge, BridgeEvents, BridgeOptions, Interruptible } from './bridge';
export { BRIDGE_SERVER_NAME, CLIENT_TOOL_PREFIX } from './types';
export type {
  BridgeEvent, BridgeEventListener, ClientTool, DeliverOutcome, McpContent, McpToolResult, ToolResultBlock,
  ToolResultContent, ToolUse
} from './types';
