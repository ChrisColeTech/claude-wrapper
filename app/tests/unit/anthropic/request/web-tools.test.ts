/**
 * Web search and web fetch in the plan (spec sections 8 and 10): a declared `web_search_*` or
 * `web_fetch_*` tool enables exactly its built-in (`--tools`, `--allowedTools`), the run gets its
 * per-run settings file carrying the `PreToolUse` hook, `system/init` must report the built-ins,
 * and the hook policy carries the request's own limits. `tool_choice: none` disables them all.
 * The expected values are the spec's mapping table, written out.
 */
import { TurnPlan } from '../../../../src/anthropic/request';
import { invalidRequest, planDefault, rejectionOf } from '../../../mocks/anthropic/plan-context';

const VALID = { model: 'opus', max_tokens: 1024, messages: [{ role: 'user', content: 'Look it up.' }] };
const SEARCH = { type: 'web_search_20250305', name: 'web_search' };
const FETCH = { type: 'web_fetch_20250910', name: 'web_fetch' };
const WEATHER = { name: 'get_weather', input_schema: { type: 'object' } };
const SETTINGS_FILE = '/var/lib/claude-wrapper/runs/run-0001/settings.json';

const planOf = (fields: object) => planDefault({ ...VALID, ...fields }) as TurnPlan;
const flagValue = (flags: readonly string[], flag: string) => flags[flags.indexOf(flag) + 1];

describe('planTurn maps the web tools to upstream built-ins (spec sections 8, 10)', () => {
  it.each([
    ['web_search', [SEARCH], 'WebSearch', 'WebSearch', ['WebSearch']],
    ['web_fetch', [FETCH], 'WebFetch', 'WebFetch(domain:*)', ['WebFetch']],
    ['both', [FETCH, SEARCH], 'WebSearch,WebFetch', 'WebSearch,WebFetch(domain:*)', ['WebSearch', 'WebFetch']]
  ])('%s: --tools, --allowedTools, the settings file and the expected init tools', (_case, tools, builtIns, allowed, init) => {
    const { runSpec, startupChecks, bridgeTools } = planOf({ tools });

    expect(flagValue(runSpec.flags, '--tools')).toBe(builtIns);
    expect(flagValue(runSpec.flags, '--allowedTools')).toBe(allowed);
    expect(flagValue(runSpec.flags, '--settings')).toBe(SETTINGS_FILE);
    expect(runSpec.flags).not.toContain('--mcp-config');
    expect(startupChecks.tools).toEqual(init);
    expect(bridgeTools).toEqual([]);
  });

  it('puts the settings file after the permission flags and before --max-turns', () => {
    const { flags } = planOf({ tools: [SEARCH] }).runSpec;

    expect(flags.indexOf('--settings')).toBeGreaterThan(flags.indexOf('--permission-prompts'));
    expect(flags.indexOf('--settings')).toBeLessThan(flags.indexOf('--max-turns'));
  });

  it('allows the client tools first, then the built-ins, beside the bridge server', () => {
    const { runSpec, startupChecks } = planOf({ tools: [SEARCH, WEATHER, FETCH] });

    expect(flagValue(runSpec.flags, '--allowedTools')).toBe('mcp__client__get_weather,WebSearch,WebFetch(domain:*)');
    expect(flagValue(runSpec.flags, '--tools')).toBe('WebSearch,WebFetch');
    expect(runSpec.flags.indexOf('--mcp-config')).toBeLessThan(runSpec.flags.indexOf('--settings'));
    expect(startupChecks.tools).toEqual(['WebSearch', 'WebFetch', 'mcp__client__get_weather']);
  });

  it('disables every tool under tool_choice none', () => {
    const plan = planOf({ tools: [SEARCH, FETCH, WEATHER], tool_choice: { type: 'none' } });

    expect(flagValue(plan.runSpec.flags, '--tools')).toBe('');
    expect(flagValue(plan.runSpec.flags, '--allowedTools')).toBe('');
    expect(plan.runSpec.flags).not.toContain('--settings');
    expect(plan.startupChecks.tools).toEqual([]);
    expect(plan.hookPolicy).toBeUndefined();
  });

  it('has no hook policy and no settings file without a web tool', () => {
    const plan = planOf({ tools: [WEATHER] });

    expect(plan.hookPolicy).toBeUndefined();
    expect(plan.runSpec.flags).not.toContain('--settings');
  });
});

describe('planTurn: the hook policy carries the request’s limits (spec section 8)', () => {
  it('keeps max_uses and the one domain list each tool declares, keyed by the built-in', () => {
    const tools = [
      { ...SEARCH, max_uses: 2, allowed_domains: ['github.com', 'docs.python.org/3'] },
      { ...FETCH, blocked_domains: ['example.org'], citations: { enabled: true }, max_content_tokens: 1000 }
    ];

    expect(planOf({ tools }).hookPolicy).toEqual({
      WebSearch: { maxUses: 2, allowedDomains: ['github.com', 'docs.python.org/3'] },
      WebFetch: { blockedDomains: ['example.org'] }
    });
  });

  it('reads null as absent, and an empty list as no list', () => {
    const tools = [{ ...SEARCH, max_uses: null, allowed_domains: [], blocked_domains: null }];

    expect(planOf({ tools }).hookPolicy).toEqual({ WebSearch: {} });
  });

  it('accepts and ignores the fields the surface does not serve', () => {
    const tool = {
      type: 'web_search_20260318', name: 'web_search', user_location: { type: 'approximate', city: 'Oslo' },
      response_inclusion: 'excluded', allowed_callers: ['direct'], strict: true, defer_loading: false,
      cache_control: { type: 'ephemeral' }
    };

    expect(planOf({ tools: [tool] }).hookPolicy).toEqual({ WebSearch: {} });
  });
});

describe('planTurn validates the web tools’ fields (spec sections 4.4, 8)', () => {
  it.each([
    [{ ...SEARCH, name: 'search' }, "tools.0.web_search_20250305.name: Input should be 'web_search'"],
    [{ type: 'web_fetch_20260209' }, 'tools.0.web_fetch_20260209.name: Field required'],
    [{ ...SEARCH, max_uses: 0 }, 'tools.0.web_search_20250305.max_uses: Input should be greater than 0'],
    [{ ...SEARCH, max_uses: 1.5 }, 'tools.0.web_search_20250305.max_uses: Input should be a valid integer'],
    [{ ...FETCH, max_uses: '2' }, 'tools.0.web_fetch_20250910.max_uses: Input should be a valid integer'],
    [{ ...SEARCH, allowed_domains: 'github.com' }, 'tools.0.web_search_20250305.allowed_domains: Input should be a valid list'],
    [{ ...FETCH, blocked_domains: ['ok.com', 7] }, 'tools.0.web_fetch_20250910.blocked_domains.1: Input should be a valid string']
  ])('rejects %p', (tool, message) => {
    expect(rejectionOf({ ...VALID, tools: [tool] })).toEqual(invalidRequest(message));
  });

  it('rejects two web tools of one kind: the names must be unique', () => {
    const tools = [SEARCH, FETCH, { type: 'web_search_20260209', name: 'web_search' }];

    expect(rejectionOf({ ...VALID, tools })).toEqual(invalidRequest('tools: Tool names must be unique.'));
  });
});
