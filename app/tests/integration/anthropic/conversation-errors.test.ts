/**
 * Error-turn eviction (spec sections 5 and 14): a turn that ends in an upstream error, a
 * post-commit failure, a mid-stream disconnect, or a run that ends before its `result` records
 * nothing and forgets its upstream session (its transcript deleted), so the client's retry is a
 * replayed turn rather than a resume onto a dangling message. Driven through the official SDK
 * with the scripted runner: the test plays upstream by hand.
 */
import Anthropic from '@anthropic-ai/sdk';
import { STATE } from '../../mocks/anthropic/plan-context';
import { memorySessions, TestSessions } from '../../mocks/anthropic/sessions';
import { rejectionOf, SurfaceHarness, startSurface } from '../../mocks/anthropic/surface-harness';
import { initFrame, MESSAGE_START, PLAIN_CALL, resultFrame, streamEvent, TEXT_START, textDelta }
  from '../../mocks/anthropic/turn-frames';
import { createScriptedRunner, ScriptedRun, ScriptedRunner } from '../../mocks/upstream/scripted-runner';
import { waitFor } from '../../mocks/shared/wait-for';

type MessageParam = Anthropic.MessageParam;

const SESSION = 'session-1';
const U1: MessageParam = { role: 'user', content: 'Say hi.' };
const U2: MessageParam = { role: 'user', content: 'Again.' };
/** The second request: the first turn's answer ("hi", from `PLAIN_CALL`) echoed, then a new message. */
const SECOND = [U1, { role: 'assistant', content: 'hi' }, U2] as MessageParam[];
const body = (messages: MessageParam[]) => ({ model: 'fable', max_tokens: 256, messages });

const init = (sessionId = SESSION) => initFrame({ session_id: sessionId });
const call = () => PLAIN_CALL.map(event => streamEvent(event));
const errorResult = (fields: object = {}) =>
  resultFrame({ subtype: 'error_during_execution', is_error: true, result: undefined, errors: ['upstream broke'], ...fields });

