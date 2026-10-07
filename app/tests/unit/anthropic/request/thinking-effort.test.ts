/**
 * `thinking` and `output_config.effort` (spec sections 4.1, 10 and 12), per catalogue entry. The
 * catalogue says what each model accepts, as the real API does: the 5.x entries think adaptively
 * and accept only `adaptive`, which needs nothing passed; Haiku 4.5 takes only manual thinking, so
 * absent or `disabled` sets `CLAUDE_CODE_DISABLE_THINKING=1` (upstream would otherwise think where
 * the real API does not) and `enabled` sets `MAX_THINKING_TOKENS` after the budget checks.
 * `display` is ignored. A valid effort level the entry supports becomes `--effort <level>`.
 * The rejections carry the real API's messages where it documents them.
 */
import { createCatalogue, CatalogueEntry, ModelInfo } from '../../../../src/anthropic/catalogue';
import { SurfaceError } from '../../../../src/anthropic/surface-error';
import { planTurn, TurnPlan } from '../../../../src/anthropic/request';
import {
  invalidRequest, NO_SESSIONS, planDefault, rejectionOf, runContext, shippedCatalogue
} from '../../../mocks/anthropic/plan-context';

const FIVE_X = ['claude-fable-5-1', 'claude-opus-5-5', 'claude-sonnet-5-5'];
const HAIKU = 'claude-haiku-4-5-20251001';
const LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'];
const THINKING_VARIABLES = ['CLAUDE_CODE_DISABLE_THINKING', 'MAX_THINKING_TOKENS'];

const request = (model: string, fields: object = {}) =>
  ({ model, max_tokens: 4096, messages: [{ role: 'user', content: 'Hello' }], ...fields });

const planOf = (body: unknown): TurnPlan => {
  const plan = planDefault(body);
  if (plan instanceof SurfaceError) throw new Error(`unexpected rejection: ${plan.message}`);
  return plan;
};

/** The thinking variables the plan puts in the child environment. */
const thinkingEnv = (body: unknown): Record<string, string> => Object.fromEntries(
  Object.entries(planOf(body).runSpec.env).filter(([name]) => THINKING_VARIABLES.includes(name))
);

const ENABLED_NOT_SUPPORTED = '"thinking.type.enabled" is not supported for this model. ' +
  'Use "thinking.type.adaptive" and "output_config.effort" to control thinking behavior.';
const DISABLED_NOT_SUPPORTED = '"thinking.type.disabled" is not supported for this model. ' +
  'Use "thinking.type.adaptive" and "output_config.effort" to control thinking behavior.';
const BETWEEN_TOOLS_NOT_SUPPORTED = '"thinking.type.between_tools" is not supported for this model.';
const ADAPTIVE_NOT_SUPPORTED = 'adaptive thinking is not supported on this model';

describe.each(FIVE_X)('thinking on %s (adaptive only)', (model) => {
  it('passes nothing when thinking is absent, null or adaptive, whatever display asks', () => {
    expect(thinkingEnv(request(model))).toEqual({});
    expect(thinkingEnv(request(model, { thinking: null }))).toEqual({});
    expect(thinkingEnv(request(model, { thinking: { type: 'adaptive' } }))).toEqual({});
    expect(thinkingEnv(request(model, { thinking: { type: 'adaptive', display: 'summarized' } }))).toEqual({});
  });

  it.each([
    [{ type: 'enabled', budget_tokens: 2048 }, ENABLED_NOT_SUPPORTED],
    [{ type: 'disabled' }, DISABLED_NOT_SUPPORTED],
    [{ type: 'between_tools' }, BETWEEN_TOOLS_NOT_SUPPORTED]
  ])("rejects %p with the real API's message", (thinking, message) => {
    expect(rejectionOf(request(model, { thinking }))).toEqual(invalidRequest(message));
  });
});

describe('thinking on Haiku 4.5 (manual only)', () => {
  it.each([undefined, null, { type: 'disabled' }])(
    'switches upstream thinking off when thinking is %p, as the real API does not think by default',
    (thinking) => {
      expect(thinkingEnv(request('haiku', thinking === undefined ? {} : { thinking }))).toEqual({
        CLAUDE_CODE_DISABLE_THINKING: '1'
      });
    }
  );

  it('passes an enabled budget as MAX_THINKING_TOKENS, display ignored', () => {
    expect(thinkingEnv(request(HAIKU, { thinking: { type: 'enabled', budget_tokens: 1024, display: 'summarized' } })))
      .toEqual({ MAX_THINKING_TOKENS: '1024' });
    expect(thinkingEnv(request(HAIKU, { max_tokens: 64000, thinking: { type: 'enabled', budget_tokens: 63999 } })))
      .toEqual({ MAX_THINKING_TOKENS: '63999' });
  });

  it.each([
    [{ type: 'enabled' }, 'thinking.enabled.budget_tokens: Field required'],
    [{ type: 'enabled', budget_tokens: '2048' }, 'thinking.enabled.budget_tokens: Input should be a valid integer'],
    [{ type: 'enabled', budget_tokens: 2048.5 }, 'thinking.enabled.budget_tokens: Input should be a valid integer'],
    [{ type: 'enabled', budget_tokens: 1023 }, 'thinking.enabled.budget_tokens: Input should be greater than or equal to 1024'],
    [{ type: 'enabled', budget_tokens: 4096 }, '`max_tokens` must be greater than `thinking.budget_tokens`.'],
    [{ type: 'enabled', budget_tokens: 8192 }, '`max_tokens` must be greater than `thinking.budget_tokens`.'],
    [{ type: 'adaptive' }, ADAPTIVE_NOT_SUPPORTED],
    [{ type: 'between_tools' }, BETWEEN_TOOLS_NOT_SUPPORTED]
  ])('rejects %p', (thinking, message) => {
    expect(rejectionOf(request(HAIKU, { thinking }))).toEqual(invalidRequest(message));
  });
});

