/**
 * The non-streaming sink (spec section 11): the turn stream is accumulated into one `Message`
 * (`accumulate`, the SDK accumulator's rules) and written as `200 application/json` at
 * `message_stop`. Nothing is written before then, so every failure is a pre-commit HTTP error.
 */
import { ServerResponse } from 'http';
import { ApiEvent } from '../translate';
import { accumulate } from './accumulate';
import { SinkEvent, Settlement, TurnSink } from './sink';

class JsonSink implements TurnSink {
  private readonly settlement: Settlement;
  private readonly events: ApiEvent[] = [];

  constructor(private readonly res: ServerResponse) {
    this.settlement = new Settlement(res);
  }

  get outcome() {
    return this.settlement.outcome;
  }

  push(event: SinkEvent): void {
    if (this.settlement.done) return;
    if (event.type === 'fail') {
      this.settlement.settle({ kind: 'rejected', error: event.error });
      return;
    }
    this.events.push(event);
    if (event.type !== 'message_stop') return;
    const body = JSON.stringify(accumulate(this.events));
    this.settlement.settle({ kind: 'completed' });
    this.res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    this.res.end(body);
  }
}

export function createJsonSink(res: ServerResponse): TurnSink {
  return new JsonSink(res);
}
