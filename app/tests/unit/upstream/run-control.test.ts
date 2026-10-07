/**
 * Writing to upstream: `send` writes one stream-json user line, and `interrupt` writes a
 * `control_request` whose id is matched to upstream's `control_response`.
 */
import { createRun } from '../../../src/upstream/runner/run';
import { createScriptedProcess } from '../../mocks/upstream/scripted-process';
import { createFakeClock } from '../../mocks/shared/fake-clock';
import { collectFrames, settle, NO_TIMERS } from '../../mocks/upstream/run-helpers';

type ControlLine = { type: string; request_id: string; request: { subtype: string } };

function startScripted() {
  const proc = createScriptedProcess();
  const run = createRun(proc.start, { timers: NO_TIMERS, clock: createFakeClock() });
  const requestIds = (): string[] => (proc.writtenLines() as ControlLine[])
    .filter(line => line.type === 'control_request')
    .map(line => line.request_id);
  return { proc, run, requestIds };
}

const success = (requestId: string) => ({
  type: 'control_response',
  response: { subtype: 'success', request_id: requestId, response: { still_queued: [] } }
});

describe('run control', () => {
  it('sends a user message as one stream-json line', async () => {
    const { proc, run } = startScripted();

    await run.send({ role: 'user', content: [{ type: 'text', text: 'Reply with pong' }] });

    expect(proc.written).toEqual([
      '{"type":"user","message":{"role":"user","content":[{"type":"text","text":"Reply with pong"}]},' +
      '"parent_tool_use_id":null,"session_id":""}\n'
    ]);
  });

  it('refuses to send once the input is closed', async () => {
    const { run } = startScripted();

    void run.close();

    await expect(run.send({ role: 'user', content: 'late' })).rejects.toThrow('input is closed');
  });

  it('writes an interrupt control_request and resolves on the control_response with its id', async () => {
    const { proc, run, requestIds } = startScripted();

    let settled = false;
    const interrupted = run.interrupt().then(response => { settled = true; return response; });
    await settle();

    expect(proc.writtenLines()).toEqual([
      { type: 'control_request', request_id: expect.any(String), request: { subtype: 'interrupt' } }
    ]);
    const [id] = requestIds();

    proc.frames(success('someone-else'));
    await settle();
    expect(settled).toBe(false);

    proc.frames(success(id as string));
    await expect(interrupted).resolves.toEqual({ subtype: 'success', request_id: id, response: { still_queued: [] } });

    proc.exit(1);
    expect(await collectFrames(run)).toEqual([success('someone-else'), success(id as string)]);
  });

  it('matches concurrent requests by id whatever order upstream answers in', async () => {
    const { proc, run, requestIds } = startScripted();

    const first = run.interrupt();
    const second = run.interrupt();
    await settle();
    const [firstId, secondId] = requestIds();
    expect(firstId).not.toEqual(secondId);

    proc.frames({ type: 'control_response', response: { subtype: 'error', request_id: secondId, error: 'busy' } });
    proc.frames(success(firstId as string));

    await expect(first).resolves.toEqual(expect.objectContaining({ subtype: 'success', request_id: firstId }));
    await expect(second).resolves.toEqual({ subtype: 'error', request_id: secondId, error: 'busy' });
  });

  it('rejects a pending interrupt when upstream exits without answering', async () => {
    const { proc, run } = startScripted();

    const interrupted = run.interrupt();
    await settle();
    proc.exit(1);

    await expect(interrupted).rejects.toThrow('upstream exited before answering');
  });

  it('refuses to interrupt once the input is closed', async () => {
    const { run } = startScripted();

    void run.close();

    await expect(run.interrupt()).rejects.toThrow('input is closed');
  });
});
