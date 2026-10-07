/**
 * How upstream names a connector's tools (spec section 9): every tool of an MCP server it loads is
 * `mcp__<server>__<tool>`, and it reads a name back by splitting on `__` (the server is the second
 * part, the tool everything after it). Under `--strict-mcp-config` the only MCP servers a run
 * loads are the bridge server (`client`) and the request's connectors, so any other `mcp__` name
 * is a connector's.
 */
import { CLIENT_TOOL_PREFIX } from './bridge';

const MCP_PREFIX = 'mcp__';
const SEPARATOR = '__';

/** The prefix of every tool of connector `server`; also its `--allowedTools` rule for the whole server, less the `__`. */
export const connectorToolPrefix = (server: string): string => `${MCP_PREFIX}${server}${SEPARATOR}`;

/** A tool name upstream gives a connector's tool. */
export const isConnectorTool = (name: unknown): name is string =>
  typeof name === 'string' && name.startsWith(MCP_PREFIX) && !name.startsWith(CLIENT_TOOL_PREFIX);

/** `mcp__<server>__<tool>` read back as upstream reads it. */
export function splitConnectorTool(name: string): { server: string; tool: string } {
  const [, server = '', ...tool] = name.split(SEPARATOR);
  return { server, tool: tool.join(SEPARATOR) };
}
