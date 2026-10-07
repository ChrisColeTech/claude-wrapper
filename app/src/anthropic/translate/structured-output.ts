/**
 * Pass 6, the StructuredOutput buffer (spec section 12), armed on a run started with
 * `--json-schema`. Upstream answers through a `tool_use` block named `StructuredOutput`, then a
 * `user` frame with its synthetic `tool_result` inside the same model call, then that call's
 * `message_delta {stop_reason: "tool_use"}`. The block (start, `input_json_delta`s, stop) is
 * buffered until its `tool_result` arrives:
 *
 * - success: the buffer becomes one `text` block whose `text_delta`s are the buffered
 *   `partial_json` chunks (empty ones skipped), and the call's `stop_reason` becomes `end_turn`,
 *   so the call's `message_delta` and `message_stop` end the turn;
 * - failure (`is_error`): the buffer is dropped and the call ends in `tool_use` with no tool call
 *   left in it, so the flattener suppresses its end like a built-in call's, and the retry follows.
 *
 * A call that ends any other way (a `max_tokens` cut) with the block still buffered flushes the
 * buffer as the text block first. Prose `text` blocks are dropped and logged, because the SDKs'
 * `parse()` helpers read every text block as JSON. The blocks left are renumbered per model call,
 * as upstream numbers them, so the flattener sees each call's blocks from index 0.
 *
 * It reads upstream's frames ahead of the flattener (the spec lists it after the bridge prefix
 * strip): the `tool_result` arrives as a `user` frame, and the flattener must already see the
 * call's end as success or failure. Frames of other threads (`parent_tool_use_id`) pass as they came.
 */
import { Frame, isCleanResult, JsonObject, ResultFrame, StreamEvent, StreamEventFrame, UserFrame } from '../../upstream/frames';
import { STRUCTURED_OUTPUT_TOOL } from '../../upstream/structured-output';
import { Logger } from '../../utils/logger';
import { Pass } from './pass';

interface Buffered {
  /** The `tool_use` id its `tool_result` names. */
  id: string;
  chunks: string[];
}

type BlockEvent = Extract<StreamEvent, { index: number }>;

const relayed = (event: StreamEvent): StreamEventFrame => ({ type: 'stream_event', event, parent_tool_use_id: null });

const isStructuredOutput = (block: JsonObject): boolean =>
  block['type'] === 'tool_use' && block['name'] === STRUCTURED_OUTPUT_TOOL;

/** The `tool_result` blocks of a `user` frame. */
function toolResults(frame: UserFrame): JsonObject[] {
  const content = frame.message.content;
  return Array.isArray(content) ? content.filter(block => block['type'] === 'tool_result') : [];
}


class StructuredOutputBuffer implements Pass<Frame, Frame> {
  /** Upstream's index of each block of the current call that is relayed, to the index it gets. */
  private readonly indices = new Map<number, number>();
  /** Blocks of the current call that are not relayed: prose, and the StructuredOutput block itself. */
  private readonly hidden = new Set<number>();
  private next = 0;
  private buffered: Buffered | undefined;
  /** The current call's StructuredOutput succeeded: its `tool_use` stop becomes `end_turn`. */
  private answered = false;
  /** The call's end, held while its buffered block waits for its `tool_result`. */
  private held: StreamEventFrame[] = [];

  constructor(private readonly logger: Pick<Logger, 'debug'>) {}

  push(frame: Frame): Frame[] {
    if (frame.type === 'user' && frame.parent_tool_use_id == null) return [...this.onUser(frame), frame];
    if (frame.type === 'result') return [...this.onResult(frame), frame];
    if (frame.type !== 'stream_event' || frame.parent_tool_use_id != null) return [frame];
    return this.onEvent(frame, frame.event);
  }

  end(): Frame[] {
    return [];
  }

  private onEvent(frame: StreamEventFrame, event: StreamEvent): Frame[] {
    switch (event.type) {
      case 'message_start':
        return [...this.startCall(), frame];
      case 'content_block_start':
        return this.onBlockStart(frame, event);
      case 'content_block_delta':
        return this.onBlockEvent(frame, event);
      case 'content_block_stop':
        return this.onBlockEvent(frame, event);
      case 'message_delta':
        return this.onCallEnd(frame, event);
      case 'message_stop':
        return this.held.length > 0 ? this.hold(frame) : [frame];
    }
  }

