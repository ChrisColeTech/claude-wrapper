/**
 * A turn's run spec (spec section 10): the argument list, the child environment, the fixed
 * working directory, the run's private directory and the operator's timers.
 */
import * as path from 'path';
import { RunSpec } from '../../upstream/runner';
import { childEnvironment } from './child-environment';
import { runFlags } from './run-flags';
import { RunContext } from './turn-plan';

/** What the request decided about the run. */
export interface RunInputs {
  modelId: string;
  system: string;
  maxTokens: number;
  /** The thinking variables the request asks for (`CLAUDE_CODE_DISABLE_THINKING` or `MAX_THINKING_TOKENS`). */
  thinking: Readonly<Record<string, string>>;
  /** `output_config.effort`, passed as `--effort`. */
  effort?: string;
  /** `output_config.format.schema` as JSON text, passed as `--json-schema`. */
  jsonSchema?: string;
  /** A continued turn's upstream session, resumed with `--resume`. */
  resume?: string;
}

export function buildRunSpec(inputs: RunInputs, context: RunContext): RunSpec {
  const { settings, environment, state, runId } = context;
  const { timers } = settings;
  return {
    flags: runFlags({
      system: inputs.system, modelId: inputs.modelId, maxTurns: settings.maxTurns,
      ...(inputs.effort === undefined ? {} : { effort: inputs.effort }),
      ...(inputs.jsonSchema === undefined ? {} : { jsonSchema: inputs.jsonSchema }),
      ...(inputs.resume === undefined ? {} : { resume: inputs.resume })
    }),
    env: childEnvironment({ maxOutputTokens: inputs.maxTokens, thinking: inputs.thinking, settings, environment }),
    cwd: state.cwd,
    runDir: { path: path.join(state.runs, runId), files: {} },
    timers: { startup: timers.startupMs, stall: timers.stallMs, lifetime: timers.lifetimeMs }
  };
}
