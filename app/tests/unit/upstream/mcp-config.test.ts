/**
 * The per-run MCP config file (spec section 10, per-run files): written `0600` into the run's
 * directory before spawn and removed at teardown, holding the bridge server's `http` entry with
 * the control-server token, so the token reaches upstream through the file alone.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BRIDGE_SERVER_NAME } from '../../../src/upstream/bridge';
import { bridgeServerEntry, writeMcpConfigFile } from '../../../src/upstream/mcp-config';

const ENDPOINT = { url: 'http://127.0.0.1:43210/runs/run-1/mcp', token: 'tok_3f9a' };

describe('per-run MCP config file', () => {
  let runDir: string;

  beforeEach(() => {
    runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-config-'));
  });

  afterEach(() => {
    fs.rmSync(runDir, { recursive: true, force: true });
  });

  it('gives the bridge server an http entry that always loads, carries the token and outlasts the park TTL', () => {
    expect(bridgeServerEntry(ENDPOINT, 600_000)).toEqual({
      type: 'http',
      url: 'http://127.0.0.1:43210/runs/run-1/mcp',
      headers: { Authorization: 'Bearer tok_3f9a' },
      alwaysLoad: true,
      timeout: 660_000
    });
  });

  it('writes the servers into the run directory, readable by the owner only', async () => {
    const servers = { [BRIDGE_SERVER_NAME]: bridgeServerEntry(ENDPOINT, 600_000) };

    const file = await writeMcpConfigFile(runDir, servers);

    expect(file.path).toBe(path.join(runDir, 'mcp-config.json'));
    expect(fs.statSync(file.path).mode & 0o777).toBe(0o600);
    expect(JSON.parse(fs.readFileSync(file.path, 'utf8'))).toEqual({ mcpServers: { client: servers.client } });
  });

  it('removes the file at teardown, and a second removal is harmless', async () => {
    const file = await writeMcpConfigFile(runDir, { client: bridgeServerEntry(ENDPOINT, 600_000) });

    await file.remove();
    await file.remove();

    expect(fs.existsSync(file.path)).toBe(false);
  });

  it('never writes through something already at the path', async () => {
    const elsewhere = path.join(runDir, 'elsewhere.json');
    fs.symlinkSync(elsewhere, path.join(runDir, 'mcp-config.json'));

    await expect(writeMcpConfigFile(runDir, { client: bridgeServerEntry(ENDPOINT, 600_000) })).rejects.toThrow(/EEXIST/);
    expect(fs.existsSync(elsewhere)).toBe(false);
  });
});
