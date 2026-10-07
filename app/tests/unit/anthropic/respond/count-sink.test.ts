/**
 * The `count_tokens` sink (spec section 12): the run's first `message_delta` is the measurement.
 * Its usage's `input_tokens` plus both cache counters is the answer, written as `200
 * application/json` `{input_tokens}`; nothing is written before it, so a failure before it is a
 * pre-commit HTTP error; everything after it is ignored.
 */
import { SurfaceError } from '../../../../src/anthropic/surface-error';
import { createCountSink, TurnSink } from '../../../../src/anthropic/respond';
import { ApiEvent, TurnEvent } from '../../../../src/anthropic/translate';
import { BLOCK_STOP, MESSAGE_START, MESSAGE_STOP, TEXT_START, textDelta } from '../../../mocks/anthropic/turn-frames';
import { SinkServer, startSinkServer } from '../../../mocks/anthropic/sink-server';

const START = {
  ...MESSAGE_START,
  message: {
    ...MESSAGE_START.message,
    usage: { input_tokens: 2, cache_creation_input_tokens: 627, cache_read_input_tokens: 40, output_tokens: 1 }
  }
};

const delta = (usage: object) => ({
  type: 'message_delta', delta: { stop_reason: 'max_tokens', stop_sequence: null }, usage
});

/** The first call of a one-token run, as upstream streams it: 2 + 3867 + 531 input tokens. */
const ONE_TOKEN_CALL = [
  START, TEXT_START, textDelta('A'), BLOCK_STOP,
  delta({ input_tokens: 2, cache_creation_input_tokens: 3867, cache_read_input_tokens: 531, output_tokens: 1 })
];

describe('count sink', () => {
  let server: SinkServer<TurnSink>;

  beforeEach(async () => {
    server = await startSinkServer(res => createCountSink(res));
  });

  afterEach(async () => {
    await server.close();
  });

  const push = (sink: TurnSink, events: object[]) => events.forEach(event => sink.push(event as TurnEvent));

  it('answers the first message_delta: input_tokens plus both cache counters, as 200 application/json', async () => {
    const response = fetch(server.url);
    const { sink, res } = await server.nextSink();

    push(sink, ONE_TOKEN_CALL.slice(0, -1));
    expect(res.headersSent).toBe(false);
    push(sink, ONE_TOKEN_CALL.slice(-1));

    const answered = await response;
    expect(answered.status).toBe(200);
    expect(answered.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(await answered.json()).toEqual({ input_tokens: 4400 });
    await expect(sink.outcome).resolves.toEqual({ kind: 'completed' });
  });

  it('ignores everything after it: the rest of the run, the cut, a failure', async () => {
    const response = fetch(server.url);
    const { sink } = await server.nextSink();

    push(sink, ONE_TOKEN_CALL);
    push(sink, [MESSAGE_STOP, { type: 'cut', reason: 'max_tokens' }, START, delta({ input_tokens: 9, output_tokens: 1 })]);
    sink.push({ type: 'fail', error: new SurfaceError(500, 'api_error', 'upstream exited with code 1') });

    expect(await (await response).json()).toEqual({ input_tokens: 4400 });
    await expect(sink.outcome).resolves.toEqual({ kind: 'completed' });
  });

  it('counts a null or missing cache counter as none', async () => {
    const response = fetch(server.url);
    const { sink } = await server.nextSink();

    push(sink, [START, delta({ input_tokens: 493, cache_creation_input_tokens: null, output_tokens: 1 })]);

    expect(await (await response).json()).toEqual({ input_tokens: 493 });
  });

  it("takes the call's message_start counters when its message_delta carries no input count", async () => {
    const response = fetch(server.url);
    const { sink } = await server.nextSink();

    push(sink, [START, delta({ input_tokens: null, output_tokens: 1 })]);

    expect(await (await response).json()).toEqual({ input_tokens: 669 });
  });

  it('fails pre-commit when upstream reported no input count at all', async () => {
    const response = fetch(server.url);
    const { sink, res } = await server.nextSink();

    const uncounted = { ...MESSAGE_START, message: { ...MESSAGE_START.message, usage: { output_tokens: 1 } } };
    push(sink, [uncounted, delta({ output_tokens: 1 })]);

    await expect(sink.outcome).resolves.toEqual({
      kind: 'rejected', error: new SurfaceError(500, 'api_error', 'Upstream reported no input token count')
    });
    expect(res.headersSent).toBe(false);
    res.end();
    await response;
  });

  it('settles as rejected and writes nothing on a failure before the measurement', async () => {
    const response = fetch(server.url);
    const { sink, res } = await server.nextSink();
    const error = new SurfaceError(529, 'overloaded_error', 'Upstream overloaded');

    push(sink, [START, TEXT_START]);
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
    sink.push(START as ApiEvent);

    controller.abort();

    await expect(sink.outcome).resolves.toEqual({ kind: 'disconnected' });
    await response;
  });
});