  /** A new model call: one that ended waiting for a `tool_result` was retried. */
  private startCall(): Frame[] {
    const released = this.held;
    this.held = [];
    this.indices.clear();
    this.hidden.clear();
    this.next = 0;
    this.buffered = undefined;
    this.answered = false;
    return released;
  }

  private onBlockStart(frame: StreamEventFrame, event: Extract<StreamEvent, { type: 'content_block_start' }>): Frame[] {
    const block = event.content_block;
    if (isStructuredOutput(block)) {
      this.hidden.add(event.index);
      this.buffered = { id: String(block['id']), chunks: [] };
      return [];
    }
    if (block['type'] === 'text') {
      this.hidden.add(event.index);
      this.logger.debug('Prose text block dropped from a structured-output turn', { index: event.index });
      return [];
    }
    this.indices.set(event.index, this.next++);
    return this.renumbered(frame, event);
  }

  private onBlockEvent(frame: StreamEventFrame, event: BlockEvent): Frame[] {
    if (!this.hidden.has(event.index)) return this.renumbered(frame, event);
    const chunk = event.type === 'content_block_delta' ? event.delta['partial_json'] : undefined;
    if (this.buffered && typeof chunk === 'string') this.buffered.chunks.push(chunk);
    return [];
  }

  private renumbered(frame: StreamEventFrame, event: BlockEvent): Frame[] {
    const index = this.indices.get(event.index) ?? event.index;
    return index === event.index ? [frame] : [{ ...frame, event: { ...event, index } }];
  }

  private onCallEnd(frame: StreamEventFrame, event: Extract<StreamEvent, { type: 'message_delta' }>): Frame[] {
    const stopReason = event.delta['stop_reason'];
    if (this.answered && stopReason === 'tool_use') {
      return [{ ...frame, event: { ...event, delta: { ...event.delta, stop_reason: 'end_turn' } } }];
    }
    if (!this.buffered) return [frame];
    if (stopReason === 'tool_use') return this.hold(frame);
    // The call ended with the block still buffered (a max_tokens cut): it is the answer so far.
    return [...this.flush(), frame];
  }

  private hold(frame: StreamEventFrame): Frame[] {
    this.held.push(frame);
    return [];
  }

  private onUser(frame: UserFrame): Frame[] {
    const buffered = this.buffered;
    const result = buffered && toolResults(frame).find(block => block['tool_use_id'] === buffered.id);
    if (!result) return [];
    return result['is_error'] === true ? this.fail() : this.succeed();
  }

  /** Upstream ended the run with the block still waiting: a clean `result` means it was accepted. */
  private onResult(result: ResultFrame): Frame[] {
    if (!this.buffered) return [];
    return isCleanResult(result) ? this.succeed() : this.fail();
  }

  private succeed(): Frame[] {
    this.answered = true;
    const text = this.flush();
    const held = this.held;
    this.held = [];
    return [...text, ...held.flatMap(frame => this.onEvent(frame, frame.event))];
  }

  /** Dropped: the call's end goes on as upstream sent it, a `tool_use` stop with no tool call left. */
  private fail(): Frame[] {
    this.buffered = undefined;
    const held = this.held;
    this.held = [];
    return held;
  }

  /** The buffered block as one text block, at the next index of the call. */
  private flush(): Frame[] {
    const chunks = this.buffered?.chunks ?? [];
    this.buffered = undefined;
    const index = this.next++;
    return [
      relayed({ type: 'content_block_start', index, content_block: { type: 'text', text: '' } }),
      ...chunks.filter(chunk => chunk !== '')
        .map(text => relayed({ type: 'content_block_delta', index, delta: { type: 'text_delta', text } })),
      relayed({ type: 'content_block_stop', index })
    ];
  }
}

export function createStructuredOutputBuffer(logger: Pick<Logger, 'debug'>): Pass<Frame, Frame> {
  return new StructuredOutputBuffer(logger);
}
