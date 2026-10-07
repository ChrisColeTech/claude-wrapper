/**
 * The Anthropic surface's operator settings (spec section 15): every row of the settings table
 * with its default, each overridable by one environment variable. Read through
 * `EnvironmentManager.getAnthropicSettings()`. Durations are milliseconds.
 *
 * An invalid value keeps the default and logs a warning naming the variable, as the rest of
 * the configuration does; a warning never echoes the value, which may be a credential.
 */

export interface AnthropicSettings {
  /** How long a held-open run waits for the client's tool results (section 7). */
  parkTtlMs: number;
  /** Idle expiry of a fingerprint → upstream session entry (section 5). */
  fingerprintExpiryMs: number;
  /** Most fingerprint entries kept (section 5). */
  fingerprintCapacity: number;
  /** How long a run may sit in upstream's `api_retry` loop before failing (section 11). */
  retryCapMs: number;
  /** SSE idle `ping` interval (section 11). */
  pingIntervalMs: number;
  /** The model catalogue file; `null` is the catalogue shipped with the package (section 3). */
  cataloguePath: string | null;
  /** Hosts connectors may reach; `*` allows all; empty means connectors are off (section 9). */
  connectorHosts: readonly string[];
  /** Per-connector call timeout written into its MCP config entry (section 9). */
  connectorCallTimeoutMs: number;
  /** Per-run timers: spawn to `system/init`, silence between frames, active lifetime (section 14). */
  timers: { startupMs: number; stallMs: number; lifetimeMs: number };
  /** Runs in existence, active plus parked (section 14). */
  maxRuns: number;
  /** How long a continued turn waits for the previous run to exit (section 14). */
  continuedTurnWaitMs: number;
  /** Bound on the wrapper's shutdown drain before SIGKILL (section 14). */
  shutdownDrainMs: number;
  /** `--max-turns` per run (section 14). */
  maxTurns: number;
  /** `upstream.env`: variables merged last into every run's environment (section 10). */
  upstreamEnv: Readonly<Record<string, string>>;
  /** `redact`: extra strings redacted from output, beside the account file's (section 6). */
  redact: readonly string[];
}

/** The environment variable behind each setting (name them in messages that point at a setting). */
export const ANTHROPIC_SETTING_ENV = {
  parkTtlMs: 'CLAUDE_WRAPPER_PARK_TTL_MS',
  fingerprintExpiryMs: 'CLAUDE_WRAPPER_FINGERPRINT_EXPIRY_MS',
  fingerprintCapacity: 'CLAUDE_WRAPPER_FINGERPRINT_CAPACITY',
  retryCapMs: 'CLAUDE_WRAPPER_RETRY_CAP_MS',
  pingIntervalMs: 'CLAUDE_WRAPPER_PING_INTERVAL_MS',
  cataloguePath: 'CLAUDE_WRAPPER_CATALOGUE_PATH',
  connectorHosts: 'CLAUDE_WRAPPER_CONNECTOR_HOSTS',
  connectorCallTimeoutMs: 'CLAUDE_WRAPPER_CONNECTOR_TIMEOUT_MS',
  startupMs: 'CLAUDE_WRAPPER_STARTUP_TIMEOUT_MS',
  stallMs: 'CLAUDE_WRAPPER_STALL_TIMEOUT_MS',
  lifetimeMs: 'CLAUDE_WRAPPER_RUN_LIFETIME_MS',
  maxRuns: 'CLAUDE_WRAPPER_MAX_RUNS',
  continuedTurnWaitMs: 'CLAUDE_WRAPPER_CONTINUED_TURN_WAIT_MS',
  shutdownDrainMs: 'CLAUDE_WRAPPER_SHUTDOWN_DRAIN_MS',
  maxTurns: 'CLAUDE_WRAPPER_MAX_TURNS',
  upstreamEnv: 'CLAUDE_WRAPPER_UPSTREAM_ENV',
  redact: 'CLAUDE_WRAPPER_REDACT'
} as const;

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

export const ANTHROPIC_SETTING_DEFAULTS: AnthropicSettings = {
  parkTtlMs: 10 * MINUTE,
  fingerprintExpiryMs: 24 * HOUR,
  fingerprintCapacity: 1000,
  retryCapMs: 60 * SECOND,
  pingIntervalMs: 15 * SECOND,
  cataloguePath: null,
  connectorHosts: [],
  connectorCallTimeoutMs: 60 * SECOND,
  timers: { startupMs: 20 * SECOND, stallMs: 90 * SECOND, lifetimeMs: 30 * MINUTE },
  maxRuns: 4,
  continuedTurnWaitMs: 10 * SECOND,
  shutdownDrainMs: 15 * SECOND,
  maxTurns: 25,
  upstreamEnv: {},
  redact: []
};

type Env = Readonly<Record<string, string | undefined>>;

function positiveInteger(env: Env, name: string, fallback: number): number {
  const value = env[name];
  if (!value) return fallback;
  if (/^\d+$/.test(value) && Number(value) > 0 && Number.isSafeInteger(Number(value))) {
    return Number(value);
  }
  console.warn(`Invalid ${name} environment variable: expected a positive integer, using default: ${fallback}`);
  return fallback;
}

function commaList(env: Env, name: string): string[] {
  return (env[name] ?? '').split(',').map((item) => item.trim()).filter(Boolean);
}

function stringMap(env: Env, name: string): Record<string, string> {
  const value = env[name];
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    const isMap = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
    if (isMap && Object.values(parsed).every((entry) => typeof entry === 'string')) {
      return parsed as Record<string, string>;
    }
  } catch {
    // reported below, without the value
  }
  console.warn(`Invalid ${name} environment variable: expected a JSON object of strings, using none`);
  return {};
}

export function loadAnthropicSettings(env: Env): AnthropicSettings {
  const names = ANTHROPIC_SETTING_ENV;
  const defaults = ANTHROPIC_SETTING_DEFAULTS;
  const number = (key: keyof typeof names & keyof AnthropicSettings, fallback: number) =>
    positiveInteger(env, names[key], fallback);

  return {
    parkTtlMs: number('parkTtlMs', defaults.parkTtlMs),
    fingerprintExpiryMs: number('fingerprintExpiryMs', defaults.fingerprintExpiryMs),
    fingerprintCapacity: number('fingerprintCapacity', defaults.fingerprintCapacity),
    retryCapMs: number('retryCapMs', defaults.retryCapMs),
    pingIntervalMs: number('pingIntervalMs', defaults.pingIntervalMs),
    cataloguePath: env[names.cataloguePath] || defaults.cataloguePath,
    connectorHosts: commaList(env, names.connectorHosts),
    connectorCallTimeoutMs: number('connectorCallTimeoutMs', defaults.connectorCallTimeoutMs),
    timers: {
      startupMs: positiveInteger(env, names.startupMs, defaults.timers.startupMs),
      stallMs: positiveInteger(env, names.stallMs, defaults.timers.stallMs),
      lifetimeMs: positiveInteger(env, names.lifetimeMs, defaults.timers.lifetimeMs)
    },
    maxRuns: number('maxRuns', defaults.maxRuns),
    continuedTurnWaitMs: number('continuedTurnWaitMs', defaults.continuedTurnWaitMs),
    shutdownDrainMs: number('shutdownDrainMs', defaults.shutdownDrainMs),
    maxTurns: number('maxTurns', defaults.maxTurns),
    upstreamEnv: stringMap(env, names.upstreamEnv),
    redact: commaList(env, names.redact)
  };
}
