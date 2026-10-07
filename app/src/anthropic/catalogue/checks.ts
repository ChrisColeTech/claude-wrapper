/**
 * Shared pieces of the catalogue file's validation. A problem names where in the file it is
 * (`models[2].capabilities.effort.low.supported`) and what belongs there.
 */

export class CatalogueFormatError extends Error {
  override readonly name = 'CatalogueFormatError';
}

export function fail(at: string, expected: string): never {
  throw new CatalogueFormatError(`${at} must be ${expected}`);
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function objectAt(value: unknown, at: string): Record<string, unknown> {
  if (!isObject(value)) fail(at, 'an object');
  return value;
}
