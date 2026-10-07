/**
 * The replay runner plays a recorded upstream run through the same run core as the spawn
 * runner: frames after the user message at their recorded offsets (scaled), parks held as
 * recorded, the recorded interrupt tail on interrupt, and the recorded exit once stdin ends.
 */
import { createReplayRunner } from '../../../src/upstream/runner';
import { RunSpec } from '../../../src/upstream/runner/types';
import { createFakeClock } from '../../mocks/shared/fake-clock';
import { asUpstreamWrote, loadRecording, recordedStdout, recordedTimeline } from '../../mocks/upstream/recordings';
import { consume, failureOf, NO_TIMERS, settle } from '../../mocks/upstream/run-helpers';

const PLAIN = 'cli-probes/c-partial.jsonl';
const WEB_SEARCH = 'cli-probes/s-sdk-hooks-allowed.wire.ndjson';
const PARK = 'spike-runs/cli-http-happy.wire.ndjson';
const INTERRUPT = 'spike-runs/cli-http-interrupt.wire.ndjson';
const CLOSE_WHILE_PARKED = 'spike-runs/sdk-close-while-parked.wire.ndjson';

const SPEC: RunSpec = { flags: ['-p'], env: {}, cwd: '/tmp/replay', timers: NO_TIMERS };
const USER = { role: 'user' as const, content: [{ type: 'text', text: 'Reply with pong' }] };

function replay(name: string, options: { timeScale?: number; spec?: RunSpec } = {}) {
  const clock = createFakeClock();
  const runner = createReplayRunner(loadRecording(name), { clock, ...options });
  const run = runner.startRun(options.spec ?? SPEC);
  return { clock, runner, run, ...consume(run) };
}

async function advance(clock: ReturnType<typeof createFakeClock>, ms: number): Promise<void> {
  clock.advance(ms);
  await settle();
}

