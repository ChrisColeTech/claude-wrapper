/**
 * `/health` shows the scheduler's counts (spec section 14) beside its existing fields: runs active
 * and parked, the cap, the turns queued over every upstream session, and upstream's last
 * rate-limit state. It is public, so it shows aggregate counts only, never an upstream session id.
 */
import Anthropic from '@anthropic-ai/sdk';
import request from 'supertest';
import { STATE } from '../../mocks/anthropic/plan-context';
import { SurfaceHarness, startSurface } from '../../mocks/anthropic/surface-harness';
import { initFrame, PLAIN_CALL, rateLimitEvent, resultFrame, streamEvent } from '../../mocks/anthropic/turn-frames';
import { waitFor } from '../../mocks/shared/wait-for';
import { settle } from '../../mocks/upstream/run-helpers';
import { createScriptedRunner, ScriptedRun, ScriptedRunner } from '../../mocks/upstream/scripted-runner';

const RESETS_AT = 1_791_123_600;
const SESSION = 'a8f3c9e2-health-session';

describe('Anthropic surface: /health', () => {
  let surface: SurfaceHarness;
  let runner: ScriptedRunner;

  const health = async () => (await request(surface.baseURL).get('/health').expect(200)).body;

  /** `/health` once a turn is queued (polled: the follow-up joins its session's queue asynchronously). */
  async function healthWithQueue(): Promise<{ anthropic: Record<string, unknown> }> {
    for (const deadline = Date.now() + 2_000; Date.now() < deadline; await new Promise(resolve => setTimeout(resolve, 5))) {
      const body = await health();
      if (body.anthropic.queued !== 0) return body;
    }
    throw new Error('no turn was ever queued');
  }

  beforeEach(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    runner = createScriptedRunner();
    surface = await startSurface({ runner, stateDirectory: STATE });
  });

  afterEach(async () => {
    await surface.close();
  });

  it("keeps its fields and adds the scheduler's counts", async () => {
    expect(await health()).toEqual({
      status: 'healthy', service: 'claude-wrapper', version: expect.any(String), description: expect.any(String),
      timestamp: expect.any(String),
      anthropic: { active: 0, parked: 0, maxRuns: 4, queued: 0, rateLimit: null }
    });
  });

  it("counts a run in flight and shows upstream's last rate-limit state", async () => {
    const asking = surface.client().messages.create({
      model: 'fable', max_tokens: 64, messages: [{ role: 'user', content: 'Say hi.' }]
    }).catch(() => undefined);
    const { process: upstream } = await runner.nextRun();

    upstream.frames(initFrame(), rateLimitEvent('allowed_warning', RESETS_AT));
    await settle();

    const body = await health();
    expect(body.anthropic).toEqual({
      active: 1, parked: 0, maxRuns: 4, queued: 0,
      rateLimit: { status: 'allowed_warning', resetsAt: RESETS_AT, rateLimitType: 'five_hour' }
    });
    upstream.exit(1);
    await asking;
  });

  it('counts a turn queued on a conversation without naming its upstream session', async () => {
    const hi: Anthropic.MessageParam = { role: 'user', content: 'Say hi.' };
    const body = (messages: Anthropic.MessageParam[]) => ({ model: 'fable', max_tokens: 64, messages });
    const answer = (run: ScriptedRun) => run.process.frames(initFrame({ session_id: SESSION }), ...PLAIN_CALL.map(event => streamEvent(event)));
    const first = surface.client().messages.create(body([hi]));
    const run1 = await runner.nextRun();
    answer(run1);
    await first;

    // The follow-up continues the session, so it waits for the first run, still short of its result.
    const followUp = surface.client().messages.create(body([hi, { role: 'assistant', content: 'hi' }, { role: 'user', content: 'Again.' }]));
    const queued = await healthWithQueue();

    expect(queued.anthropic).toEqual({ active: 1, parked: 0, maxRuns: 4, queued: 1, rateLimit: null });
    expect(JSON.stringify(queued)).not.toContain(SESSION);
    run1.process.frames(resultFrame({ session_id: SESSION }));
    await waitFor(() => run1.process.inputEnded());
    run1.process.exit(0);
    const run2 = await runner.nextRun();
    answer(run2);
    run2.process.frames(resultFrame({ session_id: SESSION }));
    await waitFor(() => run2.process.inputEnded());
    run2.process.exit(0);
    await followUp;
  });
});
