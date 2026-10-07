/**
 * Client tools in the plan (spec sections 4.4, 7 and 10): each declared tool is validated at the
 * client's index (names `^[a-zA-Z0-9_-]{1,115}$`, since upstream sees them prefixed
 * `mcp__client__`), and a turn that exposes client tools mounts the bridge server: its tools go to
 * the bridge verbatim, `--mcp-config` names the run's own config file, `--allowedTools` lists
 * every `mcp__client__<name>`, and `system/init` must report exactly those tools. `tool_choice:
 * none` leaves the bridge unmounted.
 */
import { SurfaceError } from '../../../../src/anthropic/http/surface-error';
import { TurnPlan } from '../../../../src/anthropic/request';
import { invalidRequest, planDefault, rejectionOf } from '../../../mocks/anthropic/plan-context';

const VALID = { model: 'opus', max_tokens: 1024, messages: [{ role: 'user', content: 'Weather in Paris?' }] };
const SCHEMA = { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] };
const WEATHER = { name: 'get_weather', description: 'Current weather for a city', input_schema: SCHEMA };
const TIME = { name: 'get-time_v2', input_schema: { type: 'object' } };
const WEB_SEARCH = { type: 'web_search_20250305', name: 'web_search' };
const withTools = (tools: unknown, fields: object = {}) => ({ ...VALID, tools, ...fields });
const planOf = (request: unknown) => planDefault(request) as TurnPlan;
const flagValue = (flags: readonly string[], flag: string) => flags[flags.indexOf(flag) + 1];
const name = (length: number) => 'n'.repeat(length);

describe('planTurn validates client tools (spec section 4.4)', () => {
  it('accepts names of letters, digits, underscores and hyphens up to 115 characters', () => {
    const tools = [WEATHER, TIME, { name: name(115), input_schema: SCHEMA }, { name: 'a', input_schema: SCHEMA }];

    expect(planDefault(withTools(tools))).not.toBeInstanceOf(SurfaceError);
  });

  it.each([116, 120, 128])('rejects a %i-character name, legal on the real API, before any spawn', (length) => {
    expect(rejectionOf(withTools([WEB_SEARCH, { name: name(length), input_schema: SCHEMA }])))
      .toEqual(invalidRequest('tools.1.custom.name: String should have at most 115 characters'));
  });

  it('rejects a name over 128 characters with the real API’s own limit', () => {
    expect(rejectionOf(withTools([{ name: name(129), input_schema: SCHEMA }])))
      .toEqual(invalidRequest('tools.0.custom.name: String should have at most 128 characters'));
  });

  it.each(['', 'get weather', 'get.weather', 'wetter_für_paris', 'a/b'])('rejects the name %p with the API’s pattern', (bad) => {
    expect(rejectionOf(withTools([WEATHER, { name: bad, input_schema: SCHEMA }])))
      .toEqual(invalidRequest("tools.1.custom.name: String should match pattern '^[a-zA-Z0-9_-]{1,128}$'"));
  });

  it('checks the name, description and input_schema fields', () => {
    expect(rejectionOf(withTools([{ input_schema: SCHEMA }]))).toEqual(invalidRequest('tools.0.custom.name: Field required'));
    expect(rejectionOf(withTools([{ name: 7, input_schema: SCHEMA }])))
      .toEqual(invalidRequest('tools.0.custom.name: Input should be a valid string'));
    expect(rejectionOf(withTools([{ ...WEATHER, description: 7 }])))
      .toEqual(invalidRequest('tools.0.custom.description: Input should be a valid string'));
    expect(rejectionOf(withTools([{ name: 'x' }]))).toEqual(invalidRequest('tools.0.custom.input_schema: Field required'));
    expect(rejectionOf(withTools([{ name: 'x', input_schema: 'object' }])))
      .toEqual(invalidRequest('tools.0.custom.input_schema: Input should be a valid dictionary'));
    expect(rejectionOf(withTools([{ name: 'x', input_schema: { properties: {} } }])))
      .toEqual(invalidRequest('tools.0.custom.input_schema.type: Field required'));
    expect(rejectionOf(withTools([{ name: 'x', input_schema: { type: 'array' } }])))
      .toEqual(invalidRequest("tools.0.custom.input_schema.type: Input should be 'object'"));
  });

  it('rejects two client tools with the same name', () => {
    expect(rejectionOf(withTools([WEATHER, TIME, { ...WEATHER, description: 'again' }])))
      .toEqual(invalidRequest('tools: Tool names must be unique.'));
  });
});

describe('planTurn mounts the bridge server for client tools (spec sections 7, 10)', () => {
  it('hands the client tools to the bridge verbatim, typed or not, and leaves the web tools out', () => {
    const typed = { ...TIME, type: 'custom', cache_control: { type: 'ephemeral' }, strict: true };

    expect(planOf(withTools([WEATHER, WEB_SEARCH, typed])).bridgeTools).toEqual([
      { name: 'get_weather', description: 'Current weather for a city', input_schema: SCHEMA },
      { name: 'get-time_v2', input_schema: { type: 'object' } }
    ]);
  });

  it('passes the run’s MCP config file and allows exactly the bridge’s tools', () => {
    const { runSpec, startupChecks } = planOf(withTools([WEATHER, TIME]));

    expect(flagValue(runSpec.flags, '--mcp-config')).toBe('/var/lib/claude-wrapper/runs/run-0001/mcp-config.json');
    expect(flagValue(runSpec.flags, '--allowedTools')).toBe('mcp__client__get_weather,mcp__client__get-time_v2');
    expect(flagValue(runSpec.flags, '--tools')).toBe('');
    expect(startupChecks.tools).toEqual(['mcp__client__get_weather', 'mcp__client__get-time_v2']);
    expect(runSpec.flags.indexOf('--mcp-config')).toBeGreaterThan(runSpec.flags.indexOf('--permission-prompts'));
    expect(runSpec.flags.indexOf('--mcp-config')).toBeLessThan(runSpec.flags.indexOf('--max-turns'));
  });

  it.each([
    ['no tools', {}],
    ['an empty list', { tools: [] }],
    ['tool_choice none', { tools: [WEATHER, TIME], tool_choice: { type: 'none' } }]
  ])('mounts nothing for %s', (_case, fields) => {
    const { runSpec, startupChecks, bridgeTools } = planOf({ ...VALID, ...fields });

    expect(bridgeTools).toEqual([]);
    expect(runSpec.flags).not.toContain('--mcp-config');
    expect(flagValue(runSpec.flags, '--allowedTools')).toBe('');
    expect(startupChecks.tools).toEqual([]);
  });

  it('mounts no bridge server for a web tool alone', () => {
    const { runSpec, bridgeTools } = planOf(withTools([WEB_SEARCH]));

    expect(bridgeTools).toEqual([]);
    expect(runSpec.flags).not.toContain('--mcp-config');
  });

  it('still validates the tools tool_choice none hides', () => {
    expect(rejectionOf(withTools([{ name: name(116), input_schema: SCHEMA }], { tool_choice: { type: 'none' } })))
      .toEqual(invalidRequest('tools.0.custom.name: String should have at most 115 characters'));
  });
});
