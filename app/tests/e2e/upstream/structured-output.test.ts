/**
 * E2E (real CLI, behind UPSTREAM_E2E=1): structured output (spec section 12) through the whole
 * surface with its production runner. `output_config.format` reaches upstream as `--json-schema`;
 * the answer is one JSON text block that the SDK's `parse()` helpers accept, non-streaming and
 * streaming. A schema upstream refuses at startup is a 400 (no API call is made). The last test
 * continues a structured-output turn without a format: unverified whether the API accepts the
 * resumed history, whose `StructuredOutput` call then has no tool declared; if it fails, that is
 * the finding, and format turns must stop recording their fingerprint.
 *
 *   UPSTREAM_E2E=1 npm --prefix app run test:e2e -- tests/e2e/upstream/structured-output.test.ts
 */
import type Anthropic from '@anthropic-ai/sdk';
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createSpawnRunner, Runner, RunSpec } from '../../../src/upstream/runner';
import { openStateDirectory, StateDirectory } from '../../../src/upstream/state-directory';
import type { SurfaceHarness } from '../../mocks/anthropic/surface-harness';
import { waitFor } from '../../mocks/shared/wait-for';
import { describeUpstream, E2E_MODEL, productionSurface, removeStateRoot } from './harness';

const RUN_EXIT_WAIT_MS = 60_000;
const SCHEMA = {
  type: 'object',
  properties: { word: { type: 'string' }, count: { type: 'integer' } },
  required: ['word', 'count']
} as const;
const ASK: Anthropic.MessageParam = { role: 'user', content: 'Give the word pong and the number 3.' };
const params = { model: E2E_MODEL, max_tokens: 1024, messages: [ASK], output_config: { format: jsonSchemaOutputFormat(SCHEMA) } };

/** The production spawn runner, noting each run's spec (never logged: it carries the environment). */
function notingRunner(specs: RunSpec[]): Runner {
  const runner = createSpawnRunner();
  return { startRun: spec => { specs.push(spec); return runner.startRun(spec); } };
}

/** Every text block is JSON (what `parse()` requires), and no tool call reached the client. */
function expectOnlyJsonText(message: Anthropic.Message): void {
  expect(message.content.length).toBeGreaterThan(0);
  message.content.forEach(block => {
    expect(block.type).toBe('text');
    expect(() => JSON.parse((block as Anthropic.TextBlock).text)).not.toThrow();
  });
}

describeUpstream('structured output through the surface against the real CLI', () => {
  let root: string;
  let state: StateDirectory;
  let surface: SurfaceHarness;
  let specs: RunSpec[];

  const runsExited = () => waitFor(() => fs.readdirSync(state.runs).length === 0, RUN_EXIT_WAIT_MS);

  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'structured-output-e2e-'));
    state = openStateDirectory(root);
    specs = [];
    surface = await productionSurface(state, { runner: notingRunner(specs) });
  });

  afterEach(async () => {
    await runsExited();
    await surface.close();
    removeStateRoot(root, state.cwd);
  }, RUN_EXIT_WAIT_MS + 10_000);

  it('messages.parse(): parsed_output follows the schema, from one JSON text block', async () => {
    const message = await surface.client().messages.parse(params);

    expect(specs[0]?.flags).toContain('--json-schema');
    expect(message.stop_reason).toBe('end_turn');
    expectOnlyJsonText(message);
    expect(message.parsed_output?.word.toLowerCase()).toContain('pong');
    expect(message.parsed_output?.count).toBe(3);
  }, 120_000);

  it('messages.stream().finalMessage(): the same, streamed as text deltas', async () => {
    const stream = surface.client().messages.stream(params);
    const blocks: string[] = [];
    stream.on('streamEvent', event => {
      if (event.type === 'content_block_start') blocks.push(event.content_block.type);
    });

    const message = await stream.finalMessage();

    expect(blocks.every(type => type === 'text' || type === 'thinking')).toBe(true);
    expectOnlyJsonText(message);
    expect(message.parsed_output?.count).toBe(3);
  }, 120_000);

  it("is a 400 naming output_config.format.schema when upstream refuses the schema at startup", async () => {
    const error = await surface.client().messages.create({
      model: E2E_MODEL, max_tokens: 256, messages: [ASK],
      output_config: { format: { type: 'json_schema', schema: { type: 'object', properties: { word: { type: 'nonsense' } } } } }
    }).then(() => undefined, (failure: InstanceType<typeof Anthropic.APIError>) => failure);

    expect(error?.status).toBe(400);
    expect((error?.error as { error: { message: string } }).error.message).toMatch(/^output_config\.format\.schema /);
  }, 60_000);

  it('continues a structured-output turn without a format (unverified: the resumed history)', async () => {
    const client = surface.client();
    const first = await client.messages.parse(params);
    await runsExited();

    const second = await client.messages.create({
      model: E2E_MODEL, max_tokens: 256,
      messages: [ASK, { role: 'assistant', content: first.content }, { role: 'user', content: 'Say that word again, plain text.' }]
    });

    expect(specs[1]?.flags).toContain('--resume');
    expect(specs[1]?.flags).not.toContain('--json-schema');
    expect(second.content.map(block => (block.type === 'text' ? block.text : '')).join('').toLowerCase()).toContain('pong');
  }, 240_000);
});
