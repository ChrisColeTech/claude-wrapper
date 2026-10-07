/**
 * A plain turn that fails (spec sections 10, 11, 13): the startup checks, an upstream error
 * before commit (an HTTP error), after commit (one SSE `error` event with the request id), a run
 * that ends without a `result`, and a client that disconnects mid-stream (the run interrupted).
 */
import Anthropic from '@anthropic-ai/sdk';
import { createReplayRunner, parseRecording, Runner } from '../../../src/upstream/runner';
import { STATE } from '../../mocks/anthropic/plan-context';
import { envelopeOf, REQUEST_ID, rejectionOf, SurfaceHarness, startSurface } from '../../mocks/anthropic/surface-harness';
import { initFrame, MESSAGE_START, resultFrame, streamEvent, TEXT_START, textDelta } from '../../mocks/anthropic/turn-frames';
import { loadRecording } from '../../mocks/upstream/recordings';
import { createScriptedRunner } from '../../mocks/upstream/scripted-runner';
import { ScriptedProcess } from '../../mocks/upstream/scripted-process';
import { createFakeClock, FakeClock } from '../../mocks/shared/fake-clock';
import { waitFor } from '../../mocks/shared/wait-for';

const STALL = 'CLAUDE_WRAPPER_STALL_TIMEOUT_MS';
const request = (model = 'claude-fable-5-1') => ({
  model, max_tokens: 256, messages: [{ role: 'user' as const, content: 'Say hi.' }]
});
const framesRecording = (...frames: object[]) => parseRecording(frames.map(frame => JSON.stringify(frame)).join('\n'));

