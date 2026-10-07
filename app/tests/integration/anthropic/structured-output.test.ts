/**
 * Structured output through the official SDK (spec section 12): `output_config.format` reaches
 * upstream as `--json-schema`, and upstream's `StructuredOutput` call comes back as one JSON text
 * block that the SDK's `parse()` helpers accept, streaming and not. The schema's startup rejection
 * is a 400 before commit; upstream running out of retries is an error after it.
 */
import Anthropic from '@anthropic-ai/sdk';
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';
import { ANTHROPIC_SETTING_ENV } from '../../../src/config/anthropic-settings';
import { createReplayRunner, ReplayRunner } from '../../../src/upstream/runner';
import { STATE } from '../../mocks/anthropic/plan-context';
import { envelopeOf, rejectionOf, SurfaceHarness, startSurface } from '../../mocks/anthropic/surface-harness';
import { structuredAnswer as answer } from '../../mocks/anthropic/structured-output-frames';
import { initFrame, resultFrame } from '../../mocks/anthropic/turn-frames';
import { waitFor } from '../../mocks/shared/wait-for';
import { loadRecording, recordedStdout } from '../../mocks/upstream/recordings';
import { createScriptedRunner, ScriptedRun, ScriptedRunner } from '../../mocks/upstream/scripted-runner';

const RECORDED = 'cli-probes/t3-json-schema-stream.jsonl';
const WORD = { type: 'object', properties: { word: { type: 'string' } }, required: ['word'] } as const;
const messages = [{ role: 'user' as const, content: 'Reply with the single word pong.' }];
const params = { model: 'fable', max_tokens: 1024, messages, output_config: { format: jsonSchemaOutputFormat(WORD) } };

const flagValue = (flags: string[], flag: string): string | undefined =>
  (flags.includes(flag) ? flags[flags.indexOf(flag) + 1] : undefined);

describe('Anthropic surface: structured output (recorded t3-json-schema-stream)', () => {
  const structured = (recordedStdout(RECORDED) as { type: string; structured_output?: unknown }[])
    .find(frame => frame.type === 'result')?.structured_output;
  let surface: SurfaceHarness;
  let runner: ReplayRunner;

  beforeEach(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    runner = createReplayRunner([loadRecording(RECORDED)], { timeScale: 0 });
    surface = await startSurface({ runner, stateDirectory: STATE });
  });

  afterEach(async () => {
    await surface.close();
  });

  it("messages.parse(): parsed_output is the object upstream produced, and the schema went to --json-schema", async () => {
    const message = await surface.client().messages.parse(params);

    expect(message.parsed_output).toEqual(structured);
    expect(message.stop_reason).toBe('end_turn');
    expect(message.content.map(block => block.type)).toEqual(['text']);
    const sent = flagValue(runner.started[0]?.spec.flags ?? [], '--json-schema');
    expect(JSON.parse(sent as string)).toEqual(params.output_config.format.schema);
  });

  it('messages.stream().finalMessage(): the same parsed_output', async () => {
    const message = await surface.client().messages.stream(params).finalMessage();

    expect(message.parsed_output).toEqual(structured);
  });

  it('streams one text block and no tool call', async () => {
    const stream = await surface.client().messages.create({ ...params, stream: true });

    const shapes: string[] = [];
    for await (const event of stream) {
      shapes.push(event.type === 'content_block_start' ? `${event.type} ${event.content_block.type}` : event.type);
    }

    expect(shapes.filter(shape => shape.startsWith('content_block_start'))).toEqual(['content_block_start text']);
    expect(shapes[shapes.length - 1]).toBe('message_stop');
  });
});

