/**
 * The startup checks on `system/init` (spec sections 3, 9 and 10): upstream must run the canonical
 * model, every mounted connector must read `connected`, and upstream must expose exactly the
 * expected tools, else the turn fails before commit. A model or tool mismatch is the operator's
 * environment (a model-switching variable, a stray tool), so retrying cannot help: a 500. A
 * connector that did not connect is the client's server (down, unreachable, wanting auth): a 400
 * naming it, its status and upstream's error text. A connector's tools are known only to its
 * server, so any tool named under a mounted connector is expected.
 */
import { connectorToolPrefix } from '../../upstream/connector-tools';
import { SystemInitFrame } from '../../upstream/frames';
import { SurfaceError } from '../surface-error';
import { StartupChecks } from '../request';

const operatorSide = (message: string): SurfaceError =>
  SurfaceError.of('api_error', message, { retryable: false });

const listed = (names: string[]): string => (names.length > 0 ? names.join(', ') : 'none');

function connectorError(init: SystemInitFrame, connectors: readonly string[]): SurfaceError | null {
  const statuses = Array.isArray(init.mcp_servers) ? init.mcp_servers : [];
  for (const name of connectors) {
    const status = statuses.find(server => server.name === name)?.status;
    if (status === 'connected') continue;
    const reported = (init.mcp_server_errors ?? []).filter(error => error.name === name)
      .map(error => `: ${error.type}: ${error.message}`).join('');
    const state = status === undefined ? 'not listed by upstream' : `status "${status}"`;
    return SurfaceError.invalidRequest(`mcp_servers: the MCP server "${name}" is not connected (${state})${reported}`);
  }
  return null;
}

export function startupError(init: SystemInitFrame, checks: StartupChecks): SurfaceError | null {
  if (init.model !== checks.model) {
    return operatorSide(`upstream started model ${init.model} instead of ${checks.model}`);
  }
  const notConnected = connectorError(init, checks.connectors);
  if (notConnected) return notConnected;
  const prefixes = checks.connectors.map(connectorToolPrefix);
  const tools = Array.isArray(init.tools) ? init.tools : [];
  const unexpected = tools.filter(tool => !checks.tools.includes(tool) && !prefixes.some(prefix => tool.startsWith(prefix)));
  const missing = checks.tools.filter(tool => !tools.includes(tool));
  if (unexpected.length > 0 || missing.length > 0) {
    return operatorSide(`upstream's tools differ from the turn's: unexpected ${listed(unexpected)}; missing ${listed(missing)}`);
  }
  return null;
}
