/**
 * Connectors in the plan (spec sections 9 and 10): each enabled server becomes one `http` entry
 * for the run's MCP config file (beside the bridge server's, written by the conductor), with its
 * Bearer header when the client gave a token, `alwaysLoad` and the connector call timeout;
 * `--mcp-config` names that file; `--allowedTools` gains `mcp__<name>` for a whole server, or one
 * `mcp__<name>__<tool>` per allowed tool; `system/init` must report every mounted server
 * `connected`. `defer_loading` is ignored; `enabled: false` is honoured as far as allow rules can
 * express it. The token never reaches argv or the environment.
 */
import { SurfaceError } from '../../../../src/anthropic/http/surface-error';
import { planCountTokens, planTurn, RunContext, TurnPlan } from '../../../../src/anthropic/request';
import { ANTHROPIC_SETTING_DEFAULTS } from '../../../../src/config/anthropic-settings';
import { connectorRequest, MCP_BETA } from '../../../mocks/anthropic/connector-recordings';
import { NO_SESSIONS, runContext, shippedCatalogue } from '../../../mocks/anthropic/plan-context';

const VALID = { model: 'opus', max_tokens: 1024, messages: [{ role: 'user', content: 'Use the docs.' }] };
const MCP_CONFIG = '/var/lib/claude-wrapper/runs/run-0001/mcp-config.json';
const TOKEN = 'secret-connector-token-1234';
const WEATHER_TOOL = { name: 'get_weather', input_schema: { type: 'object' } };

const context = (timeoutMs = ANTHROPIC_SETTING_DEFAULTS.connectorCallTimeoutMs): RunContext => runContext({
  settings: { ...ANTHROPIC_SETTING_DEFAULTS, connectorHosts: ['docs.example.com', 'wiki.example.com'], connectorCallTimeoutMs: timeoutMs },
  betas: ['other-beta', MCP_BETA]
});

function planOf(fields: object, ctx = context()): TurnPlan {
  const plan = planTurn({ ...VALID, ...fields }, shippedCatalogue, NO_SESSIONS, ctx);
  if (plan instanceof SurfaceError) throw new Error(`unexpected rejection: ${plan.message}`);
  return plan;
}

const flagValue = (flags: readonly string[], flag: string) => flags[flags.indexOf(flag) + 1];

