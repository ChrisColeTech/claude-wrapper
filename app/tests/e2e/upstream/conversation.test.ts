/**
 * E2E (real CLI, behind UPSTREAM_E2E=1): a continued turn (spec section 5, ADR 0002). The first
 * turn starts an upstream session; the second request carries the first answer back as the
 * client got it, so the surface resumes that session (`--resume`) and sends only the new
 * message. The resumed run reads the earlier turn from the prompt cache, and the model refers to
 * its own earlier answer.
 *
 *   UPSTREAM_E2E=1 npm --prefix app run test:e2e -- tests/e2e/upstream/conversation.test.ts
 */
import type Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createSpawnRunner, Runner, RunSpec } from '../../../src/upstream/runner';
import { openStateDirectory, StateDirectory } from '../../../src/upstream/state-directory';
import type { SurfaceHarness } from '../../mocks/anthropic/surface-harness';
import { waitFor } from '../../mocks/shared/wait-for';
import { describeUpstream, E2E_MODEL, removeStateRoot } from './harness';

const RUN_EXIT_WAIT_MS = 60_000;
const FIRST: Anthropic.MessageParam = {
  role: 'user', content: 'Pick one fruit at random and reply with only its name, one word, nothing else.'
};
const SECOND: Anthropic.MessageParam = {
  role: 'user', content: 'Which fruit did you just pick? Reply with only that same word.'
};

const textOf = (message: Anthropic.Message): string =>
  message.content.filter(block => block.type === 'text').map(block => (block as Anthropic.TextBlock).text).join('');
const word = (text: string): string => text.trim().toLowerCase().replace(/[^a-z]/g, '');

/** The production spawn runner, noting each run's spec (never logged: it carries the environment). */
function notingRunner(specs: RunSpec[]): Runner {
  const runner = createSpawnRunner();
  return { startRun: spec => { specs.push(spec); return runner.startRun(spec); } };
}

/** Built here, not imported at the top: a skipped file must not start the OpenAI surface's timers. */
async function productionSurface(state: StateDirectory, runner: Runner): Promise<SurfaceHarness> {
  const { createServer } = await import('../../../src/api/server');
  const { serveApp } = await import('../../mocks/anthropic/surface-harness');
  return serveApp(createServer({ stateDirectory: state, runner }));
}

describeUpstream('a continued turn against the real CLI', () => {
  let root: string;
  let state: StateDirectory;
  let surface: SurfaceHarness;
  let specs: RunSpec[];

  /** The response ends at message_stop; the run writes its result (and the transcript) and exits after it. */
  const runsExited = () => waitFor(() => fs.readdirSync(state.runs).length === 0, RUN_EXIT_WAIT_MS);

  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'conversation-e2e-'));
    state = openStateDirectory(root);
    specs = [];
    surface = await productionSurface(state, notingRunner(specs));
  });

  afterEach(async () => {
    await runsExited();
    await surface.close();
    removeStateRoot(root, state.cwd);
  }, RUN_EXIT_WAIT_MS + 10_000);

  it('resumes the upstream session, reads it from the cache, and the model recalls its own answer', async () => {
    const client = surface.client();

    const first = await client.messages.create({ model: E2E_MODEL, max_tokens: 256, messages: [FIRST] });
    await runsExited();
    const second = await client.messages.create({
      model: E2E_MODEL, max_tokens: 256, messages: [FIRST, { role: 'assistant', content: first.content }, SECOND]
    });

    expect(specs[0]?.flags).not.toContain('--resume');
    expect(specs[1]?.flags).toContain('--resume');
    expect(second.usage.cache_read_input_tokens).toBeGreaterThan(0);
    expect(word(textOf(second))).toBe(word(textOf(first)));
  }, 240_000);
});
