/**
 * Shared pieces of the catalogue file's validation. A problem names where in the file it is
 * (`models[2].capabilities.effort.low.supported`) and what belongs there.
 */
import { isObject } from '../../utils/json-object';

export class CatalogueFormatError extends Error {
  override readonly name = 'CatalogueFormatError';
}

export function fail(at: string, expected: string): never {
  throw new CatalogueFormatError(`${at} must be ${expected}`);
}

export function objectAt(value: unknown, at: string): Record<string, unknown> {
  if (!isObject(value)) fail(at, 'an object');
  return value;
}
