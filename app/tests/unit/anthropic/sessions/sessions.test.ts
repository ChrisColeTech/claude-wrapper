/**
 * The fingerprint map (spec sections 5 and 14): fingerprint to upstream session id, in memory,
 * at most `capacity` entries with least-recently-used eviction, each expiring after `expiryMs`
 * idle. Every way an entry goes (forget, eviction, expiry, a newer session taking its
 * fingerprint) deletes that session's upstream transcript. Time comes from a fake clock.
 */
import { createSessions, Sessions } from '../../../../src/anthropic/sessions';
import { createFakeClock, FakeClock } from '../../../mocks/shared/fake-clock';
import { recordingTranscripts } from '../../../mocks/anthropic/sessions';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe('sessions', () => {
  let clock: FakeClock;
  let deleted: string[];
  let sessions: Sessions;

  function build(options: { capacity?: number; expiryMs?: number } = {}): Sessions {
    const transcripts = recordingTranscripts();
    deleted = transcripts.deleted;
    return createSessions({ clock, capacity: options.capacity ?? 1000, expiryMs: options.expiryMs ?? DAY, transcripts });
  }

  beforeEach(() => {
    clock = createFakeClock(1_000_000);
    sessions = build();
  });

  describe('lookup and record', () => {
    it('finds nothing for a fingerprint never recorded', () => {
      expect(sessions.lookup('fp-a')).toBeNull();
    });

    it('finds the session recorded under a fingerprint', () => {
      sessions.record('session-1', 'fp-a');

      expect(sessions.lookup('fp-a')).toBe('session-1');
    });

    it("moves a session to its new fingerprint when its transcript grows, keeping its transcript", () => {
      sessions.record('session-1', 'fp-a');

      sessions.record('session-1', 'fp-b');

      expect(sessions.lookup('fp-a')).toBeNull();
      expect(sessions.lookup('fp-b')).toBe('session-1');
      expect(deleted).toEqual([]);
    });

    it('forgets the older session when a newer one records the same fingerprint', () => {
      sessions.record('session-1', 'fp-a');

      sessions.record('session-2', 'fp-a');

      expect(sessions.lookup('fp-a')).toBe('session-2');
      expect(deleted).toEqual(['session-1']);
    });
  });

  describe('forget', () => {
    it('drops the entry and deletes the upstream transcript', () => {
      sessions.record('session-1', 'fp-a');
      sessions.record('session-2', 'fp-b');

      sessions.forget('session-1');

      expect(sessions.lookup('fp-a')).toBeNull();
      expect(sessions.lookup('fp-b')).toBe('session-2');
      expect(deleted).toEqual(['session-1']);
    });

    it('deletes the transcript of a session it holds no entry for (a failed first turn), every time', () => {
      sessions.forget('session-9');
      sessions.forget('session-9');

      expect(deleted).toEqual(['session-9', 'session-9']);
    });
  });

  describe('idle expiry', () => {
    it('keeps an entry until it has been idle for the expiry, then forgets it', () => {
      sessions.record('session-1', 'fp-a');

      clock.advance(DAY - 1);
      expect(sessions.lookup('fp-a')).toBe('session-1');
      clock.advance(DAY - 1);
      expect(sessions.lookup('fp-a')).toBe('session-1');
      clock.advance(DAY);
      expect(sessions.lookup('fp-a')).toBeNull();
      expect(deleted).toEqual(['session-1']);
    });

    it('deletes the transcripts of every expired entry at the next call, looked up or not', () => {
      sessions.record('session-1', 'fp-a');
      sessions.record('session-2', 'fp-b');
      clock.advance(HOUR);
      sessions.record('session-3', 'fp-c');

      clock.advance(DAY - HOUR);
      expect(sessions.lookup('fp-c')).toBe('session-3');

      expect(deleted).toEqual(['session-1', 'session-2']);
      expect(sessions.lookup('fp-a')).toBeNull();
    });

    it('takes the expiry it is given', () => {
      sessions = build({ expiryMs: 1000 });
      sessions.record('session-1', 'fp-a');

      clock.advance(1000);

      expect(sessions.lookup('fp-a')).toBeNull();
    });
  });

  describe('capacity', () => {
    it('evicts the least recently used entry beyond capacity, as a forget', () => {
      sessions = build({ capacity: 2 });
      sessions.record('session-1', 'fp-a');
      sessions.record('session-2', 'fp-b');
      sessions.lookup('fp-a');

      sessions.record('session-3', 'fp-c');

      expect(sessions.lookup('fp-b')).toBeNull();
      expect(sessions.lookup('fp-a')).toBe('session-1');
      expect(sessions.lookup('fp-c')).toBe('session-3');
      expect(deleted).toEqual(['session-2']);
    });

    it('counts a session once however often its fingerprint moves', () => {
      sessions = build({ capacity: 2 });
      sessions.record('session-1', 'fp-a');
      sessions.record('session-1', 'fp-b');
      sessions.record('session-2', 'fp-c');

      expect(deleted).toEqual([]);
      expect(sessions.lookup('fp-b')).toBe('session-1');
    });
  });

  describe('the parked-run registry', () => {
    it("finds a parked run by any of its tool_use ids until it is removed", () => {
      const run = { toolUseIds: ['toolu_1', 'toolu_2'], runId: 'run-1', abandon: async () => undefined };

      sessions.parked.put(run);

      expect(sessions.parked.get('toolu_1')).toBe(run);
      expect(sessions.parked.get('toolu_2')).toBe(run);
      expect(sessions.parked.get('toolu_3')).toBeUndefined();
      sessions.parked.remove(run);
      expect(sessions.parked.get('toolu_1')).toBeUndefined();
      expect(sessions.parked.get('toolu_2')).toBeUndefined();
    });
  });
});
