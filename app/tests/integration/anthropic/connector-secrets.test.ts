/**
 * A connector's `authorization_token` through the production spawn runner (spec section 9): it
 * reaches upstream only as its server's Bearer header in the run's MCP config file, written `0600`
 * in the run's own directory, and the directory is gone once the run has exited. Upstream here is
 * a stand-in (`fake-mcp-cli.js`) that reports what it found in the file; never the real CLI.
 */
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createSpawnRunner, Runner } from '../../../src/upstream/runner';
import { openStateDirectory, StateDirectory } from '../../../src/upstream/state-directory';
import { connectorRequest, MCP_BETA } from '../../mocks/anthropic/connector-recordings';
import { SurfaceHarness, startSurface } from '../../mocks/anthropic/surface-harness';
import { waitFor } from '../../mocks/shared/wait-for';

const FAKE_MCP_CLI = path.resolve(__dirname, '..', '..', 'mocks', 'upstream', 'fake-mcp-cli.js');
const HOSTS = 'CLAUDE_WRAPPER_CONNECTOR_HOSTS';
const TOKEN = 'connector-secret-0b1d';

/** The spawn runner, upstream being `node fake-mcp-cli.js <the planned flags>`. */
const fakeUpstream = (): Runner => {
  const runner = createSpawnRunner({ command: process.execPath });
  return { startRun: spec => runner.startRun({ ...spec, flags: [FAKE_MCP_CLI, ...spec.flags] }) };
};

describe('Anthropic surface: a connector token through the spawn runner', () => {
  let surface: SurfaceHarness;
  let root: string;
  let state: StateDirectory;

  beforeEach(async () => {
    process.env[HOSTS] = 'docs.example.com';
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'connector-secrets-'));
    state = openStateDirectory(root);
    surface = await startSurface({ runner: fakeUpstream(), stateDirectory: state });
  });

  afterEach(async () => {
    delete process.env[HOSTS];
    await surface.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("is upstream's Bearer header in a 0600 file, removed with the run's directory at exit", async () => {
    const { mcp_servers, tools } = connectorRequest('docs');
    const message = await surface.client().beta.messages.create({
      model: 'fable', max_tokens: 64, betas: [MCP_BETA], messages: [{ role: 'user', content: 'Report.' }],
      mcp_servers: mcp_servers.map(server => ({ ...server, authorization_token: TOKEN })), tools
    } as unknown as Anthropic.Beta.Messages.MessageCreateParamsNonStreaming);
    const reported = JSON.parse((message.content[0] as { text: string }).text);

    expect(reported).toEqual({ mode: '600', headers: { docs: `Bearer ${TOKEN}` } });
    await waitFor(() => fs.readdirSync(state.runs).length === 0, 5000);
  });
});
