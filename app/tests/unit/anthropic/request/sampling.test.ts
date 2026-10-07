/**
 * Sampling parameters (spec sections 4.1 and 12): upstream has no sampling knob, so on every
 * catalogue model `temperature` is absent or 1.0, `top_p` absent or at least 0.99, and `top_k`
 * absent; anything else is a 400 naming the field and the accepted value.
 */
import { SurfaceError } from '../../../../src/anthropic/surface-error';
import { invalidRequest, planDefault, rejectionOf } from '../../../mocks/anthropic/plan-context';

const MODELS = ['claude-fable-5-1', 'opus', 'sonnet', 'haiku'];
const request = (model: string, fields: object) => ({
  model, max_tokens: 1024, messages: [{ role: 'user', content: 'Hello' }], ...fields
});

const TEMPERATURE = invalidRequest('temperature: only 1.0 is supported on this surface; leave it out or send 1.0');
const TOP_P = invalidRequest('top_p: only values of 0.99 or more are supported on this surface; leave it out or send at least 0.99');
const TOP_K = invalidRequest('top_k: not supported on this surface; leave it out');

describe('planTurn validates temperature, top_p and top_k on every model (spec section 4.1)', () => {
  it.each(MODELS)('accepts them absent, at their accepted values, or null (%s)', (model) => {
    for (const fields of [{}, { temperature: 1 }, { temperature: 1.0, top_p: 0.99 }, { top_p: 1 }, { top_k: null }]) {
      expect(planDefault(request(model, fields))).not.toBeInstanceOf(SurfaceError);
    }
  });

  it.each(MODELS)('rejects any other temperature, Haiku 4.5 included (%s)', (model) => {
    for (const temperature of [0, 0.7, 0.999]) {
      expect(rejectionOf(request(model, { temperature }))).toEqual(TEMPERATURE);
    }
  });

  it.each(MODELS)('rejects a top_p below 0.99 (%s)', (model) => {
    for (const topP of [0, 0.5, 0.98]) {
      expect(rejectionOf(request(model, { top_p: topP }))).toEqual(TOP_P);
    }
  });

  it.each(MODELS)('rejects top_k whatever its value (%s)', (model) => {
    for (const topK of [0, 1, 40]) {
      expect(rejectionOf(request(model, { top_k: topK }))).toEqual(TOP_K);
    }
  });

  it('requires numbers, top_p no greater than 1', () => {
    expect(rejectionOf(request('opus', { temperature: '1' }))).toEqual(
      invalidRequest('temperature: Input should be a valid number')
    );
    expect(rejectionOf(request('opus', { top_p: true }))).toEqual(invalidRequest('top_p: Input should be a valid number'));
    expect(rejectionOf(request('opus', { top_p: 1.5 }))).toEqual(
      invalidRequest('top_p: Input should be less than or equal to 1')
    );
  });
});
