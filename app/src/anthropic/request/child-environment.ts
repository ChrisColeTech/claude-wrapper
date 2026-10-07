/**
 * The child environment of a run (spec section 10): an allowlist built from scratch, never
 * inherited. Only the base variables are copied from the wrapper's environment, so no `CLAUDE*`
 * or `ANTHROPIC*` variable reaches upstream unless the operator puts it in `upstream.env`.
 */
import { ANTHROPIC_SETTING_ENV, AnthropicSettings } from '../../config/anthropic-settings';
import { aboveParkTtl } from '../../upstream/mcp-config';

/** Copied when present: what a process needs to find its home, binaries, locale and proxy. */
const BASE_VARIABLES = [
  'HOME', 'PATH', 'LANG', 'LC_ALL', 'TZ', 'TMPDIR',
  'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'no_proxy'
];

/** Refused even from the operator, each for the reason given. */
const REFUSED_VARIABLES: Readonly<Record<string, string>> = {
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: 'it silently switches the model',
  CLAUDE_CODE_SIMPLE: 'it refuses the subscription login'
};

/** The CLI's own default, pinned so the connector connect wait is known and inside the startup timer. */
const MCP_CONNECT_TIMEOUT_MS = 5_000;
/** Upstream's per-session search cap; a run is one turn, so `max_uses` always binds first. */
const WEB_SEARCHES_PER_SESSION = 200;

export interface EnvironmentInputs {
  /** `CLAUDE_CODE_MAX_OUTPUT_TOKENS`: the request's `max_tokens`. */
  maxOutputTokens: number;
  settings: AnthropicSettings;
  /** The wrapper's own environment. */
  environment: Readonly<Record<string, string | undefined>>;
}

/**
 * The startup check on the operator's `upstream.env`: throws when it sets a refused variable,
 * whatever the value. The wrapper calls it before serving; every planned run repeats it.
 */
export function checkUpstreamEnv(upstreamEnv: Readonly<Record<string, string>>): void {
  const refused = Object.keys(REFUSED_VARIABLES)
    .filter(name => name in upstreamEnv)
    .map(name => `${name} (${REFUSED_VARIABLES[name]})`);
  if (refused.length > 0) {
    throw new Error(`${ANTHROPIC_SETTING_ENV.upstreamEnv} may not set ${refused.join(', ')}`);
  }
}

export function childEnvironment(inputs: EnvironmentInputs): Record<string, string> {
  const { settings, environment } = inputs;
  checkUpstreamEnv(settings.upstreamEnv);
  const env: Record<string, string> = {};
  for (const name of BASE_VARIABLES) {
    const value = environment[name];
    if (value !== undefined) env[name] = value;
  }
  // Above the park TTL, as the bridge server's own call timeout is, so a park ends on the wrapper's side.
  const mcpTimeout = String(aboveParkTtl(settings.parkTtlMs));
  return {
    ...env,
    CLAUDE_CODE_MAX_OUTPUT_TOKENS: String(inputs.maxOutputTokens),
    CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT: mcpTimeout,
    MCP_TOOL_TIMEOUT: mcpTimeout,
    MCP_CONNECT_TIMEOUT_MS: String(MCP_CONNECT_TIMEOUT_MS),
    CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION: String(WEB_SEARCHES_PER_SESSION),
    ...settings.upstreamEnv
  };
}
