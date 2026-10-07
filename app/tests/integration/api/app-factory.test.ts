import request from 'supertest';
import { once } from 'events';
import { AddressInfo } from 'net';
import defaultApp, { createServer, startServer } from '../../../src/api/server';
import { EnvironmentManager } from '../../../src/config/env';
import { SurfaceDeps } from '../../../src/anthropic/deps';
import { createFakeClock } from '../../mocks/shared/fake-clock';

function stubDeps(): Required<SurfaceDeps> {
  return {
    runner: { startRun: jest.fn() },
    catalogue: { resolve: jest.fn(), list: jest.fn() },
    sessions: { lookup: jest.fn(), record: jest.fn(), forget: jest.fn() },
    controlServer: { start: jest.fn(), registerRun: jest.fn(), releaseRun: jest.fn(), close: jest.fn() },
    clock: createFakeClock()
  };
}

describe('App factory', () => {
  it('builds an app with every dependency injected that serves the OpenAI surface as before', async () => {
    const deps = stubDeps();
    const app = createServer(deps);

    const health = await request(app).get('/health').expect(200);
    expect(health.body).toEqual(expect.objectContaining({ status: 'healthy', service: 'claude-wrapper' }));

    const models = await request(app).get('/v1/models').expect(200);
    expect(models.body.data.map((model: { id: string }) => model.id)).toEqual(['sonnet', 'opus']);
  });

  it('builds a fresh, independent app on each call', async () => {
    const first = createServer();
    const second = createServer();

    expect(first).not.toBe(second);

    first.get('/only-on-first', (_req, res) => {
      res.json({ ok: true });
    });

    await request(first).get('/only-on-first').expect(200);
    await request(second).get('/only-on-first').expect(404);
  });

  it('keeps the default export an app that serves the OpenAI surface', async () => {
    const health = await request(defaultApp).get('/health').expect(200);
    expect(health.body).toEqual(expect.objectContaining({ status: 'healthy', service: 'claude-wrapper' }));
  });

  it('starts a server listening on the configured port', async () => {
    const config = EnvironmentManager.getConfig();
    jest.spyOn(EnvironmentManager, 'getConfig').mockReturnValue({ ...config, port: 0 });

    const server = startServer();
    try {
      await once(server, 'listening');
      const { port } = server.address() as AddressInfo;
      await request(`http://127.0.0.1:${port}`).get('/health').expect(200);
    } finally {
      server.close();
    }
  });
});
