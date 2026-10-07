/**
 * Pass 2, the flattener (spec section 11, ADR 0003): the run's `stream_event` frames become one
 * turn stream. (a) The turn's first `message_start` is relayed and every later one suppressed;
 * (b) each model call's block indices are offset by the number of blocks already relayed in the
 * turn; (c) a call that stops with `tool_use` but relays no `tool_use` block has its
 * `message_delta` and `message_stop` suppressed, as upstream handles the call itself and calls the
 * model again; (d) a frame with a non-null `parent_tool_use_id` is dropped; (e) any other call end
 * is relayed verbatim as the turn's end, and nothing after it is relayed.
 *
 * It also ends the turn with the `fail` signal, mapped by the run's failure reader: (i) a
 * `message_start` while the current upstream message still has an open block (its model call
 * broke after streaming content), (ii) a failed `result` before the end, and a `system/api_retry`
 * whose category is deterministic. A plain `api_retry` is not a trigger: a failed call that had
 * no open block is retried as one more suppressed `message_start`.
 *
 * Today the only calls (c) suppresses are failed StructuredOutput answers, whose block pass 6 has
 * already taken out. A call with a client `tool_use` block ends the turn here, and the park rule
 * (`park.ts`, the pass right after this one) parks it. The server-tool ticket widens (c) to calls
 * whose `tool_use` blocks are all built-in, and adds its synthesised result blocks to (b)'s count.
 */
import { ApiRetryFrame, Frame, ResultFrame, StreamEvent } from '../../upstream/frames';
import { FailureReader } from '../failure';
import { SurfaceError } from '../http/surface-error';
import { Pass } from './pass';
import { TurnEvent } from './turn-event';

/** `is_error: true` or a subtype other than `success`. */
const isFailedResult = (result: ResultFrame): boolean => result.is_error || result.subtype !== 'success';

class Flattener implements Pass<Frame, TurnEvent> {
  private started = false;
  private ended = false;
  /** The current upstream message's blocks that have started and not stopped. */
  private readonly openBlocks = new Set<number>();
  /** Blocks relayed in the turn so far, and the current call's offset (b). */
  private relayedBlocks = 0;
  private offset = 0;
  /** The current call relayed a `tool_use` block, so a `tool_use` stop ends the turn (c). */
  private toolCall = false;
  /** The current call's end is suppressed (c): its `message_stop` does not end the turn. */
  private continues = false;

  constructor(private readonly failures: FailureReader) {}

  push(frame: Frame): TurnEvent[] {
    if (this.ended) return [];
    if (frame.type === 'result') return this.onResult(frame);
    if (frame.type === 'system' && frame.subtype === 'api_retry') return this.onRetry(frame);
    if (frame.type !== 'stream_event' || frame.parent_tool_use_id != null) return [];
    return this.onEvent(frame.event);
  }

  end(): TurnEvent[] {
    return [];
  }

  private onEvent(event: StreamEvent): TurnEvent[] {
    switch (event.type) {
      case 'message_start':
        return this.onMessageStart(event);
      case 'content_block_start':
        this.openBlocks.add(event.index);
        this.toolCall ||= event.content_block['type'] === 'tool_use';
        this.relayedBlocks = Math.max(this.relayedBlocks, this.offset + event.index + 1);
        return [{ ...event, index: this.offset + event.index }];
      case 'content_block_delta':
        return [{ ...event, index: this.offset + event.index }];
      case 'content_block_stop':
        this.openBlocks.delete(event.index);
        return [{ ...event, index: this.offset + event.index }];
      case 'message_delta':
        this.continues = event.delta['stop_reason'] === 'tool_use' && !this.toolCall;
        return this.continues ? [] : [event];
      case 'message_stop':
        return this.onMessageStop(event);
      default:
        return [event];
    }
  }

  private onMessageStart(event: StreamEvent): TurnEvent[] {
    if (this.openBlocks.size > 0) return this.fail(this.failures.errorFor({ kind: 'broken_call' }));
    this.offset = this.relayedBlocks;
    this.toolCall = false;
    if (this.started) return [];
    this.started = true;
    return [event];
  }

  private onMessageStop(event: StreamEvent): TurnEvent[] {
    if (this.continues) {
      this.continues = false;
      return [];
    }
    this.ended = true;
    return [event];
  }

  private onRetry(retry: ApiRetryFrame): TurnEvent[] {
    const error = this.failures.failFast(retry);
    return error ? this.fail(error) : [];
  }

  private onResult(result: ResultFrame): TurnEvent[] {
    return isFailedResult(result) ? this.fail(this.failures.errorFor({ kind: 'result', result })) : [];
  }

  private fail(error: SurfaceError): TurnEvent[] {
    this.ended = true;
    return [{ type: 'fail', error }];
  }
}

export function createFlattener(failures: FailureReader): Pass<Frame, TurnEvent> {
  return new Flattener(failures);
}
