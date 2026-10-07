/**
 * The control server's interface (spec section 16): the loopback listener an upstream run calls
 * back into, carrying each run's bridge server (`/runs/<id>/mcp`) and hook endpoint
 * (`/runs/<id>/hook`), each answering only to the run's token.
 */
import { IncomingMessage, ServerResponse } from 'http';

/**
 * Serves a run's bridge server over Streamable HTTP. A POST's JSON body arrives parsed
 * (`undefined` when empty); the handler writes the response itself.
 */
export type McpHttpHandler = (req: IncomingMessage, res: ServerResponse, body: unknown) => Promise<void>;

/** Applies a run's hook policy: the hook client's JSON in, the reply it prints out. */
export type HookHandler = (input: unknown) => Promise<unknown>;

/** A run registers the endpoints its turn needs; an endpoint without a handler is a 404. */
export interface RunHandlers {
  mcpHandler?: McpHttpHandler;
  hookHandler?: HookHandler;
}

/**
 * Where the run's upstream reaches its endpoints. The token goes only into the run's `0600`
 * files (`Authorization: Bearer <token>`), never into argv, the environment or a log line.
 */
export interface RunRegistration {
  mcpUrl: string;
  hookUrl: string;
  token: string;
}

export interface ControlServer {
  /** Listens on 127.0.0.1 on an ephemeral port; later calls return the same address. */
  start(): Promise<{ baseUrl: string }>;
  /**
   * Mounts a run's endpoints under a fresh random token. Throws before `start()` has resolved,
   * for an id already registered, and for an id outside `[A-Za-z0-9_-]{1,128}`.
   */
  registerRun(id: string, handlers: RunHandlers): RunRegistration;
  /** Unmounts the run: its paths answer 404 from now on, its token included. Unknown ids are ignored. */
  releaseRun(id: string): void;
  /** Stops listening and drops every open connection; for wrapper shutdown and tests. */
  close(): Promise<void>;
}

