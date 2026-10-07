/**
 * How a turn fails inside the turn stream (spec sections 11 and 13): recorded upstream failures
 * and hand-built ones in, the `fail` signal with the mapped error out, and nothing after it.
 * Trigger (i) is a broken model call: a `message_start` while the current upstream message still
 * has an open block, or a `message_stop` with no `message_delta` before it; (ii) a failed `result`
 * before the turn's end; a deterministic `api_retry` fails at first sight.
 *
 * E2E scenario 1's recording (Claude Code 2.1.291) is a golden. After a deliberate change to the
 * turn stream, rewrite it and review the diff:
 *   UPDATE_TURN_STREAM_GOLDENS=1 npm run test:unit -- tests/unit/anthropic/translate/translator-failures
 */
import * as fs from 'fs';
import * as path from 'path';
import { createFailureReader } from '../../../../src/anthropic/failure';
import { FailSignal, TurnEvent } from '../../../../src/anthropic/translate';
import { Frame } from '../../../../src/upstream/frames';
import {
  apiRetry, BLOCK_STOP, frameOf, MESSAGE_START, MESSAGE_STOP, resultFrame, streamEvent, TEXT_START, textDelta, translate
} from '../../../mocks/anthropic/turn-frames';
import { recordedFrames, recordedStdout } from '../../../mocks/upstream/recordings';

const types = (events: TurnEvent[]): string[] => events.map(event => event.type);
const failure = (events: TurnEvent[]) => {
  const { error } = events.find((event): event is FailSignal => event.type === 'fail') as FailSignal;
  return { status: error.status, type: error.type, message: error.message, retryable: error.retryable };
};
/** The frames of a recording's last run (several probes ran in one file). */
const lastRun = (frames: Frame[]): Frame[] =>
  frames.slice(frames.map(frame => frame.type === 'system' && frame.subtype === 'init').lastIndexOf(true));
const secondCall = streamEvent({ ...MESSAGE_START, message: { ...MESSAGE_START.message, id: 'msg_2' } });

describe('translator: a recorded upstream failure', () => {
  it('fails with the API 400 and its own message (URL document rejected)', () => {
    const events = translate(lastRun(recordedFrames('cli-probes/o-pass-through-run2.jsonl')));

    expect(types(events)).toEqual(['fail']);
    expect(failure(events)).toEqual({ status: 400, type: 'invalid_request_error', retryable: false,
      message: 'Unable to download the file. Please verify the URL and try again.' });
  });

  it('fails with the API 400 for a tool name over 128 characters', () => {
    expect(failure(translate(recordedFrames('cli-probes/q-tool-names-run1.wire.ndjson')))).toEqual({
      status: 400, type: 'invalid_request_error', retryable: false,
      message: 'tools.4.custom.name: String should have at most 128 characters'
    });
  });

  it('fails as operator-side when upstream is not logged in', () => {
    expect(failure(translate(recordedFrames('cli-probes/r1-simple-env.jsonl')))).toEqual({
      status: 500, type: 'api_error', retryable: false,
      message: expect.stringMatching(/^The upstream Claude Code login failed \(authentication_failed\)/)
    });
  });

  it('fails at the first api_retry of a 401 loop, as operator-side', () => {
    const events = translate(recordedFrames('cli-probes/auth-failure.jsonl'));

    expect(types(events)).toEqual(['fail']);
    expect(failure(events)).toEqual({ status: 500, type: 'api_error', retryable: false,
      message: expect.stringMatching(/^The upstream Claude Code login failed \(authentication_failed\)/) });
  });

  it('fails with 404 naming the client model on an unknown model', () => {
    const failures = createFailureReader({ turn: { requestedModel: 'zzz' } });

    expect(failure(translate(recordedFrames('cli-probes/h-unknown-model.txt'), jest.fn(), failures))).toEqual({
      status: 404, type: 'not_found_error', message: 'model: zzz', retryable: false
    });
  });

  it('fails with the budget error of error_max_budget_usd', () => {
    expect(failure(translate(recordedFrames('cli-probes/g1-system-prompt.jsonl')))).toEqual({
      status: 500, type: 'api_error', message: 'Reached maximum budget ($0.25)', retryable: false
    });
  });
});

