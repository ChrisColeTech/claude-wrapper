/**
 * Connectors (spec section 9): a beta client's `mcp_servers`, each with its `mcp_toolset`, reach
 * upstream as remote MCP servers beside the bridge server. In order, every rule before any spawn:
 * the beta gate (without `anthropic-beta: mcp-client-2025-11-20` either field is an extra input, as
 * on the real API); the operator's host list (empty: connectors are off; a 400 naming the setting,
 * because upstream connects from the operator's machine); the servers and toolsets as the real API
 * validates them; then each server's host against the list. Each enabled server becomes one `http`
 * entry for the run's MCP config file (its token as the Bearer header, `alwaysLoad`, the connector
 * call timeout) and `--allowedTools` rules for its enabled tools. `tool_choice: none` mounts none,
 * though they are validated all the same.
 */
import { AnthropicSettings, ANTHROPIC_SETTING_ENV } from '../../config/anthropic-settings';
import { connectorServerEntry, McpHttpServerEntry } from '../../upstream/mcp-config';
import { JsonObject, isObject } from '../../utils/json-object';
import { SurfaceError } from '../surface-error';
import { DeclaredServer, declaredServers } from './connector-servers';
import { allowRules, pairedToolsets } from './connector-toolsets';
import { extraInputs } from './validate-extra-fields';

/** The `anthropic-beta` value that unlocks `mcp_servers` and `mcp_toolset`. */
export const MCP_CLIENT_BETA = 'mcp-client-2025-11-20';

export interface ConnectorPlan {
  /** Each mounted server's entry in the run's MCP config file, by name. */
  entries: Record<string, McpHttpServerEntry>;
  /** `--allowedTools` rules for the mounted servers' enabled tools, in the servers' order. */
  allowRules: string[];
  /** The mounted servers, each of which `system/init` must report `connected`. */
  names: string[];
}

const NO_CONNECTORS: ConnectorPlan = { entries: {}, allowRules: [], names: [] };

const HOSTS = ANTHROPIC_SETTING_ENV.connectorHosts;

const toolsetIndices = (tools: unknown): number[] => (Array.isArray(tools) ? tools : [])
  .flatMap((tool: unknown, index) => (isObject(tool) && tool['type'] === 'mcp_toolset' ? [index] : []));

function checkHost(server: DeclaredServer, hosts: readonly string[]): void {
  if (!hosts.some(host => host === '*' || server.hosts.includes(host.toLowerCase()))) {
    throw SurfaceError.invalidRequest(`mcp_servers.${server.index}.url: host "${server.hosts[0]}" is not in this surface's `
      + `connector host list; the wrapper's operator allows it in ${HOSTS}`);
  }
}

/** What the request asks of connectors; `betas` are its `anthropic-beta` values. */
export function connectors(request: JsonObject, settings: AnthropicSettings, betas: readonly string[]): ConnectorPlan {
  const declared = request['mcp_servers'] !== undefined && request['mcp_servers'] !== null;
  const toolsets = toolsetIndices(request['tools']);
  if (!declared && toolsets.length === 0) return NO_CONNECTORS;
  if (!betas.includes(MCP_CLIENT_BETA)) throw extraInputs(declared ? 'mcp_servers' : `tools.${toolsets[0]}.mcp_toolset`);
  if (toolsets.length === 0 && Array.isArray(request['mcp_servers']) && request['mcp_servers'].length === 0) return NO_CONNECTORS;
  if (settings.connectorHosts.length === 0) {
    throw SurfaceError.invalidRequest(`mcp_servers: connectors are off on this surface; the wrapper's operator turns them on by `
      + `listing the hosts they may reach in ${HOSTS}`);
  }
  const servers = declared ? declaredServers(request['mcp_servers']) : [];
  const paired = pairedToolsets(request['tools'], servers);
  servers.forEach(server => checkHost(server, settings.connectorHosts));
  const mounted = servers.map(server => ({ server, rules: allowRules(server, paired.get(server.name)!) }))
    .filter(({ rules }) => rules.length > 0);
  const choice = request['tool_choice'];
  if (isObject(choice) && choice['type'] === 'none') return NO_CONNECTORS;
  return {
    entries: Object.fromEntries(mounted.map(({ server }) =>
      [server.name, connectorServerEntry({ url: server.url, token: server.token }, settings.connectorCallTimeoutMs)])),
    allowRules: mounted.flatMap(({ rules }) => rules),
    names: mounted.map(({ server }) => server.name)
  };
}
