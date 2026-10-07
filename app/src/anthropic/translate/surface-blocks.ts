/**
 * The flattener's rule (b) (spec section 11): each model call upstream makes restarts its block
 * indices at 0, so a call's indices are offset by the blocks already relayed in the turn, and the
 * built-in calls' result blocks count among them. A result block is placed where no block is
 * open: at once between blocks, else right after the open block's `content_block_stop` (upstream
 * runs a tool while its message still streams), and never before the turn's `message_start`. A
 * result placed inside a call moves that call's later blocks one place on.
 */
import { JsonObject, StreamEvent, UserFrame } from '../../upstream/frames';
import { ServerToolCalls, ServerToolResultSignal, TurnEvent } from './turn-event';

type BlockEvent = Extract<StreamEvent, { index: number }>;

/** A built-in call's result waiting for its place: everything but its index. */
export type PendingResult = Omit<ServerToolResultSignal, 'index'>;

const isBlock = (value: unknown): value is JsonObject => typeof value === 'object' && value !== null;

/** The `tool_result` blocks of a `user` frame that answer one of the run's built-in calls. */
export function serverToolResults(frame: UserFrame, calls: ServerToolCalls): PendingResult[] {
  const content = Array.isArray(frame.message.content) ? frame.message.content.filter(isBlock) : [];
  return content.flatMap(block => {
    const toolUseId = String(block['tool_use_id']);
    const tool = block['type'] === 'tool_result' ? calls.toolOf(toolUseId) : undefined;
    return tool ? [{ type: 'server_tool_result' as const, tool, toolUseId, block, toolUseResult: frame.tool_use_result }] : [];
  });
}

export class BlockOffsets {
  /** Blocks relayed in the turn so far, result blocks included, and the current call's offset. */
  private relayedBlocks = 0;
  private offset = 0;
  private open = false;
  private readonly pending: PendingResult[] = [];
  /** Until the turn's `message_start` is out, results wait. */
  private started = false;

  /** A model call starts: its indices follow every block relayed so far. */
  newCall(): void {
    this.offset = this.relayedBlocks;
  }

  /** The turn's `message_start` is out: results that came before it open the message. */
  start(): TurnEvent[] {
    this.started = true;
    return this.flush();
  }

  /** One of the call's block events, offset. */
  block(event: BlockEvent): TurnEvent[] {
    const index = this.offset + event.index;
    if (event.type === 'content_block_start') {
      this.relayedBlocks = Math.max(this.relayedBlocks, index + 1);
      this.open = true;
    }
    if (event.type !== 'content_block_stop') return [{ ...event, index }];
    this.open = false;
    return [{ ...event, index }, ...this.flush()];
  }

  /** Results to place: now if nothing is open, else once the open block stops. */
  results(results: PendingResult[]): TurnEvent[] {
    this.pending.push(...results);
    return this.flush();
  }

  private flush(): TurnEvent[] {
    if (!this.started || this.open) return [];
    return this.pending.splice(0).map(result => {
      this.offset += 1;
      return { ...result, index: this.relayedBlocks++ };
    });
  }
}
