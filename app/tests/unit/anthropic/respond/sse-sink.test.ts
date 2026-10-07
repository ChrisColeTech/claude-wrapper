/**
 * The SSE sink (spec section 11): commit at the first `message_start`, named events, an idle
 * `ping`, the end right after `message_stop`, the post-commit `error` event, and the client's
 * disconnect, observed over a real loopback connection.
 */
import { ServerResponse } from 'http';
import { SurfaceError } from '../../../../src/anthropic/http/surface-error';
import { createSseSink, TurnSink } from '../../../../src/anthropic/respond';
import { ApiEvent } from '../../../../src/anthropic/translate';
import { createFakeClock, FakeClock } from '../../../mocks/shared/fake-clock';
import { BLOCK_STOP, END_TURN, MESSAGE_START, MESSAGE_STOP, PLAIN_CALL, TEXT_START, textDelta } from '../../../mocks/anthropic/turn-frames';
import { bodyReader, SinkServer, sseEvents, startSinkServer } from '../../../mocks/anthropic/sink-server';

const REQUEST_ID = 'req_000000000000000000000001';
const PING = { event: 'ping', data: { type: 'ping' } };
const named = (events: object[]) => (events as ApiEvent[]).map(event => ({ event: event.type, data: event }));

describe('SSE sink', () => {
  let clock: FakeClock;
  let server: SinkServer<TurnSink>;

  beforeEach(async () => {
    clock = createFakeClock();
    server = await startSinkServer(res => createSseSink(res, { requestId: REQUEST_ID, clock, pingIntervalMs: 15_000 }));
  });

  afterEach(async () => {
    await server.close();
  });

  async function open(): Promise<{ sink: TurnSink; res: ServerResponse; response: Promise<Response> }> {
    const response = fetch(server.url);
    const { sink, res } = await server.nextSink();
    return { sink, res, response };
  }

  it('commits status and headers at message_start, writes named events and ends after message_stop', async () => {
    const { sink, res, response } = await open();
    expect(res.headersSent).toBe(false);

    sink.push(MESSAGE_START as ApiEvent);
    const committed = await response;
    expect(committed.status).toBe(200);
    expect(committed.headers.get('content-type')).toBe('text/event-stream; charset=utf-8');
    expect(committed.headers.get('cache-control')).toBe('no-cache');

    PLAIN_CALL.slice(1).forEach(event => sink.push(event as ApiEvent));
    expect(sseEvents(await bodyReader(committed).rest())).toEqual(named(PLAIN_CALL));
    await expect(sink.outcome).resolves.toEqual({ kind: 'completed' });
  });

  it('writes a ping whenever 15 s pass without an event, from commit until message_stop', async () => {
    const { sink, response } = await open();
    sink.push(MESSAGE_START as ApiEvent);
    const body = bodyReader(await response);

    clock.advance(14_999);
    sink.push(TEXT_START as ApiEvent);
    clock.advance(14_999);
    sink.push(textDelta('hi') as ApiEvent);
    clock.advance(15_000);
    await body.until(text => text.includes('event: ping'));
    clock.advance(15_000);
    [BLOCK_STOP, END_TURN, MESSAGE_STOP].forEach(event => sink.push(event as ApiEvent));

    const events = sseEvents(await body.rest());
    expect(events).toEqual([...named([MESSAGE_START, TEXT_START, textDelta('hi')]), PING, PING,
      ...named([BLOCK_STOP, END_TURN, MESSAGE_STOP])]);
    expect(clock.pendingCount()).toBe(0);
  });

  it('settles as rejected and writes nothing on a failure before commit', async () => {
    const { sink, res, response } = await open();
    const error = new SurfaceError(500, 'api_error', 'upstream broke');

    sink.push({ type: 'fail', error });

    await expect(sink.outcome).resolves.toEqual({ kind: 'rejected', error });
    expect(res.headersSent).toBe(false);
    res.end();
    await response;
  });

  it('writes one error event carrying the request id after commit, then ends', async () => {
    const { sink, response } = await open();
    const error = new SurfaceError(504, 'timeout_error', 'upstream stalled');

    [MESSAGE_START, TEXT_START].forEach(event => sink.push(event as ApiEvent));
    sink.push({ type: 'fail', error });
    sink.push(textDelta('ignored') as ApiEvent);

    const events = sseEvents(await bodyReader(await response).rest());
    expect(events.slice(-1)).toEqual([{ event: 'error', data: {
      type: 'error', error: { type: 'timeout_error', message: 'upstream stalled' }, request_id: REQUEST_ID
    } }]);
    expect(events).toHaveLength(3);
    await expect(sink.outcome).resolves.toEqual({ kind: 'failed', error });
  });

  it('settles as disconnected when the client goes away mid-stream, and stops pinging', async () => {
    const controller = new AbortController();
    const response = fetch(server.url, { signal: controller.signal });
    const { sink } = await server.nextSink();
    sink.push(MESSAGE_START as ApiEvent);
    await bodyReader(await response).until(text => text.includes('message_start'));

    controller.abort();

    await expect(sink.outcome).resolves.toEqual({ kind: 'disconnected' });
    expect(clock.pendingCount()).toBe(0);
    expect(() => sink.push(TEXT_START as ApiEvent)).not.toThrow();
  });

  it('settles as disconnected when the client goes away before commit', async () => {
    const controller = new AbortController();
    const response = fetch(server.url, { signal: controller.signal }).catch(() => undefined);
    const { sink } = await server.nextSink();

    controller.abort();

    await expect(sink.outcome).resolves.toEqual({ kind: 'disconnected' });
    await response;
  });
});
