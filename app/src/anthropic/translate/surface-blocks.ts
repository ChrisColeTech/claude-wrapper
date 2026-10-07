/**
 * The flattener's block numbering (spec section 11, rule (b)): every model call upstream makes
 * restarts its block indices at 0, and the turn's one surface message numbers its blocks in the
 * order they are emitted, synthesised result blocks included. A block's surface index is fixed
 * when it starts. A result block is placed where no block is open: at once between blocks, else
 * right after the open block's `content_block_stop` (upstream runs a tool while its message still
 * streams), and never before the turn's `message_start`.
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

export class SurfaceBlocks {
  private next = 0;
  /** The current model call's block indices, upstream's to the surface's. */
  private readonly callIndices = new Map<number, number>();
  private open: number | undefined;
  private readonly pending: PendingResult[] = [];
  /** Until the turn's `message_start` is out, results wait. */
  private started = false;

  /** The turn's `message_start` is out: results that came before it open the message. */
  start(): TurnEvent[] {
    this.started = true;
    return this.flush();
  }

  /** A new model call: its indices restart at 0. */
  newCall(): void {
    this.callIndices.clear();
  }

  /** One of the call's block events, renumbered. */
  block(event: BlockEvent): TurnEvent[] {
    if (event.type === 'content_block_start') {
      this.callIndices.set(event.index, this.next);
      this.open = this.next++;
    }
    const index = this.callIndices.get(event.index) ?? event.index;
    if (event.type !== 'content_block_stop') return [{ ...event, index }];
    this.open = undefined;
    return [{ ...event, index }, ...this.flush()];
  }

  /** Results to place: now if nothing is open, else once the open block stops. */
  results(results: PendingResult[]): TurnEvent[] {
    this.pending.push(...results);
    return this.flush();
  }

  private flush(): TurnEvent[] {
    if (!this.started || this.open !== undefined) return [];
    return this.pending.splice(0).map(result => ({ ...result, index: this.next++ }));
  }
}
