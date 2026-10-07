/**
 * Admission (spec section 14): one cap on runs in existence, active plus parked, answered with
 * 529 `overloaded_error` at once (no queue, a parked run never evicted); and upstream's last
 * `rate_limit_event`: after `rejected`, every request until `resetsAt` gets 429
 * `rate_limit_error` with `retry-after`, before any run starts.
 */
import { SurfaceError } from '../../../../src/anthropic/http/surface-error';
import { Lease } from '../../../../src/anthropic/scheduler';
import { initFrame, rateLimitEvent } from '../../../mocks/anthropic/turn-frames';
import {
  continuedPlan, fakeRun, freshPlan, heldRun, parkedPlan, quietLog, schedulerOn
} from '../../../mocks/anthropic/scheduler-fixtures';
import { createFakeClock, FakeClock } from '../../../mocks/shared/fake-clock';

const NOW_MS = 1_791_000_000_000;
const admission = (requestId: string, plan = freshPlan()) => ({ requestId, plan, replan: () => plan });

async function rejection(promise: Promise<Lease>): Promise<SurfaceError> {
  try {
    await promise;
  } catch (error) {
    return error as SurfaceError;
  }
  throw new Error('expected the admission to be refused');
}

describe('the scheduler: admission', () => {
  let clock: FakeClock;

  beforeEach(() => {
    clock = createFakeClock(NOW_MS);
  });

  describe('the run cap', () => {
    it('admits up to the cap, then answers 529 overloaded_error at once and logs the rejection', async () => {
      const log = quietLog();
      const scheduler = schedulerOn(clock, { maxRuns: 2 }, log);

      await scheduler.admit(admission('req_1'));
      await scheduler.admit(admission('req_2'));
      const error = await rejection(scheduler.admit(admission('req_3')));

      expect(error).toBeInstanceOf(SurfaceError);
      expect(error.status).toBe(529);
      expect(error.type).toBe('overloaded_error');
      expect(log.warn).toHaveBeenCalledWith('Run cap reached: request refused',
        expect.objectContaining({ requestId: 'req_3', active: 2, parked: 0, maxRuns: 2 }));
    });

    it('gives the slot back when a lease is released before its run started', async () => {
      const scheduler = schedulerOn(clock, { maxRuns: 1 });

      const lease = await scheduler.admit(admission('req_1'));
      lease.release();

      await expect(scheduler.admit(admission('req_2'))).resolves.toBeDefined();
    });

    it('keeps the slot of a started run until it has ended, its turn over or not', async () => {
      const scheduler = schedulerOn(clock, { maxRuns: 1 });
      const lease = await scheduler.admit(admission('req_1'));
      const run = fakeRun();

      lease.started(run);
      lease.release();
      await rejection(scheduler.admit(admission('req_2')));
      run.end();
      await run.ended;

      await expect(scheduler.admit(admission('req_3'))).resolves.toBeDefined();
    });

    it('counts a parked run against the cap and never evicts it to admit a turn', async () => {
      const scheduler = schedulerOn(clock, { maxRuns: 1 });
      const lease = await scheduler.admit(admission('req_1'));
      const parked = heldRun(['toolu_1']);
      lease.started(fakeRun());
      scheduler.registerParked(parked);

      const error = await rejection(scheduler.admit(admission('req_2')));

      expect(error.status).toBe(529);
      expect(parked.abandoned).toEqual([]);
      expect(scheduler.counts()).toEqual(expect.objectContaining({ active: 0, parked: 1 }));
    });

    it('takes no slot for a turn that answers a parked run: that run holds one already', async () => {
      const scheduler = schedulerOn(clock, { maxRuns: 1 });
      const lease = await scheduler.admit(admission('req_1'));
      const parked = heldRun(['toolu_1']);
      lease.started(fakeRun());
      scheduler.registerParked(parked);

      const resuming = await scheduler.admit(admission('req_2', parkedPlan(parked)));

      expect(resuming.plan.continuation).toEqual(expect.objectContaining({ parked }));
    });
  });

  it("counts what /health shows: active and parked runs, the cap, turns queued per session, upstream's last rate-limit state", async () => {
    const scheduler = schedulerOn(clock, { maxRuns: 3 });
    const first = await scheduler.admit(admission('req_1'));
    first.started(fakeRun('run-1', 'session-1'));
    first.onFrame(initFrame({ session_id: 'session-1' }));
    const second = await scheduler.admit(admission('req_2'));
    second.started(fakeRun('run-2'));
    scheduler.registerParked(heldRun(['toolu_1']));
    void scheduler.admit(admission('req_3', continuedPlan('session-1')));
    expect(scheduler.counts()).toEqual({ active: 2, parked: 1, maxRuns: 3, queued: { 'session-1': 1 }, rateLimit: null });

    first.onFrame(rateLimitEvent('allowed', 1_791_003_600));

    expect(scheduler.counts().rateLimit).toEqual({ status: 'allowed', resetsAt: 1_791_003_600, rateLimitType: 'five_hour' });
  });

  describe('rate-limit admission', () => {
    const resetsIn = (seconds: number) => NOW_MS / 1000 + seconds;

    it("answers 429 rate_limit_error with retry-after until upstream's rejected window resets", async () => {
      const log = quietLog();
      const scheduler = schedulerOn(clock, {}, log);
      const lease = await scheduler.admit(admission('req_1'));
      lease.onFrame(initFrame({ session_id: 'session-1' }));

      lease.onFrame(rateLimitEvent('rejected', resetsIn(90)));
      const error = await rejection(scheduler.admit(admission('req_2')));
      clock.advance(30_000);
      const later = await rejection(scheduler.admit(admission('req_3', continuedPlan('session-1'))));
      clock.advance(60_000);

      expect(error.status).toBe(429);
      expect(error.type).toBe('rate_limit_error');
      expect(error.retryAfter).toBe(90);
      expect(later.retryAfter).toBe(60);
      await expect(scheduler.admit(admission('req_4'))).resolves.toBeDefined();
      expect(log.warn).toHaveBeenCalledWith('Upstream rate limit reached: requests refused until it resets',
        expect.objectContaining({ requestId: 'req_1', sessionId: 'session-1', resetsAt: resetsIn(90) }));
      expect(log.warn).toHaveBeenCalledWith('Rate-limited: request refused',
        expect.objectContaining({ requestId: 'req_2', retryAfter: 90 }));
    });

    it('refuses a turn that answers a parked run too', async () => {
      const scheduler = schedulerOn(clock);
      const lease = await scheduler.admit(admission('req_1'));
      const parked = heldRun(['toolu_1']);
      lease.started(fakeRun());
      scheduler.registerParked(parked);

      lease.onFrame(rateLimitEvent('rejected', resetsIn(90)));
      const error = await rejection(scheduler.admit(admission('req_2', parkedPlan(parked))));

      expect(error.status).toBe(429);
    });

    it('admits again once a later event reports the window allowed', async () => {
      const scheduler = schedulerOn(clock);
      const lease = await scheduler.admit(admission('req_1'));

      lease.onFrame(rateLimitEvent('rejected', resetsIn(3_600)));
      lease.onFrame(rateLimitEvent('allowed', resetsIn(3_600)));

      await expect(scheduler.admit(admission('req_2'))).resolves.toBeDefined();
    });

    it('logs allowed_warning and admits', async () => {
      const log = quietLog();
      const scheduler = schedulerOn(clock, {}, log);
      const lease = await scheduler.admit(admission('req_1'));

      lease.onFrame(rateLimitEvent('allowed_warning', resetsIn(600)));

      await expect(scheduler.admit(admission('req_2'))).resolves.toBeDefined();
      expect(log.warn).toHaveBeenCalledWith('Upstream rate limit warning',
        expect.objectContaining({ requestId: 'req_1', status: 'allowed_warning', resetsAt: resetsIn(600) }));
    });

    it('admits after a rejection that names no reset time: there is nothing to wait for', async () => {
      const scheduler = schedulerOn(clock);
      const lease = await scheduler.admit(admission('req_1'));

      lease.onFrame(rateLimitEvent('rejected', Number.NaN));

      await expect(scheduler.admit(admission('req_2'))).resolves.toBeDefined();
    });
  });
});
