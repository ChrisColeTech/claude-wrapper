/**
 * A JSON object, as parsed from a request body or an upstream frame: string keys to unknown
 * values. `isObject` is the one check for it across the surface and upstream.
 */
export type JsonObject = { [key: string]: unknown };

/** An object that is neither `null` nor an array. */
export function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
