/**
 * Pass 7, the `max_tokens` cut (spec section 12, ADR 0004). The run's output cap is the request's
 * `max_tokens`, but upstream does not stop at it: it asks the model to resume and calls it again.
 * When a relayed model call's `message_delta` carries `stop_reason: "max_tokens"`, that
 * `message_delta` and its `message_stop` are relayed as the turn's end (the real API's shape:
 * the partial content, `output_tokens` equal to the cap), followed by the `cut` signal, and every
 * event after it is ignored, a `fail` from a later `result` included.
 */
import { Pass } from './pass';
import { CutSignal, TurnEvent } from './turn-event';

const CUT: CutSignal = { type: 'cut', reason: 'max_tokens' };

class MaxTokensCut implements Pass<TurnEvent, TurnEvent> {
  private capped = false;
  private cut = false;

  push(event: TurnEvent): TurnEvent[] {
    if (this.cut) return [];
    if (event.type === 'message_delta' && event.delta['stop_reason'] === 'max_tokens') this.capped = true;
    if (event.type !== 'message_stop' || !this.capped) return [event];
    this.cut = true;
    return [event, CUT];
  }

  end(): TurnEvent[] {
    return [];
  }
}

export function createMaxTokensCut(): Pass<TurnEvent, TurnEvent> {
  return new MaxTokensCut();
}
