/**
 * A conversation through the official SDK (spec section 5, ADR 0002) against the replay runner.
 * The recordings are one upstream session across runs: `p3` starts it, `p6` and `p7` resume it
 * (`--resume`), and `p1` is a fresh session. A turn whose history is what the surface served
 * continues the session and sends only the new message; an edited history, or the same history
 * after a restart, is a replayed turn with the history rendered into the prompt. The recordings'
 * own `system/init` and `assistant` frames are the oracle.
 */
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_SETTING_ENV } from '../../../src/config/anthropic-settings';
import { createReplayRunner, parseRecording, Recording, ReplayRunner } from '../../../src/upstream/runner';
import { STATE } from '../../mocks/anthropic/plan-context';
import { memorySessions, TestSessions } from '../../mocks/anthropic/sessions';
import { SurfaceHarness, startSurface } from '../../mocks/anthropic/surface-harness';
import { BLOCK_STOP, END_TURN, initFrame, MESSAGE_START, MESSAGE_STOP, resultFrame, streamEvent, TEXT_START, textDelta }
  from '../../mocks/anthropic/turn-frames';
import { waitFor } from '../../mocks/shared/wait-for';
import { loadRecording, recordedStdout } from '../../mocks/upstream/recordings';

type MessageParam = Anthropic.MessageParam;
type Recorded = { type: string; subtype?: string; session_id?: string;
  message?: { content: { type: string; text?: string }[] } };

const P3 = 'cli-probes/p3-helpful-assistant-persisted.jsonl';
const P6 = 'cli-probes/p6-resume-snapshot-off.jsonl';
const P7 = 'cli-probes/p7-resume-snapshot-on.jsonl';
const P1 = 'cli-probes/p1-empty-system-prompt.jsonl';

const U1: MessageParam = { role: 'user', content: 'In one sentence: what are you, who made you, what tools do you have?' };
const U2: MessageParam = { role: 'user', content: 'What did I just ask you?' };
const U3: MessageParam = { role: 'user', content: 'And what did I ask first?' };

/** A recording's upstream session id and answer text, read straight from the file. */
function recorded(fixture: string): { sessionId: string; text: string } {
  const stdout = recordedStdout(fixture) as Recorded[];
  const init = stdout.find(frame => frame.type === 'system' && frame.subtype === 'init');
  const text = stdout.filter(frame => frame.type === 'assistant').flatMap(frame => frame.message?.content ?? [])
    .filter(block => block.type === 'text').map(block => block.text).join('');
  return { sessionId: String(init?.session_id), text };
}

const textOf = (message: Anthropic.Message) =>
  message.content.filter(block => block.type === 'text').map(block => (block as Anthropic.TextBlock).text).join('');
const flagValue = (flags: readonly string[], flag: string) => (flags.includes(flag) ? flags[flags.indexOf(flag) + 1] : undefined);
const userLine = (runner: ReplayRunner, run: number) =>
  (runner.started[run]?.input[0] as { message: { content: { type: string; text: string }[] } }).message;

