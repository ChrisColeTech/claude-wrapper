/**
 * Sampling parameters (spec sections 4.1 and 12). Upstream has no sampling knob, so on every
 * catalogue model `temperature` must be absent or 1.0, `top_p` absent or at least 0.99, and
 * `top_k` absent: the values at which sampling is the default. Anything else is a 400 naming the
 * field and the accepted value. Stricter than the real API on Haiku 4.5, deliberately: accepting
 * `temperature: 0` there would misreport what ran. `null` reads as absent.
 */
import { SurfaceError } from '../surface-error';
import { Body, fieldInvalid } from './field-errors';

const present = (value: unknown): boolean => value !== undefined && value !== null;

function numberField(body: Body, field: string): number | undefined {
  const value = body[field];
  if (!present(value)) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw fieldInvalid(field, 'a valid number');
  return value;
}

export function validateSampling(body: Body): void {
  const temperature = numberField(body, 'temperature');
  if (temperature !== undefined && temperature !== 1) {
    throw SurfaceError.invalidRequest('temperature: only 1.0 is supported on this surface; leave it out or send 1.0');
  }
  const topP = numberField(body, 'top_p');
  if (topP !== undefined && topP > 1) throw fieldInvalid('top_p', 'less than or equal to 1');
  if (topP !== undefined && topP < 0.99) {
    throw SurfaceError.invalidRequest(
      'top_p: only values of 0.99 or more are supported on this surface; leave it out or send at least 0.99'
    );
  }
  if (present(body['top_k'])) throw SurfaceError.invalidRequest('top_k: not supported on this surface; leave it out');
}
