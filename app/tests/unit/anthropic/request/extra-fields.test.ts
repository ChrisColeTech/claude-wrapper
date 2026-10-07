/**
 * Top-level fields the surface does not know (spec section 4.1): unknown and beta-only fields are
 * a 400 with the real API's "Extra inputs are not permitted" wording, and `container` is a 400 of
 * its own, so a client learns at once that a feature is absent instead of getting an answer that
 * ignored it.
 */
import { SurfaceError } from '../../../../src/anthropic/http/surface-error';
import { invalidRequest, planDefault, rejectionOf } from '../../../mocks/anthropic/plan-context';

const VALID = { model: 'claude-sonnet-5-5', max_tokens: 1024, messages: [{ role: 'user', content: 'Hello' }] };
const extraInputs = (path: string) => invalidRequest(`${path}: Extra inputs are not permitted`);

describe('planTurn rejects fields the surface does not know (spec section 4.1)', () => {
  it.each([
    ['context_management', { edits: [{ type: 'clear_tool_uses_20250919' }] }],
    ['speed', 'fast'],
    ['fallbacks', [{ model: 'claude-haiku-4-5' }]],
    ['output_format', { type: 'json_schema', schema: { type: 'object' } }],
    ['compaction', { enabled: true }],
    ['mcp_servers', [{ type: 'url', url: 'https://example.com/mcp', name: 'example' }]]
  ])('rejects the beta-only field %s with the real API’s wording', (field, value) => {
    expect(rejectionOf({ ...VALID, [field]: value })).toEqual(extraInputs(field));
  });

  it.each([['session_id'], ['betas'], ['user_profile_id'], ['Model'], ['frequency_penalty']])(
    'rejects the unknown top-level field %s',
    (field) => {
      expect(rejectionOf({ ...VALID, [field]: 'x' })).toEqual(extraInputs(field));
    }
  );

  it('rejects an unknown field before resolving the model, as a schema error', () => {
    expect(rejectionOf({ ...VALID, model: 'claude-opus-4-1', speed: 'fast' })).toEqual(extraInputs('speed'));
  });

  it('rejects the beta-only output_config.task_budget and any unknown output_config field', () => {
    expect(rejectionOf({ ...VALID, output_config: { task_budget: { type: 'tokens', total: 1000 } } })).toEqual(
      extraInputs('output_config.task_budget')
    );
    expect(rejectionOf({ ...VALID, output_config: { effort: 'low', verbosity: 'low' } })).toEqual(
      extraInputs('output_config.verbosity')
    );
  });

  it.each([['low'], [[{ effort: 'low' }]]])('requires output_config to be an object: %p', (outputConfig) => {
    expect(rejectionOf({ ...VALID, output_config: outputConfig })).toEqual(
      invalidRequest('output_config: Input should be a valid dictionary')
    );
  });

  it.each([['container_011CTsoaF6jXv4rr1VwvdpN6'], [{ skills: [{ type: 'anthropic', skill_id: 'pptx' }] }]])(
    'rejects container with its own message: %p',
    (container) => {
      expect(rejectionOf({ ...VALID, container })).toEqual(
        invalidRequest('container: containers are not supported on this surface')
      );
    }
  );

  it('accepts every field of the Messages API it serves', () => {
    const request = {
      ...VALID,
      system: 'Be brief.',
      stream: false,
      metadata: { user_id: 'user-1' },
      service_tier: 'auto',
      inference_geo: 'us',
      diagnostics: { previous_message_id: 'msg_1' },
      cache_control: { type: 'ephemeral' },
      container: null,
      tool_choice: { type: 'auto' },
      tools: [],
      temperature: 1,
      top_p: 0.99,
      output_config: {}
    };

    expect(planDefault(request)).not.toBeInstanceOf(SurfaceError);
  });
});
