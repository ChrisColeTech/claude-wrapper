/**
 * A `count_tokens` request's run (spec section 12): what upstream would send for the request is
 * measured by one minimal model call. The run is capped at one output token and persists no
 * session. It continues nothing: no upstream session is looked up for it and it answers no parked
 * run, so its history is always rendered as a replayed turn's.
 */
import { Sessions } from '../sessions';
import { RunInputs } from './run-spec';

/** The output cap of a measuring run. */
const MEASURING_OUTPUT_TOKENS = 1;

/** What a count looks up: no session matches and no run is parked. */
export const NOTHING_TO_CONTINUE: Sessions = {
  lookup: () => null,
  record: () => undefined,
  forget: () => undefined,
  parked: { get: () => undefined, put: () => undefined, remove: () => undefined }
};

/**
 * The measuring run of a request planned as `inputs`. No thinking budget fits under its one-token
 * cap: upstream raises any budget to at least 1024 tokens, and the API rejects a budget that is not
 * below `max_tokens`. So a request asking for a budget is measured with thinking off; the budget
 * is output, never input.
 */
export function measuringRun(inputs: Omit<RunInputs, 'maxTokens'>): RunInputs {
  const { MAX_THINKING_TOKENS: budget, ...thinking } = inputs.thinking;
  return {
    ...inputs,
    maxTokens: MEASURING_OUTPUT_TOKENS,
    thinking: budget === undefined ? thinking : { ...thinking, CLAUDE_CODE_DISABLE_THINKING: '1' },
    noSessionPersistence: true
  };
}
