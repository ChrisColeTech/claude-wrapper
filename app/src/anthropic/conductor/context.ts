/**
 * Small helpers of the conductor's: log context, what a request asked for, and the sessions a lost
 * park falls back to.
 */
import { SinkOutcome } from '../respond';
import { Sessions } from '../sessions';
import { PumpLogger } from './run-pump';

/** `logger` with `context` on every line. */
export function withContext(logger: PumpLogger, context: object): PumpLogger {
  return {
    debug: (message, extra) => logger.debug(message, { ...context, ...(extra as object) }),
    info: (message, extra) => logger.info(message, { ...context, ...(extra as object) }),
    warn: (message, extra) => logger.warn(message, { ...context, ...(extra as object) })
  };
}

export const wantsStream = (body: unknown): boolean =>
  typeof body === 'object' && body !== null && (body as { stream?: unknown }).stream === true;

export const outcomeContext = (outcome: SinkOutcome): object =>
  ('error' in outcome ? { outcome: outcome.kind, errorType: outcome.error.type } : { outcome: outcome.kind });

/** The same sessions with no parked run: what a turn falls back to when its park was lost. */
export const withoutParks = (sessions: Sessions): Sessions => ({
  lookup: fingerprint => sessions.lookup(fingerprint),
  record: (sessionId, fingerprint) => sessions.record(sessionId, fingerprint),
  forget: sessionId => sessions.forget(sessionId),
  parked: { get: () => undefined, put: () => undefined, remove: () => undefined }
});
