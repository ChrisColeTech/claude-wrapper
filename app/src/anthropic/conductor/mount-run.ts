/**
 * Mounting a run on the control server (spec sections 7, 8, 10 and 16): the run registers its
 * bridge server (client tools) and its hook endpoint (web tools) under one token, with the control
 * server started by the first run that needs it. Its files join its own directory: the MCP config
 * with the bridge server's entry (`alwaysLoad`, a call timeout above the park TTL, the token as its
 * Bearer header), and the settings file with the `PreToolUse` hook beside the hook endpoint file,
 * from which the hook client reads where to post and the token. The token is in those `0600` files
 * and the spec in memory, never in argv, the environment or a log line.
 */
import * as path from 'path';
import { Bridge, BRIDGE_SERVER_NAME } from '../../upstream/bridge';
import { ControlServer, RunHandlers } from '../../upstream/control-server';
import { HookPolicy } from '../../upstream/hook-policy';
import {
  HOOK_ENDPOINT_FILE_NAME, HOOK_SETTINGS_FILE_NAME, hookCommand, hookEndpointContent, hookSettingsContent
} from '../../upstream/hook-settings';
import { bridgeServerEntry, MCP_CONFIG_FILE_NAME, mcpConfigContent } from '../../upstream/mcp-config';
import { RunSpec, withRunFile } from '../../upstream/runner';

/** What a run serves on the control server; each is absent when its turn does not need it. */
export interface RunMounts {
  bridge?: Bridge | undefined;
  policy?: HookPolicy | undefined;
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
    ...(policy ? { hookHandler: async (input: unknown) => policy.decide(input) } : {})
  };
}

/** Undefined when the run needs neither: nothing is registered. */
export async function mountRun(
  control: ControlServer, runId: string, mounts: RunMounts, spec: RunSpec, parkTtlMs: number
): Promise<MountedRun | undefined> {
  if (!mounts.bridge && !mounts.policy) return undefined;
  await control.start();
  const { mcpUrl, hookUrl, token } = control.registerRun(runId, handlersFor(mounts));
  let mounted = spec;
  if (mounts.bridge) {
    const servers = { [BRIDGE_SERVER_NAME]: bridgeServerEntry({ url: mcpUrl, token }, parkTtlMs) };
    mounted = withRunFile({ ...mounted, mcp: { url: mcpUrl, token } }, MCP_CONFIG_FILE_NAME, mcpConfigContent(servers));
  }
  if (mounts.policy) {
    const hooks = { url: hookUrl, token };
    const endpointFile = path.join(mounted.runDir?.path ?? '', HOOK_ENDPOINT_FILE_NAME);
    mounted = withRunFile({ ...mounted, hooks }, HOOK_ENDPOINT_FILE_NAME, hookEndpointContent(hooks));
    mounted = withRunFile(mounted, HOOK_SETTINGS_FILE_NAME, hookSettingsContent(hookCommand({ endpointFile })));
  }
  return { spec: mounted, release: () => control.releaseRun(runId) };
}
