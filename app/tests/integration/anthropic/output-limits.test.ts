/**
 * Output limits through the official SDK (spec section 12, ADR 0004). A `max_tokens` cut and a
 * stop-sequence cut end the turn in the real API's shape, then the surface interrupts the run, so
 * upstream does not go on generating, and forgets its upstream session: a cut is an error turn
 * (spec section 5). `result` never overrides the relayed stop reason. The cut signal itself is
 * never written to the client.
 */
import Anthropic from '@anthropic-ai/sdk';
import { createReplayRunner, ReplayRunner } from '../../../src/upstream/runner';
import { STATE } from '../../mocks/anthropic/plan-context';
import { memorySessions, TestSessions } from '../../mocks/anthropic/sessions';
import { SurfaceHarness, startSurface } from '../../mocks/anthropic/surface-harness';
import {
  BLOCK_STOP, END_TURN, initFrame, MESSAGE_START, MESSAGE_STOP, resultFrame, streamEvent, TEXT_START, textDelta
} from '../../mocks/anthropic/turn-frames';
import { loadRecording, recordedStdout } from '../../mocks/upstream/recordings';
import { createScriptedRunner, ScriptedRun, ScriptedRunner } from '../../mocks/upstream/scripted-runner';
import { waitFor } from '../../mocks/shared/wait-for';

const CAPPED = 'cli-probes/t1-max-output-100.jsonl';
const SESSION = 'session-1';

type Recorded = { type: string; session_id?: string; message?: { model?: string; content: { text?: string }[] } };

const textOf = (message: Anthropic.Message): string =>
  message.content.map(block => (block.type === 'text' ? block.text : '')).join('');

const isInterrupt = (line: unknown): boolean =>
  (line as { type?: string; request?: { subtype?: string } }).type === 'control_request' &&
  (line as { request: { subtype?: string } }).request.subtype === 'interrupt';

describe('Anthropic surface: the max_tokens cut (recorded: four capped calls)', () => {
  const stdout = recordedStdout(CAPPED) as Recorded[];
  const firstCallText = stdout.find(frame => frame.type === 'assistant' && frame.message?.model !== '<synthetic>')
    ?.message?.content[0]?.text;
  const upstreamSession = stdout.find(frame => frame.type === 'result')?.session_id as string;
  let surface: SurfaceHarness;
  let runner: ReplayRunner;
  let state: TestSessions;

  beforeEach(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    runner = createReplayRunner([loadRecording(CAPPED)], { timeScale: 0 });
    state = memorySessions();
    surface = await startSurface({ runner, stateDirectory: STATE, sessions: state.sessions });
  });

  afterEach(async () => {
    await surface.close();
  });

  const request = { model: 'fable', max_tokens: 100, messages: [{ role: 'user' as const, content: 'Write about tangerines.' }] };

  it.each([
    ['messages.create', (client: Anthropic) => client.messages.create(request)],
    ['messages.stream().finalMessage()', (client: Anthropic) => client.messages.stream(request).finalMessage()]
  ])("%s: the first capped call's partial text, stop_reason max_tokens, output_tokens the cap", async (_name, send) => {
    const message = await send(surface.client());

    expect(message.stop_reason).toBe('max_tokens');
    expect(message.usage.output_tokens).toBe(100);
    expect(textOf(message)).toBe(firstCallText);
    expect(runner.started[0]?.spec.env['CLAUDE_CODE_MAX_OUTPUT_TOKENS']).toBe('100');
  });

  it('interrupts the run and forgets its session, though upstream ends with an error result', async () => {
    await surface.client().messages.create(request);

    await waitFor(() => state.deleted.length === 2);
    expect(runner.started[0]?.input.some(isInterrupt)).toBe(true);
    expect([...new Set(state.forgotten)]).toEqual([upstreamSession]);
    expect(state.recorded).toEqual([]);
  });

  it('writes no event the API does not define', async () => {
    const stream = await surface.client().messages.create({ ...request, stream: true });

    const types: string[] = [];
    for await (const event of stream) types.push(event.type);

    expect(types[types.length - 1]).toBe('message_stop');
    expect(types).not.toContain('cut');
  });
});

