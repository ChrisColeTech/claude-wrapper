/**
 * The matching rule (spec section 5, ADR 0002): a request continues upstream session S when its
 * normalised `messages[0..n-1]` has S's recorded fingerprint and its tail is one user message with
 * no `tool_result`. The plan then resumes S (`--resume <id>`) and sends only that message.
 * Anything else (first turn, edit, truncation, regenerate, multi-message tail, a tool result, an
 * unknown or forgotten session) is a replayed turn. `system`, `model` and `tools` are not in the key.
 */
import { fingerprint, NormalisedMessage, planTurn, TurnPlan } from '../../../../src/anthropic/request';
import { Sessions } from '../../../../src/anthropic/sessions';
import { runContext, shippedCatalogue } from '../../../mocks/anthropic/plan-context';
import { memorySessions } from '../../../mocks/anthropic/sessions';

type Message = { role: 'user' | 'assistant'; content: string | object[] };

const U1: Message = { role: 'user', content: 'My name is Sam.' };
const A1: Message = { role: 'assistant', content: [{ type: 'text', text: 'Nice to meet you, Sam.' }] };
const U2: Message = { role: 'user', content: 'What is my name?' };
const A2: Message = { role: 'assistant', content: [{ type: 'text', text: 'Sam.' }] };
const U3: Message = { role: 'user', content: 'Spell it.' };

const blocksOf = (message: Message) =>
  (typeof message.content === 'string' ? [{ type: 'text', text: message.content }] : message.content);
const normalised = (...messages: Message[]) =>
  messages.map(message => ({ role: message.role, content: blocksOf(message) })) as NormalisedMessage[];

describe('planTurn: continued or replayed turn', () => {
  let sessions: Sessions;

  const plan = (messages: Message[], fields: object = {}) =>
    planTurn({ model: 'fable', max_tokens: 1024, messages, ...fields }, shippedCatalogue, sessions, runContext()) as TurnPlan;
  /** The session as the conductor records it after a clean turn: the request's messages plus the answer. */
  const recorded = (sessionId: string, ...transcript: Message[]) =>
    sessions.record(sessionId, fingerprint(normalised(...transcript)));

  beforeEach(() => {
    sessions = memorySessions().sessions;
  });

  it('replays a first turn', () => {
    const result = plan([U1]);

    expect(result.continuation).toEqual({ replay: { role: 'user', content: blocksOf(U1) } });
    expect(result.runSpec.flags).not.toContain('--resume');
  });

  it("continues the session whose transcript is the request's history, sending only the new message", () => {
    recorded('session-1', U1, A1);

    const result = plan([U1, A1, U2]);

    expect(result.continuation).toEqual({ resume: 'session-1', message: { role: 'user', content: blocksOf(U2) } });
    expect(result.runSpec.flags.slice(-4)).toEqual(['--max-turns', '25', '--resume', 'session-1']);
  });

  it("sends the new message's blocks verbatim", () => {
    recorded('session-1', U1, A1);
    const blocks = [{ type: 'text', text: 'And this?', cache_control: { type: 'ephemeral' } },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgo=' } }];

    const result = plan([U1, A1, { role: 'user', content: blocks }]);

    expect(result.continuation).toEqual({ resume: 'session-1', message: { role: 'user', content: blocks } });
  });

  it('continues whatever form the client echoes the answer in', () => {
    recorded('session-1', U1, A1);
    const echoes: Message[] = [
      { role: 'assistant', content: 'Nice to meet you, Sam.' },
      { role: 'assistant', content: [{ type: 'thinking', thinking: '', signature: 'c2ln' },
        { type: 'text', text: 'Nice to meet you, Sam.', citations: null }] }
    ];

    for (const echo of echoes) expect(plan([U1, echo, U2]).continuation).toEqual(expect.objectContaining({ resume: 'session-1' }));
  });

  it('merges a tail of consecutive user messages into the one new message', () => {
    recorded('session-1', U1, A1);

    const result = plan([U1, A1, U2, U3]);

    expect(result.continuation).toEqual({
      resume: 'session-1', message: { role: 'user', content: [...blocksOf(U2), ...blocksOf(U3)] }
    });
  });

  it('keeps system, model and tools out of the key', () => {
    recorded('session-1', U1, A1);

    const result = plan([U1, A1, U2], {
      model: 'opus',
      system: 'You are terse.',
      tools: [{ name: 'get_weather', description: 'Weather for a city', input_schema: { type: 'object', properties: {} } }],
      metadata: { user_id: 'someone-else' }
    });

    expect(result.continuation).toEqual(expect.objectContaining({ resume: 'session-1' }));
    expect(result.runSpec.flags).toEqual(expect.arrayContaining(['--model', 'claude-opus-5-5']));
  });

  describe('replays', () => {
    const replays = (result: TurnPlan) => {
      expect(result.continuation).toEqual({ replay: expect.objectContaining({ role: 'user' }) });
      expect(result.runSpec.flags).not.toContain('--resume');
    };

    it('an edited earlier message', () => {
      recorded('session-1', U1, A1);

      replays(plan([{ role: 'user', content: 'My name is Alex.' }, A1, U2]));
    });

    it('an edited answer', () => {
      recorded('session-1', U1, A1);

      replays(plan([U1, { role: 'assistant', content: 'Hello.' }, U2]));
    });

    it('a truncated history, the session having moved on', () => {
      recorded('session-1', U1, A1, U2, A2);

      replays(plan([U1, A1, U3]));
    });

    it('a regenerate: the same request again once its answer is recorded', () => {
      recorded('session-1', U1, A1, U2, A2);

      replays(plan([U1, A1, U2]));
    });

    it('a multi-message tail: more than the new user message beyond the recorded transcript', () => {
      recorded('session-1', U1, A1);

      replays(plan([U1, A1, U2, A2, U3]));
    });

    it('a tail carrying a tool_result', () => {
      const call: Message = { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_1', name: 'f', input: {} }] };
      recorded('session-1', U1, call);

      replays(plan([U1, call, { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'ok' },
        { type: 'text', text: 'Go on.' }] }]));
    });

    it('a forgotten session', () => {
      recorded('session-1', U1, A1);
      sessions.forget('session-1');

      replays(plan([U1, A1, U2]));
    });
  });

  it('renders the history of a replayed turn into its message', () => {
    const result = plan([U1, A1, U2]);

    expect(result.continuation).toEqual({ replay: { role: 'user', content: [
      expect.objectContaining({ type: 'text', text: expect.stringMatching(/^<conversation_history>\n/) }),
      { type: 'text', text: 'What is my name?' }
    ] } });
  });
});
