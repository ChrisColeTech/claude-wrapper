/**
 * The startup checks on `system/init` (spec sections 3, 9 and 10) for connectors: every mounted
 * connector must read `connected`, else the turn fails before commit with a 400 naming the server,
 * its status and upstream's error text; a connector's tools, which only its server knows, are
 * expected tools; nothing else is.
 */
import { startupError } from '../../../../src/anthropic/conductor/startup-checks';
import { SystemInitFrame } from '../../../../src/upstream/frames';
import { initFrame } from '../../../mocks/anthropic/turn-frames';

const CHECKS = { model: 'claude-fable-5-1', tools: ['mcp__client__get_weather'], connectors: ['docs', 'wiki'] };
const init = (fields: object) => initFrame(fields) as SystemInitFrame;
const connected = [{ name: 'client', status: 'connected' }, { name: 'docs', status: 'connected' }, { name: 'wiki', status: 'connected' }];

const errorOf = (fields: object) => {
  const error = startupError(init(fields), CHECKS);
  return error && { status: error.status, type: error.type, message: error.message, retryable: error.retryable };
};

describe('startup checks: connectors (spec section 9)', () => {
  it("passes when every connector is connected, its tools among upstream's", () => {
    expect(errorOf({
      mcp_servers: connected, tools: ['mcp__client__get_weather', 'mcp__docs__search', 'mcp__docs__read', 'mcp__wiki__page']
    })).toBeNull();
  });

  it.each(['failed', 'needs-auth', 'pending'])('fails a connector whose status is %s, before commit, as a 400', status => {
    expect(errorOf({
      mcp_servers: [connected[0], connected[1], { name: 'wiki', status }], tools: ['mcp__client__get_weather', 'mcp__docs__search']
    })).toEqual({
      status: 400, type: 'invalid_request_error', retryable: false,
      message: `mcp_servers: the MCP server "wiki" is not connected (status "${status}")`
    });
  });

  it("names upstream's error text for a server it skipped", () => {
    expect(errorOf({
      mcp_servers: connected.slice(0, 2), tools: ['mcp__client__get_weather'],
      mcp_server_errors: [{ name: 'wiki', type: 'invalid_config', message: 'url must use https' }]
    })).toEqual(expect.objectContaining({
      status: 400, message: 'mcp_servers: the MCP server "wiki" is not connected (not listed by upstream): invalid_config: url must use https'
    }));
  });

  it("still fails a tool under no mounted server's name", () => {
    expect(errorOf({ mcp_servers: connected, tools: ['mcp__client__get_weather', 'mcp__other__x', 'Bash'] })).toEqual(expect.objectContaining({
      status: 500, message: "upstream's tools differ from the turn's: unexpected mcp__other__x, Bash; missing none"
    }));
  });
});
