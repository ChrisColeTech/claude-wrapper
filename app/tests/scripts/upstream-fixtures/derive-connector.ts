/**
 * Connector fixtures derived from bridge recordings, until e2e scenario 9 records a real connector
 * run (spec section 9). Upstream reports a call to any MCP server it executes the same way: a
 * `tool_use` block named `mcp__<server>__<tool>`, then a `user` frame carrying its `tool_result`.
 * A bridge run whose server answered (at once, or after a pause) is therefore a connector run once
 * its server is renamed: every `mcp__<from>__` becomes `mcp__<to>__`, and `system/init` and the
 * `assistant` frames' tool metadata name the server `<to>`. Only upstream's stdio is kept (stdin,
 * stdout, the exit): the wrapper never sees a connector's own MCP traffic, and the harness's side
 * lines name the old server. Every other byte of a kept frame is upstream's; lines are written in
 * `JSON.stringify` form, as recorded.
 */

export interface ConnectorDerivation {
  /** The bridge recording, relative to `tests/fixtures/upstream/`. */
  readonly source: string;
  /** The derived fixture, relative to the same directory. */
  readonly target: string;
  /** The MCP server's name in the source. */
  readonly from: string;
  /** The connector's name in the derived fixture. */
  readonly to: string;
}

export const CONNECTOR_DERIVATIONS: readonly ConnectorDerivation[] = [
  // One call whose server answered after three seconds, then an answer quoting its result.
  { source: 'spike-runs/cli-http-happy.wire.ndjson', target: 'derived/connector-weather.wire.ndjson', from: 'spike', to: 'weather' },
  // Six calls in one message, each answered at once, so most results arrive while the message still streams.
  { source: 'cli-probes/q-tool-names-run2.wire.ndjson', target: 'derived/connector-labels.wire.ndjson', from: 'client', to: 'labels' }
];

const KEPT = new Set(['host->cli', 'cli->host', 'proc']);

type WireEntry = { t_ms: number; dir: string; frame?: unknown };
type ServerStatus = { name?: unknown };

function renamedFrame(frame: string, { from, to }: ConnectorDerivation): string {
  const renamed = frame.split(`mcp__${from}__`).join(`mcp__${to}__`)
    .split(`"server_display_name":"${from}"`).join(`"server_display_name":"${to}"`);
  if (!renamed.startsWith('{"type":"system","subtype":"init"')) return renamed;
  const init = JSON.parse(renamed) as { mcp_servers?: ServerStatus[] };
  init.mcp_servers = (init.mcp_servers ?? []).map(server => (server.name === from ? { ...server, name: to } : server));
  return JSON.stringify(init);
}

/** The derived recording's text: one wire entry per line, as the source's. */
export function deriveConnectorRecording(source: string, derivation: ConnectorDerivation): string {
  return source.split('\n').filter(line => line.trim() !== '')
    .map(line => JSON.parse(line) as WireEntry)
    .filter(entry => KEPT.has(entry.dir))
    .map(entry => JSON.stringify(typeof entry.frame === 'string' ? { ...entry, frame: renamedFrame(entry.frame, derivation) } : entry))
    .join('\n') + '\n';
}