describe('Anthropic surface: a plain turn that fails', () => {
  let surface: SurfaceHarness;

  async function serve(runner: Runner): Promise<Anthropic> {
    surface = await startSurface({ runner, stateDirectory: STATE });
    return surface.client();
  }
  const replaying = (...recordings: ReturnType<typeof parseRecording>[]) =>
    serve(createReplayRunner(recordings, { timeScale: 0 }));

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    delete process.env[STALL];
    await surface.close();
  });

  describe('startup checks on system/init', () => {
    it('fails before commit when upstream exposes tools the turn did not enable', async () => {
      const client = await replaying(loadRecording('cli-probes/c-partial.jsonl'));

      const error = await rejectionOf(client.messages.create(request()));

      expect(error).toBeInstanceOf(Anthropic.InternalServerError);
      expect(envelopeOf(error).error).toEqual({ type: 'api_error',
        message: expect.stringMatching(/^upstream's tools differ from the turn's: unexpected Task, Bash, .*; missing none$/) });
      expect(error.headers?.get('x-should-retry')).toBe('false');
    });

    it('fails before commit when upstream runs another model than the canonical id', async () => {
      const client = await replaying(loadRecording('cli-probes/p1-empty-system-prompt.jsonl'));

      const error = await rejectionOf(client.messages.stream(request('opus')).finalMessage());

      expect(error).toBeInstanceOf(Anthropic.InternalServerError);
      expect(envelopeOf(error).error.message).toBe('upstream started model claude-fable-5-1 instead of claude-opus-5-5');
    });
  });

  describe('an upstream error', () => {
    const preCommit = () => framesRecording(initFrame(),
      resultFrame({ is_error: true, api_error_status: 400, result: 'API Error: 400 bad block' }));
    const postCommit = () => framesRecording(initFrame(), streamEvent(MESSAGE_START), streamEvent(TEXT_START),
      streamEvent(textDelta('Hel')), resultFrame({ subtype: 'error_during_execution', is_error: true, result: undefined,
        errors: ['upstream broke'] }));

    it('before commit is an HTTP 500 api_error with upstream text, streaming or not', async () => {
      const client = await replaying(preCommit(), preCommit());

      const created = await rejectionOf(client.messages.create(request()));
      const streamed = await rejectionOf(client.messages.stream(request()).finalMessage());

      for (const error of [created, streamed]) {
        expect(error).toBeInstanceOf(Anthropic.InternalServerError);
        expect(envelopeOf(error)).toEqual({ type: 'error', error: { type: 'api_error', message: 'API Error: 400 bad block' },
          request_id: expect.stringMatching(REQUEST_ID) });
      }
    });

    it('after commit is one SSE error event carrying the request id', async () => {
      const client = await replaying(postCommit());
      const stream = client.messages.stream(request());
      const texts: string[] = [];
      stream.on('text', text => texts.push(text));

      const error = await rejectionOf(stream.finalMessage());

      expect(texts).toEqual(['Hel']);
      expect(error).toBeInstanceOf(Anthropic.APIError);
      expect(error.status).toBeUndefined();
      expect(envelopeOf(error)).toEqual({ type: 'error', error: { type: 'api_error', message: 'upstream broke' },
        request_id: error.requestID });
      expect(error.requestID).toMatch(REQUEST_ID);
    });
  });

  describe('a run that ends before the turn', () => {
    it('without a result is a 500 naming the exit code', async () => {
      const wire = [{ t_ms: 0, dir: 'host->cli', frame: '{"type":"user"}' },
        { t_ms: 1, dir: 'cli->host', frame: JSON.stringify(initFrame()) },
        { t_ms: 2, dir: 'proc', frame: '[exit code=1 signal=null]' }];
      const client = await replaying(parseRecording(wire.map(entry => JSON.stringify(entry)).join('\n')));

      const error = await rejectionOf(client.messages.create(request()));

      expect(error).toBeInstanceOf(Anthropic.InternalServerError);
      expect(envelopeOf(error).error).toEqual({ type: 'api_error', message: 'upstream exited with code 1' });
    });

    it('on a stalled run is a 504 timeout_error', async () => {
      process.env[STALL] = '50';
      const client = await replaying(framesRecording(initFrame()));

      const error = await rejectionOf(client.messages.create(request()));

      expect(error.status).toBe(504);
      expect(envelopeOf(error).error).toEqual({ type: 'timeout_error', message: 'upstream timed out (stall timer)' });
    });
  });

  describe('a client that disconnects mid-stream', () => {
    const interrupted = (upstream: ScriptedProcess) => () =>
      upstream.writtenLines().some(line => (line as { type: string }).type === 'control_request');

    /** Streams until the first text arrives, then the client goes away. */
    async function disconnectMidStream(clock?: FakeClock): Promise<ScriptedProcess> {
      const runner = createScriptedRunner(clock);
      surface = await startSurface({ runner, stateDirectory: STATE, ...(clock ? { clock } : {}) });
      const stream = surface.client().messages.stream(request());
      const firstText = new Promise(resolve => stream.on('text', resolve));
      const ended = stream.finalMessage().catch((error: unknown) => error);
      const { process: upstream } = await runner.nextRun();
      await waitFor(() => upstream.writtenLines().length === 1);

      upstream.frames(initFrame(), streamEvent(MESSAGE_START), streamEvent(TEXT_START), streamEvent(textDelta('Hel')));
      await firstText;
      stream.abort();
      expect(await ended).toBeInstanceOf(Anthropic.APIUserAbortError);
      return upstream;
    }

    it('gets its run interrupted, then stdin closed once the result is in', async () => {
      const upstream = await disconnectMidStream();

      await waitFor(interrupted(upstream));
      expect(upstream.writtenLines()[1]).toEqual(expect.objectContaining({
        type: 'control_request', request: { subtype: 'interrupt' }
      }));
      expect(upstream.inputEnded()).toBe(false);
      upstream.frames(resultFrame({ subtype: 'error_during_execution', is_error: true }));
      await waitFor(() => upstream.inputEnded());
      upstream.exit(0);
    });

    it('gets stdin closed 5 s after the interrupt when no result comes', async () => {
      const clock = createFakeClock();
      const upstream = await disconnectMidStream(clock);
      await waitFor(interrupted(upstream));

      clock.advance(4_999);
      expect(upstream.inputEnded()).toBe(false);
      clock.advance(1);
      expect(upstream.inputEnded()).toBe(true);
      upstream.exit(0);
    });
  });
});