describe('planTurn mounts the connectors (spec sections 9, 10)', () => {
  it("writes one http entry per server, names the run's MCP config file and allows the whole server", () => {
    const { runSpec, connectors, startupChecks, bridgeTools } = planOf(connectorRequest('docs'));

    expect(connectors).toEqual({
      docs: { type: 'http', url: 'https://docs.example.com/mcp', alwaysLoad: true, timeout: 60_000 }
    });
    expect(flagValue(runSpec.flags, '--mcp-config')).toBe(MCP_CONFIG);
    expect(flagValue(runSpec.flags, '--allowedTools')).toBe('mcp__docs');
    expect(flagValue(runSpec.flags, '--tools')).toBe('');
    expect(startupChecks).toEqual({ model: 'claude-opus-5-5', tools: [], connectors: ['docs'] });
    expect(bridgeTools).toEqual([]);
  });

  it("carries the token as the entry's Bearer header, and nowhere in argv or the environment", () => {
    const fields = { ...connectorRequest('docs'), mcp_servers: [{ ...connectorRequest('docs').mcp_servers[0], authorization_token: TOKEN }] };
    const { runSpec, connectors } = planOf(fields, context(15_000));

    expect(connectors['docs']).toEqual({
      type: 'http', url: 'https://docs.example.com/mcp', headers: { Authorization: `Bearer ${TOKEN}` }, alwaysLoad: true, timeout: 15_000
    });
    expect(JSON.stringify(runSpec.flags)).not.toContain(TOKEN);
    expect(JSON.stringify(runSpec.env)).not.toContain(TOKEN);
    expect(runSpec.runDir?.files).toEqual({});
  });

  it('allows the client tools first, then each server, beside the bridge server', () => {
    const docs = connectorRequest('docs');
    const wiki = connectorRequest('wiki');
    const { runSpec, connectors, startupChecks } = planOf({
      mcp_servers: [...docs.mcp_servers, ...wiki.mcp_servers], tools: [WEATHER_TOOL, ...docs.tools, ...wiki.tools]
    });

    expect(flagValue(runSpec.flags, '--allowedTools')).toBe('mcp__client__get_weather,mcp__docs,mcp__wiki');
    expect(Object.keys(connectors)).toEqual(['docs', 'wiki']);
    expect(startupChecks.tools).toEqual(['mcp__client__get_weather']);
    expect(startupChecks.connectors).toEqual(['docs', 'wiki']);
  });

  it('allows one rule per allowed tool when tool_configuration lists them, in upstream naming', () => {
    const request = connectorRequest('docs');
    const server = { ...request.mcp_servers[0], tool_configuration: { enabled: true, allowed_tools: ['search', 'read.page'] } };

    expect(flagValue(planOf({ ...request, mcp_servers: [server] }).runSpec.flags, '--allowedTools'))
      .toBe('mcp__docs__search,mcp__docs__read_page');
  });

  it('does not mount a server whose tool_configuration is disabled, nor one with no tool allowed', () => {
    const request = connectorRequest('docs');
    for (const tool_configuration of [{ enabled: false }, { allowed_tools: [] }]) {
      const plan = planOf({ ...request, mcp_servers: [{ ...request.mcp_servers[0], tool_configuration }] });

      expect(plan.connectors).toEqual({});
      expect(plan.runSpec.flags).not.toContain('--mcp-config');
      expect(plan.startupChecks.connectors).toEqual([]);
    }
  });

  it("honours a toolset's enabled flags as allow rules, and ignores defer_loading", () => {
    const request = connectorRequest('docs');
    const toolset = (fields: object) => ({ ...request, tools: [{ ...request.tools[0], ...fields }] });
    const allowed = (fields: object, server: object = {}) => flagValue(planOf({
      ...toolset(fields), mcp_servers: [{ ...request.mcp_servers[0], ...server }]
    }).runSpec.flags, '--allowedTools');

    expect(allowed({ default_config: { defer_loading: true }, configs: { search: { defer_loading: false } } })).toBe('mcp__docs');
    expect(allowed({ default_config: { enabled: false }, configs: { search: { enabled: true }, read: { enabled: false } } })).toBe('mcp__docs__search');
    expect(allowed({ configs: { delete: { enabled: false } } }, { tool_configuration: { allowed_tools: ['search', 'delete'] } })).toBe('mcp__docs__search');
    expect(planOf(toolset({ default_config: { enabled: false } })).connectors).toEqual({});
  });

  it('mounts no connector under tool_choice none, though it validates them', () => {
    const plan = planOf({ ...connectorRequest('docs'), tool_choice: { type: 'none' } });

    expect(plan.connectors).toEqual({});
    expect(plan.runSpec.flags).not.toContain('--mcp-config');
    expect(flagValue(plan.runSpec.flags, '--allowedTools')).toBe('');
  });

  it('mounts the connectors on a count_tokens run, so their tool definitions are counted', () => {
    const plan = planCountTokens({ model: 'opus', messages: VALID.messages, ...connectorRequest('docs') }, shippedCatalogue, context());

    expect(plan).toEqual(expect.objectContaining({ connectors: { docs: expect.objectContaining({ url: 'https://docs.example.com/mcp' }) } }));
    expect(flagValue((plan as TurnPlan).runSpec.flags, '--mcp-config')).toBe(MCP_CONFIG);
  });

  it('keeps mcp_servers among the run-bound parameters', () => {
    expect(planOf(connectorRequest('docs')).runBound['mcp_servers']).toBe(JSON.stringify(connectorRequest('docs').mcp_servers));
  });
});
