/**
 * Hand-built upstream frames for translator, sink and conductor tests: the frames of one plain
 * model call, and builders for `system/init`, `result` and stream events. Every frame goes
 * through `parseFrame`, as a run yields it.
 */
import { createTranslator, TurnEvent } from '../../../src/anthropic/translate';
import { Frame, parseFrame } from '../../../src/upstream/frames';

const SESSION = { session_id: 'session-1', uuid: 'frame-uuid' };

export const frameOf = (value: object): Frame => parseFrame(JSON.stringify(value));

export const streamEvent = (event: object, parent: string | null = null): Frame =>
  frameOf({ type: 'stream_event', event, parent_tool_use_id: parent, ...SESSION });

export const MESSAGE_START = {
  type: 'message_start',
  message: {
    id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-fable-5-1', content: [],
    stop_reason: null, stop_sequence: null, usage: { input_tokens: 5, output_tokens: 1 }
  }
};
export const TEXT_START = { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } };
export const textDelta = (text: string) => ({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } });
export const BLOCK_STOP = { type: 'content_block_stop', index: 0 };
export const END_TURN = {
  type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 7 }
};
export const MESSAGE_STOP = { type: 'message_stop' };

/** The stream events of one model call answering "hi". */
export const PLAIN_CALL = [MESSAGE_START, TEXT_START, textDelta('hi'), BLOCK_STOP, END_TURN, MESSAGE_STOP];

export const initFrame = (fields: object = {}): Frame => frameOf({
  type: 'system', subtype: 'init', cwd: '/state/cwd', tools: [], mcp_servers: [], model: 'claude-fable-5-1',
  permissionMode: 'default', apiKeySource: 'none', claude_code_version: '2.1.291', ...SESSION, ...fields
});

export const resultFrame = (fields: object = {}): Frame => frameOf({
  type: 'result', subtype: 'success', is_error: false, result: 'hi', stop_reason: 'end_turn', num_turns: 1,
  duration_ms: 1, duration_api_ms: 1, total_cost_usd: 0, usage: {}, modelUsage: {}, permission_denials: [],
  ...SESSION, ...fields
});

/** Every frame through one translator, then its end. */
export function translate(frames: Frame[], debug: jest.Mock = jest.fn()): TurnEvent[] {
  const translator = createTranslator({ logger: { debug } });
  return [...frames.flatMap(frame => translator.push(frame)), ...translator.end()];
}