describe('translator: a model call that fails after it has streamed content', () => {
  const streamed = [streamEvent(MESSAGE_START), streamEvent(TEXT_START), streamEvent(textDelta('Hel'))];

  it('fails on a new message_start while a block is open, with the api_retry that came between', () => {
    const events = translate([...streamed, apiRetry('overloaded', 529), secondCall, streamEvent(TEXT_START)]);

    expect(types(events)).toEqual(['message_start', 'content_block_start', 'content_block_delta', 'fail']);
    expect(failure(events)).toEqual({ status: 529, type: 'overloaded_error', message: 'Upstream overloaded', retryable: true });
  });

  it('fails with a 500 api_error when nothing came between', () => {
    expect(failure(translate([...streamed, secondCall]))).toEqual({ status: 500, type: 'api_error', retryable: true,
      message: "upstream's model call failed after it had streamed content" });
  });

  it('does not fail on a plain api_retry when the failed call had no open block', () => {
    const closed = translate([...streamed, streamEvent(BLOCK_STOP), apiRetry('overloaded', 529), secondCall]);
    const empty = translate([streamEvent(MESSAGE_START), apiRetry('server_error', 500), secondCall, streamEvent(TEXT_START)]);

    expect(types(closed)).toEqual(['message_start', 'content_block_start', 'content_block_delta', 'content_block_stop']);
    expect(types(empty)).toEqual(['message_start', 'content_block_start']);
  });

  it('fails on a failed result after content and relays nothing after it', () => {
    const events = translate([...streamed, resultFrame({ is_error: true, api_error_status: 529,
      result: 'API Error: 529 Overloaded' }), streamEvent(textDelta('late'))]);

    expect(types(events)).toEqual(['message_start', 'content_block_start', 'content_block_delta', 'fail']);
    expect(failure(events)).toEqual({ status: 529, type: 'overloaded_error', message: 'Overloaded', retryable: true });
  });

  it('fails when the call stops with no message_delta, though upstream then reports success', () => {
    // Claude Code 2.1.291 closes a call broken by a mid-stream error this way and retries it out of the stream.
    const events = translate([...streamed, streamEvent(BLOCK_STOP), streamEvent(MESSAGE_STOP), resultFrame({ result: 'Hello there.' })]);

    expect(types(events)).toEqual(['message_start', 'content_block_start', 'content_block_delta', 'content_block_stop', 'fail']);
    expect(failure(events)).toEqual({ status: 500, type: 'api_error', retryable: true,
      message: "upstream's model call failed after it had streamed content" });
  });

  it('fails a later model call that stops with no message_delta, never ending the turn without one', () => {
    const connectorCall = [
      streamEvent(MESSAGE_START),
      streamEvent({ type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'toolu_c', name: 'mcp__docs__fetch', input: {} } }),
      streamEvent({ type: 'content_block_stop', index: 0 }),
      streamEvent({ type: 'message_delta', delta: { stop_reason: 'tool_use', stop_sequence: null }, usage: { output_tokens: 3 } }),
      streamEvent(MESSAGE_STOP),
      frameOf({ type: 'user', parent_tool_use_id: null,
        message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_c', content: 'the page' }] } })
    ];

    const events = translate([...connectorCall, secondCall, streamEvent(TEXT_START), streamEvent(textDelta('Hel')),
      streamEvent(BLOCK_STOP), streamEvent(MESSAGE_STOP), resultFrame()]);

    expect(types(events).slice(-1)).toEqual(['fail']);
    expect(types(events).filter(type => type === 'message_delta' || type === 'message_stop')).toEqual([]);
  });
});

describe('translator: the recorded call that broke after streaming (e2e scenario 1)', () => {
  const FIXTURE = 'e2e-runs/scenario-1-failure-after-content-error_event.jsonl';
  const GOLDEN = path.resolve(__dirname, '..', '..', '..', 'fixtures', 'turn-streams', 'scenario-1-failure-after-content-error_event.json');
  type Recorded = { type: string; subtype?: string; event?: { delta?: { text?: string } }; message?: { content: { text?: string }[] } };
  const stdout = recordedStdout(FIXTURE) as Recorded[];
  const events = translate(recordedFrames(FIXTURE));
  /** The turn stream as JSON: the `fail` signal's error as its fields. */
  const asJson = events.map(event => (event.type === 'fail' ? { type: 'fail', error: failure([event]) } : event));
  const joined = (texts: (string | undefined)[]): string => texts.filter(text => text !== undefined).join('');

  it('matches the committed turn stream: what was streamed before the break, then the fail signal', () => {
    if (process.env['UPDATE_TURN_STREAM_GOLDENS'] === '1') fs.writeFileSync(GOLDEN, JSON.stringify(asJson, null, 2) + '\n');

    expect(asJson).toEqual(JSON.parse(fs.readFileSync(GOLDEN, 'utf8')));
  });

  it("fails with the unknown-cause row though upstream's result says success, and the answer never streamed", () => {
    const streamed = joined(stdout.filter(frame => frame.type === 'stream_event').map(frame => frame.event?.delta?.text));
    const answered = joined(stdout.filter(frame => frame.type === 'assistant').flatMap(frame => frame.message?.content ?? [])
      .map(block => block.text));

    expect(types(events)).toEqual(['message_start', 'content_block_start', 'content_block_delta', 'content_block_stop', 'fail']);
    expect(failure(events)).toEqual({ status: 500, type: 'api_error', retryable: true,
      message: "upstream's model call failed after it had streamed content" });
    expect(stdout.find(frame => frame.type === 'result')?.subtype).toBe('success');
    expect(answered.length).toBeGreaterThan(streamed.length);
  });
});
