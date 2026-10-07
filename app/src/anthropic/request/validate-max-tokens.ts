/**
 * `max_tokens` (spec sections 4.1 and 12): required, an integer from 1 to the catalogue entry's
 * `max_tokens`. `0`, the real API's cache pre-warm, has no upstream equivalent and is rejected.
 * Above the entry's limit the real API's own message names the canonical id.
 */
import { ModelInfo } from '../catalogue';
import { SurfaceError } from '../surface-error';
import { fieldInvalid, fieldRequired } from './field-errors';

export function validateMaxTokens(maxTokens: unknown, model: ModelInfo): number {
  if (maxTokens === undefined) throw fieldRequired('max_tokens');
  if (typeof maxTokens !== 'number' || !Number.isSafeInteger(maxTokens)) {
    throw fieldInvalid('max_tokens', 'a valid integer');
  }
  if (maxTokens < 1) throw fieldInvalid('max_tokens', 'greater than or equal to 1');
  const limit = model.max_tokens;
  if (limit !== null && maxTokens > limit) {
    throw SurfaceError.invalidRequest(
      `max_tokens: ${maxTokens} > ${limit}, which is the maximum allowed number of output tokens for ${model.id}`
    );
  }
  return maxTokens;
}
