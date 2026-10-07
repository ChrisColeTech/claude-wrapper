/**
 * `thinking` (spec sections 4.1, 10 and 12), driven by the catalogue entry's `thinking`
 * capability as the real API's acceptance is per model, and worded with the real API's messages.
 * Returns the child-environment variables the request needs:
 *
 * - `adaptive`: nothing to pass (upstream thinks adaptively on the models that offer it);
 * - `enabled`: `MAX_THINKING_TOKENS=<budget_tokens>`, once the budget is an integer of at least
 *   1024 and below `max_tokens` (a `count_tokens` body has no `max_tokens` to be below);
 * - `disabled`, or `thinking` absent on a model without adaptive thinking (its API default is no
 *   thinking, but upstream thinks by default): `CLAUDE_CODE_DISABLE_THINKING=1`;
 * - `between_tools`: a 400 on every model, as upstream has no knob for it.
 *
 * `display` is ignored: upstream always omits thinking text. An entry without capabilities (an
 * operator's file may say `null`) gets no per-model check: the request's type is served as asked.
 */
import { isObject } from '../../utils/json-object';
import { ModelInfo, ThinkingCapability } from '../catalogue';
import { SurfaceError } from '../surface-error';
import { fieldInvalid, fieldRequired } from './field-errors';

const TYPES: readonly unknown[] = ['adaptive', 'between_tools', 'disabled', 'enabled'];
const MIN_BUDGET_TOKENS = 1024;

const DISABLE = { CLAUDE_CODE_DISABLE_THINKING: '1' };

const ADAPTIVE_INSTEAD = 'Use "thinking.type.adaptive" and "output_config.effort" to control thinking behavior.';

const notSupported = (type: string): SurfaceError => SurfaceError.invalidRequest(type === 'adaptive'
  ? 'adaptive thinking is not supported on this model'
  : `"thinking.type.${type}" is not supported for this model.${type === 'between_tools' ? '' : ` ${ADAPTIVE_INSTEAD}`}`);

/** Whether the entry accepts `type`; `disabled`, newer than the SDK's capability shape, defaults to accepted. */
function accepts(thinking: ThinkingCapability | undefined, type: string): boolean {
  if (type === 'between_tools') return false;
  if (!thinking) return true;
  if (type === 'disabled') return thinking.types.disabled?.supported ?? true;
  return thinking.supported && thinking.types[type as 'adaptive' | 'enabled'].supported;
}

function budgetOf(thinking: Record<string, unknown>): number {
  const budget = thinking['budget_tokens'];
  const path = 'thinking.enabled.budget_tokens';
  if (budget === undefined || budget === null) throw fieldRequired(path);
  if (typeof budget !== 'number' || !Number.isSafeInteger(budget)) throw fieldInvalid(path, 'a valid integer');
  if (budget < MIN_BUDGET_TOKENS) throw fieldInvalid(path, `greater than or equal to ${MIN_BUDGET_TOKENS}`);
  return budget;
}

/** The child-environment variables `thinking` asks for on `model`, or the 400. */
export function thinkingEnvironment(
  thinking: unknown, model: ModelInfo, maxTokens: number | undefined
): Record<string, string> {
  const capability = model.capabilities?.thinking;
  if (thinking === undefined || thinking === null) {
    return capability && !capability.types.adaptive.supported ? DISABLE : {};
  }
  if (!isObject(thinking)) throw fieldInvalid('thinking', 'a valid dictionary');
  const type = thinking['type'];
  if (type === undefined || type === null) throw fieldRequired('thinking.type');
  if (!TYPES.includes(type)) throw fieldInvalid('thinking.type', "'adaptive', 'between_tools', 'disabled' or 'enabled'");
  const budget = type === 'enabled' ? budgetOf(thinking) : undefined;
  if (!accepts(capability, String(type))) throw notSupported(String(type));
  if (type === 'disabled') return DISABLE;
  if (budget === undefined) return {};
  if (maxTokens !== undefined && budget >= maxTokens) {
    throw SurfaceError.invalidRequest('`max_tokens` must be greater than `thinking.budget_tokens`.');
  }
  return { MAX_THINKING_TOKENS: String(budget) };
}
