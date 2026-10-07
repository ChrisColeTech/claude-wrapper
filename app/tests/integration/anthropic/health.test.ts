/**
 * `/health` shows the scheduler's counts (spec section 14) beside its existing fields: runs active
 * and parked, the cap, turns queued per upstream session, and upstream's last rate-limit state.
 */
import request from 'supertest';
import { STATE } from '../../mocks/anthropic/plan-context';
import { SurfaceHarness, startSurface } from '../../mocks/anthropic/surface-harness';
import { initFrame, rateLimitEvent } from '../../mocks/anthropic/turn-frames';
import { settle } from '../../mocks/upstream/run-helpers';
import { createScriptedRunner, ScriptedRunner } from '../../mocks/upstream/scripted-runner';

const RESETS_AT = 1_791_123_600;

describe('Anthropic surface: /health', () => {
  let surface: SurfaceHarness;
  let runner: ScriptedRunner;

  const health = async () => (await request(surface.baseURL).get('/health').expect(200)).body;

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
      anthropic: { active: 0, parked: 0, maxRuns: 4, queued: {}, rateLimit: null }
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
      active: 1, parked: 0, maxRuns: 4, queued: {},
      rateLimit: { status: 'allowed_warning', resetsAt: RESETS_AT, rateLimitType: 'five_hour' }
    });
    upstream.exit(1);
    await asking;
  });
});
