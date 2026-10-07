/**
 * The non-streaming sink (spec section 11): the accumulated `Message` as one JSON response at
 * `message_stop`; any failure is pre-commit; a client gone before the end is a disconnect.
 */
import { SurfaceError } from '../../../../src/anthropic/surface-error';
import { accumulate, createJsonSink, TurnSink } from '../../../../src/anthropic/respond';
import { ApiEvent } from '../../../../src/anthropic/translate';
import { MESSAGE_START, PLAIN_CALL, TEXT_START } from '../../../mocks/anthropic/turn-frames';
import { SinkServer, startSinkServer } from '../../../mocks/anthropic/sink-server';

describe('JSON sink', () => {
  let server: SinkServer<TurnSink>;

  beforeEach(async () => {
    server = await startSinkServer(res => createJsonSink(res));
  });

  afterEach(async () => {
    await server.close();
  });

  it('writes the accumulated message as 200 application/json at message_stop', async () => {
    const response = fetch(server.url);
    const { sink, res } = await server.nextSink();

    PLAIN_CALL.slice(0, -1).forEach(event => sink.push(event as ApiEvent));
    expect(res.headersSent).toBe(false);
    sink.push(PLAIN_CALL[PLAIN_CALL.length - 1] as ApiEvent);

    const answered = await response;
    expect(answered.status).toBe(200);
    expect(answered.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(await answered.json()).toEqual(accumulate(PLAIN_CALL as ApiEvent[]));
    await expect(sink.outcome).resolves.toEqual({ kind: 'completed' });
  });

  it('settles as rejected and writes nothing on a failure, even after message_start', async () => {
    const response = fetch(server.url);
    const { sink, res } = await server.nextSink();
    const error = new SurfaceError(500, 'api_error', 'upstream broke');

    [MESSAGE_START, TEXT_START].forEach(event => sink.push(event as ApiEvent));
    sink.push({ type: 'fail', error });

    await expect(sink.outcome).resolves.toEqual({ kind: 'rejected', error });
    expect(res.headersSent).toBe(false);
    res.end();
    await response;
  });

  it('settles as disconnected when the client goes away first', async () => {
    const controller = new AbortController();
    const response = fetch(server.url, { signal: controller.signal }).catch(() => undefined);
    const { sink } = await server.nextSink();
    sink.push(MESSAGE_START as ApiEvent);

    controller.abort();

    await expect(sink.outcome).resolves.toEqual({ kind: 'disconnected' });
    await response;
  });
});
