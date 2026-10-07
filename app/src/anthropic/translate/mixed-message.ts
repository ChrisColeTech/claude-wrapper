/**
 * The mixed-message hold (spec section 11): when one assistant message holds a client `tool_use`
 * after a built-in or connector call, the client block and everything after it in the message are
 * held until every such call that precedes it has had its result block placed, so the order is the
 * real API's (`server_tool_use`, its result, `tool_use`). Upstream runs the message's calls in
 * order, so those results arrive before the client call parks. Only the call's first client block
 * is held: a built-in after it runs only once the client's results are in, so its result opens the
 * resuming turn instead (the documented deviation).
 */
import { StreamEvent } from '../../upstream/frames';
import { runsUpstream, ToolKind, toolUseKind } from './tool-use-kind';

const toolUse = (event: StreamEvent): { id: string; kind: ToolKind | undefined } | undefined => {
  if (event.type !== 'content_block_start' || event.content_block['type'] !== 'tool_use') return undefined;
  return { id: String(event.content_block['id']), kind: toolUseKind(event.content_block) };
};

export class MixedMessageHold {
  /** The current message's built-in and connector calls whose result has not been placed. */
  private readonly unanswered = new Set<string>();
  private clientSeen = false;
  private held: StreamEvent[] | undefined;

  /** Whether `event` is held; it is when a hold is on, or when it opens one. */
  arrive(event: StreamEvent): boolean {
    if (this.held) {
      this.held.push(event);
      return true;
    }
    if (event.type === 'message_start') {
      this.unanswered.clear();
      this.clientSeen = false;
    }
    const call = toolUse(event);
    if (call && runsUpstream(call.kind)) this.unanswered.add(call.id);
    if (call?.kind !== 'client' || this.clientSeen) return false;
    this.clientSeen = true;
    if (this.unanswered.size === 0) return false;
    this.held = [event];
    return true;
  }

  /** A built-in or connector call's result block was placed; returns the events it releases, if any. */
  placed(toolUseId: string): StreamEvent[] {
    this.unanswered.delete(toolUseId);
    if (!this.held || this.unanswered.size > 0) return [];
    const released = this.held;
    this.held = undefined;
    return released;
  }
}
