/**
 * What the bridge reads from upstream's frames, as the spike's frame handler did: `system/init`
 * starts a turn, each `tool_use` block of an `assistant` frame is announced, a `message_delta`
 * with `stop_reason: tool_use` completes the assistant message, `result` ends the turn.
 * Everything else is nothing to the bridge.
 */
import { Frame, JsonObject } from '../frames';

export type FrameInput =
  | { kind: 'turn_started' }
  | { kind: 'tool_uses'; toolUses: { id: string; name: string; input: unknown }[] }
  | { kind: 'message_complete'; stopReason: string }
  | { kind: 'turn_ended' }
  | { kind: 'none' };

const isToolUse = (block: JsonObject): boolean => block['type'] === 'tool_use';

export function mapFrame(frame: Frame): FrameInput {
  switch (frame.type) {
    case 'system':
      return frame.subtype === 'init' ? { kind: 'turn_started' } : { kind: 'none' };
    case 'assistant': {
      const toolUses = (frame.message.content ?? []).filter(isToolUse)
        .map(block => ({ id: String(block['id']), name: String(block['name']), input: block['input'] }));
      return toolUses.length > 0 ? { kind: 'tool_uses', toolUses } : { kind: 'none' };
    }
    case 'stream_event': {
      const { event } = frame;
      const stopReason = event.type === 'message_delta' ? event.delta['stop_reason'] : undefined;
      return stopReason === 'tool_use' ? { kind: 'message_complete', stopReason } : { kind: 'none' };
    }
    case 'result':
      return { kind: 'turn_ended' };
    default:
      return { kind: 'none' };
  }
}
