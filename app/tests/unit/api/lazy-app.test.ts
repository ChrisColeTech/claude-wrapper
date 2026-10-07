import express from 'express';
import request from 'supertest';
import { AddressInfo } from 'net';
import { lazyApp } from '../../../src/api/lazy-app';

function buildHelloApp() {
  const app = express();
  app.get('/hello', (_req, res) => {
    res.json({ hello: 'world' });
  });
  return app;
}

describe('Lazy app', () => {
  it('builds nothing until the app is first used', () => {
    const build = jest.fn(buildHelloApp);

    lazyApp(build);

    expect(build).not.toHaveBeenCalled();
  });

  it('builds once and serves requests as the built app', async () => {
    const build = jest.fn(buildHelloApp);
    const app = lazyApp(build);

    await request(app).get('/hello').expect(200, { hello: 'world' });
    await request(app).get('/hello').expect(200);

    expect(build).toHaveBeenCalledTimes(1);
  });

  it('listens like the built app', async () => {
    const app = lazyApp(buildHelloApp);
    const server = app.listen(0, '127.0.0.1');

    try {
      await new Promise(resolve => server.once('listening', resolve));
      const { port } = server.address() as AddressInfo;
      await request(`http://127.0.0.1:${port}`).get('/hello').expect(200, { hello: 'world' });
    } finally {
      server.close();
    }
  });
});
