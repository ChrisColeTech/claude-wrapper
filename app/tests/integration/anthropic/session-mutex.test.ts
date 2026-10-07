/**
 * One upstream session, one run at a time (spec sections 5 and 14), through the official SDK with
 * a scripted upstream. A turn that ends cleanly makes its session findable at once, before
 * upstream's `result`, so a client that sends its next turn faster than upstream writes `result`
 * still gets a continued turn. That turn waits for the previous run's exit (the transcript is
 * written by then), up to 10 s, then SIGKILL; it is re-planned after the wait, so a previous turn
 * that turned out an error makes it a replayed turn. A previous run still parked after the wait is
 * abandoned (its session forgotten) and SIGKILLed, so the turn is replayed. A duplicate request
 * queues behind the turn in flight on its session and is replayed.
 */
import Anthropic from '@anthropic-ai/sdk';
import { weatherCalls } from '../../mocks/anthropic/bridge-upstream';
import { GET_WEATHER } from '../../mocks/anthropic/client-tool-recordings';
import { STATE } from '../../mocks/anthropic/plan-context';
import { memorySessions, TestSessions } from '../../mocks/anthropic/sessions';
import { SurfaceHarness, startSurface } from '../../mocks/anthropic/surface-harness';
import { initFrame, MESSAGE_START, PLAIN_CALL, resultFrame, streamEvent } from '../../mocks/anthropic/turn-frames';
import { createFakeClock, FakeClock } from '../../mocks/shared/fake-clock';
import { waitFor } from '../../mocks/shared/wait-for';
import { createScriptedRunner, ScriptedRun, ScriptedRunner } from '../../mocks/upstream/scripted-runner';

type MessageParam = Anthropic.MessageParam;

const SESSION = 'session-1';
const U1: MessageParam = { role: 'user', content: 'Say hi.' };
const U2: MessageParam = { role: 'user', content: 'Again.' };
/** The follow-up: the first turn's answer ("hi", from `PLAIN_CALL`) echoed, then a new message. */
const FOLLOW_UP = [U1, { role: 'assistant', content: 'hi' }, U2] as MessageParam[];
const body = (messages: MessageParam[]) => ({ model: 'fable', max_tokens: 256, messages });

const init = (sessionId = SESSION) => initFrame({ session_id: sessionId });
const call = () => PLAIN_CALL.map(event => streamEvent(event));
const errorResult = () =>
  resultFrame({ subtype: 'error_during_execution', is_error: true, result: undefined, errors: ['upstream broke'] });
const resumeOf = (run: ScriptedRun) => (run.spec.flags.includes('--resume') ? run.spec.flags.slice(-1)[0] : null);
const sentText = (run: ScriptedRun) => JSON.stringify(run.process.writtenLines()[0]);

