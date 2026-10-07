/**
 * A `result` that ends the turn before its final `message_stop` (spec section 11, trigger ii):
 * `is_error: true` or a subtype other than `success`. Mapped to 500 `api_error` with upstream's
 * own text; the full table of section 13 (status by `api_error_status` and category) belongs to
 * the upstream-failure ticket and replaces `resultError`.
 */
import { ResultFrame } from '../../upstream/frames';
import { SurfaceError } from '../http/surface-error';

export function isFailedResult(result: ResultFrame): boolean {
  return result.is_error || result.subtype !== 'success';
}

/** Upstream's text: `result.result` (the error text on an errored `success`), else `errors[]`, else the subtype. */
function resultText(result: ResultFrame): string {
  if (typeof result.result === 'string' && result.result !== '') return result.result;
  if (Array.isArray(result.errors) && result.errors.length > 0) return result.errors.join('; ');
  return result.subtype;
}

export function resultError(result: ResultFrame): SurfaceError {
  return new SurfaceError(500, 'api_error', resultText(result));
}