describe('Anthropic surface: structured output, scripted upstream', () => {
  let surface: SurfaceHarness;
  let runner: ScriptedRunner;

  async function nextRun(): Promise<ScriptedRun> {
    const run = await runner.nextRun();
    await waitFor(() => run.process.writtenLines().length >= 1);
    return run;
  }

  beforeEach(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    runner = createScriptedRunner();
  });

  afterEach(async () => {
    await surface.close();
    delete process.env[ANTHROPIC_SETTING_ENV.redact];
  });

  it.each([
    ['messages.parse', (client: Anthropic) => client.messages.parse(params)],
    ['messages.stream().finalMessage()', (client: Anthropic) => client.messages.stream(params).finalMessage()]
  ])("%s: upstream's startup rejection of the schema is a 400 naming output_config.format.schema", async (_name, send) => {
    surface = await startSurface({ runner, stateDirectory: STATE });
    const response = rejectionOf(send(surface.client()));
    const run = await runner.nextRun();

    run.process.stderr('Error: --json-schema is not a valid JSON Schema: data/type must be equal to one of the allowed values\n');
    run.process.exit(1);
    const error = await response;

    expect(error).toBeInstanceOf(Anthropic.BadRequestError);
    expect(envelopeOf(error).error).toEqual({
      type: 'invalid_request_error',
      message: 'output_config.format.schema is not a valid JSON Schema: data/type must be equal to one of the allowed values'
    });
    expect(error.headers?.get('x-should-retry')).toBe('false');
  });

  it('drops an answer that failed the schema and parses the retry', async () => {
    surface = await startSurface({ runner, stateDirectory: STATE });
    const response = surface.client().messages.parse(params);
    const run = await nextRun();

    run.process.frames(initFrame({ tools: ['StructuredOutput'] }), ...answer('toolu_1', '{"wrd": "pong"}', true),
      ...answer('toolu_2', '{"word": "pong"}'), resultFrame({ stop_reason: 'tool_use', num_turns: 3 }));
    await waitFor(() => run.process.inputEnded());
    run.process.exit(0);

    expect((await response).parsed_output).toEqual({ word: 'pong' });
  });

  it('is an SSE error after commit when upstream runs out of retries', async () => {
    surface = await startSurface({ runner, stateDirectory: STATE });
    const ended = surface.client().messages.stream(params).finalMessage()
      .then(() => undefined, (error: InstanceType<typeof Anthropic.APIError>) => error);
    const run = await nextRun();

    run.process.frames(initFrame({ tools: ['StructuredOutput'] }), ...answer('toolu_1', '{}', true), resultFrame({
      subtype: 'error_max_structured_output_retries', is_error: true, stop_reason: 'tool_use',
      errors: ['Failed to provide valid structured output after 5 attempts']
    }));
    const error = await ended;
    run.process.exit(0);

    expect(error?.status).toBeUndefined();
    expect(envelopeOf(error as InstanceType<typeof Anthropic.APIError>).error)
      .toEqual({ type: 'api_error', message: 'Failed to provide valid structured output after 5 attempts' });
  });

  it('fails before commit when upstream does not report its StructuredOutput tool', async () => {
    surface = await startSurface({ runner, stateDirectory: STATE });
    const response = rejectionOf(surface.client().messages.parse(params));
    const run = await nextRun();

    run.process.frames(initFrame({ tools: [] }));
    const error = await response;
    run.process.exit(0);

    expect(error.status).toBe(500);
    expect(envelopeOf(error).error.message).toMatch(/missing StructuredOutput/);
  });

  it('keeps the JSON parseable with an armed string that is also a JSON literal', async () => {
    process.env[ANTHROPIC_SETTING_ENV.redact] = 'true';
    surface = await startSurface({ runner, stateDirectory: STATE });
    const response = surface.client().messages.parse(params);
    const run = await nextRun();

    run.process.frames(initFrame({ tools: ['StructuredOutput'] }), ...answer('toolu_1', '{"word": "true", "ok": true}'),
      resultFrame({ stop_reason: 'tool_use', num_turns: 2 }));
    await waitFor(() => run.process.inputEnded());
    run.process.exit(0);

    expect((await response).parsed_output).toEqual({ word: '[redacted]', ok: true });
  });
});