describe('replay runner', () => {
  it('plays a plain recording once the user message is sent, and exits once stdin ends', async () => {
    const { clock, runner, run, seen } = replay(PLAIN);

    await advance(clock, 60_000);
    expect(seen).toEqual([]);

    await run.send(USER);
    await advance(clock, 1_000);
    expect(seen.map(asUpstreamWrote)).toEqual(recordedStdout(PLAIN));

    let exited = false;
    void run.exited.then(() => { exited = true; });
    await advance(clock, 60_000);
    expect(exited).toBe(false);

    void run.close();
    await advance(clock, 1_000);
    await expect(run.exited).resolves.toEqual({ code: 0, signal: null, stderr: '' });
    expect(runner.started).toEqual([{
      spec: SPEC,
      input: [{ type: 'user', message: USER, parent_tool_use_id: null, session_id: '' }]
    }]);
  });

  it('plays a timed recording at its recorded offsets from the user message, scaled', async () => {
    const { clock, run, seen } = replay(WEB_SEARCH, { timeScale: 0.5 });
    const { userAtMs, stdoutAtMs } = recordedTimeline(WEB_SEARCH);
    const recordedBy = (offset: number) => stdoutAtMs.filter(at => at - userAtMs <= offset).length;

    await run.send(USER);
    let now = 0;
    for (const offset of [500, 3177, 3178, 10892, 10893, 18700]) {
      await advance(clock, (offset - now) * 0.5);
      now = offset;
      expect(seen.length).toBe(recordedBy(offset));
    }
    expect(seen.map(asUpstreamWrote)).toEqual(recordedStdout(WEB_SEARCH));

    void run.close();
    await advance(clock, 1_000);
    await expect(run.exited).resolves.toEqual(expect.objectContaining({ code: 0, signal: null }));
  });

  it('holds a client-tool park for its recorded length, then plays the rest of the run', async () => {
    const { clock, run, seen } = replay(PARK);
    const { userAtMs, stdoutAtMs } = recordedTimeline(PARK);
    const parkedAt = 3681 - userAtMs;
    const resumedAt = 6694 - userAtMs;

    await run.send(USER);
    await advance(clock, parkedAt);
    const beforePark = seen.length;
    expect(seen[beforePark - 1]).toEqual(expect.objectContaining({ type: 'rate_limit_event' }));

    await advance(clock, resumedAt - parkedAt - 1);
    expect(seen.length).toBe(beforePark);
    await advance(clock, 10_000);
    expect(seen.length).toBe(stdoutAtMs.length);
    expect(seen[seen.length - 1]).toEqual(expect.objectContaining({ type: 'result', subtype: 'success' }));
  });

  it('enforces the run timers on a replay as on a real run', async () => {
    const { clock, run } = replay(PARK, { spec: { ...SPEC, timers: { ...NO_TIMERS, stall: 2_000 } } });
    const failure = failureOf(run);

    await run.send(USER);
    await advance(clock, 10_000);

    await expect(failure).resolves.toEqual({ kind: 'timeout', timer: 'stall' });
    await advance(clock, 10_000);
    await expect(run.exited).resolves.toEqual(expect.objectContaining({ failure: { kind: 'timeout', timer: 'stall' } }));
  });

  it('waits at a recorded interrupt, then plays the interrupt tail with the live request id', async () => {
    const { clock, run, seen } = replay(INTERRUPT);
    const recorded = recordedStdout(INTERRUPT);

    await run.send(USER);
    await advance(clock, 600_000);
    expect(seen.map(asUpstreamWrote)).toEqual(recorded.slice(0, -4));

    const response = run.interrupt();
    await advance(clock, 1_000);
    const live = await response;
    expect(live).toEqual({ subtype: 'success', request_id: expect.any(String), response: { still_queued: [] } });
    expect(live.request_id).not.toBe('spike-interrupt-1');

    const tail = seen.slice(-4).map(asUpstreamWrote);
    expect(tail).toEqual([
      { type: 'control_response', response: live },
      ...recorded.slice(-3)
    ]);
    expect(tail[3]).toEqual(expect.objectContaining({ type: 'result', subtype: 'error_during_execution' }));

    void run.close();
    await advance(clock, 1_000);
    await expect(run.exited).resolves.toEqual(expect.objectContaining({ code: 1, signal: null }));
  });

  it('skips to the interrupt tail when interrupted before the recorded moment', async () => {
    const { clock, run, seen } = replay(INTERRUPT);

    await run.send(USER);
    await advance(clock, 3_000);
    const before = seen.length;
    expect(seen[before - 1]).toEqual(expect.objectContaining({ type: 'system', subtype: 'status' }));

    const interrupted = run.interrupt();
    await advance(clock, 1_000);
    await interrupted;
    expect(seen.slice(before).map(frame => frame.type)).toEqual(['control_response', 'user', 'user', 'result']);
  });

  it('acknowledges an interrupt on a recording without a tail and plays on', async () => {
    const { clock, run, seen } = replay(PLAIN);

    await run.send(USER);
    const interrupted = run.interrupt();
    await advance(clock, 1_000);
    const response = await interrupted;

    expect(response).toEqual({ subtype: 'success', request_id: expect.any(String), response: { still_queued: [] } });
    expect(seen.filter(frame => frame.type !== 'control_response').map(asUpstreamWrote)).toEqual(recordedStdout(PLAIN));
  });

  it('ends a run that keeps going after its input is closed with SIGTERM', async () => {
    const { clock, run } = replay(CLOSE_WHILE_PARKED);

    await run.send(USER);
    await advance(clock, 7_000);
    void run.close();
    await advance(clock, 2_000);

    await expect(run.exited).resolves.toEqual({ code: null, signal: 'SIGTERM', stderr: '' });
  });

  it('starts one recording per run, in order, and refuses a run it has no recording for', () => {
    const clock = createFakeClock();
    const runner = createReplayRunner([loadRecording(PLAIN), loadRecording(PARK)], { clock });
    const second = { ...SPEC, flags: ['-p', '--resume', 's1'] };

    runner.startRun(SPEC);
    runner.startRun(second);

    expect(runner.started.map(started => started.spec)).toEqual([SPEC, second]);
    expect(() => runner.startRun(SPEC)).toThrow('no recording for run 3');
  });
});
