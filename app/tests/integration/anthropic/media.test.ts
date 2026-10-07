/**
 * Images and documents through the official SDK (spec sections 4.3, 5, 11 and 13) against the
 * replay runner. The requests carry exactly the blocks the probes sent upstream, which upstream
 * echoed byte for byte and the model read (probe e: a base64 image; `o-pass-through-run1` and
 * `run2`: text, content and base64 PDF documents, and one with `title`, `context` and
 * `citations`); each turn replays what upstream answered. The surface sends those blocks on
 * unchanged on a first, a continued and a replayed turn, relays the document citation to both
 * response modes, and relays the API's 400 for mixed citation settings with the API's message.
 */
import Anthropic from '@anthropic-ai/sdk';
import { createReplayRunner, Recording, ReplayRunner } from '../../../src/upstream/runner';
import { STATE } from '../../mocks/anthropic/plan-context';
import { memorySessions, TestSessions } from '../../mocks/anthropic/sessions';
import { envelopeOf, rejectionOf, SurfaceHarness, startSurface } from '../../mocks/anthropic/surface-harness';
import { waitFor } from '../../mocks/shared/wait-for';
import { recordedTurn, recordedTurnStdout } from '../../mocks/upstream/recorded-turns';

type Block = Anthropic.ContentBlockParam;
type Recorded = { type: string; session_id?: string; message?: { content: Block[] };
  event?: { delta?: { type: string; citation?: unknown } } };

const RUN1 = 'cli-probes/o-pass-through-run1.jsonl';
const RUN2 = 'cli-probes/o-pass-through-run2.jsonl';
const PROBE_E = 'cli-probes/e-stream-json-input.jsonl';

const stdoutOf = (fixture: string, turn: number) => recordedTurnStdout(fixture, turn) as Recorded[];
/** The user message the probe sent in that turn, as upstream echoed it (identical to what was sent). */
const sentIn = (fixture: string, turn: number): Block[] =>
  stdoutOf(fixture, turn).find(frame => frame.type === 'user')?.message?.content ?? [];
/** The answer text upstream gave in that turn, from its `assistant` frames. */
const answeredIn = (fixture: string, turn: number): string =>
  stdoutOf(fixture, turn).filter(frame => frame.type === 'assistant').flatMap(frame => frame.message?.content ?? [])
    .map(block => (block as Anthropic.TextBlockParam).text).join('');
const sessionOf = (fixture: string) => String(stdoutOf(fixture, 1)[0]?.session_id);

const textOf = (message: Anthropic.Message) =>
  message.content.map(block => (block as Anthropic.TextBlock).text).join('');
const userLine = (runner: ReplayRunner, run: number) =>
  (runner.started[run]?.input[0] as { message: { role: string; content: Block[] } }).message;
const flagValue = (flags: readonly string[], flag: string) => (flags.includes(flag) ? flags[flags.indexOf(flag) + 1] : undefined);
const body = (messages: Anthropic.MessageParam[]) => ({ model: 'fable', max_tokens: 1024, messages });
const user = (content: Block[]): Anthropic.MessageParam => ({ role: 'user', content });

