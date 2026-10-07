/**
 * The typed frame union of the CLI's stream-json stdout (spec section 16, frames).
 *
 * Each known frame keeps every field upstream sent; the types name the fields the surface reads.
 * The Agent SDK's `sdk.d.ts` is the reference. A line whose type (or `system` subtype) is not in
 * the union, or that is not a JSON object at all, becomes an `UnknownFrame` carrying the parsed
 * value (or the raw text), so a CLI that adds frame types never breaks a run.
 */
import { isObject, JsonObject } from '../utils/json-object';
export type { JsonObject };

interface FrameBase {
  uuid?: string;
  session_id?: string;
}

export interface SystemInitFrame extends FrameBase {
  type: 'system';
  subtype: 'init';
  session_id: string;
  cwd: string;
  model: string;
  tools: string[];
  mcp_servers: { name: string; status: string; source?: string }[];
  mcp_server_errors?: { name: string; type: string; message: string }[];
  apiKeySource: string;
  permissionMode: string;
  claude_code_version: string;
  capabilities?: string[];
}

export interface ApiRetryFrame extends FrameBase {
  type: 'system';
  subtype: 'api_retry';
  attempt: number;
  max_retries: number;
  retry_delay_ms: number;
  error_status: number | null;
  error: string;
}

export interface StatusFrame extends FrameBase {
  type: 'system';
  subtype: 'status';
  status: string | null;
}

/** One Messages API streaming event, as upstream relays it under `--include-partial-messages`. */
export type StreamEvent =
  | { type: 'message_start'; message: JsonObject }
  | { type: 'content_block_start'; index: number; content_block: JsonObject }
  | { type: 'content_block_delta'; index: number; delta: JsonObject }
  | { type: 'content_block_stop'; index: number }
  | { type: 'message_delta'; delta: JsonObject; usage: JsonObject }
  | { type: 'message_stop' };

export interface StreamEventFrame extends FrameBase {
  type: 'stream_event';
  event: StreamEvent;
  parent_tool_use_id: string | null;
  ttft_ms?: number;
}

/** One completed content block of a model call; several share `message.id`. */
export interface AssistantFrame extends FrameBase {
  type: 'assistant';
  message: JsonObject & { id: string; model: string; content: JsonObject[] };
  parent_tool_use_id: string | null;
  error?: string;
}

export interface UserFrame extends FrameBase {
  type: 'user';
  message: { role: 'user'; content: string | JsonObject[] };
  parent_tool_use_id: string | null;
  tool_use_result?: unknown;
  isSynthetic?: boolean;
}

export interface ResultFrame extends FrameBase {
  type: 'result';
  subtype: 'success' | 'error_during_execution' | 'error_max_turns' | 'error_max_budget_usd'
    | 'error_max_structured_output_retries';
  is_error: boolean;
  api_error_status?: number | null;
  /** Present on `success` only: the final text, or the error text when `is_error` is true. */
  result?: string;
  errors?: string[];
  stop_reason: string | null;
  num_turns: number;
  duration_ms: number;
  duration_api_ms: number;
  total_cost_usd: number;
  usage: JsonObject;
  modelUsage: { [model: string]: JsonObject };
  permission_denials: JsonObject[];
  structured_output?: unknown;
  terminal_reason?: string;
}

export interface RateLimitFrame extends FrameBase {
  type: 'rate_limit_event';
  rate_limit_info: {
    status: 'allowed' | 'allowed_warning' | 'rejected';
    resetsAt?: number;
    rateLimitType?: string;
    utilization?: number;
    errorCode?: string;
  };
}

/** Emitted every 30 s while a tool call is pending (`heartbeat: true` while parked). */
export interface ToolProgressFrame extends FrameBase {
  type: 'tool_progress';
  tool_use_id: string;
  tool_name: string;
  parent_tool_use_id: string | null;
  elapsed_time_seconds: number;
  heartbeat?: boolean;
}

export interface ControlRequestFrame {
  type: 'control_request';
  request_id: string;
  request: JsonObject & { subtype: string };
}

export type ControlResponse =
  | { subtype: 'success'; request_id: string; response?: JsonObject }
  | { subtype: 'error'; request_id: string; error: string };

export interface ControlResponseFrame {
  type: 'control_response';
  response: ControlResponse;
}

/** Anything outside the union: `raw` is the parsed JSON value, or the line itself when not JSON. */
export interface UnknownFrame {
  type: 'unknown';
  raw: unknown;
}

export type Frame =
  | SystemInitFrame
  | ApiRetryFrame
  | StatusFrame
  | StreamEventFrame
  | AssistantFrame
  | UserFrame
  | ResultFrame
  | RateLimitFrame
  | ToolProgressFrame
  | ControlRequestFrame
  | ControlResponseFrame
  | UnknownFrame;

const SYSTEM_SUBTYPES = new Set(['init', 'api_retry', 'status']);
const FRAME_TYPES = new Set(['stream_event', 'assistant', 'user', 'result', 'rate_limit_event',
  'tool_progress', 'control_request', 'control_response']);

function parseJson(line: string): unknown {
  try {
    return JSON.parse(line);
  } catch {
    return line;
  }
}

function isKnown(value: JsonObject): boolean {
  if (value['type'] === 'system') {
    return typeof value['subtype'] === 'string' && SYSTEM_SUBTYPES.has(value['subtype']);
  }
  return typeof value['type'] === 'string' && FRAME_TYPES.has(value['type']);
}

/** Classifies one stdout line. Never throws. */
export function parseFrame(line: string): Frame {
  const value = parseJson(line);
  if (isObject(value) && isKnown(value)) {
    return value as unknown as Frame;
  }
  return { type: 'unknown', raw: value };
}

/** `type` or `type/subtype` of what upstream sent, for logs; never the frame's content. */
export function describeFrame(frame: Frame): string {
  if (frame.type !== 'unknown') {
    return 'subtype' in frame ? `${frame.type}/${frame.subtype}` : frame.type;
  }
  if (!isObject(frame.raw)) {
    return 'non-JSON line';
  }
  const { type, subtype } = frame.raw;
  return typeof subtype === 'string' ? `${String(type)}/${subtype}` : String(type);
}
