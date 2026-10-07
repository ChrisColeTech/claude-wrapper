/**
 * The frame union: the eleven frame kinds of the CLI contract arrive as themselves; anything
 * else arrives typed `unknown` with what upstream sent, and is logged at debug by kind only.
 */
import { createRun } from '../../../src/upstream/runner/run';
import { createScriptedProcess } from '../../mocks/upstream/scripted-process';
import { createFakeClock } from '../../mocks/shared/fake-clock';
import { collectFrames, NO_TIMERS } from '../../mocks/upstream/run-helpers';

const KNOWN = [
  { type: 'system', subtype: 'init', session_id: 's1', model: 'claude-haiku-4-5-20251001', tools: [] },
  { type: 'system', subtype: 'api_retry', attempt: 1, max_retries: 10, error_status: 529, error: 'overloaded' },
  { type: 'system', subtype: 'status', status: 'requesting' },
  { type: 'stream_event', event: { type: 'message_stop' }, parent_tool_use_id: null },
  { type: 'assistant', message: { id: 'msg_1', content: [] }, parent_tool_use_id: null },
  { type: 'user', message: { role: 'user', content: [] }, parent_tool_use_id: null },
  { type: 'result', subtype: 'success', is_error: false },
  { type: 'rate_limit_event', rate_limit_info: { status: 'allowed' } },
  { type: 'tool_progress', tool_use_id: 't1', tool_name: 'mcp__client__x', heartbeat: true },
  { type: 'control_request', request_id: 'r1', request: { subtype: 'can_use_tool' } },
  { type: 'control_response', response: { subtype: 'success', request_id: 'r2' } }
];

describe('run frames', () => {
  it('passes every frame kind of the CLI contract through as itself', async () => {
    const proc = createScriptedProcess();
    const run = createRun(proc.start, { timers: NO_TIMERS, clock: createFakeClock() });

    proc.frames(...KNOWN);
    proc.exit(0);

    expect(await collectFrames(run)).toEqual(KNOWN);
  });

  it('passes other frames through typed unknown and logs only their kind at debug', async () => {
    const proc = createScriptedProcess();
    const logger = { debug: jest.fn() };
    const run = createRun(proc.start, { timers: NO_TIMERS, clock: createFakeClock(), logger });
    const thinking = { type: 'system', subtype: 'thinking_tokens', estimated_tokens: 50 };
    const suggestion = { type: 'prompt_suggestion', suggestion: 'secret text' };

    proc.frames(thinking, suggestion, [1, 2]);
    proc.stdout('not json at all\n');
    proc.exit(0);

    expect(await collectFrames(run)).toEqual([
      { type: 'unknown', raw: thinking },
      { type: 'unknown', raw: suggestion },
      { type: 'unknown', raw: [1, 2] },
      { type: 'unknown', raw: 'not json at all' }
    ]);
    expect(logger.debug.mock.calls.map(call => call[1])).toEqual([
      { frame: 'system/thinking_tokens' },
      { frame: 'prompt_suggestion' },
      { frame: 'non-JSON line' },
      { frame: 'non-JSON line' }
    ]);
    expect(JSON.stringify(logger.debug.mock.calls)).not.toContain('secret text');
  });
});
