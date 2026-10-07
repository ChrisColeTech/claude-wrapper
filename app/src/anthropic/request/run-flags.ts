/**
 * The argument list of a run (spec section 10), in the table's order. Never passed: the flags the
 * spec rules out (`--fallback-model`, `--max-budget-usd`, `--append-system-prompt`, `--bare`,
 * `--dangerously-skip-permissions`, `--exclude-dynamic-system-prompt-sections`), and the
 * conditional ones (`--settings`, `--effort`, `--json-schema`, `--no-session-persistence`) until
 * a turn needs them. `--mcp-config` is a turn's that mounts the bridge server, `--resume` a
 * continued turn's.
 */

export interface FlagInputs {
  /** The upstream system prompt: exactly the client's, or ''. */
  system: string;
  /** The catalogue's canonical id, never the client's alias. */
  modelId: string;
  maxTurns: number;
  /** Exactly the enabled tools, each client tool as `mcp__client__<name>`; none: `""`. */
  allowedTools: readonly string[];
  /** The run's MCP config file, when the turn mounts the bridge server. */
  mcpConfig?: string;
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
    // No built-in tools; only the bridge server's tools allowed, if any.
    '--tools', '',
    '--allowedTools', inputs.allowedTools.join(','),
    '--permission-mode', 'default', '--permission-prompts', 'none',
    ...(inputs.mcpConfig === undefined ? [] : ['--mcp-config', inputs.mcpConfig]),
    '--max-turns', String(inputs.maxTurns),
    ...(inputs.resume === undefined ? [] : ['--resume', inputs.resume])
  ];
}
