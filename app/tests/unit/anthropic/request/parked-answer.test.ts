/**
 * Answering a parked run (spec sections 4.2, 5 and 7): a request whose last user message heads
 * with `tool_result` blocks naming a parked run's `tool_use` ids is planned as that run's
 * continuation, carrying the results for its bridge server; correlation is by the ids alone, so
 * edits to earlier history do not matter. An answer missing some of the run's ids is the real
 * API's 400 (the run stays parked); ids no parked run holds are a replayed turn noting the lost
 * park. Nothing is rendered for a parked continuation.
 */
import { ParkedRun, Sessions } from '../../../../src/anthropic/sessions';
import { changedRunBound, planTurn, TurnPlan } from '../../../../src/anthropic/request';
import { SurfaceError } from '../../../../src/anthropic/surface-error';
import { invalidRequest, NO_SESSIONS, runContext, shippedCatalogue } from '../../../mocks/anthropic/plan-context';

const TOOLS = [{ name: 'get_weather', input_schema: { type: 'object' } }];
const ASK = { role: 'user', content: 'Weather in Paris and Tokyo?' };
const CALLS = {
  role: 'assistant',
  content: [
    { type: 'text', text: 'Checking both.' },
    { type: 'tool_use', id: 'toolu_1', name: 'get_weather', input: { city: 'Paris' } },
    { type: 'tool_use', id: 'toolu_2', name: 'get_weather', input: { city: 'Tokyo' } }
  ]
};
const result = (id: string, content: unknown = `{"id":"${id}"}`) => ({ type: 'tool_result', tool_use_id: id, content });

const PARKED: ParkedRun = { toolUseIds: ['toolu_1', 'toolu_2'], runId: 'run-parked', abandon: async () => undefined };

/** Sessions whose parked-run registry holds `PARKED`. */
const withParked: Sessions = {
  ...NO_SESSIONS,
  parked: { get: id => (PARKED.toolUseIds.includes(id) ? PARKED : undefined), put: () => undefined, remove: () => undefined }
};

const request = (answer: unknown, history: unknown[] = [ASK, CALLS]) =>
  ({ model: 'fable', max_tokens: 1024, tools: TOOLS, messages: [...history, { role: 'user', content: answer }] });
const plan = (body: unknown, sessions: Sessions = withParked) => planTurn(body, shippedCatalogue, sessions, runContext());
const planned = (body: unknown, sessions?: Sessions) => plan(body, sessions) as TurnPlan;
const rejection = (body: unknown) => {
  const error = plan(body) as SurfaceError;
  return { status: error.status, type: error.type, message: error.message };
};

