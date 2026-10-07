/**
 * What every validation concern shares: `null` reads as absent for every optional field, and the
 * 400s are worded as the real API words a schema failure, `<path>: <reason>`, the path dotted
 * with indices (`messages.0.content`).
 */
import { SurfaceError } from '../surface-error';

/** A field that is there: neither absent nor `null`. */
export const present = (value: unknown): boolean => value !== undefined && value !== null;

export function fieldRequired(path: string): SurfaceError {
  return SurfaceError.invalidRequest(`${path}: Field required`);
}

/** `<path>: Input should be <expected>`, e.g. `a valid string`. */
export function fieldInvalid(path: string, expected: string): SurfaceError {
  return SurfaceError.invalidRequest(`${path}: Input should be ${expected}`);
}
