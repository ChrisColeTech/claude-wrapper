/**
 * The real-CLI scenarios' surface (`tests/e2e/upstream/harness.ts`, `productionSurface`): closing
 * it closes the control server a turn started. A count or turn with client or web tools starts
 * the surface's control server; left listening, it kept Jest from exiting after the count_tokens
 * scenario. Driven here with the scripted runner, so nothing reaches the real CLI.
 */
import Anthropic from '@anthropic-ai/sdk';
import * as http from 'http';
import { GET_WEATHER } from '../mocks/anthropic/client-tool-recordings';
import { STATE } from '../mocks/anthropic/plan-context';
import { initFrame, streamEvent } from '../mocks/anthropic/turn-frames';
import { createScriptedRunner } from '../mocks/upstream/scripted-runner';
import { productionSurface } from '../e2e/upstream/harness';

/** The status a GET to `url` answers with on a new connection, or the error code when nothing listens there. */
function probe(url: string): Promise<number | string> {
  return new Promise(resolve => {
    http.get(url, { agent: false }, response => { response.resume(); resolve(response.statusCode ?? 0); })
      .on('error', (error: Error & { code?: string }) => resolve(error.code ?? 'error'));
  });
}

describe("the real-CLI scenarios' production surface", () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('closes, with the HTTP server, the control server a count with a client tool started', async () => {
    const runner = createScriptedRunner();
    const surface = await productionSurface(STATE, { runner });
    const counted = surface.client().messages.countTokens({
      model: 'fable', tools: [GET_WEATHER as Anthropic.Tool], messages: [{ role: 'user', content: 'Weather in Paris?' }]
    });
    const { spec, process: upstream } = await runner.nextRun();
    const bridgeUrl = String(JSON.parse(spec.runDir?.files['mcp-config.json'] ?? '{}').mcpServers.client.url);
    upstream.frames(initFrame({ tools: ['mcp__client__get_weather'] }), streamEvent({
      type: 'message_delta', delta: { stop_reason: 'max_tokens', stop_sequence: null }, usage: { input_tokens: 7, output_tokens: 1 }
    }));
    await counted;
    upstream.exit(0);
    const listening = await probe(bridgeUrl);

    await surface.close();

    expect(listening).toBe(404);
    expect(await probe(bridgeUrl)).toBe('ECONNREFUSED');
  });
});
