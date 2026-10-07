/**
 * The fingerprint map (spec sections 5 and 14, ADR 0002), in memory only, so a wrapper restart
 * starts it empty and every conversation's next turn is a replayed turn. Expiry needs no timer:
 * entries are kept in last-use order, so the idle ones are a prefix, dropped at every call.
 */
import { logger as defaultLogger } from '../../utils/logger';
import { createParkedRuns } from './parked-runs';
import { Sessions, SessionsOptions } from './types';

interface Entry {
  fingerprint: string;
  lastUsed: number;
}

type DropReason = 'expired' | 'evicted' | 'superseded';

class FingerprintMap implements Sessions {
  readonly parked = createParkedRuns();
  /** One entry per session, least recently used first: a use moves the entry to the end. */
  private readonly bySession = new Map<string, Entry>();
  private readonly byFingerprint = new Map<string, string>();

  constructor(private readonly options: SessionsOptions) {}

  lookup(fingerprint: string): string | null {
    this.expire();
    const sessionId = this.byFingerprint.get(fingerprint);
    if (sessionId === undefined) return null;
    this.use(sessionId, fingerprint);
    return sessionId;
  }

  record(sessionId: string, fingerprint: string): void {
    this.expire();
    const holder = this.byFingerprint.get(fingerprint);
    // Two sessions with one transcript: only the newer can be found again, so the older is garbage.
    if (holder !== undefined && holder !== sessionId) this.drop(holder, 'superseded');
    this.remove(sessionId);
    this.use(sessionId, fingerprint);
    this.byFingerprint.set(fingerprint, sessionId);
    for (const [oldest] of this.bySession) {
      if (this.bySession.size <= this.options.capacity) break;
      this.drop(oldest, 'evicted');
    }
  }

  forget(sessionId: string): void {
    this.remove(sessionId);
    void this.options.transcripts.delete(sessionId);
  }

  private use(sessionId: string, fingerprint: string): void {
    this.bySession.delete(sessionId);
    this.bySession.set(sessionId, { fingerprint, lastUsed: this.options.clock.now() });
  }

  private remove(sessionId: string): void {
    const entry = this.bySession.get(sessionId);
    if (!entry) return;
    this.bySession.delete(sessionId);
    if (this.byFingerprint.get(entry.fingerprint) === sessionId) this.byFingerprint.delete(entry.fingerprint);
  }

  private drop(sessionId: string, reason: DropReason): void {
    (this.options.logger ?? defaultLogger).info('Upstream session forgotten', { sessionId, reason });
    this.forget(sessionId);
  }

  /** Drops every entry idle for the expiry or longer; they are the front of `bySession`. */
  private expire(): void {
    const cutoff = this.options.clock.now() - this.options.expiryMs;
    for (const [sessionId, entry] of this.bySession) {
      if (entry.lastUsed > cutoff) return;
      this.drop(sessionId, 'expired');
    }
  }
}

export function createSessions(options: SessionsOptions): Sessions {
  return new FingerprintMap(options);
}