describe('Anthropic surface: a conversation', () => {
  const surfaces: SurfaceHarness[] = [];
  let state: TestSessions;

  async function serve(...fixtures: (string | Recording)[]): Promise<{ client: Anthropic; runner: ReplayRunner }> {
    const recordings = fixtures.map(fixture => (typeof fixture === 'string' ? loadRecording(fixture) : fixture));
    const runner = createReplayRunner(recordings, { timeScale: 0 });
    state = memorySessions();
    const surface = await startSurface({ runner, stateDirectory: STATE, sessions: state.sessions });
    surfaces.push(surface);
    return { client: surface.client(), runner };
  }

  /** A turn's record lands at its `result`, which upstream writes after the response's `message_stop`. */
  const recordedTurns = (count: number) => waitFor(() => state.recorded.length === count);

  const create = (client: Anthropic, messages: MessageParam[]) =>
    client.messages.create({ model: 'fable', max_tokens: 1024, messages });

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    delete process.env[ANTHROPIC_SETTING_ENV.redact];
    await Promise.all(surfaces.splice(0).map(surface => surface.close()));
  });

  it('continues turn two on the upstream session and replays an edited turn three', async () => {
    const { client, runner } = await serve(P3, P6, P1);

    const first = await create(client, [U1]);
    await recordedTurns(1);
    const history: MessageParam[] = [U1, { role: 'assistant', content: first.content }];
    const second = await client.messages.stream({ model: 'fable', max_tokens: 1024, messages: [...history, U2] })
      .finalMessage();
    await recordedTurns(2);
    const edited: MessageParam = { role: 'user', content: 'In one word: who made you?' };
    const third = await create(client, [edited, history[1]!, U2, { role: 'assistant', content: second.content }, U3]);

    const [run1, run2, run3] = runner.started;
    expect(run1?.spec.flags).not.toContain('--resume');
    expect(flagValue(run2?.spec.flags ?? [], '--resume')).toBe(recorded(P3).sessionId);
    expect(userLine(runner, 1)).toEqual({ role: 'user', content: [{ type: 'text', text: U2.content }] });
    expect(textOf(second)).toBe(recorded(P6).text);
    expect(run3?.spec.flags).not.toContain('--resume');
    expect(userLine(runner, 2).content).toEqual([
      { type: 'text', text: '<conversation_history>\n' +
        'These are the earlier turns of this conversation, and the assistant turns in it are your own replies.\n' +
        `<turn role="user">\n${edited.content}\n</turn>\n` +
        `<turn role="assistant">\n${recorded(P3).text}\n</turn>\n` +
        `<turn role="user">\n${U2.content}\n</turn>\n` +
        `<turn role="assistant">\n${recorded(P6).text}\n</turn>\n` +
        '</conversation_history>' },
      { type: 'text', text: U3.content }
    ]);
    expect(textOf(third)).toBe(recorded(P1).text);
    expect(state.forgotten).toEqual([]);
  });

  it('continues again from a streamed continued turn, the client echoing only the text', async () => {
    const { client, runner } = await serve(P3, P6, P7);

    const first = await client.messages.stream({ model: 'fable', max_tokens: 1024, messages: [U1] }).finalMessage();
    await recordedTurns(1);
    const second = await create(client, [U1, { role: 'assistant', content: textOf(first) }, U2]);
    await recordedTurns(2);
    await create(client, [U1, { role: 'assistant', content: textOf(first) }, U2,
      { role: 'assistant', content: textOf(second) }, U3]);

    const sessionId = recorded(P3).sessionId;
    expect(runner.started.map(run => flagValue(run.spec.flags, '--resume') ?? null))
      .toEqual([null, sessionId, sessionId]);
    expect(userLine(runner, 2)).toEqual({ role: 'user', content: [{ type: 'text', text: U3.content }] });
  });

  it('continues after an answer the client got redacted, since that is the answer it echoes', async () => {
    process.env[ANTHROPIC_SETTING_ENV.redact] = 'Sam';
    const call = (text: string) => [MESSAGE_START, TEXT_START, textDelta(text), BLOCK_STOP, END_TURN, MESSAGE_STOP];
    const answer = (text: string) => parseRecording([initFrame(), ...call(text).map(event => streamEvent(event)), resultFrame()]
      .map(frame => JSON.stringify(frame)).join('\n'));
    const { client, runner } = await serve(answer('Hello Sam.'), answer('Bye.'));

    const first = await create(client, [{ role: 'user', content: 'I am Sam.' }]);
    await recordedTurns(1);
    await create(client, [{ role: 'user', content: 'I am Sam.' }, { role: 'assistant', content: first.content }, U2]);

    expect(textOf(first)).toBe('Hello [redacted].');
    expect(flagValue(runner.started[1]?.spec.flags ?? [], '--resume')).toBe('session-1');
  });

  it('replays the next turn after a restart, the new app knowing no session', async () => {
    const before = await serve(P3);
    const first = await create(before.client, [U1]);
    await recordedTurns(1);

    const after = await serve(P1);
    await create(after.client, [U1, { role: 'assistant', content: first.content }, U2]);

    expect(after.runner.started[0]?.spec.flags).not.toContain('--resume');
    expect(userLine(after.runner, 0).content[0]?.text).toMatch(/^<conversation_history>\n/);
  });
});
