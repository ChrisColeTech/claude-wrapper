/**
 * Tool types (spec sections 4.4 and 8): client tools and the web search and web fetch versions
 * pass to their tickets; every server tool type the surface cannot serve is a 400 naming the type
 * at the client's index, and a web tool carrying both domain lists is a 400, as on the real API.
 */
import { SurfaceError } from '../../../../src/anthropic/http/surface-error';
import { invalidRequest, planDefault, rejectionOf } from '../../../mocks/anthropic/plan-context';

const VALID = { model: 'opus', max_tokens: 1024, messages: [{ role: 'user', content: 'Hello' }] };
const withTools = (tools: unknown) => ({ ...VALID, tools });
const CLIENT_TOOL = { name: 'get_weather', description: 'Weather', input_schema: { type: 'object', properties: {} } };
const unsupported = (index: number, type: string) =>
  invalidRequest(`tools.${index}: tool type "${type}" is not supported on this surface`);
const BOTH_LISTS = (index: number) =>
  invalidRequest(`tools.${index}: use either allowed_domains or blocked_domains, not both`);

const WEB_TOOLS = [
  ['web_search_20250305', 'web_search'], ['web_search_20260209', 'web_search'], ['web_search_20260318', 'web_search'],
  ['web_fetch_20250910', 'web_fetch'], ['web_fetch_20260209', 'web_fetch'], ['web_fetch_20260309', 'web_fetch'],
  ['web_fetch_20260318', 'web_fetch']
];

describe('planTurn validates tool types (spec sections 4.4, 8)', () => {
  it.each(WEB_TOOLS)('accepts client tools, typed or not, beside the web tool %s', (type, name) => {
    const tools = [
      CLIENT_TOOL, { ...CLIENT_TOOL, name: 'b', type: 'custom' }, { ...CLIENT_TOOL, name: 'c', type: null }, { type, name }
    ];

    expect(planDefault(withTools(tools))).not.toBeInstanceOf(SurfaceError);
  });

  it.each([
    ['code_execution_20250825'], ['code_execution_20260521'], ['text_editor_20250728'], ['bash_20250124'],
    ['computer_20251124'], ['computer_toolset_20260801'], ['memory_20250818'], ['tool_search_tool_regex_20251119'],
    ['tool_search_tool_bm25'], ['browser_toolset_20260801'], ['advisor_20260301'], ['mcp_toolset'],
    ['web_search_20240101'], ['web_search'], ['function']
  ])('rejects the server tool type %s, naming it at the client’s index', (type) => {
    expect(rejectionOf(withTools([CLIENT_TOOL, { type, name: 'x' }]))).toEqual(unsupported(1, type));
  });

  it.each(WEB_TOOLS)('rejects %s carrying both allowed_domains and blocked_domains', (type, name) => {
    const tool = { type, name, allowed_domains: ['example.com'], blocked_domains: ['example.org'] };

    expect(rejectionOf(withTools([tool]))).toEqual(BOTH_LISTS(0));
  });

  it.each([
    [{ allowed_domains: ['example.com'] }], [{ blocked_domains: ['example.org'] }],
    [{ allowed_domains: ['example.com'], blocked_domains: null }], [{ allowed_domains: null, blocked_domains: [] }]
  ])('accepts a web tool with one domain list: %p', (lists) => {
    expect(planDefault(withTools([{ type: 'web_search_20260209', name: 'web_search', ...lists }])))
      .not.toBeInstanceOf(SurfaceError);
  });

  it('checks the shape of the list', () => {
    expect(rejectionOf(withTools(CLIENT_TOOL))).toEqual(invalidRequest('tools: Input should be a valid list'));
    expect(rejectionOf(withTools([CLIENT_TOOL, 'web_search']))).toEqual(
      invalidRequest('tools.1: Input should be a valid dictionary')
    );
    expect(rejectionOf(withTools([{ ...CLIENT_TOOL, type: 7 }]))).toEqual(
      invalidRequest('tools.0.type: Input should be a valid string')
    );
  });

  it('accepts tools absent, null or empty', () => {
    for (const tools of [undefined, null, []]) {
      expect(planDefault(withTools(tools))).not.toBeInstanceOf(SurfaceError);
    }
  });
});
