/**
 * E2E (real CLI, behind UPSTREAM_E2E=1): a plain run with the planner's spec yields `system/init`
 * passing the plan's startup checks, frames, `result` and exit 0 through the spawn runner, and
 * leaves no run directory behind.
 */
import * as fs from 'fs';
import { Frame } from '../../../src/upstream/frames';
import { createUpstreamHarness, describeUpstream, firstMessage } from './harness';

const indexOf = (frames: Frame[], match: (frame: Frame) => boolean): number => frames.findIndex(match);

describeUpstream('upstream runner against the real CLI', () => {
  const harness = createUpstreamHarness();

  afterEach(async () => {
    await harness.cleanup();
  });

  it('a plain run with the planned spec yields system/init, frames, result and exit 0', async () => {
    const { run, plan, spec } = harness.start({ prompt: 'Reply with the single word pong.' });

    const { frames, exit } = await harness.complete(run, firstMessage(plan));

    const init = indexOf(frames, frame => frame.type === 'system' && frame.subtype === 'init');
    const firstEvent = indexOf(frames, frame => frame.type === 'stream_event');
    const result = indexOf(frames, frame => frame.type === 'result');
    expect(init).toBe(0);
    expect(firstEvent).toBeGreaterThan(init);
    expect(result).toBeGreaterThan(firstEvent);
    expect(frames[init]).toEqual(expect.objectContaining({
      model: plan.startupChecks.model, tools: plan.startupChecks.tools
    }));
    expect(frames[result]).toEqual(expect.objectContaining({ subtype: 'success', is_error: false }));
    expect(exit).toEqual(expect.objectContaining({ code: 0, signal: null }));
    expect(exit.failure).toBeUndefined();
    expect(fs.existsSync(spec.runDir?.path ?? '')).toBe(false);
  }, 120_000);
});
