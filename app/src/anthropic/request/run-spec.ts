/**
 * A turn's run spec (spec section 10): the argument list, the child environment, the fixed
 * working directory, the run's private directory and the operator's timers.
 */
import * as path from 'path';
import { CLIENT_TOOL_PREFIX } from '../../upstream/bridge';
import { WebTool } from '../../upstream/hook-policy';
import { HOOK_SETTINGS_FILE_NAME } from '../../upstream/hook-settings';
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
  /** The built-in web tools the run enables, in `--tools` order; none: no hook. */
  webTools: readonly WebTool[];
  /** The `--allowedTools` rules of the connectors the run mounts; none: no connector. */
  connectorRules: readonly string[];
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

/** The permission rule that admits each built-in; the hook enforces the request's limits on top. */
const ALLOW_RULES: Readonly<Record<WebTool, string>> = { WebSearch: 'WebSearch', WebFetch: 'WebFetch(domain:*)' };

export function buildRunSpec(inputs: RunInputs, context: RunContext): RunSpec {
  const { settings, environment, state, runId } = context;
  const { timers } = settings;
  const runDir = path.join(state.runs, runId);
  // The bridge server and the connectors share the run's one MCP config file.
  const mcpServers = inputs.clientToolNames.length > 0 || inputs.connectorRules.length > 0;
  const hooked = inputs.webTools.length > 0;
  return {
    flags: runFlags({
      system: inputs.system, modelId: inputs.modelId, maxTurns: settings.maxTurns,
      tools: inputs.webTools,
      allowedTools: [
        ...inputs.clientToolNames.map(name => `${CLIENT_TOOL_PREFIX}${name}`),
        ...inputs.connectorRules,
        ...inputs.webTools.map(tool => ALLOW_RULES[tool])
      ],
      // The conductor writes these files into the run's directory once the control server has its token.
      ...(mcpServers ? { mcpConfig: path.join(runDir, MCP_CONFIG_FILE_NAME) } : {}),
      ...(hooked ? { settings: path.join(runDir, HOOK_SETTINGS_FILE_NAME) } : {}),
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
