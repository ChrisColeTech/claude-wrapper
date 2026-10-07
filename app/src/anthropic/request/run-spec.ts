/**
 * A turn's run spec (spec section 10): the argument list, the child environment, the fixed
 * working directory, the run's private directory and the operator's timers.
 */
import * as path from 'path';
import { CLIENT_TOOL_PREFIX } from '../../upstream/bridge';
import { MCP_CONFIG_FILE_NAME } from '../../upstream/mcp-config';
import { RunSpec } from '../../upstream/runner';
import { childEnvironment } from './child-environment';
import { runFlags } from './run-flags';
import { RunContext } from './turn-plan';

/** What the request decided about the run. */
export interface RunInputs {
  modelId: string;
  system: string;
  maxTokens: number;
  /** The client tools the bridge server mounts; none: no bridge server. */
  clientToolNames: readonly string[];
  /** The thinking variables the request asks for (`CLAUDE_CODE_DISABLE_THINKING` or `MAX_THINKING_TOKENS`). */
  thinking: Readonly<Record<string, string>>;
  /** `output_config.effort`, passed as `--effort`. */
  effort?: string;
  /** `output_config.format.schema` as JSON text, passed as `--json-schema`. */
  jsonSchema?: string;
  /** A continued turn's upstream session, resumed with `--resume`. */
  resume?: string;
  /** A `count_tokens` run (spec section 12): upstream writes no transcript. */
  noSessionPersistence?: boolean;
}

export function buildRunSpec(inputs: RunInputs, context: RunContext): RunSpec {
  const { settings, environment, state, runId } = context;
  const { timers } = settings;
  const runDir = path.join(state.runs, runId);
  const bridged = inputs.clientToolNames.length > 0;
  return {
    flags: runFlags({
      system: inputs.system, modelId: inputs.modelId, maxTurns: settings.maxTurns,
      allowedTools: inputs.clientToolNames.map(name => `${CLIENT_TOOL_PREFIX}${name}`),
      // The conductor writes the file into the run's directory once the control server has its token.
      ...(bridged ? { mcpConfig: path.join(runDir, MCP_CONFIG_FILE_NAME) } : {}),
      ...(inputs.effort === undefined ? {} : { effort: inputs.effort }),
      ...(inputs.jsonSchema === undefined ? {} : { jsonSchema: inputs.jsonSchema }),
      ...(inputs.resume === undefined ? {} : { resume: inputs.resume }),
      ...(inputs.noSessionPersistence ? { noSessionPersistence: true } : {})
    }),
    env: childEnvironment({ maxOutputTokens: inputs.maxTokens, thinking: inputs.thinking, settings, environment }),
    cwd: state.cwd,
    runDir: { path: runDir, files: {} },
    timers: { startup: timers.startupMs, stall: timers.stallMs, lifetime: timers.lifetimeMs }
  };
}
