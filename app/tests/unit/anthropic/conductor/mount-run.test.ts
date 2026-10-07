/**
 * Mounting a run's MCP servers (spec sections 9 and 10): the bridge server and the connectors
 * share the run's one MCP config file. A run with connectors only registers nothing on the control
 * server; a run with both writes both entries, the bridge's under `client`.
 */
import { mountRun } from '../../../../src/anthropic/conductor/mount-run';
import { createBridge } from '../../../../src/upstream/bridge';
import { ControlServer } from '../../../../src/upstream/control-server';
import { connectorServerEntry } from '../../../../src/upstream/mcp-config';
import { RunSpec } from '../../../../src/upstream/runner';
import { GET_WEATHER } from '../../../mocks/anthropic/client-tool-recordings';

const SPEC: RunSpec = {
  flags: [], env: {}, cwd: '/state/cwd', runDir: { path: '/state/runs/run-1', files: {} },
  timers: { startup: 0, stall: 0, lifetime: 0 }
};
const DOCS = connectorServerEntry({ url: 'https://docs.example.com/mcp', token: 'docs-token' }, 60_000);

function stubControl(): ControlServer & { registerRun: jest.Mock; start: jest.Mock } {
  return {
    start: jest.fn(async () => ({ baseUrl: 'http://127.0.0.1:1' })),
    registerRun: jest.fn(() => ({ mcpUrl: 'http://127.0.0.1:1/runs/run-1/mcp', hookUrl: 'http://127.0.0.1:1/runs/run-1/hook', token: 'control-token' })),
    releaseRun: jest.fn(),
    close: jest.fn(async () => undefined)
  };
}

const config = (spec: RunSpec | undefined) => JSON.parse(spec?.runDir?.files['mcp-config.json'] ?? 'null');

describe('mountRun: the run MCP config file (spec sections 9, 10)', () => {
  it('writes the connectors alone without touching the control server', async () => {
    const control = stubControl();
    const mounted = await mountRun(control, 'run-1', { connectors: { docs: DOCS } }, SPEC, 600_000);

    expect(config(mounted?.spec)).toEqual({ mcpServers: { docs: {
      type: 'http', url: 'https://docs.example.com/mcp', headers: { Authorization: 'Bearer docs-token' }, alwaysLoad: true, timeout: 60_000
    } } });
    expect(control.start).not.toHaveBeenCalled();
    expect(control.registerRun).not.toHaveBeenCalled();
    expect(mounted?.spec.mcp).toBeUndefined();
  });

  it("writes the bridge server's entry beside the connectors'", async () => {
    const control = stubControl();
    const bridge = createBridge([GET_WEATHER]);
    const mounted = await mountRun(control, 'run-1', { bridge, connectors: { docs: DOCS } }, SPEC, 600_000);

    expect(Object.keys(config(mounted?.spec).mcpServers)).toEqual(['client', 'docs']);
    expect(config(mounted?.spec).mcpServers.client).toEqual(expect.objectContaining({
      url: 'http://127.0.0.1:1/runs/run-1/mcp', headers: { Authorization: 'Bearer control-token' }, timeout: 660_000
    }));
    expect(mounted?.spec.mcp).toEqual({ url: 'http://127.0.0.1:1/runs/run-1/mcp', token: 'control-token' });
  });

  it('mounts nothing for a run with neither', async () => {
    expect(await mountRun(stubControl(), 'run-1', { connectors: {} }, SPEC, 600_000)).toBeUndefined();
  });
});
