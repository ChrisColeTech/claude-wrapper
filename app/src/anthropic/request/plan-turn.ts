/**
 * `planTurn` (spec section 16): one deep, pure function from a request body to a complete turn
 * plan or the `SurfaceError` the client gets. Nothing here performs I/O. Each concern below
 * throws its `SurfaceError`; the first one is the answer. `planCountTokens` plans a
 * `count_tokens` body the same way, for the run that measures it (spec section 12).
 */
import { ClientTool, CLIENT_TOOL_PREFIX } from '../../upstream/bridge';
import { Catalogue } from '../catalogue';
import { SurfaceError } from '../http/surface-error';
import { Sessions } from '../sessions';
import { clientTools } from './client-tools';
import { chooseContinuation, resumedSession } from './continuation';
import { measuringRun, NOTHING_TO_CONTINUE } from './count-run';
import { Body, isObject } from './field-errors';
import { withoutIgnoredContent } from './ignored-content';
import { normaliseMessages } from './normalise';
import { parkedAnswer } from './parked-answer';
import { runBoundParameters } from './run-bound';
import { buildRunSpec } from './run-spec';
import { systemPrompt } from './system-prompt';
import { Continuation, Endpoint, RunContext, TurnPlan } from './turn-plan';
import { validateContentBlocks } from './validate-content-blocks';
import { validateEffort } from './validate-effort';
import { rejectExtraFields } from './validate-extra-fields';
import { validateMaxTokens } from './validate-max-tokens';
import { validateMessages } from './validate-messages';
import { resolveModel } from './validate-model';
import { validatePlainFields } from './validate-plain-fields';
import { validateSampling } from './validate-sampling';
import { validateServerTools } from './validate-server-tools';
import { validateStopSequences } from './validate-stop-sequences';
import { thinkingEnvironment } from './validate-thinking';
import { validateToolChoice } from './validate-tool-choice';
import { validateTurnOrder } from './validate-turn-order';

/** The body fields that shape no part of the plan yet: each is validated, then served or ignored. */
function validateParameters(request: Body): void {
  validatePlainFields(request);
  validateSampling(request);
  validateToolChoice(request['tool_choice']);
  validateServerTools(request['tools']);
}

/** The client tools the turn exposes: none under `tool_choice: none`, though they are validated all the same. */
function bridgeTools(request: Body): ClientTool[] {
  const tools = clientTools(request['tools']);
  const choice = request['tool_choice'];
  return isObject(choice) && choice['type'] === 'none' ? [] : tools;
}

function plan(
  request: unknown, catalogue: Catalogue, sessions: Sessions, context: RunContext, endpoint: Endpoint
): TurnPlan {
  if (!isObject(request)) throw SurfaceError.invalidRequest('The request body must be a JSON object');
  rejectExtraFields(request, endpoint);
  const model = resolveModel(request['model'], catalogue);
  // A count has no `max_tokens`: its run is capped at one output token instead.
  const maxTokens = endpoint === 'count_tokens' ? undefined : validateMaxTokens(request['max_tokens'], model);
  const clientMessages = validateMessages(request['messages']);
  validateContentBlocks(clientMessages);
  const messages = normaliseMessages(withoutIgnoredContent(clientMessages));
  validateTurnOrder(messages);
  const system = systemPrompt(request['system']);
  validateParameters(request);
  const tools = bridgeTools(request);
  const stopSequences = validateStopSequences(request['stop_sequences']) ?? [];
  const thinking = thinkingEnvironment(request['thinking'], model, maxTokens);
  const effort = validateEffort(request['output_config'], model);
  // A parked run's answer continues that run; anything else starts one, continued or replayed.
  const answer = parkedAnswer(messages, clientMessages, sessions.parked);
  const continuation: Continuation = answer && 'parked' in answer ? answer : chooseContinuation(messages, sessions);
  const resume = resumedSession(continuation);
  const clientToolNames = tools.map(tool => tool.name);
  const runInputs = {
    modelId: model.id, system, thinking, clientToolNames,
    ...(effort === undefined ? {} : { effort }), ...(resume === undefined ? {} : { resume })
  };
  return {
    model,
    messages,
    system,
    runSpec: buildRunSpec(maxTokens === undefined ? measuringRun(runInputs) : { ...runInputs, maxTokens }, context),
    continuation,
    translatorConfig: { stopSequences },
    // Upstream reports exactly the mounted tools: the bridge server's, prefixed.
    startupChecks: { model: model.id, tools: clientToolNames.map(name => `${CLIENT_TOOL_PREFIX}${name}`) },
    bridgeTools: tools,
    runBound: runBoundParameters(request, model.id, system),
    ...(answer && 'lostPark' in answer ? { lostPark: answer.lostPark } : {})
  };
}

function planned(planning: () => TurnPlan): TurnPlan | SurfaceError {
  try {
    return planning();
  } catch (error) {
    if (error instanceof SurfaceError) return error;
    throw error;
  }
}

/** `sessions` is only looked up: whether the request continues an upstream session. */
export function planTurn(
  request: unknown, catalogue: Catalogue, sessions: Sessions, context: RunContext
): TurnPlan | SurfaceError {
  return planned(() => plan(request, catalogue, sessions, context, 'messages'));
}

/**
 * A `count_tokens` body (spec section 12), planned as the Messages turn it describes would be,
 * for a run that measures it. A count continues nothing: its history is always rendered.
 */
export function planCountTokens(request: unknown, catalogue: Catalogue, context: RunContext): TurnPlan | SurfaceError {
  return planned(() => plan(request, catalogue, NOTHING_TO_CONTINUE, context, 'count_tokens'));
}