describe('the thinking field itself', () => {
  it.each([
    ['on', 'thinking: Input should be a valid dictionary'],
    [[{ type: 'adaptive' }], 'thinking: Input should be a valid dictionary'],
    [{}, 'thinking.type: Field required'],
    [{ type: 'auto' }, "thinking.type: Input should be 'adaptive', 'between_tools', 'disabled' or 'enabled'"]
  ])('rejects %p on every model', (thinking, message) => {
    for (const model of [...FIVE_X, HAIKU]) {
      expect(rejectionOf(request(model, { thinking }))).toEqual(invalidRequest(message));
    }
  });
});

describe('output_config.effort', () => {
  const flagsOf = (body: unknown): string[] => planOf(body).runSpec.flags;

  it.each(FIVE_X.flatMap(model => LEVELS.map(level => [model, level])))(
    'passes %s effort %s as --effort, after --max-turns',
    (model, level) => {
      expect(flagsOf(request(model, { output_config: { effort: level } })).slice(-4)).toEqual([
        '--max-turns', '25', '--effort', level
      ]);
    }
  );

  it.each([undefined, null])('passes no --effort when it is %p', (effort) => {
    expect(flagsOf(request('opus', { output_config: { effort } }))).not.toContain('--effort');
    expect(flagsOf(request('opus'))).not.toContain('--effort');
  });

  it.each(LEVELS)('rejects %s on Haiku 4.5, which takes no effort', (level) => {
    expect(rejectionOf(request(HAIKU, { output_config: { effort: level } }))).toEqual(
      invalidRequest('output_config.effort is not supported for this model.')
    );
  });

  it.each(['extreme', 'HIGH', 3])('rejects a level outside the enum: %p', (effort) => {
    expect(rejectionOf(request('sonnet', { output_config: { effort } }))).toEqual(
      invalidRequest("output_config.effort: Input should be 'low', 'medium', 'high', 'xhigh' or 'max'")
    );
  });
});

describe('an operator catalogue drives both checks', () => {
  const base: ModelInfo = shippedCatalogue.resolve('opus') as ModelInfo;
  const capabilities = base.capabilities as NonNullable<ModelInfo['capabilities']>;
  const entry = (id: string, overrides: Partial<ModelInfo>): CatalogueEntry => ({ ...base, id, aliases: [], ...overrides });
  const catalogue = createCatalogue([
    entry('no-xhigh', { capabilities: { ...capabilities, effort: { ...capabilities.effort, xhigh: { supported: false } } } }),
    entry('unknown-capabilities', { capabilities: null })
  ]);
  const plan = (body: unknown) => planTurn(body, catalogue, NO_SESSIONS, runContext());

  it("rejects a level the entry's effort capability lists as unsupported", () => {
    const rejected = plan(request('no-xhigh', { output_config: { effort: 'xhigh' } })) as SurfaceError;

    expect({ status: rejected.status, type: rejected.type, message: rejected.message }).toEqual(invalidRequest("output_config.effort 'xhigh' is not supported for this model."));
  });

  it('accepts what the request asks when the entry states no capabilities', () => {
    const effort = plan(request('unknown-capabilities', { output_config: { effort: 'max' } })) as TurnPlan;
    const enabled = plan(request('unknown-capabilities', { thinking: { type: 'enabled', budget_tokens: 2048 } })) as TurnPlan;
    const disabled = plan(request('unknown-capabilities', { thinking: { type: 'disabled' } })) as TurnPlan;
    const absent = plan(request('unknown-capabilities')) as TurnPlan;

    expect(effort.runSpec.flags.slice(-2)).toEqual(['--effort', 'max']);
    expect(enabled.runSpec.env).toEqual(expect.objectContaining({ MAX_THINKING_TOKENS: '2048' }));
    expect(disabled.runSpec.env).toEqual(expect.objectContaining({ CLAUDE_CODE_DISABLE_THINKING: '1' }));
    expect(Object.keys(absent.runSpec.env)).not.toEqual(expect.arrayContaining(['CLAUDE_CODE_DISABLE_THINKING']));
  });
});
