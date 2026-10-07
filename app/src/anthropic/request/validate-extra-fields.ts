/**
 * Fields the surface does not know (spec section 4.1). An unknown or beta-only top-level field,
 * or an `output_config` field other than `effort` and `format` (`task_budget` is beta-only), is a
 * 400 with the real API's "Extra inputs are not permitted" wording; `container` has its own
 * message. Checked before anything else in the body, as the real API's schema is.
 *
 * `mcp_servers` is beta-only and not in the list: the connectors ticket adds it with its gate.
 */
import { SurfaceError } from '../http/surface-error';
import { Body, fieldInvalid, isObject } from './field-errors';

const KNOWN_FIELDS = new Set([
  'model', 'messages', 'max_tokens', 'system', 'stream', 'tools', 'tool_choice', 'temperature', 'top_p', 'top_k',
  'stop_sequences', 'metadata', 'thinking', 'output_config', 'service_tier', 'cache_control', 'container',
  'inference_geo', 'diagnostics'
]);

const KNOWN_OUTPUT_CONFIG_FIELDS = new Set(['effort', 'format']);

export function extraInputs(path: string): SurfaceError {
  return SurfaceError.invalidRequest(`${path}: Extra inputs are not permitted`);
}

function rejectUnknown(value: Body, known: ReadonlySet<string>, prefix: string): void {
  const unknown = Object.keys(value).find(field => !known.has(field));
  if (unknown !== undefined) throw extraInputs(`${prefix}${unknown}`);
}

function checkOutputConfig(outputConfig: unknown): void {
  if (outputConfig === undefined || outputConfig === null) return;
  if (!isObject(outputConfig)) throw fieldInvalid('output_config', 'a valid dictionary');
  rejectUnknown(outputConfig, KNOWN_OUTPUT_CONFIG_FIELDS, 'output_config.');
}

export function rejectExtraFields(body: Body): void {
  rejectUnknown(body, KNOWN_FIELDS, '');
  checkOutputConfig(body['output_config']);
  if (body['container'] !== undefined && body['container'] !== null) {
    throw SurfaceError.invalidRequest('container: containers are not supported on this surface');
  }
}
