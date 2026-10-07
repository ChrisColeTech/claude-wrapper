/**
 * Sessions for tests: a transcript store that only records which sessions' transcripts were
 * deleted, and a fingerprint map built on it with the default capacity and expiry. Nothing here
 * touches the disk.
 */
import { createSessions, Sessions } from '../../../src/anthropic/sessions';
import { ANTHROPIC_SETTING_DEFAULTS } from '../../../src/config/anthropic-settings';
import { TranscriptStore } from '../../../src/upstream/transcripts';
import { Clock, systemClock } from '../../../src/utils/clock';

export interface RecordingTranscripts extends TranscriptStore {
  /** Session ids whose transcript was deleted, in order (repeats kept). */
  readonly deleted: string[];
}

export function recordingTranscripts(): RecordingTranscripts {
  const deleted: string[] = [];
  return { deleted, delete: async (sessionId) => { deleted.push(sessionId); } };
}

export interface TestSessions {
  sessions: Sessions;
  /** Session ids recorded after a clean turn, in order. */
  recorded: string[];
  /** Session ids the surface forgot, in order (expiry and eviction inside the map are not noted). */
  forgotten: string[];
  /** Session ids whose transcript the sessions deleted. */
  deleted: string[];
}

/**
 * The fingerprint map with the default capacity and expiry, deleting nothing on disk, and noting
 * every record and forget (a turn's record lands at its `result`, after the response has ended).
 */
export function memorySessions(clock: Clock = systemClock): TestSessions {
  const transcripts = recordingTranscripts();
  const map = createSessions({
    clock,
    capacity: ANTHROPIC_SETTING_DEFAULTS.fingerprintCapacity,
    expiryMs: ANTHROPIC_SETTING_DEFAULTS.fingerprintExpiryMs,
    transcripts
  });
  const recorded: string[] = [];
  const forgotten: string[] = [];
  const sessions: Sessions = {
    lookup: fingerprint => map.lookup(fingerprint),
    record: (sessionId, fingerprint) => { recorded.push(sessionId); map.record(sessionId, fingerprint); },
    forget: sessionId => { forgotten.push(sessionId); map.forget(sessionId); },
    parked: map.parked
  };
  return { sessions, recorded, forgotten, deleted: transcripts.deleted };
}
