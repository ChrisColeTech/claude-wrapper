/**
 * The per-session mutex (spec section 14): one upstream session never runs two runs at once. A
 * continued turn queues FIFO behind the earlier turns on its session. At the head it waits for the
 * session's previous run: without bound while that run's turn is in flight (a park keeps it in
 * flight), then up to the continued-turn wait for its exit, which a SIGKILL ends. Only then is the
 * turn re-planned, against the sessions as that run left them: upstream has written its transcript,
 * and a turn that ended in an error has forgotten the session. So a follow-up resumes a session
 * whose transcript is complete, and a duplicate becomes a replayed turn rather than a resume onto
 * a transcript that has moved on.
 */
import { Clock } from '../../utils/clock';
import { resumedSession, TurnPlan } from '../request';
import { Slot } from './slot';
import { SchedulerLogger } from './types';
import { deferred, Deferred, within } from './wait';

interface Waiter {
  slot: Slot;
  /** Settles once the waiter is at the head of its queue. */
  head: Deferred;
}

export interface SessionLockOptions {
  clock: Clock;
  /** The continued-turn wait for the previous run's exit. */
  waitMs: number;
  logger: SchedulerLogger;
}

export class SessionLocks {
  /** The latest slot on each session: the session's previous run, for the next turn on it. */
  private readonly holders = new Map<string, Slot>();
  private readonly queues = new Map<string, Waiter[]>();
  /** Rejects every wait once the scheduler shuts down. */
  private readonly closed = deferred<never>();

  constructor(private readonly options: SessionLockOptions) {
    this.closed.promise.catch(() => undefined);
  }

  /** `slot`'s run is on `sessionId`. */
  bind(slot: Slot, sessionId: string): void {
    this.holders.set(sessionId, slot);
    slot.sessions.add(sessionId);
  }

  /** `slot` is free: it is no session's previous run any more. */
  unbind(slot: Slot): void {
    for (const id of slot.sessions) if (this.holders.get(id) === slot) this.holders.delete(id);
  }

  /** Resolves once `slot`'s turn may run, `slot.plan` re-planned if it waited on a session. */
  async acquire(slot: Slot, replan: () => TurnPlan): Promise<void> {
    let session = resumedSession(slot.plan.continuation);
    while (session !== undefined) {
      const next = await this.turnAtHead(session, slot, replan);
      if (next === session) return;
      session = next;
    }
  }

  /** Every turn still waiting is refused with `error`. */
  close(error: Error): void {
    this.closed.reject(error);
  }

  /** Turns waiting on each session that has any. */
  queued(): Record<string, number> {
    return Object.fromEntries([...this.queues].map(([session, queue]) => [session, queue.length]));
  }

  /** Queues `slot` on `session`; at the head, waits out the previous run and re-plans. The session the re-plan continues. */
  private async turnAtHead(session: string, slot: Slot, replan: () => TurnPlan): Promise<string | undefined> {
    const queue = this.queues.get(session) ?? [];
    this.queues.set(session, queue);
    const waiter = { slot, head: deferred() };
    queue.push(waiter);
    if (queue.length === 1) waiter.head.resolve();
    try {
      await this.until(waiter.head.promise);
      await this.previousRunGone(slot, session);
      slot.plan = replan();
      const next = resumedSession(slot.plan.continuation);
      if (next === session) this.bind(slot, session);
      return next;
    } finally {
      queue.splice(queue.indexOf(waiter), 1);
      queue[0]?.head.resolve();
      if (queue.length === 0) this.queues.delete(session);
    }
  }

  private async previousRunGone(slot: Slot, session: string): Promise<void> {
    const previous = this.holders.get(session);
    if (!previous || previous === slot) return;
    await this.until(previous.turnOver);
    const { clock, waitMs, logger } = this.options;
    if (await this.until(within(previous.ended, waitMs, clock))) return;
    logger.warn("The session's previous run did not exit in time: killed", {
      requestId: slot.requestId, sessionId: session, runId: previous.run?.runId, waitMs
    });
    previous.run?.kill();
    await this.until(previous.ended);
  }

  private until<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([promise, this.closed.promise]);
  }
}
