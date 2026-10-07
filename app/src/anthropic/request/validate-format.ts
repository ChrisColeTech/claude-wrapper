/**
 * `output_config.format` (spec sections 4.1, 10 and 12): absent, or `{type: "json_schema",
 * schema}` with the schema an object, worded as the real API's schema errors. The schema itself is
 * upstream's to judge: it passes verbatim as `--json-schema`, and upstream's startup rejection of
 * it is a 400 (the failure module's). `null` reads as absent.
 */
import { JsonObject } from '../../upstream/frames';
import { fieldInvalid, fieldRequired, isObject } from './field-errors';
import { extraInputs } from './validate-extra-fields';

const FORMAT_FIELDS = new Set(['type', 'schema']);

/** The JSON schema to pass as `--json-schema`, or undefined for none. `outputConfig` is already an object or absent. */
export function validateFormat(outputConfig: unknown): JsonObject | undefined {
  const format = isObject(outputConfig) ? outputConfig['format'] : undefined;
  if (format === undefined || format === null) return undefined;
  if (!isObject(format)) throw fieldInvalid('output_config.format', 'a valid dictionary');
  if (format['type'] === undefined) throw fieldRequired('output_config.format.type');
  if (format['type'] !== 'json_schema') throw fieldInvalid('output_config.format.type', "'json_schema'");
  if (format['schema'] === undefined) throw fieldRequired('output_config.format.schema');
  if (!isObject(format['schema'])) throw fieldInvalid('output_config.format.schema', 'a valid dictionary');
  const extra = Object.keys(format).find(field => !FORMAT_FIELDS.has(field));
  if (extra !== undefined) throw extraInputs(`output_config.format.${extra}`);
  return format['schema'];
}
