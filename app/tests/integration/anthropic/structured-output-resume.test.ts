/**
 * `output_config.format` is run-bound (spec section 12): a format run that parks on a client tool
 * keeps its `--json-schema` when the next request resumes it, so that turn's `StructuredOutput`
 * call is still rendered as the JSON text block, whatever the resuming request says about format.
 */
import Anthropic from '@anthropic-ai/sdk';
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { callWeather, connectAsUpstream, toolResultFrame, weatherCalls } from '../../mocks/anthropic/bridge-upstream';
import { GET_WEATHER } from '../../mocks/anthropic/client-tool-recordings';
import { STATE } from '../../mocks/anthropic/plan-context';
import { SurfaceHarness, startSurface } from '../../mocks/anthropic/surface-harness';
import { structuredAnswer } from '../../mocks/anthropic/structured-output-frames';
import { initFrame, resultFrame } from '../../mocks/anthropic/turn-frames';
import { waitFor } from '../../mocks/shared/wait-for';
import { createScriptedRunner, ScriptedRunner } from '../../mocks/upstream/scripted-runner';

const PARIS = { id: 'toolu_paris', city: 'Paris' };
const WEATHER = { type: 'object', properties: { warm: { type: 'boolean' } }, required: ['warm'] } as const;
const ASK: Anthropic.MessageParam = { role: 'user', content: 'Is it warm in Paris?' };
const REQUEST = { model: 'fable', max_tokens: 1024, tools: [GET_WEATHER as Anthropic.Tool] };

describe('Anthropic surface: structured output on a run held open for a client tool', () => {
  let surface: SurfaceHarness;
  let runner: ScriptedRunner;
  let mcp: Client | undefined;

  beforeEach(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    runner = createScriptedRunner();
    surface = await startSurface({ runner, stateDirectory: STATE });
  });

  afterEach(async () => {
    await mcp?.close();
    mcp = undefined;
    await surface.close();
  });

  it("renders the resumed turn's StructuredOutput answer as JSON text, though the resuming request has no format", async () => {
    const client = surface.client();
    const asking = client.messages.create({ ...REQUEST, messages: [ASK], output_config: { format: jsonSchemaOutputFormat(WEATHER) } });
    const { spec, process: upstream } = await runner.nextRun();
    await waitFor(() => upstream.writtenLines().length === 1);
    mcp = await connectAsUpstream(spec);
    upstream.frames(initFrame({ tools: ['mcp__client__get_weather', 'StructuredOutput'] }), ...weatherCalls([PARIS]));
    const waiting = callWeather(mcp, PARIS);
    const parked = await asking;
    expect(spec.flags).toContain('--json-schema');
    expect(parked.stop_reason).toBe('tool_use');

    const resuming = client.messages.create({ ...REQUEST, messages: [ASK, { role: 'assistant', content: parked.content },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: PARIS.id, content: 'Paris: 24 C' }] }] });
    await waiting;
    upstream.frames(toolResultFrame(PARIS.id, 'Paris: 24 C'), ...structuredAnswer('toolu_answer', '{"warm": true}'),
      resultFrame({ stop_reason: 'tool_use', num_turns: 3 }));
    const answer = await resuming;

    expect(answer.stop_reason).toBe('end_turn');
    expect(answer.content.map(block => block.type)).toEqual(['text']);
    expect(JSON.parse((answer.content[0] as Anthropic.TextBlock).text)).toEqual({ warm: true });
    await waitFor(() => upstream.inputEnded());
    upstream.exit(0);
  });
});
