/**
 * E2E (real CLI, behind UPSTREAM_E2E=1): the two thinking mechanics spec section 12 relies on
 * without a probe that settled them. Each scenario plans its runs through `planTurn`, so the
 * child environment is the surface's, and compares a reference run with the run under test on
 * one prompt that invites long reasoning. The measured thinking tokens are printed.
 *
 * Scenario 2: `MAX_THINKING_TOKENS` under a binding budget on Haiku 4.5. The reference gets an
 * ample budget and must think past the small one (else the budget would not bind and the scenario
 * says so); the run with `budget_tokens: 1024` must think, and stay near its budget (the API calls
 * the budget a target, not a cap, so up to twice it is accepted).
 *
 * Scenario 3: `CLAUDE_CODE_DISABLE_THINKING=1` on a 5.x model, expected to have no effect (the
 * surface never sets it there): with the variable the model still thinks.
 *
 *   UPSTREAM_E2E=1 npm --prefix app run test:e2e -- tests/e2e/upstream/thinking.test.ts
 *
 * `UPSTREAM_E2E_5X_MODEL` picks scenario 3's model (default `claude-sonnet-5-5`). With
 * `UPSTREAM_E2E_RECORD_DIR` set, each run's frames are written there as JSON lines; scrub them
 * (`npm run fixtures:scrub`) before any becomes a fixture.
 */
import * as fs from 'fs';
import * as path from 'path';
import { Frame, JsonObject } from '../../../src/upstream/frames';
import { messageToSend } from '../../../src/anthropic/request';
import { createUpstreamHarness, describeUpstream, PlainRunOptions } from './harness';

const HAIKU = 'claude-haiku-4-5-20251001';
const FIVE_X_MODEL = process.env['UPSTREAM_E2E_5X_MODEL'] ?? 'claude-sonnet-5-5';
const BUDGET = 1024;
const RUN_TIMEOUT_MS = 600_000;
const PROMPT = 'How many positive integers below 10000 are divisible by 7 and have digits summing to 20? ' +
  'Work it out carefully and check your count before answering. Reply with only the number.';

interface Thought {
  /** `result.usage.output_tokens_details.thinking_tokens`. */
  tokens: number;
  /** Main-thread thinking blocks started. */
  blocks: number;
  env: Record<string, string>;
}

function thoughtOf(frames: Frame[], env: Record<string, string>): Thought {
  const result = frames.find(frame => frame.type === 'result');
  const details = result?.type === 'result'
    ? (result.usage['output_tokens_details'] as JsonObject | undefined)
    : undefined;
  const blocks = frames.filter(frame => frame.type === 'stream_event' && frame.parent_tool_use_id == null &&
    frame.event.type === 'content_block_start' && frame.event.content_block['type'] === 'thinking').length;
  return { tokens: Number(details?.['thinking_tokens'] ?? 0), blocks, env };
}

function record(name: string, frames: Frame[]): void {
  const dir = process.env['UPSTREAM_E2E_RECORD_DIR'];
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.jsonl`), frames.map(frame => JSON.stringify(frame)).join('\n') + '\n');
}

describeUpstream('thinking against the real CLI (spec section 12, e2e scenarios 2 and 3)', () => {
  const harness = createUpstreamHarness();

  /** One planned run to its exit; the run must succeed. */
  async function think(name: string, options: PlainRunOptions): Promise<Thought> {
    const { run, plan, spec } = harness.start({ prompt: PROMPT, ...options });
    const { frames, exit } = await harness.complete(run, messageToSend(plan.continuation));
    record(name, frames);
    expect(frames.find(frame => frame.type === 'result')).toEqual(expect.objectContaining({ is_error: false }));
    expect(exit.code).toBe(0);
    return thoughtOf(frames, spec.env);
  }

  afterEach(async () => {
    await harness.cleanup();
  });

  it(`scenario 2: MAX_THINKING_TOKENS=${BUDGET} binds Haiku 4.5's thinking`, async () => {
    const ample = await think('scenario-2-ample', {
      model: HAIKU, maxTokens: 16_000, fields: { thinking: { type: 'enabled', budget_tokens: 12_000 } }
    });
    const tight = await think('scenario-2-tight', {
      model: HAIKU, maxTokens: 16_000, fields: { thinking: { type: 'enabled', budget_tokens: BUDGET } }
    });
    console.info(`[scenario 2] thinking_tokens with budget 12000: ${ample.tokens}; with budget ${BUDGET}: ${tight.tokens}`);

    expect(tight.env['MAX_THINKING_TOKENS']).toBe(String(BUDGET));
    expect(tight.env).not.toHaveProperty('CLAUDE_CODE_DISABLE_THINKING');
    // Precondition: unbudgeted, the prompt needs more thinking than the small budget allows.
    expect(ample.tokens).toBeGreaterThan(BUDGET);
    expect(tight.blocks).toBeGreaterThan(0);
    expect(tight.tokens).toBeGreaterThan(0);
    expect(tight.tokens).toBeLessThanOrEqual(2 * BUDGET);
  }, RUN_TIMEOUT_MS);

  it(`scenario 3: CLAUDE_CODE_DISABLE_THINKING=1 has no effect on ${FIVE_X_MODEL}`, async () => {
    const reference = await think('scenario-3-reference', { model: FIVE_X_MODEL, maxTokens: 16_000 });
    const disabled = await think('scenario-3-disabled', {
      model: FIVE_X_MODEL, maxTokens: 16_000, env: { CLAUDE_CODE_DISABLE_THINKING: '1' }
    });
    console.info(`[scenario 3] ${FIVE_X_MODEL} thinking: reference ${reference.blocks} block(s), ${reference.tokens} ` +
      `tokens; with CLAUDE_CODE_DISABLE_THINKING=1 ${disabled.blocks} block(s), ${disabled.tokens} tokens`);

    expect(reference.env).not.toHaveProperty('CLAUDE_CODE_DISABLE_THINKING');
    // Precondition: the 5.x model thinks on this prompt.
    expect(reference.blocks).toBeGreaterThan(0);
    expect(disabled.env['CLAUDE_CODE_DISABLE_THINKING']).toBe('1');
    expect(disabled.blocks).toBeGreaterThan(0);
  }, RUN_TIMEOUT_MS);
});
