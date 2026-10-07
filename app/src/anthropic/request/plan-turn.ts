/**
 * `planTurn` (spec section 16): one deep, pure function from a request body to a complete turn
 * plan or the `SurfaceError` the client gets. Nothing here performs I/O. Each concern below
 * throws its `SurfaceError`; the first one is the answer.
 */
import { ClientTool, CLIENT_TOOL_PREFIX } from '../../upstream/bridge';
import { STRUCTURED_OUTPUT_TOOL } from '../../upstream/structured-output';
import { Catalogue } from '../catalogue';
import { SurfaceError } from '../http/surface-error';
import { Sessions } from '../sessions';
import { clientTools } from './client-tools';
import { chooseContinuation, resumedSession } from './continuation';
import { Body, isObject } from './field-errors';
import { withoutIgnoredContent } from './ignored-content';
import { normaliseMessages } from './normalise';
import { parkedAnswer } from './parked-answer';
import { runBoundParameters } from './run-bound';
import { buildRunSpec } from './run-spec';
import { systemPrompt } from './system-prompt';
import { Continuation, RunContext, TurnPlan } from './turn-plan';
import { validateContentBlocks } from './validate-content-blocks';
import { validateEffort } from './validate-effort';
import { rejectExtraFields } from './validate-extra-fields';
import { validateFormat } from './validate-format';
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

/**
 * What upstream must report on `system/init`: exactly the mounted tools, the bridge server's
 * prefixed, plus `StructuredOutput` on a `--json-schema` run (upstream adds it even under `--tools ""`).
 */
function expectedTools(clientToolNames: readonly string[], structuredOutput: boolean): string[] {
  return [...clientToolNames.map(name => `${CLIENT_TOOL_PREFIX}${name}`), ...(structuredOutput ? [STRUCTURED_OUTPUT_TOOL] : [])];
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
  const tools = bridgeTools(request);
  const stopSequences = validateStopSequences(request['stop_sequences']) ?? [];
  const thinking = thinkingEnvironment(request['thinking'], model, maxTokens);
  const effort = validateEffort(request['output_config'], model);
  const schema = validateFormat(request['output_config']);
  // A parked run's answer continues that run; anything else starts one, continued or replayed.
  const answer = parkedAnswer(messages, clientMessages, sessions.parked);
  const continuation: Continuation = answer && 'parked' in answer ? answer : chooseContinuation(messages, sessions);
  const resume = resumedSession(continuation);
  const clientToolNames = tools.map(tool => tool.name);
  const runInputs = {
    modelId: model.id, system, maxTokens, thinking, clientToolNames, ...(effort === undefined ? {} : { effort }),
    ...(schema === undefined ? {} : { jsonSchema: JSON.stringify(schema) }), ...(resume === undefined ? {} : { resume })
  };
  return {
    model,
    messages,
    system,
    runSpec: buildRunSpec(runInputs, context),
    continuation,
    translatorConfig: { stopSequences, structuredOutput: schema !== undefined },
    startupChecks: { model: model.id, tools: expectedTools(clientToolNames, schema !== undefined) },
    bridgeTools: tools,
    runBound: runBoundParameters(request, model.id, system),
    ...(answer && 'lostPark' in answer ? { lostPark: answer.lostPark } : {})
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
