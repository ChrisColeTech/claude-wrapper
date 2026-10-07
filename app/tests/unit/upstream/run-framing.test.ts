/**
 * The run core turns upstream's stdout bytes into frames: NDJSON lines split anywhere across
 * chunks, a partial last line at the end of stdout, and the 16 MB line ceiling.
 */
import { createRun } from '../../../src/upstream/runner/run';
import { RunFailure } from '../../../src/upstream/runner/run-failure';
import { createScriptedProcess } from '../../mocks/upstream/scripted-process';
import { createFakeClock } from '../../mocks/shared/fake-clock';
import { collectFrames, NO_TIMERS } from '../../mocks/upstream/run-helpers';

const MAX_LINE_BYTES = 16 * 1024 * 1024;

function startScripted() {
  const proc = createScriptedProcess();
  const run = createRun(proc.start, { timers: NO_TIMERS, clock: createFakeClock() });
  return { proc, run };
}

describe('run framing', () => {
  it('delivers frames in upstream order from lines split across chunks', async () => {
    const { proc, run } = startScripted();

    proc.stdout('{"type":"system","subtype":"init","session_id":"s1"');
    proc.stdout(',"model":"claude-haiku-4-5-20251001"}\n{"type":"rate_limit_event","rate_limit_info":{"status":"allo');
    proc.stdout('wed"}}\n{"type":"result","subtype":"success","is_error":false,"result":"caf');
    const accented = Buffer.from('é"}\n');
    proc.stdout(accented.subarray(0, 1));
    proc.stdout(accented.subarray(1));
    proc.exit(0);

    expect(await collectFrames(run)).toEqual([
      { type: 'system', subtype: 'init', session_id: 's1', model: 'claude-haiku-4-5-20251001' },
      { type: 'rate_limit_event', rate_limit_info: { status: 'allowed' } },
      { type: 'result', subtype: 'success', is_error: false, result: 'café' }
    ]);
    await expect(run.exited).resolves.toEqual({ code: 0, signal: null, stderr: '' });
  });

  it('delivers a partial last line when stdout ends, and skips blank lines', async () => {
    const { proc, run } = startScripted();

    proc.stdout('{"type":"system","subtype":"status","status":"requesting"}\r\n\n');
    proc.stdout('{"type":"result","subtype":"success","is_error":false}');
    proc.exit(0);

    expect(await collectFrames(run)).toEqual([
      { type: 'system', subtype: 'status', status: 'requesting' },
      { type: 'result', subtype: 'success', is_error: false }
    ]);
  });

  it('passes a line of exactly 16 MB through', async () => {
    const { proc, run } = startScripted();

    proc.stdout(Buffer.alloc(MAX_LINE_BYTES, 'a'));
    proc.stdout('\n');
    proc.exit(0);

    const frames = await collectFrames(run);
    expect(frames).toHaveLength(1);
    expect(frames[0]).toEqual({ type: 'unknown', raw: expect.any(String) });
  });

  it('fails the run on a line over 16 MB and interrupts it', async () => {
    const { proc, run } = startScripted();

    proc.frames({ type: 'system', subtype: 'init', session_id: 's1' });
    proc.stdout(Buffer.alloc(MAX_LINE_BYTES / 2, 'a'));
    proc.stdout(Buffer.alloc(MAX_LINE_BYTES / 2 + 1, 'a'));

    const seen: unknown[] = [];
    const failure = await (async () => {
      try {
        for await (const frame of run.frames) seen.push(frame);
      } catch (error) {
        return error;
      }
      return undefined;
    })();

    expect(seen).toEqual([{ type: 'system', subtype: 'init', session_id: 's1' }]);
    expect(failure).toBeInstanceOf(RunFailure);
    expect((failure as RunFailure).reason).toEqual({ kind: 'line_too_long', limitBytes: MAX_LINE_BYTES });
    expect(proc.writtenLines()).toEqual([expect.objectContaining({ type: 'control_request', request: { subtype: 'interrupt' } })]);

    proc.exit(0);
    await expect(run.exited).resolves.toEqual(expect.objectContaining({
      code: 0, failure: { kind: 'line_too_long', limitBytes: MAX_LINE_BYTES }
    }));
  });
});
