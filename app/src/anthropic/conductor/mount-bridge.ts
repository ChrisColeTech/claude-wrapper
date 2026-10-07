/**
 * Mounting a run's bridge server (spec sections 7, 10 and 16): the run registers its bridge with
 * the control server, started by the first run that needs it, and the run's MCP config file joins
 * its own directory with the bridge server's entry (`alwaysLoad`, a call timeout above the park
 * TTL, the run's token as its Bearer header). The token is in that `0600` file and the spec in
 * memory, never in argv, the environment or a log line.
 */
import { Bridge, BRIDGE_SERVER_NAME } from '../../upstream/bridge';
import { ControlServer } from '../../upstream/control-server';
import { bridgeServerEntry, MCP_CONFIG_FILE_NAME, mcpConfigContent } from '../../upstream/mcp-config';
import { RunSpec, withRunFile } from '../../upstream/runner';

export interface MountedBridge {
  /** The planned spec with the MCP config file (the planner already passed `--mcp-config` for it). */
  spec: RunSpec;
  /** Unmounts the run from the control server: its endpoint and token answer 404 from then on. */
  release(): void;
}

export async function mountBridge(
  control: ControlServer, runId: string, bridge: Bridge, spec: RunSpec, parkTtlMs: number
): Promise<MountedBridge> {
  await control.start();
  const { mcpUrl: url, token } = control.registerRun(runId, { mcpHandler: bridge.mcpHandler });
  const servers = { [BRIDGE_SERVER_NAME]: bridgeServerEntry({ url, token }, parkTtlMs) };
  return {
    spec: withRunFile({ ...spec, mcp: { url, token } }, MCP_CONFIG_FILE_NAME, mcpConfigContent(servers)),
    release: () => control.releaseRun(runId)
  };
}
