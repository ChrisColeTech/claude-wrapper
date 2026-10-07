/**
 * The argument list of a run (spec section 10), in the table's order. Never passed: the flags the
 * spec rules out (`--fallback-model`, `--max-budget-usd`, `--append-system-prompt`, `--bare`,
 * `--dangerously-skip-permissions`, `--exclude-dynamic-system-prompt-sections`), and the
 * conditional ones (`--json-schema`, `--no-session-persistence`) until a turn needs them.
 * `--tools` names exactly the built-ins the declared server tools need; `--mcp-config` is a turn's
 * that mounts the bridge server, `--settings` one's that enables a built-in (its hook), `--effort`
 * the request's `output_config.effort`; `--resume` is a continued turn's.
 */

export interface FlagInputs {
  /** The upstream system prompt: exactly the client's, or ''. */
  system: string;
  /** The catalogue's canonical id, never the client's alias. */
  modelId: string;
  maxTurns: number;
  /** The built-in tools the run enables (`WebSearch`, `WebFetch`); none: `""`. */
  tools: readonly string[];
  /** Exactly the enabled tools, each client tool as `mcp__client__<name>`, then the built-ins' rules; none: `""`. */
  allowedTools: readonly string[];
  /** The run's MCP config file, when the turn mounts the bridge server. */
  mcpConfig?: string;
  /** The run's settings file, holding the `PreToolUse` hook, when the turn enables a built-in. */
  settings?: string;
  /** `output_config.effort`, validated against the catalogue entry. */
  effort?: string;
  /** A continued turn's upstream session. */
  resume?: string;
}

const STREAM_JSON = [
  '-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--include-partial-messages'
];

export function runFlags(inputs: FlagInputs): string[] {
  return [
    ...STREAM_JSON,
    '--system-prompt', inputs.system,
    '--system-prompt-snapshot', 'off',
    '--setting-sources=', '--strict-mcp-config',
    '--model', inputs.modelId,
    // No host-side built-in: only the web tools a declared server tool needs, if any.
    '--tools', inputs.tools.join(','),
    '--allowedTools', inputs.allowedTools.join(','),
    '--permission-mode', 'default', '--permission-prompts', 'none',
    ...(inputs.mcpConfig === undefined ? [] : ['--mcp-config', inputs.mcpConfig]),
    ...(inputs.settings === undefined ? [] : ['--settings', inputs.settings]),
    '--max-turns', String(inputs.maxTurns),
    ...(inputs.effort === undefined ? [] : ['--effort', inputs.effort]),
    ...(inputs.resume === undefined ? [] : ['--resume', inputs.resume])
  ];
}
