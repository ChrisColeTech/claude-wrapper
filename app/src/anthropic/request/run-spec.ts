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
}

export function buildRunSpec(inputs: RunInputs, context: RunContext): RunSpec {
  const { settings, environment, state, runId } = context;
  const { timers } = settings;
  return {
    flags: runFlags({ system: inputs.system, modelId: inputs.modelId, maxTurns: settings.maxTurns }),
    env: childEnvironment({ maxOutputTokens: inputs.maxTokens, settings, environment }),
    cwd: state.cwd,
    runDir: { path: path.join(state.runs, runId), files: {} },
    timers: { startup: timers.startupMs, stall: timers.stallMs, lifetime: timers.lifetimeMs }
  };
}
