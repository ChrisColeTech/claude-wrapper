/**
 * The `mcp_toolset` entries in `tools` (spec section 9): each names one declared server
 * (`mcp_server_name`), every server is named by exactly one, as on the real API. A toolset's
 * `enabled` flags (`default_config` and per-tool `configs`) choose the server's tools, which the
 * run's `--allowedTools` must express: a tool the request disables is never allowed. `defer_loading`
 * is accepted and ignored (with `--tools ""` there is no tool search, so a deferred tool would be
 * unreachable). A pinned tool listing (`tools`, copied from an `mcp_tool_listing` block, which this
 * surface never emits) is a 400.
 */
import { connectorRule } from '../../upstream/connector-tools';
import { JsonObject, isObject } from '../../utils/json-object';
import { SurfaceError } from '../surface-error';
import { DeclaredServer, optionalBoolean } from './connector-servers';
import { fieldInvalid, fieldRequired } from './field-errors';

interface DeclaredToolset {
  /** The client's index in `tools`. */
  index: number;
  server: string;
  /** `default_config.enabled`: whether a tool no config names is enabled. */
  enabledByDefault: boolean;
  /** `configs[tool].enabled`, where given. */
  overrides: ReadonlyMap<string, boolean>;
}

const path = (index: number): string => `tools.${index}.mcp_toolset`;

function toolConfig(value: unknown, at: string): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isObject(value)) throw fieldInvalid(at, 'a valid dictionary');
  optionalBoolean(value['defer_loading'], `${at}.defer_loading`);
  return optionalBoolean(value['enabled'], `${at}.enabled`);
}

function overrides(configs: unknown, at: string): Map<string, boolean> {
  const enabled = new Map<string, boolean>();
  if (configs === undefined || configs === null) return enabled;
  if (!isObject(configs)) throw fieldInvalid(at, 'a valid dictionary');
  for (const [tool, config] of Object.entries(configs)) {
    const flag = toolConfig(config, `${at}.${tool}`);
    if (flag !== undefined) enabled.set(tool, flag);
  }
  return enabled;
}

function declaredToolset(toolset: JsonObject, index: number): DeclaredToolset {
  const server = toolset['mcp_server_name'];
  if (server === undefined || server === null) throw fieldRequired(`${path(index)}.mcp_server_name`);
  if (typeof server !== 'string') throw fieldInvalid(`${path(index)}.mcp_server_name`, 'a valid string');
  if (toolset['tools'] !== undefined && toolset['tools'] !== null) {
    throw SurfaceError.invalidRequest(`${path(index)}.tools: pinned tool listings are not supported on this surface`);
  }
  return {
    index, server,
    enabledByDefault: toolConfig(toolset['default_config'], `${path(index)}.default_config`) ?? true,
    overrides: overrides(toolset['configs'], `${path(index)}.configs`)
  };
}

/** The request's toolsets, each paired with its server: by server name. */
export function pairedToolsets(tools: unknown, servers: readonly DeclaredServer[]): Map<string, DeclaredToolset> {
  const paired = new Map<string, DeclaredToolset>();
  const names = new Set(servers.map(server => server.name));
  (Array.isArray(tools) ? tools : []).forEach((tool: unknown, index) => {
    if (!isObject(tool) || tool['type'] !== 'mcp_toolset') return;
    const toolset = declaredToolset(tool, index);
    if (!names.has(toolset.server)) {
      throw SurfaceError.invalidRequest(`${path(index)}.mcp_server_name: no server named "${toolset.server}" in mcp_servers`);
    }
    if (paired.has(toolset.server)) {
      throw SurfaceError.invalidRequest(`${path(index)}: server "${toolset.server}" already has an mcp_toolset; each server takes exactly one`);
    }
    paired.set(toolset.server, toolset);
  });
  const unreferenced = servers.find(server => !paired.has(server.name));
  if (unreferenced) {
    throw SurfaceError.invalidRequest(
      `mcp_servers.${unreferenced.index}: server "${unreferenced.name}" has no mcp_toolset in tools; each server takes exactly one`);
  }
  return paired;
}

/** The tools enabled by default that a config disables, which only an allowed-tools list can leave out. */
function disabledByConfig(server: DeclaredServer, toolset: DeclaredToolset): string[] {
  if (!toolset.enabledByDefault) return [];
  const disabled = [...toolset.overrides].filter(([, enabled]) => !enabled).map(([tool]) => tool);
  const [first] = disabled;
  if (first !== undefined && server.allowedTools === null) {
    throw SurfaceError.invalidRequest(`${path(toolset.index)}.configs.${first}.enabled: false is supported on this surface only beside `
      + `mcp_servers.${server.index}.tool_configuration.allowed_tools`);
  }
  return disabled;
}

/**
 * The `--allowedTools` rules for `server`'s enabled tools: `mcp__<name>` for every tool, else one
 * rule per tool. None: the server is not mounted.
 */
export function allowRules(server: DeclaredServer, toolset: DeclaredToolset): string[] {
  const disabled = disabledByConfig(server, toolset);
  if (!server.enabled) return [];
  const listed = toolset.enabledByDefault
    ? server.allowedTools?.filter(tool => !disabled.includes(tool))
    : [...toolset.overrides].filter(([tool, enabled]) => enabled && (server.allowedTools ?? [tool]).includes(tool)).map(([tool]) => tool);
  return listed === undefined ? [connectorRule(server.name)] : listed.map(tool => connectorRule(server.name, tool));
}
