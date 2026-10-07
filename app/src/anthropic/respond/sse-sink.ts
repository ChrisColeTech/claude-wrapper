/**
 * The SSE sink (spec section 11): the status and headers are committed at the turn's first
 * relayed event (`message_start`; the translator relays nothing before it), each API event is
 * written as the SSE event of its name, a `ping` is written whenever the ping interval passes
 * without an event from commit until `message_stop`, and the response ends right after
 * `message_stop`. A failure after commit is one `error` event carrying the request id. A client
 * disconnect settles the outcome so the conductor can interrupt the run.
 */
import { ServerResponse } from 'http';
import { Clock, TimerHandle } from '../../utils/clock';
import { SurfaceError } from '../http/surface-error';
import { isControlSignal, TurnEvent } from '../translate';
import { Settlement, TurnSink } from './sink';

export interface SseSinkOptions {
  /** Goes into the `error` event's `request_id`. */
  requestId: string;
  clock: Clock;
  /** Idle time before a `ping`; not a positive number: no pings. */
  pingIntervalMs: number;
}

const SSE_HEADERS = { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache' };

class SseSink implements TurnSink {
  private readonly settlement: Settlement;
  private ping: TimerHandle | undefined;

  constructor(private readonly res: ServerResponse, private readonly options: SseSinkOptions) {
    this.settlement = new Settlement(res, () => this.stopPing());
  }

  get outcome() {
    return this.settlement.outcome;
  }

  push(event: TurnEvent): void {
    if (this.settlement.done) return;
    if (event.type === 'fail') {
      this.fail(event.error);
      return;
    }
    if (isControlSignal(event)) return;
    if (!this.res.headersSent) this.res.writeHead(200, SSE_HEADERS);
    this.write(event.type, event);
    if (event.type === 'message_stop') this.end({ kind: 'completed' });
  }

  private fail(error: SurfaceError): void {
    if (!this.res.headersSent) {
      this.settlement.settle({ kind: 'rejected', error });
      return;
    }
    const { requestId } = this.options;
    this.write('error', { type: 'error', error: { type: error.type, message: error.message }, request_id: requestId });
    this.end({ kind: 'failed', error });
  }

  private end(outcome: { kind: 'completed' } | { kind: 'failed'; error: SurfaceError }): void {
    this.settlement.settle(outcome);
    this.res.end();
  }

  private write(name: string, data: unknown): void {
    if (this.res.destroyed) {
      this.settlement.settle({ kind: 'disconnected' });
      return;
    }
    this.res.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
    this.armPing();
  }

  private armPing(): void {
    this.stopPing();
    const { clock, pingIntervalMs } = this.options;
    if (!(pingIntervalMs > 0) || this.settlement.done) return;
    this.ping = clock.setTimeout(() => this.write('ping', { type: 'ping' }), pingIntervalMs);
  }

  private stopPing(): void {
    if (this.ping !== undefined) this.options.clock.clearTimeout(this.ping);
    this.ping = undefined;
  }
}

export function createSseSink(res: ServerResponse, options: SseSinkOptions): TurnSink {
  return new SseSink(res, options);
}