describe('Anthropic surface: an error turn forgets its upstream session', () => {
  let surface: SurfaceHarness;
  let runner: ScriptedRunner;
  let state: TestSessions;
  let client: Anthropic;

  /** The next run once it has the turn's message. */
  async function nextRun(): Promise<ScriptedRun> {
    const run = await runner.nextRun();
    await waitFor(() => run.process.writtenLines().length >= 1);
    return run;
  }

  /** Upstream answers "hi" cleanly and exits once stdin closes. */
  async function answerCleanly(run: ScriptedRun, sessionId = SESSION): Promise<void> {
    run.process.frames(init(sessionId), ...call(), resultFrame({ session_id: sessionId }));
    await waitFor(() => run.process.inputEnded());
    run.process.exit(0);
  }

  /** A first turn the surface records under SESSION, then the second request's run, started. */
  async function continuedTurn(stream: boolean): Promise<{ run: ScriptedRun; response: Promise<unknown> }> {
    const first = client.messages.create(body([U1]));
    await answerCleanly(await nextRun());
    await first;
    await waitFor(() => state.recorded.length === 1);
    const response = stream ? client.messages.stream(body(SECOND)).finalMessage() : client.messages.create(body(SECOND));
    const run = await nextRun();
    expect(run.spec.flags.slice(-2)).toEqual(['--resume', SESSION]);
    return { run, response: response.catch((error: unknown) => error) };
  }

  /** The client retries the second request: a replayed turn, answered cleanly. */
  async function retryIsReplayed(): Promise<void> {
    const retried = client.messages.create(body(SECOND));
    const run = await nextRun();
    expect(run.spec.flags).not.toContain('--resume');
    expect(JSON.stringify(run.process.writtenLines()[0])).toContain('<conversation_history>');
    await answerCleanly(run, 'session-2');
    await retried;
  }

  beforeEach(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    runner = createScriptedRunner();
    state = memorySessions();
    surface = await startSurface({ runner, stateDirectory: STATE, sessions: state.sessions });
    client = surface.client();
  });

  afterEach(async () => {
    await surface.close();
  });

  it('on an upstream error before commit', async () => {
    const { run, response } = await continuedTurn(false);

    run.process.frames(init(), resultFrame({ is_error: true, api_error_status: 400, result: 'API Error: 400 bad block' }));

    expect(await response).toBeInstanceOf(Anthropic.BadRequestError);
    await waitFor(() => state.forgotten.includes(SESSION));
    run.process.exit(1);
    await waitFor(() => state.deleted.length === 2);
    expect(state.deleted).toEqual([SESSION, SESSION]);
    await retryIsReplayed();
  });

  it('on a failure after commit', async () => {
    const { run, response } = await continuedTurn(true);

    run.process.frames(init(), streamEvent(MESSAGE_START), streamEvent(TEXT_START), streamEvent(textDelta('Hel')),
      errorResult());

    expect(await response).toBeInstanceOf(Anthropic.APIError);
    await waitFor(() => run.process.inputEnded());
    run.process.exit(1);
    await waitFor(() => state.deleted.length === 2);
    expect(state.deleted).toEqual([SESSION, SESSION]);
    await retryIsReplayed();
  });

  it('on a run that ends before its result, even after the whole message reached the client', async () => {
    const { run, response } = await continuedTurn(false);

    run.process.frames(init(), ...call());
    expect(await response).toEqual(expect.objectContaining({ content: [{ type: 'text', text: 'hi' }] }));
    expect(state.forgotten).toEqual([]);
    run.process.exit(1);

    await waitFor(() => state.deleted.length === 1);
    expect(state.forgotten).toEqual([SESSION]);
    await retryIsReplayed();
  });

  it('on an error result after the whole message reached the client', async () => {
    const { run, response } = await continuedTurn(true);

    run.process.frames(init(), ...call(), errorResult());

    expect(await response).toEqual(expect.objectContaining({ stop_reason: 'end_turn' }));
    await waitFor(() => state.forgotten.includes(SESSION));
    run.process.exit(1);
    await waitFor(() => state.deleted.length === 2);
    await retryIsReplayed();
  });

  it('at once on a client that disconnects mid-stream, and again once the run has exited', async () => {
    const first = client.messages.create(body([U1]));
    await answerCleanly(await nextRun());
    await first;
    await waitFor(() => state.recorded.length === 1);
    const stream = client.messages.stream(body(SECOND));
    const firstText = new Promise(resolve => stream.on('text', resolve));
    const ended = stream.finalMessage().catch((error: unknown) => error);
    const run = await nextRun();

    run.process.frames(init(), streamEvent(MESSAGE_START), streamEvent(TEXT_START), streamEvent(textDelta('Hel')));
    await firstText;
    stream.abort();
    expect(await ended).toBeInstanceOf(Anthropic.APIUserAbortError);

    await waitFor(() => state.forgotten.includes(SESSION));
    expect(state.deleted).toEqual([SESSION]);
    run.process.frames(errorResult());
    await waitFor(() => run.process.inputEnded());
    run.process.exit(0);
    await waitFor(() => state.deleted.length === 2);
    await retryIsReplayed();
  });

  it('forgets the new session of a replayed turn that fails', async () => {
    const response = rejectionOf(client.messages.create(body([U1])));
    const run = await nextRun();

    run.process.frames(init('session-9'), resultFrame({ session_id: 'session-9', is_error: true, result: 'API Error: 500 x' }));
    await response;
    run.process.exit(1);

    await waitFor(() => state.deleted.length === 2);
    expect(state.deleted).toEqual(['session-9', 'session-9']);
    expect(state.recorded).toEqual([]);
  });

  it('records the session of a clean turn and forgets nothing', async () => {
    const first = client.messages.create(body([U1]));
    await answerCleanly(await nextRun());
    await first;

    await waitFor(() => state.recorded.length === 1);
    expect(state.recorded).toEqual([SESSION]);
    expect(state.forgotten).toEqual([]);
  });
});
