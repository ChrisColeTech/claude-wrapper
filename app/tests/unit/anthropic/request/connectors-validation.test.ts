/**
 * Connector validation before spawn (spec sections 4.1, 4.4 and 9): the beta gate, the operator's
 * host list, the real API's rules on `mcp_servers` and `mcp_toolset` (type `url`, an `https` url,
 * unique names, exactly one toolset per server, every toolset naming a declared server) and the
 * surface's own (no server named `client`; a name upstream can address). Each is a 400
 * `invalid_request_error` stating the rule; nothing is spawned.
 */
import { SurfaceError } from '../../../../src/anthropic/surface-error';
import { planCountTokens, planTurn, RunContext } from '../../../../src/anthropic/request';
import { ANTHROPIC_SETTING_DEFAULTS } from '../../../../src/config/anthropic-settings';
import { connectorRequest, MCP_BETA } from '../../../mocks/anthropic/connector-recordings';
import { invalidRequest, NO_SESSIONS, runContext, shippedCatalogue } from '../../../mocks/anthropic/plan-context';

const VALID = { model: 'opus', max_tokens: 1024, messages: [{ role: 'user', content: 'Use the docs.' }] };
const HOSTS = 'CLAUDE_WRAPPER_CONNECTOR_HOSTS';
const SERVER = { type: 'url', url: 'https://docs.example.com/mcp', name: 'docs' };
const TOOLSET = { type: 'mcp_toolset', mcp_server_name: 'docs' };

const context = (hosts: string[] = ['*'], betas: string[] = [MCP_BETA]): RunContext =>
  runContext({ settings: { ...ANTHROPIC_SETTING_DEFAULTS, connectorHosts: hosts }, betas });

function rejection(fields: object, ctx: RunContext = context()): { status: number; type: string; message: string } {
  const result = planTurn({ ...VALID, ...fields }, shippedCatalogue, NO_SESSIONS, ctx);
  if (!(result instanceof SurfaceError)) throw new Error('expected a SurfaceError, got a plan');
  return { status: result.status, type: result.type, message: result.message };
}

describe('the beta gate (spec section 9): without mcp-client-2025-11-20 the fields are extra inputs', () => {
  it.each([
    ['mcp_servers', { mcp_servers: [SERVER], tools: [TOOLSET] }, 'mcp_servers: Extra inputs are not permitted'],
    ['an empty mcp_servers', { mcp_servers: [] }, 'mcp_servers: Extra inputs are not permitted'],
    ['an mcp_toolset alone', { tools: [{ name: 'x', input_schema: { type: 'object' } }, TOOLSET] }, 'tools.1.mcp_toolset: Extra inputs are not permitted']
  ])('%s', (_case, fields, message) => {
    expect(rejection(fields, context(['*'], ['some-other-beta']))).toEqual(invalidRequest(message));
  });

  it('reads mcp_servers: null as absent', () => {
    expect(planTurn({ ...VALID, mcp_servers: null }, shippedCatalogue, NO_SESSIONS, context(['*'], []))).not.toBeInstanceOf(SurfaceError);
  });

  it('gates count_tokens the same way, and takes mcp_servers there with the beta', () => {
    const body = { model: 'opus', messages: VALID.messages, ...connectorRequest('docs') };

    expect(planCountTokens(body, shippedCatalogue, context(['*'], []))).toEqual(
      expect.objectContaining({ message: 'mcp_servers: Extra inputs are not permitted' }));
    expect(planCountTokens(body, shippedCatalogue, context())).not.toBeInstanceOf(SurfaceError);
  });
});

describe("the operator's host list (spec section 9): a 400 naming the setting", () => {
  it('is off by default', () => {
    expect(rejection(connectorRequest('docs'), context([]))).toEqual(invalidRequest(
      `mcp_servers: connectors are off on this surface; the wrapper's operator turns them on by listing the hosts they may reach in ${HOSTS}`));
  });

  it('refuses a host outside the list, matching hosts without case', () => {
    expect(rejection(connectorRequest('docs'), context(['other.example.com']))).toEqual(invalidRequest(
      `mcp_servers.0.url: host "docs.example.com" is not in this surface's connector host list; the wrapper's operator allows it in ${HOSTS}`));
    expect(planTurn({ ...VALID, ...connectorRequest('docs') }, shippedCatalogue, NO_SESSIONS, context(['DOCS.example.com'])))
      .not.toBeInstanceOf(SurfaceError);
  });
});