describe('planTurn: a request answering a parked run', () => {
  it('continues the parked run with the results, in any order', () => {
    const results = [result('toolu_2'), result('toolu_1', [{ type: 'text', text: 'sunny' }])];

    expect(planned(request(results)).continuation).toEqual({ parked: PARKED, results });
  });

  it('carries is_error and image results as the client sent them', () => {
    const image = { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgo=' } };
    const results = [{ ...result('toolu_1', [image]), is_error: false }, { ...result('toolu_2', 'no data'), is_error: true }];

    expect(planned(request(results)).continuation).toEqual({ parked: PARKED, results });
  });

  it('ignores edits to the earlier history: the ids are the contract', () => {
    const edited = [{ role: 'user', content: 'Something else entirely' }, { role: 'assistant', content: 'Sure.' }];

    expect(planned(request([result('toolu_1'), result('toolu_2')], edited)).continuation)
      .toEqual({ parked: PARKED, results: [result('toolu_1'), result('toolu_2')] });
  });

  it('answers a partial answer with the real API’s 400, naming the ids left without a result', () => {
    expect(rejection(request([result('toolu_2')]))).toEqual(invalidRequest(
      'messages.1: `tool_use` ids were found without `tool_result` blocks immediately after: toolu_1. ' +
      'Each `tool_use` block must have a corresponding `tool_result` block in the next message.'
    ));
  });

  it('answers a result for an id the parked call never made with the real API’s 400', () => {
    expect(rejection(request([result('toolu_1'), result('toolu_2'), result('toolu_9')]))).toEqual(invalidRequest(
      'messages.2.content.2: unexpected `tool_use_id` found in `tool_result` blocks: toolu_9. ' +
      'Each `tool_result` block must have a corresponding `tool_use` block in the previous message.'
    ));
  });

  it('refuses content after the results, which a held-open run has no way to take', () => {
    expect(rejection(request([result('toolu_1'), result('toolu_2'), { type: 'text', text: 'And Rome?' }])))
      .toEqual(invalidRequest(
        'messages.2.content.2: "text" blocks after the tool_result blocks are not supported on this surface ' +
        'when the results answer a parked tool call; send them in the next turn'
      ));
  });

  it('replays a turn whose results name no parked run, noting the lost park', () => {
    const turn = planned(request([result('toolu_1'), result('toolu_2')]), NO_SESSIONS);

    expect(turn.continuation).toEqual({ replay: expect.objectContaining({ role: 'user' }) });
    expect(turn.lostPark).toEqual(['toolu_1', 'toolu_2']);
  });

  it('notes no lost park for a turn that answers no tool call', () => {
    const turn = planned({ model: 'fable', max_tokens: 1024, messages: [ASK] });

    expect(turn.lostPark).toBeUndefined();
    expect(turn.continuation).toEqual({ replay: { role: 'user', content: [{ type: 'text', text: ASK.content }] } });
  });

  it('validates a tool_result’s id and is_error', () => {
    expect(rejection(request([{ type: 'tool_result', content: 'x' }])))
      .toEqual(invalidRequest('messages.2.content.0.tool_use_id: Field required'));
    expect(rejection(request([{ type: 'tool_result', tool_use_id: 7 }])))
      .toEqual(invalidRequest('messages.2.content.0.tool_use_id: Input should be a valid string'));
    expect(rejection(request([{ ...result('toolu_1'), is_error: 'yes' }])))
      .toEqual(invalidRequest('messages.2.content.0.is_error: Input should be a valid boolean'));
  });

  it('plans the parked continuation even when the answer is split over two user messages', () => {
    const body = { ...request([result('toolu_1')]), messages: [ASK, CALLS, { role: 'user', content: [result('toolu_1')] },
      { role: 'user', content: [result('toolu_2')] }] };

    expect(planned(body).continuation).toEqual({ parked: PARKED, results: [result('toolu_1'), result('toolu_2')] });
    expect(plan(body)).not.toBeInstanceOf(SurfaceError);
  });
});

describe('planTurn: the run-bound parameters a resuming turn cannot change (spec section 12)', () => {
  const base = { model: 'fable', max_tokens: 1024, system: 'Be brief.', tools: TOOLS, messages: [ASK] };
  const changed = (other: object) => changedRunBound(planned(base).runBound, planned({ ...base, ...other }).runBound);

  it('names each run-bound parameter that differs', () => {
    expect(changed({ max_tokens: 2048, system: [{ type: 'text', text: 'Be long.' }] })).toEqual(['max_tokens', 'system']);
    expect(changed({ model: 'opus', tools: [...TOOLS, { name: 'get_time', input_schema: { type: 'object' } }] }))
      .toEqual(['model', 'tools']);
    expect(changed({ thinking: { type: 'adaptive' }, output_config: { effort: 'high' } }))
      .toEqual(['thinking', 'output_config.effort']);
  });

  it('names none for the same run, however the request spells it', () => {
    expect(changed({ model: 'claude-fable-5-1', system: [{ type: 'text', text: 'Be brief.' }], tool_choice: { type: 'auto' } }))
      .toEqual([]);
    expect(changed({ messages: [ASK, CALLS, { role: 'user', content: [result('toolu_1'), result('toolu_2')] }] })).toEqual([]);
  });
});
