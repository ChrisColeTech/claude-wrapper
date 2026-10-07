/**
 * How a turn fails, end to end through the SDK (spec sections 11, 13 and 14): after commit each
 * trigger, (i) a broken model call, (ii) a failed result, (iii) an exit or a timer firing, (iv)
 * the retry cap, is one SSE `error` event with the mapped type, then the run is interrupted and
 * torn down and its upstream session forgotten once it has exited. Before commit the deterministic
 * `api_retry` categories fail at first sight, the retry cap answers with the last category, and
 * the billing gate is logged at warn with the length of the client's `system`.
 */
import Anthropic from '@anthropic-ai/sdk';
import { createReplayRunner, parseRecording } from '../../../src/upstream/runner';
import { Frame } from '../../../src/upstream/frames';
import { logger } from '../../../src/utils/logger';
import { NO_SESSIONS, STATE } from '../../mocks/anthropic/plan-context';
import { envelopeOf, REQUEST_ID, rejectionOf, SurfaceHarness, startSurface } from '../../mocks/anthropic/surface-harness';
import {
  apiRetry, BLOCK_STOP, END_TURN, initFrame, MESSAGE_START, MESSAGE_STOP, rateLimitEvent, resultFrame, streamEvent,
  syntheticError, TEXT_START, textDelta
} from '../../mocks/anthropic/turn-frames';
import { createFakeClock, FakeClock } from '../../mocks/shared/fake-clock';
import { waitFor } from '../../mocks/shared/wait-for';
import { settle } from '../../mocks/upstream/run-helpers';
import { ScriptedProcess } from '../../mocks/upstream/scripted-process';
import { createScriptedRunner } from '../../mocks/upstream/scripted-runner';

const RETRY_CAP = 'CLAUDE_WRAPPER_RETRY_CAP_MS';
const NOW_MS = 1_791_000_000_000;
const request = (fields: object = {}) => ({
  model: 'claude-fable-5-1', max_tokens: 256, messages: [{ role: 'user' as const, content: 'Say hi.' }], ...fields
});
const SECOND_CALL = streamEvent({ ...MESSAGE_START, message: { ...MESSAGE_START.message, id: 'msg_2' } });
const interrupted = (upstream: ScriptedProcess) => () =>
  upstream.writtenLines().some(line => (line as { type: string }).type === 'control_request');