describe("the real API's rules on mcp_servers and mcp_toolset, before any spawn (spec section 9)", () => {
  const servers = (...list: unknown[]) => ({ mcp_servers: list, tools: [TOOLSET] });

  it.each([
    ['not a list', { mcp_servers: {}, tools: [TOOLSET] }, 'mcp_servers: Input should be a valid list'],
    ['a server not a dictionary', servers('docs'), 'mcp_servers.0: Input should be a valid dictionary'],
    ['no type', servers({ ...SERVER, type: undefined }), 'mcp_servers.0.type: Field required'],
    ['type other than url', servers({ ...SERVER, type: 'stdio' }), "mcp_servers.0.type: Input should be 'url'"],
    ['no url', servers({ ...SERVER, url: undefined }), 'mcp_servers.0.url: Field required'],
    ['an http url', servers({ ...SERVER, url: 'http://docs.example.com/mcp' }), 'mcp_servers.0.url: must be an https URL'],
    ['not a url', servers({ ...SERVER, url: 'docs.example.com' }), 'mcp_servers.0.url: must be an https URL'],
    ['no name', servers({ ...SERVER, name: undefined }), 'mcp_servers.0.name: Field required'],
    ['a name that is not a string', servers({ ...SERVER, name: 7 }), 'mcp_servers.0.name: Input should be a valid string'],
    ['a token that is not a string', servers({ ...SERVER, authorization_token: 7 }), 'mcp_servers.0.authorization_token: Input should be a valid string'],
    ['tool_configuration not a dictionary', servers({ ...SERVER, tool_configuration: [] }), 'mcp_servers.0.tool_configuration: Input should be a valid dictionary'],
    ['enabled not a boolean', servers({ ...SERVER, tool_configuration: { enabled: 'no' } }), 'mcp_servers.0.tool_configuration.enabled: Input should be a valid boolean'],
    ['allowed_tools not a list of strings', servers({ ...SERVER, tool_configuration: { allowed_tools: [1] } }), 'mcp_servers.0.tool_configuration.allowed_tools.0: Input should be a valid string']
  ])('%s', (_case, fields, message) => {
    expect(rejection(fields)).toEqual(invalidRequest(message));
  });

  it('wants unique names', () => {
    expect(rejection({ mcp_servers: [SERVER, { ...SERVER, url: 'https://b.example.com/mcp' }], tools: [TOOLSET, TOOLSET] }))
      .toEqual(invalidRequest('mcp_servers: server names must be unique; "docs" is declared twice'));
  });

  it('wants every toolset to name a declared server', () => {
    expect(rejection({ mcp_servers: [SERVER], tools: [TOOLSET, { type: 'mcp_toolset', mcp_server_name: 'wiki' }] }))
      .toEqual(invalidRequest('tools.1.mcp_toolset.mcp_server_name: no server named "wiki" in mcp_servers'));
    expect(rejection({ mcp_servers: [SERVER], tools: [{ type: 'mcp_toolset' }] }))
      .toEqual(invalidRequest('tools.0.mcp_toolset.mcp_server_name: Field required'));
  });

  it('wants exactly one toolset per server', () => {
    expect(rejection({ mcp_servers: [SERVER], tools: [TOOLSET, TOOLSET] }))
      .toEqual(invalidRequest('tools.1.mcp_toolset: server "docs" already has an mcp_toolset; each server takes exactly one'));
    expect(rejection({ mcp_servers: [SERVER], tools: [] }))
      .toEqual(invalidRequest('mcp_servers.0: server "docs" has no mcp_toolset in tools; each server takes exactly one'));
  });

  it.each([
    ['default_config not a dictionary', { default_config: true }, 'tools.0.mcp_toolset.default_config: Input should be a valid dictionary'],
    ['default_config.enabled not a boolean', { default_config: { enabled: 1 } }, 'tools.0.mcp_toolset.default_config.enabled: Input should be a valid boolean'],
    ['configs not a dictionary', { configs: [] }, 'tools.0.mcp_toolset.configs: Input should be a valid dictionary'],
    ['a config not a dictionary', { configs: { search: true } }, 'tools.0.mcp_toolset.configs.search: Input should be a valid dictionary'],
    ['a pinned tool listing', { tools: [] }, 'tools.0.mcp_toolset.tools: pinned tool listings are not supported on this surface']
  ])('a toolset with %s', (_case, fields, message) => {
    expect(rejection({ mcp_servers: [SERVER], tools: [{ ...TOOLSET, ...fields }] })).toEqual(invalidRequest(message));
  });
});

describe("the surface's own rules (spec section 9)", () => {
  it("refuses a server named client, the bridge server's fixed name", () => {
    expect(rejection(connectorRequest('client'))).toEqual(invalidRequest(
      'mcp_servers.0.name: "client" is reserved on this surface (it names the server that carries the client\'s own tools)'));
  });

  it.each(['my docs', 'docs.v2', 'a__b', ''])('refuses a name upstream cannot address: %j', name => {
    expect(rejection(connectorRequest(name, 'https://docs.example.com/mcp'))).toEqual(invalidRequest(
      'mcp_servers.0.name: on this surface a server name holds only letters, digits, "_" and "-", and no "__" (upstream names its tools mcp__<name>__<tool>)'));
  });

  it('refuses disabling one tool of a server whose tools are not listed: no allow rule can express it', () => {
    expect(rejection({ mcp_servers: [SERVER], tools: [{ ...TOOLSET, configs: { delete_page: { enabled: false } } }] }))
      .toEqual(invalidRequest(
        'tools.0.mcp_toolset.configs.delete_page.enabled: false is supported on this surface only beside mcp_servers.0.tool_configuration.allowed_tools'));
  });
});
