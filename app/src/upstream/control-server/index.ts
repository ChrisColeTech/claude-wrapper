/**
 * The control server (spec section 16): `start() → {baseUrl}`, `registerRun(id, handlers) →
 * {mcpUrl, hookUrl, token}`, `releaseRun(id)`, and `close()` for shutdown.
 */
export type { ControlServer, HookHandler, McpHttpHandler, RunHandlers, RunRegistration } from './types';
export { createControlServer } from './control-server';
export type { ControlServerOptions } from './control-server';