describe('Anthropic surface: stop sequences', () => {
  let surface: SurfaceHarness;
  let runner: ScriptedRunner;
  let state: TestSessions;

  async function nextRun(): Promise<ScriptedRun> {
    const run = await runner.nextRun();
    await waitFor(() => run.process.writtenLines().length >= 1);
    return run;
  }

  /** Upstream streams `chunks` as one text block and would go on, until the interrupt lands. */
  async function streamText(run: ScriptedRun, chunks: string[]): Promise<void> {
    run.process.frames(initFrame(), streamEvent(MESSAGE_START), streamEvent(TEXT_START),
      ...chunks.map(chunk => streamEvent(textDelta(chunk))));
    await waitFor(() => run.process.writtenLines().some(isInterrupt));
    run.process.frames(streamEvent(BLOCK_STOP), streamEvent(END_TURN), streamEvent(MESSAGE_STOP),
      resultFrame({ subtype: 'error_during_execution', is_error: true, stop_reason: null }));
    await waitFor(() => run.process.inputEnded());
    run.process.exit(0);
  }

  beforeEach(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    runner = createScriptedRunner();
    state = memorySessions();
    surface = await startSurface({ runner, stateDirectory: STATE, sessions: state.sessions });
  });

  afterEach(async () => {
    await surface.close();
  });

  const request = {
    model: 'fable', max_tokens: 256, stop_sequences: ['STOP', '\n\n'],
    messages: [{ role: 'user' as const, content: 'Count.' }]
  };

  it.each([
    ['messages.create', (client: Anthropic) => client.messages.create(request)],
    ['messages.stream().finalMessage()', (client: Anthropic) => client.messages.stream(request).finalMessage()]
  ])('%s: ends at the first match split across deltas, interrupts, and forgets the session', async (_name, send) => {
    const response = send(surface.client());
    const run = await nextRun();

    await streamText(run, ['Count: 1, 2, ST', 'OP 3, 4']);
    const message = await response;

    expect(textOf(message)).toBe('Count: 1, 2, ');
    expect(message.stop_reason).toBe('stop_sequence');
    expect(message.stop_sequence).toBe('STOP');
    // The estimate: 1 at the call's message_start, plus 13 relayed characters over four, rounded up.
    expect(message.usage.output_tokens).toBe(5);
    await waitFor(() => state.deleted.length === 2);
    expect([...new Set(state.forgotten)]).toEqual([SESSION]);
    expect(state.recorded).toEqual([]);
  });

  it('forgets the session even when upstream ends cleanly before the interrupt lands', async () => {
    const response = surface.client().messages.create(request);
    const run = await nextRun();

    run.process.frames(initFrame(), ...[MESSAGE_START, TEXT_START, textDelta('Done.\n\nMore'), BLOCK_STOP, END_TURN,
      MESSAGE_STOP].map(event => streamEvent(event)), resultFrame());
    await waitFor(() => run.process.inputEnded());
    run.process.exit(0);

    expect(await response).toEqual(expect.objectContaining({ stop_reason: 'stop_sequence', stop_sequence: '\n\n' }));
    await waitFor(() => state.deleted.length === 2);
    expect(state.recorded).toEqual([]);
  });

  it('streams the text before the match while it holds back only the tail', async () => {
    const stream = surface.client().messages.stream(request);
    const texts: string[] = [];
    stream.on('text', text => texts.push(text));
    const run = await nextRun();

    await streamText(run, ['Long enough line', ' \n', '\nnever sent']);
    await stream.finalMessage();

    expect(texts).toEqual(['Long enough l', 'in', 'e ']);
  });
});

describe('Anthropic surface: thinking and effort reach the run', () => {
  let surface: SurfaceHarness;
  let runner: ScriptedRunner;

  beforeEach(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    runner = createScriptedRunner();
    surface = await startSurface({ runner, stateDirectory: STATE });
  });

  afterEach(async () => {
    await surface.close();
  });

  async function answer(): Promise<ScriptedRun> {
    const run = await runner.nextRun();
    await waitFor(() => run.process.writtenLines().length >= 1);
    run.process.frames(initFrame({ model: run.spec.flags[run.spec.flags.indexOf('--model') + 1] }),
      ...[MESSAGE_START, TEXT_START, textDelta('hi'), BLOCK_STOP, END_TURN, MESSAGE_STOP].map(e => streamEvent(e)),
      resultFrame());
    await waitFor(() => run.process.inputEnded());
    run.process.exit(0);
    return run;
  }

  it('Haiku 4.5 with an enabled budget gets MAX_THINKING_TOKENS and keeps thinking on', async () => {
    const response = surface.client().messages.create({
      model: 'haiku', max_tokens: 4096, thinking: { type: 'enabled', budget_tokens: 2048 },
      messages: [{ role: 'user', content: 'Think, then say hi.' }]
    });
    const run = await answer();
    await response;

    expect(run.spec.env['MAX_THINKING_TOKENS']).toBe('2048');
    expect(run.spec.env).not.toHaveProperty('CLAUDE_CODE_DISABLE_THINKING');
  });

  it('Haiku 4.5 without thinking runs with upstream thinking off', async () => {
    const response = surface.client().messages.create({
      model: 'haiku', max_tokens: 64, messages: [{ role: 'user', content: 'Say hi.' }]
    });
    const run = await answer();
    await response;

    expect(run.spec.env['CLAUDE_CODE_DISABLE_THINKING']).toBe('1');
  });

  it('a 5.x model with an effort level runs with --effort', async () => {
    const response = surface.client().messages.create({
      model: 'sonnet', max_tokens: 64, output_config: { effort: 'low' }, messages: [{ role: 'user', content: 'Say hi.' }]
    });
    const run = await answer();
    await response;

    expect(run.spec.flags.slice(run.spec.flags.indexOf('--effort'), run.spec.flags.indexOf('--effort') + 2))
      .toEqual(['--effort', 'low']);
    expect(Object.keys(run.spec.env)).not.toContain('CLAUDE_CODE_DISABLE_THINKING');
  });
});
