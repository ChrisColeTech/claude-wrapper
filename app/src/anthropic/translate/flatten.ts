/**
 * Pass 2, the flattener (spec section 11, ADR 0003): the run's `stream_event` frames become one
 * turn stream. (a) The turn's first `message_start` is relayed and every later one suppressed;
 * (d) a frame with a non-null `parent_tool_use_id` is dropped; (e) the call's `message_delta`
 * and `message_stop` are relayed verbatim as the turn's end, and nothing after it is relayed.
 * A `result` that fails before that end becomes the `fail` signal.
 *
 * This ticket flattens a single model call. Offsetting block indices across calls (b) and the
 * `stop_reason: tool_use` rule (c) come with the server-tool and client-tool tickets.
 */
import { Frame, ResultFrame, StreamEvent } from '../../upstream/frames';
import { Pass } from './pass';
import { isFailedResult, resultError } from './result-error';
import { TurnEvent } from './turn-event';

class Flattener implements Pass<Frame, TurnEvent> {
  private started = false;
  private ended = false;

  push(frame: Frame): TurnEvent[] {
    if (this.ended) return [];
    if (frame.type === 'result') return this.onResult(frame);
    if (frame.type !== 'stream_event' || frame.parent_tool_use_id != null) return [];
    return this.onEvent(frame.event);
  }

  end(): TurnEvent[] {
    return [];
  }

  private onEvent(event: StreamEvent): TurnEvent[] {
    switch (event.type) {
      case 'message_start':
        if (this.started) return [];
        this.started = true;
        return [event];
      case 'message_stop':
        this.ended = true;
        return [event];
      default:
        return [event];
    }
  }

  private onResult(result: ResultFrame): TurnEvent[] {
    if (!isFailedResult(result)) return [];
    this.ended = true;
    return [{ type: 'fail', error: resultError(result) }];
  }
}

export function createFlattener(): Pass<Frame, TurnEvent> {
  return new Flattener();
}