describe('Anthropic surface: one run per upstream session', () => {
  let surface: SurfaceHarness;
  let runner: ScriptedRunner;
  let state: TestSessions;
  let client: Anthropic;
  let clock: FakeClock;

  /** The next run once it has the turn's message. */
  async function nextRun(): Promise<ScriptedRun> {
    const run = await runner.nextRun();
    await waitFor(() => run.process.writtenLines().length >= 1);
    return run;
  }

  /** Whether a run starts within a moment (it is then taken: the test must not await another). */
  async function startsSoon(next: Promise<ScriptedRun>): Promise<boolean> {
    return Promise.race([next.then(() => true), new Promise<boolean>(resolve => setTimeout(() => resolve(false), 100))]);
  }

  /** Upstream answers "hi" and stops short of its `result`: the response is complete, the run is not. */
  async function answerWithoutResult(run: ScriptedRun, sessionId = SESSION): Promise<void> {
    run.process.frames(init(sessionId), ...call());
  }

  /** Upstream writes its clean `result` and exits once stdin closes. */
  async function finishCleanly(run: ScriptedRun, sessionId = SESSION): Promise<void> {
    run.process.frames(resultFrame({ session_id: sessionId }));
    await waitFor(() => run.process.inputEnded());
    run.process.exit(0);
  }

  beforeEach(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    clock = createFakeClock(1_791_000_000_000);
    runner = createScriptedRunner(clock);
    state = memorySessions(clock);
    surface = await startSurface({ runner, clock, stateDirectory: STATE, sessions: state.sessions });
    client = surface.client();
  });

  afterEach(async () => {
    await surface.close();
  });

  it("continues the session when the follow-up arrives before the previous run's result, once that run has exited", async () => {
    const first = client.messages.create(body([U1]));
    const run1 = await nextRun();
    await answerWithoutResult(run1);
    await first;

    const second = client.messages.create(body(FOLLOW_UP));
    const next = nextRun();
    expect(await startsSoon(next)).toBe(false);
    await finishCleanly(run1);
    const run2 = await next;

    expect(resumeOf(run2)).toBe(SESSION);
    expect(run2.process.writtenLines()[0]).toEqual(expect.objectContaining({
      message: { role: 'user', content: [{ type: 'text', text: 'Again.' }] }
    }));
    await answerWithoutResult(run2);
    await finishCleanly(run2);
    await expect(second).resolves.toEqual(expect.objectContaining({ stop_reason: 'end_turn' }));
    expect(state.forgotten).toEqual([]);
  });

  it("replays the follow-up when the previous run's result turns out an error", async () => {
    const first = client.messages.create(body([U1]));
    const run1 = await nextRun();
    await answerWithoutResult(run1);
    await first;

    const second = client.messages.create(body(FOLLOW_UP));
    const next = nextRun();
    run1.process.frames(errorResult());
    await waitFor(() => run1.process.inputEnded());
    run1.process.exit(1);
    const run2 = await next;

    expect(resumeOf(run2)).toBeNull();
    expect(sentText(run2)).toContain('<conversation_history>');
    expect(state.forgotten).toContain(SESSION);
    await answerWithoutResult(run2, 'session-2');
    await finishCleanly(run2, 'session-2');
    await second;
  });

  it('SIGKILLs a previous run still there 10 s after its turn ended; with no result, the follow-up is replayed', async () => {
    const first = client.messages.create(body([U1]));
    const run1 = await nextRun();
    await answerWithoutResult(run1);
    await first;

    const second = client.messages.create(body(FOLLOW_UP));
    const next = nextRun();
    expect(await startsSoon(next)).toBe(false);
    clock.advance(9_999);
    expect(run1.process.kills).toEqual([]);
    clock.advance(1);
    await waitFor(() => run1.process.kills.length > 0);
    expect(run1.process.kills).toEqual(['SIGKILL']);
    run1.process.exit(null, 'SIGKILL');
    const run2 = await next;

    expect(resumeOf(run2)).toBeNull();
    expect(state.forgotten).toContain(SESSION);
    await answerWithoutResult(run2, 'session-2');
    await finishCleanly(run2, 'session-2');
    await second;
  });

  it('abandons a parked run its session waited 10 s for, SIGKILLs it, and replays the new turn', async () => {
    const withTool = (messages: MessageParam[]) => ({ ...body(messages), tools: [GET_WEATHER as Anthropic.Tool] });
    const initWithTool = (sessionId = SESSION) => initFrame({ session_id: sessionId, tools: ['mcp__client__get_weather'] });
    const first = client.messages.create(withTool([U1]));
    const run1 = await nextRun();
    run1.process.frames(initWithTool(), ...call());
    await first;
    await finishCleanly(run1);
    const parking = client.messages.create(withTool(FOLLOW_UP));
    const run2 = await nextRun();
    run2.process.frames(initWithTool(), ...weatherCalls([{ id: 'toolu_1', city: 'Paris' }]));
    expect(await parking).toEqual(expect.objectContaining({ stop_reason: 'tool_use' }));
    await waitFor(() => state.sessions.parked.get('toolu_1') !== undefined);

    // The client drops the tool call and sends another message on the same history.
    const dropped = client.messages.create(withTool([U1, { role: 'assistant', content: 'hi' }, { role: 'user', content: 'Never mind.' }]));
    const next = nextRun();
    expect(await startsSoon(next)).toBe(false);
    clock.advance(9_999);
    expect(run2.process.kills).toEqual([]);
    clock.advance(1);
    await waitFor(() => run2.process.kills.includes('SIGKILL'));
    expect(state.sessions.parked.get('toolu_1')).toBeUndefined();
    expect(state.forgotten).toContain(SESSION);
    run2.process.exit(null, 'SIGKILL');
    const run3 = await next;

    expect(resumeOf(run2)).toBe(SESSION);
    expect(resumeOf(run3)).toBeNull();
    expect(sentText(run3)).toContain('<conversation_history>');
    run3.process.frames(initWithTool('session-2'), ...call());
    await finishCleanly(run3, 'session-2');
    await expect(dropped).resolves.toEqual(expect.objectContaining({ stop_reason: 'end_turn' }));
  });

  it('queues a duplicate behind the turn in flight on its session, then replays it', async () => {
    const first = client.messages.create(body([U1]));
    const run1 = await nextRun();
    await answerWithoutResult(run1);
    await finishCleanly(run1);
    await first;
    const continued = client.messages.create(body(FOLLOW_UP));
    const runA = await nextRun();
    runA.process.frames(init(), streamEvent(MESSAGE_START));

    const duplicate = client.messages.create(body(FOLLOW_UP));
    const next = nextRun();
    expect(await startsSoon(next)).toBe(false);
    runA.process.frames(...call().slice(1));
    await continued;
    await finishCleanly(runA);
    const runB = await next;

    expect(resumeOf(runA)).toBe(SESSION);
    expect(resumeOf(runB)).toBeNull();
    expect(sentText(runB)).toContain('<conversation_history>');
    await answerWithoutResult(runB, 'session-2');
    await finishCleanly(runB, 'session-2');
    await duplicate;
  });
});
