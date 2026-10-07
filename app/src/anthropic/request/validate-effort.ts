/**
 * `output_config.effort` (spec sections 4.1, 10 and 12): absent, or one of the API's levels that
 * the catalogue entry's `effort` capability supports; it then passes verbatim as `--effort`, so
 * upstream's warn-and-ignore of an unsupported level never triggers. An entry without
 * capabilities gets no per-model check. `null` reads as absent. The applied level cannot be read
 * back from upstream's frames.
 */
import { isObject } from '../../utils/json-object';
import { EffortCapability, ModelInfo } from '../catalogue';
import { SurfaceError } from '../surface-error';
import { fieldInvalid } from './field-errors';

const LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
type EffortLevel = typeof LEVELS[number];

const isLevel = (value: unknown): value is EffortLevel => (LEVELS as readonly unknown[]).includes(value);

function checkSupported(level: EffortLevel, effort: EffortCapability | undefined): void {
  if (!effort) return;
  if (!effort.supported) throw SurfaceError.invalidRequest('output_config.effort is not supported for this model.');
  if (!effort[level]?.supported) {
    throw SurfaceError.invalidRequest(`output_config.effort '${level}' is not supported for this model.`);
  }
}

/** The level to pass as `--effort`, or undefined for none. `outputConfig` is already known to be an object or absent. */
export function validateEffort(outputConfig: unknown, model: ModelInfo): EffortLevel | undefined {
  const effort = isObject(outputConfig) ? outputConfig['effort'] : undefined;
  if (effort === undefined || effort === null) return undefined;
  if (!isLevel(effort)) throw fieldInvalid('output_config.effort', "'low', 'medium', 'high', 'xhigh' or 'max'");
  checkSupported(effort, model.capabilities?.effort);
  return effort;
}
