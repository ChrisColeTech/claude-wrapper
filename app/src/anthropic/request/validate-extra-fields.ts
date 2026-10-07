/**
 * Fields the surface does not know (spec section 4.1). An unknown or beta-only top-level field,
 * or an `output_config` field other than `effort` and `format` (`task_budget` is beta-only), is a
 * 400 with the real API's "Extra inputs are not permitted" wording; `container` has its own
 * message. Checked before anything else in the body, as the real API's schema is. A
 * `count_tokens` body (spec section 12) takes fewer fields: the Messages-only ones (`max_tokens`,
 * `stream`, `stop_sequences`, the sampling and plain fields, `container`) are extra inputs there.
 * `mcp_servers` is known to both: beta-only, its gate is the connectors' (`connectors.ts`).
 */
import { JsonObject, isObject } from '../../utils/json-object';
import { SurfaceError } from '../surface-error';
import { fieldInvalid } from './field-errors';
import { Endpoint } from './turn-plan';

const KNOWN_FIELDS = new Set([
  'model', 'messages', 'max_tokens', 'system', 'stream', 'tools', 'tool_choice', 'temperature', 'top_p', 'top_k',
  'stop_sequences', 'metadata', 'thinking', 'output_config', 'service_tier', 'cache_control', 'container',
  'inference_geo', 'diagnostics', 'mcp_servers'
]);

const COUNT_TOKENS_FIELDS = new Set([
  'model', 'messages', 'system', 'tools', 'tool_choice', 'thinking', 'output_config', 'cache_control', 'mcp_servers'
]);

const KNOWN_OUTPUT_CONFIG_FIELDS = new Set(['effort', 'format']);

export function extraInputs(path: string): SurfaceError {
  return SurfaceError.invalidRequest(`${path}: Extra inputs are not permitted`);
}

function rejectUnknown(value: JsonObject, known: ReadonlySet<string>, prefix: string): void {
  const unknown = Object.keys(value).find(field => !known.has(field));
  if (unknown !== undefined) throw extraInputs(`${prefix}${unknown}`);
}

function checkOutputConfig(outputConfig: unknown): void {
  if (outputConfig === undefined || outputConfig === null) return;
  if (!isObject(outputConfig)) throw fieldInvalid('output_config', 'a valid dictionary');
  rejectUnknown(outputConfig, KNOWN_OUTPUT_CONFIG_FIELDS, 'output_config.');
}

export function rejectExtraFields(body: JsonObject, endpoint: Endpoint): void {
  rejectUnknown(body, endpoint === 'messages' ? KNOWN_FIELDS : COUNT_TOKENS_FIELDS, '');
  checkOutputConfig(body['output_config']);
  if (body['container'] !== undefined && body['container'] !== null) {
    throw SurfaceError.invalidRequest('container: containers are not supported on this surface');
  }
}
