/**
 * A connector's `authorization_token` is a client's secret (spec section 9): it reaches upstream
 * only in the run's `0600` MCP config file and must stay out of every log line. The wrapper's
 * debug request log prints the whole parsed body, so as soon as a body is parsed each server's
 * token is made a non-enumerable property: the planner still reads it by name, but
 * `JSON.stringify`, `util.inspect` (what the console prints), `Object.keys` and spreading all
 * leave it out. Nothing else in the body changes.
 */
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function hideConnectorTokens(body: unknown): void {
  const servers = isObject(body) ? body['mcp_servers'] : undefined;
  if (!Array.isArray(servers)) return;
  for (const server of servers) {
    if (!isObject(server) || !Object.hasOwn(server, 'authorization_token')) continue;
    Object.defineProperty(server, 'authorization_token', {
      value: server['authorization_token'], enumerable: false, writable: true, configurable: true
    });
  }
}
