/**
 * Upstream's frames for a structured-output answer, for surface tests with the scripted runner:
 * one model call whose `StructuredOutput` `tool_use` streams `json` as its input, the synthetic
 * `tool_result` upstream writes inside the same call (`isError` for an answer that failed the
 * schema), then the call's `message_delta {stop_reason: "tool_use"}` and `message_stop`.
 */
import { Frame } from '../../../src/upstream/frames';
import { frameOf, MESSAGE_START, MESSAGE_STOP, streamEvent } from './turn-frames';

export function structuredAnswer(id: string, json: string, isError = false): Frame[] {
  return [
    ...[MESSAGE_START,
      { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id, name: 'StructuredOutput', input: {} } },
      { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: json } },
      { type: 'content_block_stop', index: 0 }].map(event => streamEvent(event)),
    frameOf({ type: 'user', parent_tool_use_id: null, session_id: 'session-1', message: { role: 'user', content: [
      { type: 'tool_result', tool_use_id: id, content: isError ? 'Output does not match the schema' : 'Structured output provided successfully',
        ...(isError ? { is_error: true } : {}) }] } }),
    ...[{ type: 'message_delta', delta: { stop_reason: 'tool_use', stop_sequence: null }, usage: { output_tokens: 9 } },
      MESSAGE_STOP].map(event => streamEvent(event))
  ];
}
