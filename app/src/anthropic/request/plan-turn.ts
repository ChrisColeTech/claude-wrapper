/**
 * `planTurn` (spec section 16): one deep, pure function from a request body to a complete turn
 * plan or the `SurfaceError` the client gets. Nothing here performs I/O. Each concern below
 * throws its `SurfaceError`; the first one is the answer.
 */
import { Catalogue } from '../catalogue';
import { SurfaceError } from '../http/surface-error';
import { Sessions } from '../sessions';
import { chooseContinuation, resumedSession } from './continuation';
import { Body, isObject } from './field-errors';
import { withoutIgnoredContent } from './ignored-content';
import { normaliseMessages } from './normalise';
import { buildRunSpec } from './run-spec';
import { systemPrompt } from './system-prompt';
import { RunContext, TurnPlan } from './turn-plan';
import { validateContentBlocks } from './validate-content-blocks';
import { rejectExtraFields } from './validate-extra-fields';
import { validateMaxTokens } from './validate-max-tokens';
import { validateMessages } from './validate-messages';
import { resolveModel } from './validate-model';
import { validatePlainFields } from './validate-plain-fields';
import { validateSampling } from './validate-sampling';
import { validateServerTools } from './validate-server-tools';
import { validateStopSequences } from './validate-stop-sequences';
import { validateToolChoice } from './validate-tool-choice';
import { validateTurnOrder } from './validate-turn-order';

/** The body fields that shape no part of the plan yet: each is validated, then served or ignored. */
function validateParameters(request: Body): void {
  validatePlainFields(request);
  validateSampling(request);
  validateToolChoice(request['tool_choice']);
  validateServerTools(request['tools']);
  if (validateStopSequences(request['stop_sequences'])) {
    // The output-limits ticket's scan honours them; until it lands, an honest 400.
    throw SurfaceError.invalidRequest('stop_sequences: not supported on this surface yet');
  }
}

function plan(request: unknown, catalogue: Catalogue, sessions: Sessions, context: RunContext): TurnPlan {
  if (!isObject(request)) throw SurfaceError.invalidRequest('The request body must be a JSON object');
  rejectExtraFields(request);
  const model = resolveModel(request['model'], catalogue);
  const maxTokens = validateMaxTokens(request['max_tokens'], model);
  const clientMessages = validateMessages(request['messages']);
  validateContentBlocks(clientMessages);
  const messages = normaliseMessages(withoutIgnoredContent(clientMessages));
  validateTurnOrder(messages);
  const system = systemPrompt(request['system']);
  validateParameters(request);
  const continuation = chooseContinuation(messages, sessions);
  const resume = resumedSession(continuation);
  return {
    model,
    messages,
    system,
    runSpec: buildRunSpec({ modelId: model.id, system, maxTokens, ...(resume === undefined ? {} : { resume }) }, context),
    continuation,
    // A text turn mounts no tools, so upstream reports none.
    startupChecks: { model: model.id, tools: [] }
  };
}

/** `sessions` is only looked up: whether the request continues an upstream session. */
export function planTurn(
  request: unknown, catalogue: Catalogue, sessions: Sessions, context: RunContext
): TurnPlan | SurfaceError {
  try {
    return plan(request, catalogue, sessions, context);
  } catch (error) {
    if (error instanceof SurfaceError) return error;
    throw error;
  }
}
