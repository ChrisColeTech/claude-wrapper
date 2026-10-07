/**
 * How upstream names a connector's tools (spec section 9): every tool of an MCP server it loads is
 * `mcp__<server>__<tool>`, and it reads a name back by splitting on `__` (the server is the second
 * part, the tool everything after it). Under `--strict-mcp-config` the only MCP servers a run
 * loads are the bridge server (`client`) and the request's connectors, so any other `mcp__` name
 * is a connector's. Upstream writes a tool's name with every character outside letters, digits,
 * `_` and `-` as `_`; a permission rule must name the tool that way.
 */
import { CLIENT_TOOL_PREFIX } from './bridge';

const MCP_PREFIX = 'mcp__';
const SEPARATOR = '__';

/** The prefix of every tool of connector `server`. */
export const connectorToolPrefix = (server: string): string => `${MCP_PREFIX}${server}${SEPARATOR}`;

/** A connector tool's name as upstream writes it in `mcp__<server>__<tool>`. */
const upstreamToolName = (tool: string): string => tool.replace(/[^a-zA-Z0-9_-]/g, '_');

/** The `--allowedTools` rule for every tool of `server` (`mcp__<server>`), or for its tool `tool`. */
export const connectorRule = (server: string, tool?: string): string =>
  (tool === undefined ? `${MCP_PREFIX}${server}` : `${connectorToolPrefix(server)}${upstreamToolName(tool)}`);

/** A tool name upstream gives a connector's tool. */
export const isConnectorTool = (name: unknown): name is string =>
  typeof name === 'string' && name.startsWith(MCP_PREFIX) && !name.startsWith(CLIENT_TOOL_PREFIX);

/** `mcp__<server>__<tool>` read back as upstream reads it. */
export function splitConnectorTool(name: string): { server: string; tool: string } {
  const [, server = '', ...tool] = name.split(SEPARATOR);
  return { server, tool: tool.join(SEPARATOR) };
}
