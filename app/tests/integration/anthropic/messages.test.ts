/**
 * A plain turn end to end (spec sections 2, 11, 16): `messages.create` and
 * `messages.stream().finalMessage()` through the official SDK against the replay runner playing
 * recorded plain turns. The recording itself (its `assistant` frames and `result`) is the oracle.
 */
import Anthropic from '@anthropic-ai/sdk';
import { createReplayRunner, ReplayRunner } from '../../../src/upstream/runner';
import { STATE } from '../../mocks/anthropic/plan-context';
import { REQUEST_ID, SurfaceHarness, startSurface } from '../../mocks/anthropic/surface-harness';
import { loadRecording, recordedStdout } from '../../mocks/upstream/recordings';

type Recorded = { type: string; message?: { content: { type: string; text?: string }[] };
  usage?: Record<string, unknown> };

const P1 = 'cli-probes/p1-empty-system-prompt.jsonl';
const T4 = 'cli-probes/t4-haiku-baseline.jsonl';
const USAGE_COUNTERS = ['input_tokens', 'output_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens'];

const request = (model: string) => ({
  model, max_tokens: 1024, messages: [{ role: 'user' as const, content: 'Who are you?' }]
});

/** The recording's answer text and `result.usage` counters, read straight from the file. */
function recorded(fixture: string): { text: string; usage: Record<string, unknown> } {
  const stdout = recordedStdout(fixture) as Recorded[];
  const text = stdout.filter(frame => frame.type === 'assistant')
    .flatMap(frame => frame.message?.content ?? []).filter(block => block.type === 'text').map(block => block.text).join('');
  const usage = (stdout.find(frame => frame.type === 'result') as Recorded).usage ?? {};
  return { text, usage: Object.fromEntries(USAGE_COUNTERS.map(key => [key, usage[key]])) };
}

const counters = (usage: object): Record<string, unknown> =>
  Object.fromEntries(USAGE_COUNTERS.map(key => [key, (usage as Record<string, unknown>)[key]]));

describe('Anthropic surface: a plain turn', () => {
  let surface: SurfaceHarness;
  let runner: ReplayRunner;

  async function serve(...fixtures: string[]): Promise<Anthropic> {
    runner = createReplayRunner(fixtures.map(loadRecording), { timeScale: 0 });
    surface = await startSurface({ runner, stateDirectory: STATE });
    return surface.client();
  }

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await surface.close();
  });

  it('answers messages.create with the recorded message, its model, usage and a request id', async () => {
    const client = await serve(P1);

    const { data: message, response } = await client.messages.create(request('claude-fable-5-1')).withResponse();

    expect(response.headers.get('request-id')).toMatch(REQUEST_ID);
    expect(message).toEqual(expect.objectContaining({ type: 'message', role: 'assistant', model: 'claude-fable-5-1',
      stop_reason: 'end_turn', stop_sequence: null }));
    expect(message.content.map(block => block.type)).toEqual(['thinking', 'text']);
    expect(message.content[1]).toEqual({ type: 'text', text: recorded(P1).text });
    expect(counters(message.usage)).toEqual(recorded(P1).usage);
  });

  it('runs the planned spec and sends the planned user message', async () => {
    const client = await serve(P1);

    await client.messages.create(request('claude-fable-5-1'));

    const [started] = runner.started;
    expect(started?.spec.flags).toEqual(expect.arrayContaining(['--model', 'claude-fable-5-1']));
    expect(started?.spec.cwd).toBe(STATE.cwd);
    expect(started?.input[0]).toEqual(expect.objectContaining({
      type: 'user', message: { role: 'user', content: [{ type: 'text', text: 'Who are you?' }] }
    }));
  });

  it('answers messages.stream().finalMessage() with the same message as messages.create, usage included', async () => {
    const client = await serve(P1, P1);

    const created = await client.messages.create(request('claude-fable-5-1'));
    const streamed = await client.messages.stream(request('claude-fable-5-1')).finalMessage();

    expect(streamed).toEqual(expect.objectContaining({ ...created, usage: created.usage }));
    expect(streamed.usage).toEqual(created.usage);
  });

  it("streams the events in the real API's order with a request id", async () => {
    const client = await serve(P1);

    const { data: stream, response } = await client.messages.create({ ...request('claude-fable-5-1'), stream: true })
      .withResponse();
    const events: string[] = [];
    for await (const event of stream) {
      events.push(event.type === 'content_block_start' || event.type === 'content_block_stop'
        ? `${event.type} ${event.index}` : event.type);
    }

    expect(response.headers.get('request-id')).toMatch(REQUEST_ID);
    expect(response.headers.get('content-type')).toBe('text/event-stream; charset=utf-8');
    expect(events.filter(event => event !== 'content_block_delta')).toEqual([
      'message_start', 'content_block_start 0', 'content_block_stop 0', 'content_block_start 1',
      'content_block_stop 1', 'message_delta', 'message_stop'
    ]);
  });

  it('runs an alias as the canonical id and relays the resolved model', async () => {
    const client = await serve(T4);

    const message = await client.messages.stream(request('haiku')).finalMessage();

    expect(runner.started[0]?.spec.flags).toEqual(expect.arrayContaining(['--model', 'claude-haiku-4-5-20251001']));
    expect(message.model).toBe('claude-haiku-4-5-20251001');
    expect(message.content.find(block => block.type === 'text')).toEqual({ type: 'text', text: recorded(T4).text });
  });

  it('rejects an invalid request before any run', async () => {
    const client = await serve(P1);

    const error = await client.messages.create({ ...request('claude-fable-5-1'), max_tokens: 0 }).catch(e => e);

    expect(error).toBeInstanceOf(Anthropic.BadRequestError);
    expect(runner.started).toHaveLength(0);
  });
});
