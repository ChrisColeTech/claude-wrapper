/**
 * `planTurn` (spec section 16): one deep, pure function from a request body to a complete turn
 * plan or the `SurfaceError` the client gets. Nothing here performs I/O. Each concern below
 * throws its `SurfaceError`; the first one is the answer.
 */
import { Catalogue } from '../catalogue';
import { Sessions } from '../deps';
import { SurfaceError } from '../http/surface-error';
import { isObject } from './field-errors';
import { normaliseMessages } from './normalise';
import { renderReplay } from './render-replay';
import { buildRunSpec } from './run-spec';
import { systemPrompt } from './system-prompt';
import { RunContext, TurnPlan } from './turn-plan';
import { validateMaxTokens } from './validate-max-tokens';
import { validateMessages } from './validate-messages';
import { resolveModel } from './validate-model';
import { validateTurnOrder } from './validate-turn-order';

function plan(request: unknown, catalogue: Catalogue, context: RunContext): TurnPlan {
  if (!isObject(request)) throw SurfaceError.invalidRequest('The request body must be a JSON object');
  const model = resolveModel(request['model'], catalogue);
  const maxTokens = validateMaxTokens(request['max_tokens'], model);
  const messages = normaliseMessages(validateMessages(request['messages']));
  validateTurnOrder(messages);
  const system = systemPrompt(request['system']);
  const replay = renderReplay(messages);
  return {
    model,
    messages,
    system,
    runSpec: buildRunSpec({ modelId: model.id, system, maxTokens }, context),
    continuation: { replay },
    // A text turn mounts no tools, so upstream reports none.
    startupChecks: { model: model.id, tools: [] }
  };
}

/**
 * `sessions` is not consulted yet: every turn is a replayed turn until conversation state lands.
 */
export function planTurn(
  request: unknown, catalogue: Catalogue, _sessions: Sessions, context: RunContext
): TurnPlan | SurfaceError {
  try {
    return plan(request, catalogue, context);
  } catch (error) {
    if (error instanceof SurfaceError) return error;
    throw error;
  }
}
