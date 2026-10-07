/**
 * The control server (spec section 16): one loopback HTTP listener per wrapper process, on
 * 127.0.0.1 and an ephemeral port, that each run registers with. A request reaches a run's
 * handler only on that run's path with that run's token; every other request, a wrong or missing
 * token included, gets the same 404 as a path that does not exist. Tokens are never logged.
 */
import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { AddressInfo } from 'net';
import { logger as defaultLogger } from '../../utils/logger';
import { readJsonBody } from './request-body';
import { matchRunPath, mintToken, presentsToken, RUN_ID_PATTERN, RunRoute } from './run-routes';
import { ControlServer, ControlServerLogger, RunHandlers, RunRegistration } from './types';

export interface ControlServerOptions {
  logger?: ControlServerLogger;
}

type RegisteredRun = { token: string; handlers: RunHandlers };

const plain = (res: ServerResponse, status: number, text: string): void => {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' }).end(text);
};

class LoopbackControlServer implements ControlServer {
  private readonly runs = new Map<string, RegisteredRun>();
  private readonly server: Server;
  private listening: Promise<{ baseUrl: string }> | undefined;
  private baseUrl: string | undefined;

  constructor(private readonly log: ControlServerLogger) {
    this.server = createServer((req, res) => { void this.handle(req, res); });
  }

  start(): Promise<{ baseUrl: string }> {
    this.listening ??= new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(0, '127.0.0.1', () => {
        const { port } = this.server.address() as AddressInfo;
        this.baseUrl = `http://127.0.0.1:${port}`;
        this.log.debug('Control server listening', { baseUrl: this.baseUrl });
        resolve({ baseUrl: this.baseUrl });
      });
    });
    return this.listening;
  }

  registerRun(id: string, handlers: RunHandlers): RunRegistration {
    if (this.baseUrl === undefined) throw new Error('control server not started');
    if (!RUN_ID_PATTERN.test(id)) throw new Error(`run id must match ${RUN_ID_PATTERN}`);
    if (this.runs.has(id)) throw new Error(`run ${id} is already registered`);
    const token = mintToken();
    this.runs.set(id, { token, handlers });
    return { mcpUrl: `${this.baseUrl}/runs/${id}/mcp`, hookUrl: `${this.baseUrl}/runs/${id}/hook`, token };
  }

  releaseRun(id: string): void {
    this.runs.delete(id);
  }

  close(): Promise<void> {
    this.runs.clear();
    if (!this.server.listening) return Promise.resolve();
    return new Promise(resolve => {
      this.server.close(() => resolve());
      this.server.closeAllConnections();
    });
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const route = matchRunPath(req.url);
    const run = route && this.runs.get(route.runId);
    if (!route || !run || !presentsToken(req, run.token) || !this.handlerFor(route, run)) {
      plain(res, 404, 'Not Found');
      return;
    }
    try {
      await this.dispatch(route, run.handlers, req, res);
    } catch (error) {
      this.log.warn('Control server handler failed', { runId: route.runId, endpoint: route.endpoint, error: String(error) });
      if (!res.headersSent) plain(res, 500, 'Internal Server Error');
      else res.end();
    }
  }

  private handlerFor(route: RunRoute, run: RegisteredRun): unknown {
    return route.endpoint === 'mcp' ? run.handlers.mcpHandler : run.handlers.hookHandler;
  }

  private async dispatch(route: RunRoute, handlers: RunHandlers, req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (route.endpoint === 'hook' && req.method !== 'POST') {
      plain(res, 405, 'Method Not Allowed');
      return;
    }
    const read = req.method === 'POST' ? await readJsonBody(req) : { ok: true as const, body: undefined };
    if (!read.ok) {
      plain(res, read.status, read.status === 413 ? 'Payload Too Large' : 'Bad Request');
      return;
    }
    this.log.debug('Control server request', { runId: route.runId, endpoint: route.endpoint, method: req.method });
    if (route.endpoint === 'mcp' && handlers.mcpHandler) {
      await handlers.mcpHandler(req, res, read.body);
    } else if (handlers.hookHandler) {
      const reply = await handlers.hookHandler(read.body);
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(reply ?? {}));
    }
  }
}

export function createControlServer(options: ControlServerOptions = {}): ControlServer {
  return new LoopbackControlServer(options.logger ?? defaultLogger);
}
