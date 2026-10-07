/**
 * The child environment (spec section 10): an allowlist built from scratch. From the wrapper's
 * environment only the base variables are copied; the always-set ones follow, then the request's
 * thinking variables (Haiku 4.5 without `thinking` gets thinking switched off); the operator's
 * `upstream.env` is merged last, except the two variables refused even from the operator.
 */
import { checkUpstreamEnv, planTurn, TurnPlan } from '../../../../src/anthropic/request';
import { loadAnthropicSettings } from '../../../../src/config/anthropic-settings';
import { NO_SESSIONS, runContext, shippedCatalogue } from '../../../mocks/anthropic/plan-context';

const REQUEST = { model: 'haiku', max_tokens: 2048, messages: [{ role: 'user', content: 'Hello' }] };

/** A wrapper environment carrying everything that must never reach upstream, beside the base. */
const POLLUTED = {
  HOME: '/home/operator',
  PATH: '/usr/bin:/bin',
  LANG: 'en_GB.UTF-8',
  LC_ALL: 'C.UTF-8',
  TZ: 'Europe/London',
  TMPDIR: '/tmp/operator',
  HTTP_PROXY: 'http://proxy:3128',
  HTTPS_PROXY: 'http://proxy:3129',
  NO_PROXY: 'localhost',
  http_proxy: 'http://lower-proxy:3128',
  https_proxy: 'http://lower-proxy:3129',
  no_proxy: '127.0.0.1',
  CLAUDE_CODE_OAUTH_TOKEN: 'stale-desktop-token',
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
  CLAUDE_CODE_SIMPLE: '1',
  CLAUDE_CODE_ENTRYPOINT: 'cli',
  CLAUDECODE: '1',
  CLAUDE_EFFORT: 'max',
  CLAUDE_CODE_EFFORT_LEVEL: 'low',
  CLAUDE_CODE_MAX_OUTPUT_TOKENS: '99999',
  CLAUDE_WRAPPER_PARK_TTL_MS: '1000',
  ANTHROPIC_API_KEY: 'sk-ant-from-the-shell',
  ANTHROPIC_MODEL: 'claude-opus-5-5',
  ANTHROPIC_BASE_URL: 'http://elsewhere',
  ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-fable-5-1',
  API_KEY: 'the-wrapper-client-key',
  NODE_OPTIONS: '--inspect',
  SSH_AUTH_SOCK: '/run/agent.sock',
  UNSET_BASE: undefined
};

const envOf = (plan: unknown) => (plan as TurnPlan).runSpec.env;

describe('planTurn: the child environment', () => {
  it('copies only the base variables from a polluted wrapper environment, then sets its own', () => {
    const plan = planTurn(REQUEST, shippedCatalogue, NO_SESSIONS, runContext({ environment: POLLUTED }));

    expect(envOf(plan)).toEqual({
      HOME: '/home/operator',
      PATH: '/usr/bin:/bin',
      LANG: 'en_GB.UTF-8',
      LC_ALL: 'C.UTF-8',
      TZ: 'Europe/London',
      TMPDIR: '/tmp/operator',
      HTTP_PROXY: 'http://proxy:3128',
      HTTPS_PROXY: 'http://proxy:3129',
      NO_PROXY: 'localhost',
      http_proxy: 'http://lower-proxy:3128',
      https_proxy: 'http://lower-proxy:3129',
      no_proxy: '127.0.0.1',
      CLAUDE_CODE_MAX_OUTPUT_TOKENS: '2048',
      CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT: '660000',
      MCP_TOOL_TIMEOUT: '660000',
      MCP_CONNECT_TIMEOUT_MS: '5000',
      MCP_TIMEOUT: '5000',
      CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION: '200',
      CLAUDE_CODE_DISABLE_THINKING: '1'
    });
  });

  it("pins both of upstream's MCP connect waits inside the default startup timer", () => {
    const env = envOf(planTurn(REQUEST, shippedCatalogue, NO_SESSIONS, runContext()));
    const startupMs = loadAnthropicSettings({}).timers.startupMs;

    for (const name of ['MCP_CONNECT_TIMEOUT_MS', 'MCP_TIMEOUT']) {
      expect(Number(env[name])).toBeGreaterThan(0);
      expect(Number(env[name])).toBeLessThan(startupMs);
    }
  });

  it('copies nothing that is absent, and starts from nothing when the wrapper environment is empty', () => {
    const plan = planTurn(REQUEST, shippedCatalogue, NO_SESSIONS, runContext({ environment: {} }));

    expect(Object.keys(envOf(plan)).sort()).toEqual([
      'CLAUDE_CODE_DISABLE_THINKING', 'CLAUDE_CODE_MAX_OUTPUT_TOKENS', 'CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION', 'CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT',
      'MCP_CONNECT_TIMEOUT_MS', 'MCP_TIMEOUT', 'MCP_TOOL_TIMEOUT'
    ]);
  });

  it('merges the operator’s upstream.env last, over the base, the always-set and the thinking variables', () => {
    const settings = loadAnthropicSettings({
      CLAUDE_WRAPPER_UPSTREAM_ENV: JSON.stringify({
        ANTHROPIC_API_KEY: 'sk-ant-operator', DISABLE_TELEMETRY: '1', PATH: '/opt/claude/bin', MCP_CONNECT_TIMEOUT_MS: '8000',
        CLAUDE_CODE_DISABLE_THINKING: '0'
      })
    });

    const plan = planTurn(REQUEST, shippedCatalogue, NO_SESSIONS, runContext({ settings, environment: POLLUTED }));

    expect(envOf(plan)).toEqual(expect.objectContaining({
      ANTHROPIC_API_KEY: 'sk-ant-operator', DISABLE_TELEMETRY: '1', PATH: '/opt/claude/bin', MCP_CONNECT_TIMEOUT_MS: '8000',
      CLAUDE_CODE_DISABLE_THINKING: '0'
    }));
    expect(envOf(plan)).not.toHaveProperty('CLAUDE_CODE_OAUTH_TOKEN');
  });
});

describe('the variables refused even from upstream.env', () => {
  it.each([
    [{ CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' },
      'CLAUDE_WRAPPER_UPSTREAM_ENV may not set CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC (it silently switches the model)'],
    [{ CLAUDE_CODE_SIMPLE: '1', DISABLE_TELEMETRY: '1' },
      'CLAUDE_WRAPPER_UPSTREAM_ENV may not set CLAUDE_CODE_SIMPLE (it refuses the subscription login)'],
    [{ CLAUDE_CODE_SIMPLE: '', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '0' },
      'CLAUDE_WRAPPER_UPSTREAM_ENV may not set CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC (it silently switches the model), ' +
      'CLAUDE_CODE_SIMPLE (it refuses the subscription login)']
  ])('are a startup error: %p', (upstreamEnv, message) => {
    expect(() => checkUpstreamEnv(upstreamEnv)).toThrow(new Error(message));
  });

  it('accepts an upstream.env without them', () => {
    expect(() => checkUpstreamEnv({ ANTHROPIC_API_KEY: 'sk-ant-operator', DISABLE_TELEMETRY: '1' })).not.toThrow();
  });

  it('are never planned into a run, should the startup check have been skipped', () => {
    const settings = loadAnthropicSettings({ CLAUDE_WRAPPER_UPSTREAM_ENV: '{"CLAUDE_CODE_SIMPLE":"1"}' });

    expect(() => planTurn(REQUEST, shippedCatalogue, NO_SESSIONS, runContext({ settings }))).toThrow(
      'CLAUDE_WRAPPER_UPSTREAM_ENV may not set CLAUDE_CODE_SIMPLE'
    );
  });
});
