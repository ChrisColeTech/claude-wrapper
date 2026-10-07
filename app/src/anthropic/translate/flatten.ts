/**
 * Pass 2, the flattener (spec section 11, ADR 0003): the run's `stream_event` frames become one
 * turn stream. (a) The turn's first `message_start` is relayed and every later one suppressed;
 * (d) a frame with a non-null `parent_tool_use_id` is dropped; (e) the call's `message_delta`
 * and `message_stop` are relayed verbatim as the turn's end, and nothing after it is relayed.
 *
 * It also ends the turn with the `fail` signal, mapped by the run's failure reader: (i) a
 * `message_start` while the current upstream message still has an open block (its model call
 * broke after streaming content), (ii) a failed `result` before the end, and a `system/api_retry`
 * whose category is deterministic. A plain `api_retry` is not a trigger: a failed call that had
 * no open block is retried as one more suppressed `message_start`.
 *
 * This ticket flattens a single model call. Offsetting block indices across calls (b) comes with
 * the server-tool ticket; the `stop_reason: tool_use` rule (c) for client tools is the park rule
 * (`park.ts`), the pass right after this one.
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
        return [event];
      case 'content_block_stop':
        this.openBlocks.delete(event.index);
        return [event];
      case 'message_stop':
        this.ended = true;
        return [event];
      default:
        return [event];
    }
  }

  private onMessageStart(event: StreamEvent): TurnEvent[] {
    if (this.openBlocks.size > 0) return this.fail(this.failures.errorFor({ kind: 'broken_call' }));
    if (this.started) return [];
    this.started = true;
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
