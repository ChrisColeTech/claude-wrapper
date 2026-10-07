/**
 * The control server (spec section 16): one loopback HTTP listener per wrapper process that
 * each run registers with. A run's `/runs/<id>/mcp` and `/runs/<id>/hook` answer only to that
 * run's token; anything else is the same 404 as a path that does not exist.
 */
import request from 'supertest';
import { IncomingMessage, ServerResponse } from 'http';
import { ControlServer, createControlServer } from '../../../src/upstream/control-server';

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('control server', () => {
  let server: ControlServer;
  let logged: unknown[];

  beforeEach(() => {
    logged = [];
    const record = (message: string, context?: unknown) => { logged.push({ message, context }); };
    server = createControlServer({ logger: { debug: record, warn: record } });
  });

  afterEach(async () => {
    await server.close();
  });

  it('listens on 127.0.0.1 on an ephemeral port, once', async () => {
    const { baseUrl } = await server.start();

    expect(baseUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(baseUrl).not.toBe('http://127.0.0.1:0');
    await expect(server.start()).resolves.toEqual({ baseUrl });
  });

  it('gives each run its own endpoints and random token', async () => {
    const { baseUrl } = await server.start();

    const first = server.registerRun('run-1', {});
    const second = server.registerRun('run-2', {});

    expect(first).toEqual({ mcpUrl: `${baseUrl}/runs/run-1/mcp`, hookUrl: `${baseUrl}/runs/run-1/hook`, token: expect.any(String) });
    expect(first.token).toMatch(/^[A-Za-z0-9_-]{43,}$/);
    expect(second.token).not.toBe(first.token);
  });

  it("passes a hook call with the run's token to the run's hook handler and returns its reply", async () => {
    const { baseUrl } = await server.start();
    const hookHandler = jest.fn(async (input: unknown) => ({ echoed: input }));
    const { token } = server.registerRun('run-1', { hookHandler });

    const response = await request(baseUrl).post('/runs/run-1/hook').set(bearer(token)).send({ tool_name: 'WebSearch' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ echoed: { tool_name: 'WebSearch' } });
  });

  it('passes an MCP request with the token to the run’s MCP handler, a POST body parsed', async () => {
    const { baseUrl } = await server.start();
    const seen: { method?: string; body: unknown }[] = [];
    const mcpHandler = async (req: IncomingMessage, res: ServerResponse, body: unknown) => {
      seen.push({ ...(req.method ? { method: req.method } : {}), body });
      res.writeHead(202).end();
    };
    const { token } = server.registerRun('run-1', { mcpHandler });

    await request(baseUrl).post('/runs/run-1/mcp').set(bearer(token)).send({ jsonrpc: '2.0', method: 'tools/list', id: 1 }).expect(202);
    await request(baseUrl).get('/runs/run-1/mcp').set(bearer(token)).expect(202);

    expect(seen).toEqual([
      { method: 'POST', body: { jsonrpc: '2.0', method: 'tools/list', id: 1 } },
      { method: 'GET', body: undefined }
    ]);
  });

  it('answers a wrong, missing or other run’s token exactly as a path that does not exist: 404', async () => {
    const { baseUrl } = await server.start();
    const hookHandler = jest.fn(async () => ({}));
    server.registerRun('run-1', { hookHandler, mcpHandler: jest.fn() });
    const other = server.registerRun('run-2', { hookHandler });

    const nowhere = await request(baseUrl).post('/runs/run-9/hook').set(bearer(other.token)).send({});
    const attempts = [
      request(baseUrl).post('/runs/run-1/hook').send({}),
      request(baseUrl).post('/runs/run-1/hook').set(bearer('not-the-token')).send({}),
      request(baseUrl).post('/runs/run-1/hook').set(bearer(other.token)).send({}),
      request(baseUrl).post('/runs/run-1/mcp').set(bearer(other.token)).send({}),
      request(baseUrl).get('/elsewhere')
    ];

    expect(nowhere.status).toBe(404);
    for (const response of await Promise.all(attempts)) {
      expect({ status: response.status, body: response.text }).toEqual({ status: 404, body: nowhere.text });
    }
    expect(hookHandler).not.toHaveBeenCalled();
  });

  it('answers 404 for a released run, even with its token', async () => {
    const { baseUrl } = await server.start();
    const hookHandler = jest.fn(async () => ({}));
    const { token } = server.registerRun('run-1', { hookHandler });

    server.releaseRun('run-1');

    await request(baseUrl).post('/runs/run-1/hook').set(bearer(token)).send({}).expect(404);
    expect(hookHandler).not.toHaveBeenCalled();
  });

  it('answers 404 on an endpoint the run registered no handler for', async () => {
    const { baseUrl } = await server.start();
    const { token } = server.registerRun('run-1', { hookHandler: async () => ({}) });

    await request(baseUrl).post('/runs/run-1/mcp').set(bearer(token)).send({}).expect(404);
  });

  it('answers 400 to a body that is not JSON and 500 when a handler fails', async () => {
    const { baseUrl } = await server.start();
    const { token } = server.registerRun('run-1', { hookHandler: async () => { throw new Error('policy failed'); } });

    await request(baseUrl).post('/runs/run-1/hook').set(bearer(token)).set('content-type', 'application/json').send('{not json').expect(400);
    await request(baseUrl).post('/runs/run-1/hook').set(bearer(token)).send({}).expect(500);
  });

  it('refuses to register before it has started, the same id twice, or an id unfit for a path', async () => {
    expect(() => server.registerRun('run-1', {})).toThrow('control server not started');
    await server.start();
    server.registerRun('run-1', {});

    expect(() => server.registerRun('run-1', {})).toThrow('run run-1 is already registered');
    expect(() => server.registerRun('../run', {})).toThrow('run id must match');
  });

  it('never logs a token', async () => {
    const { baseUrl } = await server.start();
    const { token } = server.registerRun('run-1', { hookHandler: async () => { throw new Error('policy failed'); } });

    await request(baseUrl).post('/runs/run-1/hook').set(bearer(token)).send({}).expect(500);
    await request(baseUrl).post('/runs/run-1/hook').set(bearer(`${token}x`)).send({}).expect(404);

    expect(logged.length).toBeGreaterThan(0);
    expect(JSON.stringify(logged)).not.toContain(token);
  });

  it('stops listening on close', async () => {
    const { baseUrl } = await server.start();

    await server.close();

    await expect(request(baseUrl).get('/runs/run-1/hook')).rejects.toThrow(/ECONNREFUSED/);
  });
});
