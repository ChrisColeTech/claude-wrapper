/**
 * E2E (real CLI, behind UPSTREAM_E2E=1): a run spawned with the per-run MCP config file calls
 * one client tool through the bridge server on the control server, parks, takes the result the
 * client delivers after a delay, and completes in two model calls with no permission denial.
 *
 *   UPSTREAM_E2E=1 npm --prefix app run test:e2e -- tests/e2e/upstream/bridge-run.test.ts
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { EnvironmentManager } from '../../../src/config/env';
import { BRIDGE_SERVER_NAME, CLIENT_TOOL_PREFIX, ClientTool, createBridge, ToolUse } from '../../../src/upstream/bridge';
import { ControlServer, createControlServer } from '../../../src/upstream/control-server';
import { Frame, ResultFrame, SystemInitFrame, UserFrame } from '../../../src/upstream/frames';
import { bridgeServerEntry, writeMcpConfigFile } from '../../../src/upstream/mcp-config';
import { createUpstreamHarness, describeUpstream } from './harness';

const WEATHER: ClientTool = {
  name: 'get_weather',
  description: 'Get the current weather for a city. Returns a JSON object.',
  input_schema: { type: 'object', properties: { city: { type: 'string', description: 'City name, e.g. Paris' } }, required: ['city'] }
};
const PROMPT = 'Use the get_weather tool for Paris, then reply with one short sentence about the weather there. Do not call any other tool.';
const CLIENT_DELAY_MS = 3_000;

const weatherFor = (toolUse: ToolUse): string =>
  JSON.stringify({ city: (toolUse.input as { city?: string }).city ?? '?', temp_c: 18, sky: 'overcast' });

describeUpstream('tool bridge against the real CLI', () => {
  const harness = createUpstreamHarness();
  let control: ControlServer;
  let runDir: string;

  beforeEach(async () => {
    control = createControlServer();
    await control.start();
    runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upstream-e2e-run-'));
  });

  afterEach(async () => {
    await harness.cleanup();
    await control.close();
    fs.rmSync(runDir, { recursive: true, force: true });
  });

  it('parks on one client tool call, resumes on the delayed result, and completes with num_turns 2', async () => {
    const bridge = createBridge([WEATHER]);
    const runId = `e2e-bridge-${process.pid}`;
    const { mcpUrl, token } = control.registerRun(runId, { mcpHandler: bridge.mcpHandler });
    const { parkTtlMs } = EnvironmentManager.getAnthropicSettings();
    const config = await writeMcpConfigFile(runDir, { [BRIDGE_SERVER_NAME]: bridgeServerEntry({ url: mcpUrl, token }, parkTtlMs) });
    const { run, spec } = harness.start({
      extraFlags: ['--mcp-config', config.path], allowedTools: [`${CLIENT_TOOL_PREFIX}${WEATHER.name}`]
    });
    expect(JSON.stringify({ flags: spec.flags, env: spec.env })).not.toContain(token);

    const parks: ToolUse[][] = [];
    bridge.events.subscribe(event => {
      if (event.kind !== 'park') return;
      parks.push(event.toolUses);
      const unpark = run.park();
      setTimeout(() => {
        bridge.deliver(event.toolUses.map(toolUse => ({ type: 'tool_result', tool_use_id: toolUse.id, content: weatherFor(toolUse) })));
        unpark();
      }, CLIENT_DELAY_MS);
    });

    const frames: Frame[] = [];
    await run.send({ role: 'user', content: [{ type: 'text', text: PROMPT }] });
    for await (const frame of run.frames) {
      frames.push(frame);
      bridge.onFrame(frame);
      if (frame.type === 'result') void run.close();
    }
    const exit = await run.exited;
    control.releaseRun(runId);
    await config.remove();

    const init = frames.find((frame): frame is SystemInitFrame => frame.type === 'system' && frame.subtype === 'init');
    expect(init?.tools).toEqual([`${CLIENT_TOOL_PREFIX}${WEATHER.name}`]);
    expect(init?.mcp_servers).toEqual([expect.objectContaining({ name: BRIDGE_SERVER_NAME, status: 'connected' })]);
    expect(parks).toEqual([[{ id: expect.stringMatching(/^toolu_/), name: WEATHER.name, input: { city: expect.any(String) } }]]);
    const parked = (parks[0] as ToolUse[])[0] as ToolUse;
    const toolResult = frames.find((frame): frame is UserFrame => frame.type === 'user' && JSON.stringify(frame.message).includes(parked.id));
    expect(JSON.stringify(toolResult?.message.content)).toContain('overcast');
    const result = frames.find((frame): frame is ResultFrame => frame.type === 'result');
    expect(result).toEqual(expect.objectContaining({ subtype: 'success', is_error: false, num_turns: 2, permission_denials: [] }));
    expect(exit).toEqual(expect.objectContaining({ code: 0, signal: null }));
  }, 180_000);
});
