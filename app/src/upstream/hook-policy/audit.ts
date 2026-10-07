/**
 * The run's audit of its hook (spec section 8): `result.permission_denials` may hold only the
 * denials the wrapper's hook issued, matched by `tool_use_id`, and those of connector tools the
 * request did not allow (spec section 9: `--allowedTools` leaves them out, so upstream denies
 * them); any other entry means upstream's permissions are not the wrapper's (a misconfiguration). And a web tool call whose result arrives
 * with no decision from the hook ran unenforced (upstream lets a call through when a command hook
 * fails to start or times out). Both are logged at error by name and id, never with the input:
 * the response has closed by `result`, so neither fails the turn.
 */
import { isObject } from '../../utils/json-object';
import { isConnectorTool } from '../connector-tools';
import { Frame, JsonObject } from '../frames';
import { DenialCode, isWebTool } from './types';

export interface AuditState {
  /** Every call the hook decided: its denial code, or null when it let the call through. */
  decided: Map<string, DenialCode | null>;
  /** The web tool calls upstream announced. */
  webCalls: Set<string>;
}

export interface AuditLogger {
  error(message: string, context?: unknown): void;
}

const blocksOf = (content: unknown): JsonObject[] =>
  (Array.isArray(content) ? content.filter(isObject) : []);

function onAnnounced(content: unknown, state: AuditState): void {
  for (const block of blocksOf(content)) {
    if (block['type'] === 'tool_use' && isWebTool(block['name'])) state.webCalls.add(String(block['id']));
  }
}

function onResults(content: unknown, state: AuditState, logger: AuditLogger): void {
  for (const block of blocksOf(content)) {
    const id = String(block['tool_use_id']);
    if (block['type'] !== 'tool_result' || !state.webCalls.has(id) || state.decided.has(id)) continue;
    logger.error("A web tool call ran without the wrapper's hook: its limits were not enforced", { toolUseId: id });
  }
}

function onDenials(denials: unknown, state: AuditState, logger: AuditLogger): void {
  for (const denial of blocksOf(denials)) {
    const id = String(denial['tool_use_id']);
    if (state.decided.get(id) || isConnectorTool(denial['tool_name'])) continue;
    logger.error("Upstream denied a tool call the wrapper's hook did not: the run is misconfigured",
      { toolName: denial['tool_name'], toolUseId: id });
  }
}

export function auditFrame(frame: Frame, state: AuditState, logger: AuditLogger): void {
  if (frame.type === 'assistant' && frame.parent_tool_use_id == null) onAnnounced(frame.message.content, state);
  if (frame.type === 'user' && frame.parent_tool_use_id == null) onResults(frame.message.content, state, logger);
  if (frame.type === 'result') onDenials(frame.permission_denials, state, logger);
}
