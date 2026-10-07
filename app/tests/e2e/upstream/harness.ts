/**
 * The real-CLI e2e harness. Every scenario that spawns the operator's Claude Code goes through
 * here, behind one flag: `UPSTREAM_E2E=1`. Unset (the default, and always in CI) the scenarios
 * are skipped, because each run spends subscription quota.
 *
 *   UPSTREAM_E2E=1 npm --prefix app run test:e2e -- tests/e2e/upstream
 *
 * `CLAUDE_COMMAND` points at the binary (default `claude` on PATH); `UPSTREAM_E2E_MODEL` picks
 * the model (default Haiku, the cheapest catalogued model). The run spec is the planner's
 * (`planTurn`), so timers, park TTL, `--max-turns` and `upstream.env` come from the operator
 * settings (`CLAUDE_WRAPPER_*`) as for the server, and an explicit credential goes in
 * `CLAUDE_WRAPPER_UPSTREAM_ENV`. Each run gets a fresh state directory; `cleanup()` closes the
 * runs and removes those directories and the CLI's project directory for each, so no transcript
 * is left behind. A scenario that goes through the whole surface builds it with
 * `productionSurface`, whose `close()` also closes the surface's control server.
 */
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { SurfaceDeps } from '../../../src/anthropic/deps';
import { SurfaceError } from '../../../src/anthropic/surface-error';
import { planTurn, TurnPlan } from '../../../src/anthropic/request';
import { EnvironmentManager } from '../../../src/config/env';
import { createControlServer } from '../../../src/upstream/control-server';
import { Frame } from '../../../src/upstream/frames';
import { createSpawnRunner, Run, RunExit, RunSpec, RunTimers, UserMessage } from '../../../src/upstream/runner';
import { openStateDirectory, StateDirectory } from '../../../src/upstream/state-directory';
import { NO_SESSIONS, shippedCatalogue } from '../../mocks/anthropic/plan-context';
import type { SurfaceHarness } from '../../mocks/anthropic/surface-harness';

export const UPSTREAM_E2E_FLAG = 'UPSTREAM_E2E';
export const E2E_MODEL = process.env['UPSTREAM_E2E_MODEL'] ?? 'claude-haiku-4-5-20251001';

export const upstreamE2eEnabled = (): boolean => process.env[UPSTREAM_E2E_FLAG] === '1';

/** `describe` when the flag is set, else `describe.skip` with the flag named in the title. */
export function describeUpstream(name: string, body: () => void): void {
  if (upstreamE2eEnabled()) describe(name, body);
  else describe.skip(`${name} (set ${UPSTREAM_E2E_FLAG}=1 to run against the real CLI)`, body);
}

export interface PlainRunOptions {
  /** The request body's `model`: a canonical id or an alias. */
  model?: string;
  maxTokens?: number;
  system?: string;
  /** The one user message's text. */
  prompt?: string;
  /** Further request fields (`thinking`, `output_config`), planned as the surface plans them. */
  fields?: Record<string, unknown>;
  /** A scenario's own flags, appended after the planned ones (the spec's flags are the plan's). */
  extraFlags?: string[];
  /** Replaces the planned `--allowedTools` list (empty for a text turn) until the planner mounts tools. */
  allowedTools?: string[];
  /** A scenario's own variables, merged after the planned environment. */
  env?: Record<string, string>;
  timers?: Partial<RunTimers>;
}

/** The planner's turn plan for a one-message text request. */
export function planPlainTurn(stateRoot: string, options: PlainRunOptions = {}): TurnPlan {
  const request = {
    model: options.model ?? E2E_MODEL,
    max_tokens: options.maxTokens ?? 1024,
    ...(options.system === undefined ? {} : { system: options.system }),
    messages: [{ role: 'user', content: options.prompt ?? 'Reply with the single word pong.' }],
    ...options.fields
  };
  const context = {
    settings: EnvironmentManager.getAnthropicSettings(),
    environment: process.env,
    state: openStateDirectory(stateRoot),
    runId: randomUUID()
  };
  const plan = planTurn(request, shippedCatalogue, NO_SESSIONS, context);
  if (plan instanceof SurfaceError) throw new Error(`the planner refused the e2e request: ${plan.message}`);
  return plan;
}

