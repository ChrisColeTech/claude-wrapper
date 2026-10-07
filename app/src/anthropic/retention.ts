/**
 * Disk retention (spec section 14). Forgetting a session deletes its transcript; beyond that, at
 * the process's first turn every transcript in the runs' project directory is an orphan of an
 * earlier wrapper process (the fingerprint map lives in memory only) and is deleted, and an hourly
 * sweep deletes the transcripts last written longer ago than the fingerprint expiry, a backstop so
 * upstream's own 30-day sweep is never relied on. Every sweep is logged.
 */
import { TranscriptDirectory } from '../upstream/transcripts';
import { Clock, TimerHandle } from '../utils/clock';
import { logger as defaultLogger } from '../utils/logger';

export const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

export interface RetentionOptions {
  transcripts: Pick<TranscriptDirectory, 'sweep'>;
  clock: Clock;
  /** The fingerprint idle expiry: a transcript idle that long has no session that could resume it. */
  expiryMs: number;
  logger?: { info(message: string, context?: unknown): void };
}

export interface Retention {
  /** Deletes every transcript: the orphans an earlier wrapper process left. */
  sweepOrphans(): void;
  /** Starts the hourly sweep; once. */
  start(): void;
  /** Stops it (the shutdown). */
  stop(): void;
}

/** A timer that does not keep the process alive on its own (the system clock's), when it can be told so. */
function unref(handle: TimerHandle): void {
  if (typeof handle === 'object' && handle !== null && 'unref' in handle) (handle as { unref(): void }).unref();
}

class TranscriptRetention implements Retention {
  private timer: TimerHandle | undefined;
  private started = false;
  private stopped = false;

  constructor(private readonly options: RetentionOptions) {}

  sweepOrphans(): void {
    const sessions = this.options.transcripts.sweep();
    (this.options.logger ?? defaultLogger).info('Upstream transcripts swept: orphans of an earlier process', { sessions });
  }

  start(): void {
    if (this.started || this.stopped) return;
    this.started = true;
    this.schedule();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer !== undefined) this.options.clock.clearTimeout(this.timer);
    this.timer = undefined;
  }

  private schedule(): void {
    this.timer = this.options.clock.setTimeout(() => this.sweep(), SWEEP_INTERVAL_MS);
    unref(this.timer);
  }

  private sweep(): void {
    const { clock, expiryMs, transcripts, logger } = this.options;
    const sessions = transcripts.sweep(clock.now() - expiryMs);
    (logger ?? defaultLogger).info('Upstream transcripts swept: idle past the expiry', { sessions, expiryMs });
    if (!this.stopped) this.schedule();
  }
}

export function createRetention(options: RetentionOptions): Retention {
  return new TranscriptRetention(options);
}
