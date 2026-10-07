/**
 * The body fields that only need their type checked (spec sections 4.1 and 12): `stream`, which
 * the conductor honours, and the fields accepted and ignored: `metadata` (`user_id` is never a
 * session key), `service_tier` (its enum validated; the response relays upstream's tier),
 * `inference_geo`, `diagnostics` and a top-level `cache_control`. `null` reads as absent.
 */
import { SurfaceError } from '../http/surface-error';
import { Body, fieldInvalid, isObject } from './field-errors';
import { extraInputs } from './validate-extra-fields';

const SERVICE_TIERS: readonly unknown[] = ['auto', 'standard_only'];

function present(body: Body, field: string): unknown {
  const value = body[field];
  return value === null ? undefined : value;
}

function checkMetadata(metadata: unknown): void {
  if (metadata === undefined) return;
  if (!isObject(metadata)) throw fieldInvalid('metadata', 'a valid dictionary');
  const extra = Object.keys(metadata).find(field => field !== 'user_id');
  if (extra !== undefined) throw extraInputs(`metadata.${extra}`);
  const userId = metadata['user_id'];
  if (userId !== undefined && userId !== null && typeof userId !== 'string') {
    throw fieldInvalid('metadata.user_id', 'a valid string');
  }
}

function checkObject(body: Body, field: string): void {
  const value = present(body, field);
  if (value !== undefined && !isObject(value)) throw fieldInvalid(field, 'a valid dictionary');
}

export function validatePlainFields(body: Body): void {
  const stream = present(body, 'stream');
  if (stream !== undefined && typeof stream !== 'boolean') throw fieldInvalid('stream', 'a valid boolean');
  checkMetadata(present(body, 'metadata'));
  const tier = present(body, 'service_tier');
  if (tier !== undefined && !SERVICE_TIERS.includes(tier)) {
    throw SurfaceError.invalidRequest("service_tier: Input should be 'auto' or 'standard_only'");
  }
  const geo = present(body, 'inference_geo');
  if (geo !== undefined && typeof geo !== 'string') throw fieldInvalid('inference_geo', 'a valid string');
  checkObject(body, 'diagnostics');
  checkObject(body, 'cache_control');
}
