/**
 * Mounting a run (spec sections 7, 8, 9, 10 and 16): the run registers its bridge server (client
 * tools) and its hook endpoint (web tools) on the control server under one token, with the control
 * server started by the first run that needs it. Its files join its own directory: the MCP config
 * with the bridge server's entry (`alwaysLoad`, a call timeout above the park TTL, the token as its
 * Bearer header) and the connectors' entries beside it, and the settings file with the
 * `PreToolUse` hook beside the hook endpoint file, from which the hook client reads where to post
 * and the token. The tokens (the control server's, the connectors') are in those `0600` files and
 * the spec in memory, never in argv, the environment or a log line; the runner removes the files
 * with the run's directory when it exits.
 */
import * as path from 'path';
import { Bridge, BRIDGE_SERVER_NAME } from '../../upstream/bridge';
import { ControlServer, RunHandlers } from '../../upstream/control-server';
import { HookPolicy } from '../../upstream/hook-policy';
import {
  HOOK_ENDPOINT_FILE_NAME, HOOK_SETTINGS_FILE_NAME, hookCommand, hookEndpointContent, hookSettingsContent
} from '../../upstream/hook-settings';
import { bridgeServerEntry, MCP_CONFIG_FILE_NAME, mcpConfigContent, McpHttpServerEntry } from '../../upstream/mcp-config';
import { RunSpec, withRunFile } from '../../upstream/runner';

/** What a run mounts; each is absent (or empty) when its turn does not need it. */
export interface RunMounts {
  /** Served on the control server. */
  bridge?: Bridge | undefined;
  /** Served on the control server. */
  policy?: HookPolicy | undefined;
  /** The connectors' entries in the MCP config file, by name; upstream reaches them itself. */
  connectors?: Readonly<Record<string, McpHttpServerEntry>>;
}

export interface MountedRun {
  /** The planned spec with the run's files (the planner already passed `--mcp-config` and `--settings` for them). */
  spec: RunSpec;
  /** Unmounts the run from the control server: its endpoints and token answer 404 from then on. */
  release(): void;
}

function handlersFor({ bridge, policy }: RunMounts): RunHandlers {
  return {
    ...(bridge ? { mcpHandler: bridge.mcpHandler } : {}),
    ...(policy ? { hookHandler: (input: unknown) => policy.decide(input) } : {})
  };
}

/** The MCP config file alone, for a run that mounts connectors and nothing on the control server. */
function withConnectors(spec: RunSpec, connectors: Readonly<Record<string, McpHttpServerEntry>>): MountedRun {
  return { spec: withRunFile(spec, MCP_CONFIG_FILE_NAME, mcpConfigContent(connectors)), release: () => undefined };
}

/** Undefined when the run needs nothing: nothing is registered, no file written. */
export async function mountRun(
  control: ControlServer, runId: string, mounts: RunMounts, spec: RunSpec, parkTtlMs: number
): Promise<MountedRun | undefined> {
  const connectors = mounts.connectors ?? {};
  const connected = Object.keys(connectors).length > 0;
  if (!mounts.bridge && !mounts.policy) return connected ? withConnectors(spec, connectors) : undefined;
  await control.start();
  const { mcpUrl, hookUrl, token } = control.registerRun(runId, handlersFor(mounts));
  let mounted = spec;
  if (mounts.bridge || connected) {
    const bridge = mounts.bridge ? { [BRIDGE_SERVER_NAME]: bridgeServerEntry({ url: mcpUrl, token }, parkTtlMs) } : {};
    const mcp = mounts.bridge ? { mcp: { url: mcpUrl, token } } : {};
    mounted = withRunFile({ ...mounted, ...mcp }, MCP_CONFIG_FILE_NAME, mcpConfigContent({ ...bridge, ...connectors }));
  }
  if (mounts.policy) {
    const hooks = { url: hookUrl, token };
    const endpointFile = path.join(mounted.runDir?.path ?? '', HOOK_ENDPOINT_FILE_NAME);
    mounted = withRunFile({ ...mounted, hooks }, HOOK_ENDPOINT_FILE_NAME, hookEndpointContent(hooks));
    mounted = withRunFile(mounted, HOOK_SETTINGS_FILE_NAME, hookSettingsContent(hookCommand({ endpointFile })));
  }
  return { spec: mounted, release: () => control.releaseRun(runId) };
}
