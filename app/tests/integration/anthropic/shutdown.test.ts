/**
 * Wrapper shutdown through the official SDK (spec section 14), upstream scripted by the test: a
 * stream in flight gets the SSE `error` "server shutting down" and its run goes down the teardown
 * ladder; a request arriving meanwhile gets 529; a parked run is interrupted before its waiting
 * tool call is rejected; the control server closes once every run has exited; the drain is bounded
 * (SIGKILL); and no log line carries the control server's token.
 */
import Anthropic from '@anthropic-ai/sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { logger } from '../../../src/utils/logger';
import { callWeather, connectAsUpstream, isPending, weatherCalls } from '../../mocks/anthropic/bridge-upstream';
import { GET_WEATHER } from '../../mocks/anthropic/client-tool-recordings';
import { STATE } from '../../mocks/anthropic/plan-context';
import { memorySessions, TestSessions } from '../../mocks/anthropic/sessions';
import { envelopeOf, rejectionOf, SurfaceHarness, startSurface } from '../../mocks/anthropic/surface-harness';
import { initFrame, MESSAGE_START, resultFrame, streamEvent, TEXT_START, textDelta } from '../../mocks/anthropic/turn-frames';
import { createFakeClock, FakeClock } from '../../mocks/shared/fake-clock';
import { waitFor } from '../../mocks/shared/wait-for';
import { settle } from '../../mocks/upstream/run-helpers';
import { ScriptedProcess } from '../../mocks/upstream/scripted-process';
import { createScriptedRunner, ScriptedRun, ScriptedRunner } from '../../mocks/upstream/scripted-runner';

type ApiError = InstanceType<typeof Anthropic.APIError>;

const ASK = { model: 'fable', max_tokens: 256, messages: [{ role: 'user' as const, content: 'Say hi.' }] };
const PARIS = { id: 'toolu_paris', city: 'Paris' };
const interrupts = (upstream: ScriptedProcess) =>
  upstream.writtenLines().filter(line => (line as { type: string }).type === 'control_request');
const interruptedEnd = () =>
  resultFrame({ subtype: 'error_during_execution', is_error: true, result: undefined, errors: ['interrupted'] });

describe('Anthropic surface: wrapper shutdown', () => {
  let surface: SurfaceHarness;
  let runner: ScriptedRunner;
  let state: TestSessions;
  let clock: FakeClock;
  let mcp: Client | undefined;

  async function nextRun(): Promise<ScriptedRun> {
    const run = await runner.nextRun();
    await waitFor(() => run.process.writtenLines().length >= 1);
    return run;
  }

  /** A stream whose first text has reached the client. */
  async function streamInFlight() {
    const stream = surface.client().messages.stream(ASK);
    const firstText = new Promise(resolve => stream.on('text', resolve));
    const ended = stream.finalMessage().then(() => undefined, (error: ApiError) => error);
    const run = await nextRun();
    run.process.frames(initFrame(), ...[MESSAGE_START, TEXT_START, textDelta('Hel')].map(event => streamEvent(event)));
    await firstText;
    return { run, ended };
  }

  /** Upstream answers the interrupt the way an interrupted run does, and exits once stdin closes. */
  async function endOnInterrupt(upstream: ScriptedProcess): Promise<void> {
    await waitFor(() => interrupts(upstream).length === 1);
    upstream.frames(interruptedEnd());
    await waitFor(() => upstream.inputEnded());
    upstream.exit(1);
  }

  beforeEach(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(logger, 'debug');
    jest.spyOn(logger, 'info');
    jest.spyOn(logger, 'warn');
    clock = createFakeClock(1_791_000_000_000);
    runner = createScriptedRunner(clock);
    state = memorySessions(clock);
    surface = await startSurface({ runner, clock, stateDirectory: STATE, sessions: state.sessions });
  });

  afterEach(async () => {
    await mcp?.close().catch(() => undefined);
    mcp = undefined;
    await surface.close();
  });

  it('ends a stream in flight with the SSE error "server shutting down" and sends its run down the ladder', async () => {
    const { run, ended } = await streamInFlight();

    const drained = surface.shutdown();
    const error = await ended;

    expect(error).toBeInstanceOf(Anthropic.APIError);
    expect(envelopeOf(error as ApiError)).toEqual({
      type: 'error', error: { type: 'api_error', message: 'server shutting down' }, request_id: error?.requestID
    });
    await endOnInterrupt(run.process);
    await drained;
    expect(run.process.kills).toEqual([]);
    expect(state.forgotten).toContain('session-1');
  });

  it('answers a request that arrives while it drains with 529 overloaded_error, spawning nothing', async () => {
    const { run } = await streamInFlight();
    const drained = surface.shutdown();

    const error = await rejectionOf(surface.client().messages.create(ASK));

    expect(error.status).toBe(529);
    expect(envelopeOf(error).error.type).toBe('overloaded_error');
    await endOnInterrupt(run.process);
    await drained;
    await expect(rejectionOf(surface.client().messages.countTokens({ model: 'fable', messages: ASK.messages })))
      .resolves.toEqual(expect.objectContaining({ status: 529 }));
  });

  it('interrupts a parked run before its waiting tool call is rejected, then closes the control server', async () => {
    const asking = surface.client().messages.create({ ...ASK, tools: [GET_WEATHER as Anthropic.Tool] });
    const { spec, process: upstream } = await nextRun();
    mcp = await connectAsUpstream(spec);
    upstream.frames(initFrame({ tools: ['mcp__client__get_weather'] }), ...weatherCalls([PARIS]));
    const waiting = callWeather(mcp, PARIS);
    expect((await asking).stop_reason).toBe('tool_use');

    const drained = surface.shutdown();
    await waitFor(() => interrupts(upstream).length === 1);
    expect(await isPending(waiting)).toBe(true);
    const [interrupt] = interrupts(upstream) as { request_id: string }[];
    upstream.frames({ type: 'control_response', response: { subtype: 'success', request_id: interrupt?.request_id } });
    await settle();

    await expect(waiting).rejects.toThrow(/abandoned: server shutting down/);
    upstream.frames(interruptedEnd());
    await waitFor(() => upstream.inputEnded());
    upstream.exit(1);
    await drained;
    await expect(fetch(spec.mcp?.url ?? '')).rejects.toThrow();
    const logged = JSON.stringify([logger.debug, logger.info, logger.warn].flatMap(spy => jest.mocked(spy).mock.calls));
    expect(logged).toContain('Parked run abandoned');
    expect(logged).not.toContain(spec.mcp?.token);
  });

  it('SIGKILLs a run still alive when the 15 s drain runs out', async () => {
    const { run, ended } = await streamInFlight();

    const drained = surface.shutdown();
    await ended;
    await waitFor(() => interrupts(run.process).length === 1);
    clock.advance(14_999);
    expect(run.process.kills).toEqual(['SIGTERM', 'SIGKILL']);
    clock.advance(1);
    await waitFor(() => run.process.kills.length === 3);
    run.process.exit(null, 'SIGKILL');

    await drained;
    expect(run.process.kills).toEqual(['SIGTERM', 'SIGKILL', 'SIGKILL']);
  });
});
