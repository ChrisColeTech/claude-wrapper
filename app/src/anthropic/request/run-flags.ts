/**
 * The argument list of a run (spec section 10), in the table's order. Never passed: the flags the
 * spec rules out (`--fallback-model`, `--max-budget-usd`, `--append-system-prompt`, `--bare`,
 * `--dangerously-skip-permissions`, `--exclude-dynamic-system-prompt-sections`), and the
 * conditional ones until a turn needs them. `--tools` names exactly the built-ins the declared
 * server tools need; `--mcp-config` is a turn's that mounts the bridge server or a connector,
 * `--settings` one's that enables a built-in (its hook), `--effort` the request's
 * `output_config.effort`, `--json-schema` its `output_config.format.schema`; `--resume` is a
 * continued turn's, `--no-session-persistence` a `count_tokens` run's.
 */

export interface FlagInputs {
  /**
   * The run's file holding the upstream system prompt (exactly the client's, or ''): one argument
   * could not carry a prompt over 128 KiB, and would show it to every local user.
   */
  systemPromptFile: string;
  /** The catalogue's canonical id, never the client's alias. */
  modelId: string;
  maxTurns: number;
  /** The built-in tools the run enables (`WebSearch`, `WebFetch`); none: `""`. */
  tools: readonly string[];
  /**
   * Exactly the enabled tools: each client tool as `mcp__client__<name>`, each connector's rules
   * (`mcp__<name>` or `mcp__<name>__<tool>`), then the built-ins' rules; none: `""`.
   */
  allowedTools: readonly string[];
  /** The run's MCP config file, when the turn mounts the bridge server or a connector. */
  mcpConfig?: string;
  /** The run's settings file, holding the `PreToolUse` hook, when the turn enables a built-in. */
  settings?: string;
  /** `output_config.effort`, validated against the catalogue entry. */
  effort?: string;
  /** `output_config.format.schema` as JSON text, passed verbatim. */
  jsonSchema?: string;
  /** A continued turn's upstream session. */
  resume?: string;
  /** A `count_tokens` run: upstream writes no transcript. */
  noSessionPersistence?: boolean;
}

const STREAM_JSON = [
  '-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--include-partial-messages'
];

export function runFlags(inputs: FlagInputs): string[] {
  return [
    ...STREAM_JSON,
    '--system-prompt-file', inputs.systemPromptFile,
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
    ...(inputs.jsonSchema === undefined ? [] : ['--json-schema', inputs.jsonSchema]),
    ...(inputs.resume === undefined ? [] : ['--resume', inputs.resume]),
    ...(inputs.noSessionPersistence ? ['--no-session-persistence'] : [])
  ];
}
