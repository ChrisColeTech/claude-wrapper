/**
 * The 400s every validation concern shares, worded as the real API words a schema failure:
 * `<path>: <reason>`, the path dotted with indices (`messages.0.content`).
 */
import { SurfaceError } from '../surface-error';

export type Body = Record<string, unknown>;

export function isObject(value: unknown): value is Body {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function fieldRequired(path: string): SurfaceError {
  return SurfaceError.invalidRequest(`${path}: Field required`);
}

/** `<path>: Input should be <expected>`, e.g. `a valid string`. */
export function fieldInvalid(path: string, expected: string): SurfaceError {
  return SurfaceError.invalidRequest(`${path}: Input should be ${expected}`);
}
