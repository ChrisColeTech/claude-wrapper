/**
 * The argument list of a run (spec section 10), in the table's order. Never passed: the flags the
 * spec rules out (`--fallback-model`, `--max-budget-usd`, `--append-system-prompt`, `--bare`,
 * `--dangerously-skip-permissions`, `--exclude-dynamic-system-prompt-sections`), and the
 * conditional ones (`--mcp-config`, `--settings`, `--no-session-persistence`) until a turn needs
 * them. `--effort` is the request's `output_config.effort`, `--json-schema` its
 * `output_config.format.schema`; `--resume` is a continued turn's.
 */

export interface FlagInputs {
  /** The upstream system prompt: exactly the client's, or ''. */
  system: string;
  /** The catalogue's canonical id, never the client's alias. */
  modelId: string;
  maxTurns: number;
  /** `output_config.effort`, validated against the catalogue entry. */
  effort?: string;
  /** `output_config.format.schema` as JSON text, passed verbatim. */
  jsonSchema?: string;
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
    // No built-in tools and nothing allowed: a text turn's run can only answer.
    '--tools', '',
    '--allowedTools', '',
    '--permission-mode', 'default', '--permission-prompts', 'none',
    '--max-turns', String(inputs.maxTurns),
    ...(inputs.effort === undefined ? [] : ['--effort', inputs.effort]),
    ...(inputs.jsonSchema === undefined ? [] : ['--json-schema', inputs.jsonSchema]),
    ...(inputs.resume === undefined ? [] : ['--resume', inputs.resume])
  ];
}
