/**
 * `output_config.format` (spec sections 4.1, 10 and 12): `format.type` must be `json_schema`, and
 * the schema passes verbatim as `--json-schema` (upstream validates it at startup). A format run
 * expects upstream to report its `StructuredOutput` tool on `system/init`, and its translator
 * renders that tool's call as the JSON text block. `null` reads as absent.
 */
import { SurfaceError } from '../../../../src/anthropic/http/surface-error';
import { planCountTokens, TurnPlan } from '../../../../src/anthropic/request';
import { invalidRequest, planDefault, rejectionOf, runContext, shippedCatalogue } from '../../../mocks/anthropic/plan-context';

const SCHEMA = {
  type: 'object',
  properties: { word: { type: 'string', description: 'One word, "quoted" and\nmultiline' } },
  required: ['word'],
  additionalProperties: false
};

const request = (fields: object = {}) =>
  ({ model: 'fable', max_tokens: 1024, messages: [{ role: 'user', content: 'Reply with a word.' }], ...fields });

const planOf = (body: unknown): TurnPlan => {
  const plan = planDefault(body);
  if (plan instanceof SurfaceError) throw new Error(`unexpected rejection: ${plan.message}`);
  return plan;
};

const flagValue = (flags: string[], flag: string): string | undefined =>
  (flags.includes(flag) ? flags[flags.indexOf(flag) + 1] : undefined);

describe('output_config.format', () => {
  const format = { type: 'json_schema', schema: SCHEMA };

  it('passes the schema verbatim as --json-schema, after --effort and before --resume', () => {
    const { flags } = planOf(request({ output_config: { format, effort: 'low' } })).runSpec;

    expect(JSON.parse(flagValue(flags, '--json-schema') as string)).toEqual(SCHEMA);
    expect(flagValue(flags, '--json-schema')).toBe(JSON.stringify(SCHEMA));
    expect(flags.indexOf('--json-schema')).toBe(flags.indexOf('--effort') + 2);
    expect(flags.indexOf('--json-schema')).toBe(flags.length - 2);
  });

  it('expects StructuredOutput on system/init and arms the translator for it', () => {
    const plan = planOf(request({ output_config: { format } }));

    expect(plan.startupChecks.tools).toEqual(['StructuredOutput']);
    expect(plan.translatorConfig.structuredOutput).toBe(true);
  });

  it.each([
    ['absent', request()],
    ['null', request({ output_config: { format: null } })],
    ['an output_config without it', request({ output_config: { effort: 'high' } })]
  ])('is no format run when %s', (_case, body) => {
    const plan = planOf(body);

    expect(plan.runSpec.flags).not.toContain('--json-schema');
    expect(plan.startupChecks.tools).toEqual([]);
    expect(plan.translatorConfig.structuredOutput).toBe(false);
  });

  it.each([
    [{ format: 'json' }, 'output_config.format: Input should be a valid dictionary'],
    [{ format: { schema: SCHEMA } }, 'output_config.format.type: Field required'],
    [{ format: { type: 'json_object', schema: SCHEMA } }, "output_config.format.type: Input should be 'json_schema'"],
    [{ format: { type: 'json_schema' } }, 'output_config.format.schema: Field required'],
    [{ format: { type: 'json_schema', schema: [SCHEMA] } }, 'output_config.format.schema: Input should be a valid dictionary'],
    [{ format: { type: 'json_schema', schema: null } }, 'output_config.format.schema: Input should be a valid dictionary'],
    [{ format: { ...format, strict: true } }, 'output_config.format.strict: Extra inputs are not permitted']
  ])('rejects output_config %p', (outputConfig, message) => {
    expect(rejectionOf(request({ output_config: outputConfig }))).toEqual(invalidRequest(message));
  });

  it('is measured on a count_tokens run too: the schema is part of what upstream sends', () => {
    const count = planCountTokens({ model: 'fable', messages: [{ role: 'user', content: 'Hi' }], output_config: { format } },
      shippedCatalogue, runContext()) as TurnPlan;

    expect(flagValue(count.runSpec.flags, '--json-schema')).toBe(JSON.stringify(SCHEMA));
    expect(count.runSpec.flags.slice(-3)).toEqual(['--json-schema', JSON.stringify(SCHEMA), '--no-session-persistence']);
    expect(count.startupChecks.tools).toEqual(['StructuredOutput']);
  });

  it('leaves judging the schema itself to upstream', () => {
    const plan = planOf(request({ output_config: { format: { type: 'json_schema', schema: { type: 12 } } } }));

    expect(flagValue(plan.runSpec.flags, '--json-schema')).toBe('{"type":12}');
  });
});
