/**
 * The failure reader (spec sections 11, 13, 14): it reads a run's frames for what upstream said
 * about a failure (the synthetic frame, `system/api_retry`, `rate_limit_event`) and maps each
 * trigger with the upstream failure table. It fails fast on the deterministic categories and
 * caps upstream's retry loop for the others.
 */
import { createFailureReader, FailureReader, FailureReaderOptions } from '../../../../src/anthropic/failure';
import { SurfaceError } from '../../../../src/anthropic/http/surface-error';
import { Frame, ResultFrame } from '../../../../src/upstream/frames';
import {
  apiRetry, MESSAGE_START, rateLimitEvent as rateLimit, resultFrame, streamEvent, syntheticError as synthetic
} from '../../../mocks/anthropic/turn-frames';
import { createFakeClock, FakeClock } from '../../../mocks/shared/fake-clock';
import { recordedFrames } from '../../../mocks/upstream/recordings';

const CAP_MS = 60_000;
const NOW_MS = 1_791_000_000_000;

const failed = (fields: object): ResultFrame => resultFrame({ is_error: true, ...fields }) as ResultFrame;
const shape = (error: SurfaceError | null) =>
  error && { status: error.status, type: error.type, message: error.message, retryable: error.retryable };

describe('failure reader', () => {
  let clock: FakeClock;
  let giveUp: jest.Mock;
  let warn: jest.Mock;

  function reader(options: FailureReaderOptions = {}, frames: Frame[] = []): FailureReader {
    const created = createFailureReader({ clock, retryCapMs: CAP_MS, onGiveUp: giveUp, logger: { warn },
      turn: { requestedModel: 'opus', systemLength: 42 }, ...options });
    frames.forEach(frame => created.observe(frame));
    return created;
  }

  beforeEach(() => {
    clock = createFakeClock(NOW_MS);
    giveUp = jest.fn();
    warn = jest.fn();
  });

  describe('a failed result', () => {
    it("takes the API's message from the synthetic frame and the status from api_error_status", () => {
      const read = reader({}, [synthetic('unknown', 'API Error: 400 Unable to download the file.')]);

      expect(shape(read.errorFor({ kind: 'result', result: failed({ api_error_status: 400, result: 'ignored' }) })))
        .toEqual({ status: 400, type: 'invalid_request_error', message: 'Unable to download the file.', retryable: false });
    });

    it('maps the recorded "Not logged in" run to a 500 naming the upstream login', () => {
      const frames = recordedFrames('cli-probes/p4-bare.jsonl');
      const read = reader({}, frames.slice(0, -1));

      const error = read.errorFor({ kind: 'result', result: frames[frames.length - 1] as ResultFrame });

      expect(shape(error)).toEqual({ status: 500, type: 'api_error', retryable: false,
        message: expect.stringContaining('upstream Claude Code login failed (authentication_failed)') });
    });

    it('names the client model on a 404', () => {
      const error = reader().errorFor({ kind: 'result', result: failed({ api_error_status: 404, result: 'CLI prose' }) });

      expect(shape(error)).toEqual({ status: 404, type: 'not_found_error', message: 'model: opus', retryable: false });
    });

    it('takes the category of an api_retry still pending when no synthetic frame names one', () => {
      const read = reader({}, [apiRetry('overloaded', 529)]);

      expect(read.errorFor({ kind: 'result', result: failed({ result: '' }) }).type).toBe('overloaded_error');
    });

    it('forgets an api_retry once a model call has produced a frame', () => {
      const read = reader({}, [apiRetry('rate_limit', 429), streamEvent(MESSAGE_START)]);

      const error = read.errorFor({ kind: 'result', result: failed({ subtype: 'error_max_turns', errors: ['Max turns'] }) });

      expect(shape(error)).toEqual({ status: 500, type: 'api_error', message: 'Max turns', retryable: false });
    });

    it('adds retry-after on a 429 when the last rate_limit_event was rejected', () => {
      const resetsAt = NOW_MS / 1000 + 120;
      const result = failed({ api_error_status: 429, result: 'API Error: 429 limited' });

      expect(reader({}, [rateLimit('rejected', resetsAt)]).errorFor({ kind: 'result', result }).retryAfter).toBe(120);
      expect(reader({}, [rateLimit('rejected', resetsAt), rateLimit('allowed', resetsAt)])
        .errorFor({ kind: 'result', result }).retryAfter).toBeUndefined();
      expect(reader({}, [rateLimit('rejected', NOW_MS / 1000 - 5)]).errorFor({ kind: 'result', result }).retryAfter)
        .toBeUndefined();
    });

    it("logs the billing gate at warn with the length of the client's system, once", () => {
      const read = reader({}, [synthetic('unknown', 'API Error: 400 Third-party apps now draw from extra usage, not plan limits')]);

      const error = read.errorFor({ kind: 'result', result: failed({ api_error_status: 400 }) });
      read.errorFor({ kind: 'exit', exit: { code: 1, signal: null, stderr: '' } });

      expect(shape(error)).toEqual({ status: 400, type: 'invalid_request_error', retryable: false,
        message: 'Third-party apps now draw from extra usage, not plan limits' });
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith('Upstream billing gate: relayed as a 400, never retried', { systemLength: 42 });
    });
  });

  describe('a model call that broke after streaming content', () => {
    it('maps the api_retry that preceded the new call', () => {
      expect(reader({}, [apiRetry('overloaded', 529)]).errorFor({ kind: 'broken_call' }).type).toBe('overloaded_error');
    });

    it('is a 500 api_error when upstream named nothing', () => {
      expect(shape(reader().errorFor({ kind: 'broken_call' }))).toEqual({ status: 500, type: 'api_error', retryable: true,
        message: "upstream's model call failed after it had streamed content" });
    });
  });

  describe('a run that ended', () => {
    it.each([
      [{ kind: 'timeout', timer: 'stall' }, { status: 504, type: 'timeout_error', message: 'upstream timed out (stall timer)', retryable: true }],
      [{ kind: 'spawn_failed', message: 'spawn claude ENOENT' }, { status: 500, type: 'api_error', message: 'upstream could not be started', retryable: false }],
      [{ kind: 'line_too_long', limitBytes: 16 }, { status: 500, type: 'api_error', message: 'upstream wrote a line over 16 bytes', retryable: true }]
    ] as const)('maps the runner failure %j', (reason, expected) => {
      expect(shape(reader().errorFor({ kind: 'run_failure', reason }))).toEqual(expected);
      expect(shape(reader().errorFor({ kind: 'exit', exit: { code: null, signal: 'SIGTERM', stderr: '', failure: reason } })))
        .toEqual(expected);
    });

    it('maps an exit with no result by its code', () => {
      expect(shape(reader().errorFor({ kind: 'exit', exit: { code: 143, signal: null, stderr: '' } }))).toEqual({
        status: 500, type: 'api_error', message: 'upstream exited with code 143', retryable: true
      });
    });

    it('prefers what upstream said before it exited', () => {
      const read = reader({}, [synthetic('authentication_failed', 'Not logged in · Please run /login')]);

      expect(read.errorFor({ kind: 'exit', exit: { code: 1, signal: null, stderr: '' } }).message)
        .toMatch(/^The upstream Claude Code login failed/);
    });
  });

  describe('api_retry', () => {
    it.each(['authentication_failed', 'oauth_org_not_allowed', 'account_on_hold', 'billing_error', 'invalid_request',
      'model_not_found', 'cloud_credential_error'])('fails fast on the deterministic category %s', category => {
      const error = reader().failFast(apiRetry(category, 401));

      expect(error).toBeInstanceOf(SurfaceError);
      expect(error?.retryable).toBe(false);
    });

    it.each(['rate_limit', 'overloaded', 'server_error', 'unknown'])('waits on %s', category => {
      expect(reader().failFast(apiRetry(category))).toBeNull();
    });

    it('gives up with the last category once the cap passes with no new model call', () => {
      const read = reader({}, [apiRetry('server_error', 500)]);
      clock.advance(30_000);
      read.observe(apiRetry('overloaded', 529));

      clock.advance(CAP_MS - 30_001);
      expect(giveUp).not.toHaveBeenCalled();
      clock.advance(1);

      expect(giveUp).toHaveBeenCalledTimes(1);
      expect(shape(giveUp.mock.calls[0][0])).toEqual({ status: 529, type: 'overloaded_error',
        message: 'Upstream overloaded', retryable: true });
    });

    it('gives up on rate_limit with retry-after from a rejected rate_limit_event', () => {
      reader({}, [rateLimit('rejected', NOW_MS / 1000 + 3_600), apiRetry('rate_limit', 429)]);

      clock.advance(CAP_MS);

      expect(giveUp.mock.calls[0][0]).toMatchObject({ status: 429, type: 'rate_limit_error', retryAfter: 3_540 });
    });

    it('clears the cap when a model call produces a frame, and starts a new one at the next api_retry', () => {
      const read = reader({}, [apiRetry('overloaded'), streamEvent(MESSAGE_START)]);
      clock.advance(CAP_MS);
      expect(giveUp).not.toHaveBeenCalled();

      read.observe(apiRetry('overloaded'));
      clock.advance(CAP_MS);
      expect(giveUp).toHaveBeenCalledTimes(1);
    });

    it('never starts the cap for a deterministic category, after a result, after stop(), or with no cap set', () => {
      reader({}, [apiRetry('authentication_failed')]);
      reader({}, [apiRetry('overloaded'), resultFrame({ is_error: true })]);
      reader({}, [apiRetry('overloaded')]).stop();
      reader({ retryCapMs: 0 }, [apiRetry('overloaded')]);

      clock.advance(10 * CAP_MS);

      expect(giveUp).not.toHaveBeenCalled();
      expect(clock.pendingCount()).toBe(0);
    });
  });
});
