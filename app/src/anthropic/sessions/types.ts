/**
 * The sessions module's interface (spec sections 5, 7 and 16): the fingerprint map that decides
 * whether a turn continues an upstream session, and the registry of held-open runs.
 */
import { TranscriptStore } from '../../upstream/transcripts';
import { Clock } from '../../utils/clock';
import { Logger } from '../../utils/logger';

/**
 * A held-open run waiting for the client's tool results (spec section 7). The registry and the
 * planner read only the ids; the conductor, which parked it, resumes it.
 */
export interface ParkedRun {
  /** The `tool_use` ids the parked turn returned; a request's `tool_result` ids are matched against them. */
  readonly toolUseIds: readonly string[];
  /** The run's id, for logs. */
  readonly runId: string;
  /**
   * Ends a park the client will not answer (park TTL, shutdown): interrupts the run, then rejects
   * its waiting tool calls, tears it down and forgets its upstream session. Settles once the run
   * has exited.
   */
  abandon(reason: string): Promise<void>;
}

/** Parked runs by `tool_use` id. Nothing here expires: the conductor's parking holds the park TTL. */
export interface ParkedRuns {
  get(toolUseId: string): ParkedRun | undefined;
  /** Registers the run under each of its `tool_use` ids. */
  put(run: ParkedRun): void;
  remove(run: ParkedRun): void;
}

/**
 * Fingerprint to upstream session id, one entry per session. Lookups and records count as use:
 * the least recently used entry goes first beyond the capacity, and an entry idle for the expiry
 * goes at the next call. Every entry that goes (forget, eviction, expiry, a newer session
 * recording the same fingerprint) has its upstream transcript deleted.
 */
export interface Sessions {
  /** The session whose recorded transcript has this fingerprint, else `null`. */
  lookup(fingerprint: string): string | null;
  /**
   * After a turn that ended cleanly: `sessionId`'s transcript now has `fingerprint`. The session's
   * earlier fingerprint stops matching (its transcript has grown past it).
   */
  record(sessionId: string, fingerprint: string): void;
  /** Drops the session's entry, if any, and deletes its upstream transcript, every time it is called. */
  forget(sessionId: string): void;
  readonly parked: ParkedRuns;
}

export interface SessionsOptions {
  /** Idle time is measured on it. */
  clock: Clock;
  /** Most entries kept (settings `fingerprintCapacity`). */
  capacity: number;
  /** Idle time after which an entry goes (settings `fingerprintExpiryMs`). */
  expiryMs: number;
  /** Where forgetting a session deletes its transcript. */
  transcripts: TranscriptStore;
  logger?: Pick<Logger, 'info'>;
}
