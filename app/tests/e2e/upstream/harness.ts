/**
 * The real-CLI e2e harness. Every scenario that spawns the operator's Claude Code goes through
 * here, behind one flag: `UPSTREAM_E2E=1`. Unset (the default, and always in CI) the scenarios
 * are skipped, because each run spends subscription quota.
 *
 *   UPSTREAM_E2E=1 npm --prefix app run test:e2e -- tests/e2e/upstream
 *
 * `CLAUDE_COMMAND` points at the binary (default `claude` on PATH); `UPSTREAM_E2E_MODEL` picks
 * the model (default Haiku, the cheapest catalogued model). Timers, park TTL, `--max-turns` and
 * `upstream.env` come from the operator settings (`CLAUDE_WRAPPER_*`), so an explicit credential
 * goes in `CLAUDE_WRAPPER_UPSTREAM_ENV` as for the server. Each run gets a fresh empty working
 * directory; `cleanup()` closes the runs and removes those directories and the CLI's project
 * directory for each, so no transcript is left behind.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { EnvironmentManager } from '../../../src/config/env';
import { Frame } from '../../../src/upstream/frames';
import { aboveParkTtl } from '../../../src/upstream/mcp-config';
import { createSpawnRunner, Run, RunExit, RunSpec, RunTimers, UserMessage } from '../../../src/upstream/runner';

export const UPSTREAM_E2E_FLAG = 'UPSTREAM_E2E';
export const E2E_MODEL = process.env['UPSTREAM_E2E_MODEL'] ?? 'claude-haiku-4-5-20251001';

export const upstreamE2eEnabled = (): boolean => process.env[UPSTREAM_E2E_FLAG] === '1';

/** `describe` when the flag is set, else `describe.skip` with the flag named in the title. */
export function describeUpstream(name: string, body: () => void): void {
  if (upstreamE2eEnabled()) describe(name, body);
  else describe.skip(`${name} (set ${UPSTREAM_E2E_FLAG}=1 to run against the real CLI)`, body);
}

export interface PlainRunOptions {
  model?: string;
  maxTokens?: number;
  systemPrompt?: string;
  /** Appended after the plain flags (a scenario's own flags). */
  extraFlags?: string[];
  /** The `--allowedTools` list; empty (the plain turn's) by default. */
  allowedTools?: string[];
  /** Merged last, like the operator's `upstream.env`. */
  env?: Record<string, string>;
  timers?: Partial<RunTimers>;
}

const BASE_ENV = ['HOME', 'PATH', 'LANG', 'LC_ALL', 'TZ', 'TMPDIR', 'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY'];
/** Refused even from the operator (section 10): one switches the model, one refuses the login. */
const REFUSED_ENV = ['CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC', 'CLAUDE_CODE_SIMPLE'];

/**
 * The spec's child environment (section 10), built from scratch: the base variables, the
 * always-set ones, then the operator's `upstream.env`, then the scenario's own. Nothing else is
 * inherited.
 */
export function childEnvironment(maxTokens: number, extra: Record<string, string> = {}): Record<string, string> {
  const settings = EnvironmentManager.getAnthropicSettings();
  const refused = REFUSED_ENV.filter(name => name in settings.upstreamEnv);
  if (refused.length > 0) throw new Error(`upstream.env may not set ${refused.join(', ')}`);
  const env: Record<string, string> = {};
  for (const name of [...BASE_ENV, ...BASE_ENV.map(n => n.toLowerCase())]) {
    const value = process.env[name];
    if (value !== undefined) env[name] = value;
  }
  const mcpTimeout = String(aboveParkTtl(settings.parkTtlMs));
  return {
    ...env,
    CLAUDE_CODE_MAX_OUTPUT_TOKENS: String(maxTokens),
    CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT: mcpTimeout,
    MCP_TOOL_TIMEOUT: mcpTimeout,
    MCP_CONNECT_TIMEOUT_MS: '5000',
    CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION: '200',
    ...settings.upstreamEnv,
    ...extra
  };
}

/** The run timers the operator settings give (section 14). */
export function settingsTimers(): RunTimers {
  const { timers } = EnvironmentManager.getAnthropicSettings();
  return { startup: timers.startupMs, stall: timers.stallMs, lifetime: timers.lifetimeMs };
}

/** The spec's argument list for a replayed text turn with no tools (section 10). */
export function plainRunSpec(cwd: string, options: PlainRunOptions = {}): RunSpec {
  const flags = [
    '-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
    '--system-prompt', options.systemPrompt ?? '', '--system-prompt-snapshot', 'off',
    '--setting-sources=', '--strict-mcp-config', '--model', options.model ?? E2E_MODEL,
    '--tools', '', '--allowedTools', (options.allowedTools ?? []).join(','), '--permission-mode', 'default', '--permission-prompts', 'none',
    '--max-turns', String(EnvironmentManager.getAnthropicSettings().maxTurns), ...(options.extraFlags ?? [])
  ];
  const env = childEnvironment(options.maxTokens ?? 1024, options.env);
  return { flags, env, cwd, timers: { ...settingsTimers(), ...options.timers } };
}

export interface UpstreamHarness {
  /** Spawns the real CLI with the plain spec in a fresh empty working directory. */
  start(options?: PlainRunOptions): { run: Run; spec: RunSpec };
  /** Sends the message, reads frames through `result`, closes stdin, and reads to the exit. */
  complete(run: Run, message: UserMessage): Promise<{ frames: Frame[]; exit: RunExit }>;
  cleanup(): Promise<void>;
}

const projectDir = (cwd: string): string =>
  path.join(os.homedir(), '.claude', 'projects', fs.realpathSync(cwd).replace(/[^a-zA-Z0-9]/g, '-'));

export function createUpstreamHarness(): UpstreamHarness {
  const runner = createSpawnRunner({ command: process.env['CLAUDE_COMMAND'] ?? 'claude' });
  const runs: Run[] = [];
  const dirs: string[] = [];

  return {
    start(options = {}) {
      const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'upstream-e2e-'));
      dirs.push(cwd);
      const spec = plainRunSpec(cwd, options);
      const run = runner.startRun(spec);
      runs.push(run);
      return { run, spec };
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
      for (const cwd of dirs.splice(0)) {
        fs.rmSync(projectDir(cwd), { recursive: true, force: true });
        fs.rmSync(cwd, { recursive: true, force: true });
      }
    }
  };
}