describe('Anthropic surface: how a turn fails', () => {
  let surface: SurfaceHarness;
  let clock: FakeClock;
  let forget: jest.Mock;

  /** A scripted run whose turn has already sent `system/init` (and, when `streamed`, committed with "Hel"). */
  async function turn(body: object, frames: Frame[]) {
    const runner = createScriptedRunner(clock);
    surface = await startSurface({ runner, clock, stateDirectory: STATE, sessions: { ...NO_SESSIONS, forget } });
    const stream = surface.client().messages.stream(request(body));
    const texts: string[] = [];
    stream.on('text', text => texts.push(text));
    const ended = stream.finalMessage().then(() => undefined, (error: InstanceType<typeof Anthropic.APIError>) => error);
    const { process: upstream } = await runner.nextRun();
    await waitFor(() => upstream.writtenLines().length === 1);
    upstream.frames(initFrame(), ...frames);
    return { upstream, ended, texts };
  }

  async function committed() {
    const started = await turn({}, [MESSAGE_START, TEXT_START, textDelta('Hel')].map(event => streamEvent(event)));
    await waitFor(() => started.texts.length > 0);
    return started;
  }

  /** The SSE `error` event as the SDK raised it: no status, the mapped type, the request id. */
  function expectSseError(error: InstanceType<typeof Anthropic.APIError> | undefined, type: string, message: string): void {
    expect(error).toBeInstanceOf(Anthropic.APIError);
    expect(error?.status).toBeUndefined();
    expect(envelopeOf(error as InstanceType<typeof Anthropic.APIError>)).toEqual({
      type: 'error', error: { type, message }, request_id: error?.requestID
    });
    expect(error?.requestID).toMatch(REQUEST_ID);
  }

  /** Forgetting may also happen earlier; once the run has exited it must have happened. */
  async function expectForgottenAfterExit(upstream: ScriptedProcess): Promise<void> {
    upstream.exit(0);
    await waitFor(() => forget.mock.calls.length > 0);
    expect(forget).toHaveBeenCalledWith('session-1');
  }

  beforeEach(() => {
    clock = createFakeClock(NOW_MS);
    forget = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    delete process.env[RETRY_CAP];
    await surface.close();
  });

  describe('after commit', () => {
    it('(i) a new message_start while a block is open: the error the api_retry named, then interrupt and forget', async () => {
      const { upstream, ended, texts } = await committed();

      upstream.frames(apiRetry('overloaded', 529), SECOND_CALL);

      expectSseError(await ended, 'overloaded_error', 'Upstream overloaded');
      expect(texts).toEqual(['Hel']);
      await waitFor(interrupted(upstream));
      await expectForgottenAfterExit(upstream);
    });

    it('is not failed by a plain api_retry when the failed call left no block open', async () => {
      const { upstream, ended, texts } = await committed();

      upstream.frames(streamEvent(BLOCK_STOP), apiRetry('overloaded', 529), SECOND_CALL, streamEvent(END_TURN),
        streamEvent(MESSAGE_STOP));

      expect(await ended).toBeUndefined();
      expect(texts).toEqual(['Hel']);
      upstream.exit(0);
    });

    it('(ii) a failed result: the mapped type, stdin closed, the session forgotten', async () => {
      const { upstream, ended } = await committed();

      upstream.frames(resultFrame({ is_error: true, api_error_status: 529, result: 'API Error: 529 Overloaded' }));

      expectSseError(await ended, 'overloaded_error', 'Overloaded');
      await waitFor(() => upstream.inputEnded());
      expect(interrupted(upstream)()).toBe(false);
      await expectForgottenAfterExit(upstream);
    });

    it('(iii) a process exit: 500 api_error with the exit code, the session forgotten', async () => {
      const { upstream, ended } = await committed();

      upstream.exit(1);

      expectSseError(await ended, 'api_error', 'upstream exited with code 1');
      await waitFor(() => forget.mock.calls.length > 0);
      expect(forget).toHaveBeenCalledWith('session-1');
    });

    it('(iii) a timer firing: timeout_error at once, before upstream has exited', async () => {
      const { upstream, ended } = await committed();
      await settle();

      clock.advance(90_000);

      expectSseError(await ended, 'timeout_error', 'upstream timed out (stall timer)');
      expect(upstream.inputEnded()).toBe(true);
      await expectForgottenAfterExit(upstream);
    });

    it('(iv) the retry cap: the last category after 60 s with no new model call, then interrupt and forget', async () => {
      const { upstream, ended } = await committed();
      upstream.frames(streamEvent(BLOCK_STOP), apiRetry('server_error', 500));
      await settle();
      upstream.frames(apiRetry('overloaded', 529));
      await settle();

      clock.advance(59_999);
      await settle();
      expect(interrupted(upstream)()).toBe(false);
      clock.advance(1);

      expectSseError(await ended, 'overloaded_error', 'Upstream overloaded');
      await waitFor(interrupted(upstream));
      await expectForgottenAfterExit(upstream);
    });
  });

  describe('before commit', () => {
    it('fails at the first api_retry of a deterministic category and interrupts the run', async () => {
      const { upstream, ended } = await turn({}, [apiRetry('authentication_failed', 401)]);

      const error = await ended;

      expect(error).toBeInstanceOf(Anthropic.InternalServerError);
      expect(envelopeOf(error as InstanceType<typeof Anthropic.APIError>).error.message)
        .toMatch(/^The upstream Claude Code login failed \(authentication_failed\)/);
      expect(error?.headers?.get('x-should-retry')).toBe('false');
      await waitFor(interrupted(upstream));
      await expectForgottenAfterExit(upstream);
    });

    it('answers the retry cap with 529 for overloaded, after the configured cap', async () => {
      process.env[RETRY_CAP] = '5000';
      const { upstream, ended } = await turn({}, [apiRetry('overloaded', 529)]);
      await settle();

      clock.advance(5_000);
      const error = await ended;

      expect(error).toBeInstanceOf(Anthropic.InternalServerError);
      expect(error?.status).toBe(529);
      expect(envelopeOf(error as InstanceType<typeof Anthropic.APIError>).error).toEqual({
        type: 'overloaded_error', message: 'Upstream overloaded' });
      await waitFor(interrupted(upstream));
      upstream.exit(0);
    });

    it('answers the retry cap with 429 and retry-after after a rejected rate_limit_event', async () => {
      const { upstream, ended } = await turn({}, [rateLimitEvent('rejected', NOW_MS / 1000 + 600), apiRetry('rate_limit', 429)]);
      await settle();

      clock.advance(60_000);
      const error = await ended;

      expect(error).toBeInstanceOf(Anthropic.RateLimitError);
      expect(error?.headers?.get('retry-after')).toBe('540');
      expect(envelopeOf(error as InstanceType<typeof Anthropic.APIError>).error.message).toBe('Upstream rate limit reached');
      upstream.exit(0);
    });

    it('answers a startup timer firing with 504 at once, before upstream has exited', async () => {
      const runner = createScriptedRunner(clock);
      surface = await startSurface({ runner, clock, stateDirectory: STATE });
      const created = rejectionOf(surface.client().messages.create(request()));
      const { process: upstream } = await runner.nextRun();

      clock.advance(20_000);
      const error = await created;

      expect(error.status).toBe(504);
      expect(envelopeOf(error).error).toEqual({ type: 'timeout_error', message: 'upstream timed out (startup timer)' });
      upstream.exit(null, 'SIGTERM');
    });
  });

  it("logs the billing gate at warn with the length of the client's system", async () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const gate = 'API Error: 400 Third-party apps now draw from extra usage, not plan limits.';
    const run = [initFrame(), syntheticError('unknown', gate), resultFrame({ is_error: true, result: gate, api_error_status: 400 })];
    surface = await startSurface({ stateDirectory: STATE, runner: createReplayRunner(
      [parseRecording(run.map(frame => JSON.stringify(frame)).join('\n'))], { timeScale: 0 }) });

    const error = await rejectionOf(surface.client().messages.create(request({ system: 'Workspace root folder: /x' })));

    expect(error).toBeInstanceOf(Anthropic.BadRequestError);
    expect(error.headers?.get('x-should-retry')).toBe('false');
    expect(warn).toHaveBeenCalledWith('Upstream billing gate: relayed as a 400, never retried',
      expect.objectContaining({ systemLength: 25, requestId: expect.stringMatching(REQUEST_ID) }));
  });
});
