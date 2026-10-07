/**
 * `model` (spec section 3): resolved in the catalogue by canonical id or alias, else 404 with the
 * real API's message, before anything is spawned.
 */
import { Catalogue, ModelInfo } from '../catalogue';
import { SurfaceError } from '../surface-error';
import { fieldInvalid, fieldRequired } from './field-errors';

export function resolveModel(model: unknown, catalogue: Catalogue): ModelInfo {
  if (model === undefined) throw fieldRequired('model');
  if (typeof model !== 'string') throw fieldInvalid('model', 'a valid string');
  const entry = catalogue.resolve(model);
  if (!entry) throw SurfaceError.of('not_found_error', `model: ${model}`);
  return entry;
}
