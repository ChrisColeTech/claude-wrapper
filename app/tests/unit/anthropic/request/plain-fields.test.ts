/**
 * The body fields that only need their type checked (spec sections 4.1 and 12): `stream`
 * (honoured by the sink) and the fields accepted and ignored, `metadata`, `service_tier` (its enum
 * validated), `inference_geo`, `diagnostics` and a top-level `cache_control`. None of them changes
 * the plan. As for every optional field, `null` reads as absent.
 */
import { SurfaceError } from '../../../../src/anthropic/surface-error';
import { TurnPlan } from '../../../../src/anthropic/request';
import { invalidRequest, planDefault, rejectionOf } from '../../../mocks/anthropic/plan-context';

const VALID = { model: 'sonnet', max_tokens: 1024, messages: [{ role: 'user', content: 'Hello' }] };

describe('planTurn accepts and ignores metadata, service_tier, inference_geo, diagnostics and cache_control', () => {
  it('plans the same turn as without them', () => {
    const ignored = {
      metadata: { user_id: '13803d75-b4b5-4c3e-b2a2-6f21399b021b' },
      service_tier: 'standard_only',
      inference_geo: 'eu',
      diagnostics: { previous_message_id: 'msg_013Uc6srznUEWyqAQcUdL59A' },
      cache_control: { type: 'ephemeral', ttl: '1h' }
    };

    expect(planDefault({ ...VALID, ...ignored })).toEqual(planDefault(VALID));
  });

  it.each([
    [{ metadata: {} }], [{ metadata: { user_id: null } }], [{ metadata: null }], [{ service_tier: 'auto' }],
    [{ service_tier: null }], [{ inference_geo: null }], [{ diagnostics: null }], [{ diagnostics: {} }],
    [{ cache_control: null }], [{ stream: true }], [{ stream: false }]
  ])('accepts %p', (fields) => {
    expect(planDefault({ ...VALID, ...fields })).not.toBeInstanceOf(SurfaceError);
  });

  it.each([['priority'], ['standard'], ['AUTO'], [1]])('accepts only the service_tier enum: %p', (tier) => {
    expect(rejectionOf({ ...VALID, service_tier: tier })).toEqual(
      invalidRequest("service_tier: Input should be 'auto' or 'standard_only'")
    );
  });

  it('checks the shape of metadata, which carries only user_id', () => {
    expect(rejectionOf({ ...VALID, metadata: 'user-1' })).toEqual(invalidRequest('metadata: Input should be a valid dictionary'));
    expect(rejectionOf({ ...VALID, metadata: { user_id: 7 } })).toEqual(
      invalidRequest('metadata.user_id: Input should be a valid string')
    );
    expect(rejectionOf({ ...VALID, metadata: { user_id: 'u', session: 's' } })).toEqual(
      invalidRequest('metadata.session: Extra inputs are not permitted')
    );
  });

  it('checks the type of inference_geo, diagnostics, cache_control and stream', () => {
    expect(rejectionOf({ ...VALID, inference_geo: 7 })).toEqual(invalidRequest('inference_geo: Input should be a valid string'));
    expect(rejectionOf({ ...VALID, diagnostics: 'msg_1' })).toEqual(
      invalidRequest('diagnostics: Input should be a valid dictionary')
    );
    expect(rejectionOf({ ...VALID, cache_control: 'ephemeral' })).toEqual(
      invalidRequest('cache_control: Input should be a valid dictionary')
    );
    expect(rejectionOf({ ...VALID, stream: 'true' })).toEqual(invalidRequest('stream: Input should be a valid boolean'));
  });

  it('never makes metadata.user_id part of the run', () => {
    const plan = planDefault({ ...VALID, metadata: { user_id: 'user-7f3a' } }) as TurnPlan;

    expect(JSON.stringify(plan)).not.toContain('user-7f3a');
  });
});
