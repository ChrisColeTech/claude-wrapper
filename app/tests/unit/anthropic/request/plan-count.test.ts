/**
 * `planCountTokens` (spec section 12): a `count_tokens` body is planned as a Messages turn would
 * be (the same validation, system prompt, rendered history and mounted tools), and its run
 * measures it: capped at one output token, persisting no session.
 */
import { SurfaceError } from '../../../../src/anthropic/surface-error';
import { planCountTokens, TurnPlan } from '../../../../src/anthropic/request';
import { invalidRequest, runContext, shippedCatalogue } from '../../../mocks/anthropic/plan-context';

const countRequest = (fields: object = {}) => ({ model: 'fable', messages: [{ role: 'user', content: 'Hello' }], ...fields });

/** The rejection as the client would see it. */
const countRejection = (body: unknown) => {
  const plan = planCountTokens(body, shippedCatalogue, runContext());
  if (!(plan instanceof SurfaceError)) throw new Error('expected a SurfaceError, got a plan');
  return { status: plan.status, type: plan.type, message: plan.message };
};

const countOf = (body: unknown): TurnPlan => {
  const plan = planCountTokens(body, shippedCatalogue, runContext());
  if (plan instanceof SurfaceError) throw new Error(`unexpected rejection: ${plan.message}`);
  return plan;
};

describe('planCountTokens: the measuring run', () => {
  it('is capped at one output token and persists no session', () => {
    const { runSpec } = countOf(countRequest());

    expect(runSpec.env['CLAUDE_CODE_MAX_OUTPUT_TOKENS']).toBe('1');
    expect(runSpec.flags[runSpec.flags.length - 1]).toBe('--no-session-persistence');
  });
});

describe("planCountTokens: the count_tokens body", () => {
  it.each([
    ['max_tokens', 1024], ['stream', false], ['stop_sequences', ['STOP']], ['metadata', { user_id: 'u' }],
    ['temperature', 1], ['top_p', 1], ['service_tier', 'auto'], ['inference_geo', 'us'], ['diagnostics', {}],
    ['container', null]
  ])('rejects the Messages-only field %s as the real API does', (field, value) => {
    expect(countRejection(countRequest({ [field]: value })))
      .toEqual(invalidRequest(`${field}: Extra inputs are not permitted`));
  });

  it('takes the fields count_tokens defines', () => {
    const plan = countOf(countRequest({
      system: [{ type: 'text', text: 'Be brief.', cache_control: { type: 'ephemeral' } }],
      tools: [{ name: 'get_weather', input_schema: { type: 'object' } }],
      tool_choice: { type: 'auto' },
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
      cache_control: { type: 'ephemeral' }
    }));

    expect(plan.system).toBe('Be brief.');
    expect(plan.bridgeTools.map(tool => tool.name)).toEqual(['get_weather']);
    expect(plan.runSpec.flags).toEqual(expect.arrayContaining(['--effort', 'low']));
  });
});

describe('planCountTokens: the same validation as Messages', () => {
  it.each(['any', 'tool'])('rejects tool_choice %s with the real API\'s message', (type) => {
    const body = countRequest({
      tools: [{ name: 'get_weather', input_schema: { type: 'object' } }],
      tool_choice: { type, ...(type === 'tool' ? { name: 'get_weather' } : {}) }
    });

    expect(countRejection(body))
      .toEqual(invalidRequest('tool_choice: type "tool" and "any" are not supported for this model.'));
  });

  it('answers an unknown model with 404 not_found_error', () => {
    expect(countRejection(countRequest({ model: 'claude-unknown' })))
      .toEqual({ status: 404, type: 'not_found_error', message: 'model: claude-unknown' });
  });

  it('rejects a message history the real API rejects', () => {
    expect(countRejection(countRequest({ messages: [{ role: 'assistant', content: 'Hi' }] })))
      .toEqual(invalidRequest('messages: first message must use the "user" role'));
  });

  it("rejects thinking a model does not take, and a budget below the real API's minimum", () => {
    expect(countRejection(countRequest({ thinking: { type: 'enabled', budget_tokens: 2048 } })).status).toBe(400);
    expect(countRejection(countRequest({ model: 'haiku', thinking: { type: 'enabled', budget_tokens: 512 } })))
      .toEqual(invalidRequest('thinking.enabled.budget_tokens: Input should be greater than or equal to 1024'));
  });
});

describe('planCountTokens: thinking under the one-token cap', () => {
  const thinkingVariables = (body: unknown) => {
    const { env } = countOf(body).runSpec;
    return { disable: env['CLAUDE_CODE_DISABLE_THINKING'], budget: env['MAX_THINKING_TOKENS'] };
  };

  it('measures a budgeted request with thinking off, whatever the budget (a count has no max_tokens)', () => {
    expect(thinkingVariables(countRequest({ model: 'haiku', thinking: { type: 'enabled', budget_tokens: 50_000 } })))
      .toEqual({ disable: '1', budget: undefined });
  });

  it('runs Haiku without thinking, as its turns run, and a 5.x model as it thinks by default', () => {
    expect(thinkingVariables(countRequest({ model: 'haiku' }))).toEqual({ disable: '1', budget: undefined });
    expect(thinkingVariables(countRequest({ thinking: { type: 'adaptive' } })))
      .toEqual({ disable: undefined, budget: undefined });
  });
});

describe('planCountTokens: what the run is given', () => {
  const weather = { name: 'get_weather', description: 'Weather by city', input_schema: { type: 'object' } };

  it('renders the history as a replayed turn, never resuming a session nor answering a parked run', () => {
    const plan = countOf(countRequest({
      messages: [
        { role: 'user', content: 'What is the weather in Paris?' },
        { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_1', name: 'get_weather', input: { city: 'Paris' } }] },
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'Sunny' }] }
      ],
      tools: [weather]
    }));

    expect(Object.keys(plan.continuation)).toEqual(['replay']);
    expect(plan.runSpec.flags).not.toContain('--resume');
    const [history] = 'replay' in plan.continuation ? plan.continuation.replay.content : [];
    expect(history).toEqual(expect.objectContaining({ type: 'text', text: expect.stringContaining('<conversation_history>') }));
  });

  it('mounts the client tools, so their definitions are counted', () => {
    const { runSpec, startupChecks } = countOf(countRequest({ tools: [weather] }));

    expect(runSpec.flags).toEqual(expect.arrayContaining([
      '--allowedTools', 'mcp__client__get_weather', '--mcp-config', '/var/lib/claude-wrapper/runs/run-0001/mcp-config.json'
    ]));
    expect(startupChecks.tools).toEqual(['mcp__client__get_weather']);
  });

  it('mounts none under tool_choice none, as the turn it measures would', () => {
    const plan = countOf(countRequest({ tools: [weather], tool_choice: { type: 'none' } }));

    expect(plan.bridgeTools).toEqual([]);
    expect(plan.runSpec.flags).not.toContain('--mcp-config');
  });
});
