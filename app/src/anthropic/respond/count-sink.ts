/**
 * The `count_tokens` sink (spec section 12): the turn stream of the run that measures a request.
 * Its first `message_delta` is the measurement: `input_tokens` plus `cache_creation_input_tokens`
 * plus `cache_read_input_tokens` of its usage (the call's `message_start` counters when the delta
 * carries no input count), written as `200 application/json` `{input_tokens}`. Nothing is written
 * before it, so every failure before it is a pre-commit HTTP error, as on Messages; everything
 * after it (the rest of the run, the cut, a failure) is ignored.
 */
import { ServerResponse } from 'http';
import { JsonObject } from '../../upstream/frames';
import { SurfaceError } from '../http/surface-error';
import { TurnEvent } from '../translate';
import { Settlement, TurnSink } from './sink';

const counter = (usage: JsonObject, name: string): number => {
  const value = usage[name];
  return typeof value === 'number' ? value : 0;
};

/** The usage's input count, or null when it carries none. */
function inputCount(usage: unknown): number | null {
  if (typeof usage !== 'object' || usage === null) return null;
  const counters = usage as JsonObject;
  if (typeof counters['input_tokens'] !== 'number') return null;
  return counter(counters, 'input_tokens') + counter(counters, 'cache_creation_input_tokens') +
    counter(counters, 'cache_read_input_tokens');
}

class CountSink implements TurnSink {
  private readonly settlement: Settlement;
  private started: unknown;

  constructor(private readonly res: ServerResponse) {
    this.settlement = new Settlement(res);
  }

  get outcome() {
    return this.settlement.outcome;
  }

  push(event: TurnEvent): void {
    if (this.settlement.done) return;
    if (event.type === 'fail') return this.settlement.settle({ kind: 'rejected', error: event.error });
    if (event.type === 'message_start') this.started ??= event.message['usage'];
    if (event.type !== 'message_delta') return;
    const count = inputCount(event.usage) ?? inputCount(this.started);
    if (count === null) {
      const error = new SurfaceError(500, 'api_error', 'Upstream reported no input token count');
      return this.settlement.settle({ kind: 'rejected', error });
    }
    this.settlement.settle({ kind: 'completed' });
    this.res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    this.res.end(JSON.stringify({ input_tokens: count }));
  }
}

export function createCountSink(res: ServerResponse): TurnSink {
  return new CountSink(res);
}