describe('Anthropic surface: images and documents', () => {
  let surface: SurfaceHarness;
  let runner: ReplayRunner;
  let state: TestSessions;

  async function serve(...recordings: Recording[]): Promise<Anthropic> {
    runner = createReplayRunner(recordings, { timeScale: 0 });
    state = memorySessions();
    surface = await startSurface({ runner, stateDirectory: STATE, sessions: state.sessions });
    return surface.client();
  }

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await surface.close();
  });

  it('sends a base64 image to upstream unchanged', async () => {
    const client = await serve(recordedTurn(RUN1, 3));
    const sent = sentIn(PROBE_E, 2);
    expect(sent.map(block => block.type)).toEqual(['image', 'text']);

    await client.messages.create(body([user(sent)]));

    expect(userLine(runner, 0)).toEqual({ role: 'user', content: sent });
  });

  it('sends a base64 PDF document to upstream unchanged and answers with what upstream read', async () => {
    const client = await serve(recordedTurn(RUN1, 3));
    const sent = sentIn(RUN1, 3);
    expect(sent.map(block => [block.type, (block as Anthropic.DocumentBlockParam).source?.type]))
      .toEqual([['document', 'base64'], ['text', undefined]]);

    const message = await client.messages.create(body([user(sent)]));

    expect(userLine(runner, 0)).toEqual({ role: 'user', content: sent });
    expect(textOf(message)).toBe(answeredIn(RUN1, 3));
    expect(textOf(message)).toContain('tangerine-7');
  });

  describe('a document with title, context and citations', () => {
    const citation = stdoutOf(RUN2, 1).map(frame => frame.event?.delta).find(delta => delta?.type === 'citations_delta')?.citation;
    const sent = sentIn(RUN2, 1);

    it('reaches upstream with every field, and messages.create carries the citation', async () => {
      const client = await serve(recordedTurn(RUN2, 1));
      expect(sent[0]).toEqual(expect.objectContaining({ type: 'document', title: 'Saffron memo',
        context: expect.any(String), citations: { enabled: true } }));

      const message = await client.messages.create(body([user(sent)]));

      expect(userLine(runner, 0)).toEqual({ role: 'user', content: sent });
      expect(message.content[1]).toEqual({ type: 'text', text: 'The codeword is saffron-5', citations: [citation] });
      expect(textOf(message)).toBe(answeredIn(RUN2, 1));
    });

    it("streams the citation as the SDK's citation event, and finalMessage() equals messages.create", async () => {
      const client = await serve(recordedTurn(RUN2, 1), recordedTurn(RUN2, 1));
      const created = await client.messages.create(body([user(sent)]));
      const cited: unknown[] = [];

      const stream = client.messages.stream(body([user(sent)])).on('citation', found => cited.push(found));
      // `parsed_output` is the SDK's client-side `parse()` field, never on the wire.
      const { parsed_output: _clientSide, ...streamed } = await stream.finalMessage();

      expect(cited).toEqual([citation]);
      expect(streamed).toEqual(created);
    });
  });

  it('continues a session after a document turn, sending only the new document message', async () => {
    const client = await serve(recordedTurn(RUN1, 1), recordedTurn(RUN1, 2));
    const first = await client.messages.create(body([user(sentIn(RUN1, 1))]));
    await waitFor(() => state.recorded.length === 1);

    const second = await client.messages.create(body([user(sentIn(RUN1, 1)),
      { role: 'assistant', content: first.content }, user(sentIn(RUN1, 2))]));

    expect(flagValue(runner.started[1]?.spec.flags ?? [], '--resume')).toBe(sessionOf(RUN1));
    expect(userLine(runner, 1)).toEqual({ role: 'user', content: sentIn(RUN1, 2) });
    expect(textOf(second)).toBe(answeredIn(RUN1, 2));
    expect(textOf(second)).toContain('cobalt-9');
  });

  it('replays earlier images and documents as real blocks in the history, in order', async () => {
    const client = await serve(recordedTurn(RUN1, 3));
    const [image] = sentIn(PROBE_E, 2);
    const [textDocument] = sentIn(RUN1, 1);
    const [pdf] = sentIn(RUN1, 3);

    await client.messages.create(body([user([image!, textDocument!, { type: 'text', text: 'Keep these.' }]),
      { role: 'assistant', content: 'Kept.' }, user([pdf!, { type: 'text', text: 'And this one?' }])]));

    const content = userLine(runner, 0).content;
    expect(content.filter(block => block.type !== 'text')).toEqual([image, textDocument, pdf]);
    expect(content[0]).toEqual({ type: 'text', text: expect.stringMatching(/^<conversation_history>\n/) });
  });

  it("relays the API's 400 for mixed citation settings with its message, and forgets the session", async () => {
    const client = await serve(recordedTurn(RUN1, 1), recordedTurn(RUN1, 6));
    const first = await client.messages.create(body([user(sentIn(RUN1, 1))]));
    await waitFor(() => state.recorded.length === 1);
    const cited = sentIn(RUN1, 6);
    expect(cited[0]).toEqual(expect.objectContaining({ type: 'document', citations: { enabled: true } }));

    const error = await rejectionOf(client.messages.create(body([user(sentIn(RUN1, 1)),
      { role: 'assistant', content: first.content }, user(cited)])));

    expect(error).toBeInstanceOf(Anthropic.BadRequestError);
    expect(envelopeOf(error).error).toEqual({ type: 'invalid_request_error',
      message: 'messages.9.content: Citations must be either enabled or disabled on all `document` blocks. ' +
        'A mixture of enabling and disabling is not supported at this time.' });
    expect(error.headers?.get('x-should-retry')).toBe('false');
    expect(flagValue(runner.started[1]?.spec.flags ?? [], '--resume')).toBe(sessionOf(RUN1));
    await waitFor(() => state.forgotten.includes(sessionOf(RUN1)));
  });
});
