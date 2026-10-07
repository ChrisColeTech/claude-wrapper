/**
 * `stop_sequences` (spec sections 4.1 and 12): absent, or a non-empty list of non-empty strings,
 * worded as the real API's schema errors. Returns the list for the translator's stop-sequence
 * scan (the output-limits ticket's); `null` reads as absent.
 */
import { SurfaceError } from '../surface-error';
import { fieldInvalid } from './field-errors';

function validateSequence(sequence: unknown, index: number): string {
  const path = `stop_sequences.${index}`;
  if (typeof sequence !== 'string') throw fieldInvalid(path, 'a valid string');
  if (sequence === '') throw SurfaceError.invalidRequest(`${path}: String should have at least 1 character`);
  return sequence;
}

export function validateStopSequences(stopSequences: unknown): string[] | undefined {
  if (stopSequences === undefined || stopSequences === null) return undefined;
  if (!Array.isArray(stopSequences)) throw fieldInvalid('stop_sequences', 'a valid list');
  if (stopSequences.length === 0) {
    throw SurfaceError.invalidRequest('stop_sequences: List should have at least 1 item after validation, not 0');
  }
  return stopSequences.map(validateSequence);
}