/** The message a planned run starts with: planned with no sessions, a run is always a replayed turn. */
export function firstMessage(plan: TurnPlan): UserMessage {
  if (!('replay' in plan.continuation)) throw new Error('the e2e harness plans fresh runs only');
  return plan.continuation.replay;
}

function withOverrides(spec: RunSpec, options: PlainRunOptions): RunSpec {
  const flags = [...spec.flags];
  if (options.allowedTools) flags[flags.indexOf('--allowedTools') + 1] = options.allowedTools.join(',');
  return {
    ...spec,
    flags: [...flags, ...(options.extraFlags ?? [])],
    env: { ...spec.env, ...options.env },
    timers: { ...spec.timers, ...options.timers }
  };
}

export interface UpstreamHarness {
  /** Spawns the real CLI with the planned spec in a fresh state directory. */
  start(options?: PlainRunOptions): { run: Run; plan: TurnPlan; spec: RunSpec };
  /** Sends the message, reads frames through `result`, closes stdin, and reads to the exit. */
  complete(run: Run, message: UserMessage): Promise<{ frames: Frame[]; exit: RunExit }>;
  cleanup(): Promise<void>;
}

const projectDir = (cwd: string): string =>
  path.join(os.homedir(), '.claude', 'projects', fs.realpathSync(cwd).replace(/[^a-zA-Z0-9]/g, '-'));

/** Removes a scenario's state root and the CLI's project directory for its working directory. */
export function removeStateRoot(root: string, cwd: string): void {
  fs.rmSync(projectDir(cwd), { recursive: true, force: true });
  fs.rmSync(root, { recursive: true, force: true });
}

/**
 * The whole surface on `stateDirectory`, served on a loopback port: the production spawn runner
 * unless `deps` gives a runner. Its control server is `deps.controlServer` or one of its own, and
 * `close()` closes it with the HTTP server, since a turn or count with client or web tools starts
 * it and a server left listening keeps Jest from exiting. The app is imported here, not at the
 * top: a skipped file must not start the OpenAI surface's timers.
 */
export async function productionSurface(
  stateDirectory: StateDirectory, deps: Omit<SurfaceDeps, 'stateDirectory'> = {}
): Promise<SurfaceHarness> {
  const { createServer } = await import('../../../src/api/server');
  const { serveApp } = await import('../../mocks/anthropic/surface-harness');
  const controlServer = deps.controlServer ?? createControlServer();
  return serveApp(createServer({ ...deps, stateDirectory, controlServer }), () => controlServer.close());
}

export function createUpstreamHarness(): UpstreamHarness {
  const runner = createSpawnRunner({ command: process.env['CLAUDE_COMMAND'] ?? 'claude' });
  const runs: Run[] = [];
  const roots: { root: string; cwd: string }[] = [];

  return {
    start(options = {}) {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'upstream-e2e-'));
      const plan = planPlainTurn(root, options);
      roots.push({ root, cwd: plan.runSpec.cwd });
      const spec = withOverrides(plan.runSpec, options);
      const run = runner.startRun(spec);
      runs.push(run);
      return { run, plan, spec };
    },
    async complete(run, message) {
      const frames: Frame[] = [];
      await run.send(message);
      for await (const frame of run.frames) {
        frames.push(frame);
        if (frame.type === 'result') void run.close();
      }
      return { frames, exit: await run.exited };
    },
    async cleanup() {
      await Promise.all(runs.splice(0).map(run => run.close()));
      for (const { root, cwd } of roots.splice(0)) removeStateRoot(root, cwd);
    }
  };
}
