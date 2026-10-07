/**
 * E2E scenario 1's recording replayed through the official SDK (spec sections 11 and 13): Claude
 * Code 2.1.291 closed a model call broken by a mid-stream `overloaded_error` with no
 * `message_delta`, retried it where no stream event shows it, and reported success. The surface
 * fails that call with the upstream table's unknown-cause row, 500 `api_error`: as the HTTP status
 * before commit (non-streaming), as one SSE `error` event after the text already streamed
 * (streaming), and forgets the upstream session either way, so the client's retry is a replayed turn.
 */
import Anthropic from '@anthropic-ai/sdk';
import { createReplayRunner } from '../../../src/upstream/runner';
import { STATE } from '../../mocks/anthropic/plan-context';
import { memorySessions, TestSessions } from '../../mocks/anthropic/sessions';
import { envelopeOf, rejectionOf, REQUEST_ID, SurfaceHarness, startSurface } from '../../mocks/anthropic/surface-harness';
import { waitFor } from '../../mocks/shared/wait-for';
import { loadRecording, recordedStdout } from '../../mocks/upstream/recordings';

const FIXTURE = 'e2e-runs/scenario-1-failure-after-content-error_event.jsonl';
const BROKEN = { type: 'api_error', message: "upstream's model call failed after it had streamed content" };

type Recorded = { type: string; subtype?: string; session_id?: string; event?: { type: string; delta?: { text?: string } } };
const stdout = recordedStdout(FIXTURE) as Recorded[];
const SESSION = stdout.find(frame => frame.type === 'system' && frame.subtype === 'init')?.session_id;
/** What upstream streamed of the call before it broke. */
const STREAMED = stdout.flatMap(frame => (frame.event?.delta?.text === undefined ? [] : [frame.event.delta.text]));

const request = {
  model: 'claude-haiku-4-5-20251001', max_tokens: 1024,
  messages: [{ role: 'user' as const, content: 'Count from 1 to 60, one number per line, nothing else.' }]
};

describe('Anthropic surface: a recorded model call that broke after streaming (e2e scenario 1)', () => {
  let surface: SurfaceHarness;
  let state: TestSessions;

  beforeEach(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    state = memorySessions();
    surface = await startSurface({
      runner: createReplayRunner([loadRecording(FIXTURE)], { timeScale: 0 }), stateDirectory: STATE, sessions: state.sessions
    });
  });

  afterEach(async () => {
    await surface.close();
  });

  it('messages.create: a 500 api_error before commit, retryable, and the session forgotten', async () => {
    const error = await rejectionOf(surface.client().messages.create(request));

    expect(error).toBeInstanceOf(Anthropic.InternalServerError);
    expect(error.status).toBe(500);
    expect(envelopeOf(error).error).toEqual(BROKEN);
    expect(error.requestID).toMatch(REQUEST_ID);
    expect(error.headers?.get('x-should-retry')).toBeNull();
    await waitFor(() => state.forgotten.includes(String(SESSION)));
  });

  it('messages.stream(): the text streamed so far, then the SSE error event, and the session forgotten', async () => {
    const stream = surface.client().messages.stream(request);
    const texts: string[] = [];
    stream.on('text', text => texts.push(text));

    const error = await rejectionOf(stream.finalMessage());

    expect(error).toBeInstanceOf(Anthropic.APIError);
    expect(error.status).toBeUndefined();
    expect(envelopeOf(error)).toEqual({ type: 'error', error: BROKEN, request_id: error.requestID });
    expect(texts).toEqual(STREAMED);
    await waitFor(() => state.forgotten.includes(String(SESSION)));
  });

  it('stream: true: the events end with the error, never a message_delta or message_stop', async () => {
    const seen: string[] = [];
    const read = async (): Promise<void> => {
      for await (const event of await surface.client().messages.create({ ...request, stream: true })) seen.push(event.type);
    };

    const error = await rejectionOf(read());

    expect(seen).toEqual(['message_start', 'content_block_start', 'content_block_delta', 'content_block_stop']);
    expect(envelopeOf(error).error).toEqual(BROKEN);
  });
});
