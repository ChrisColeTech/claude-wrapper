/**
 * `stop_sequences` (spec sections 4.1 and 12): a non-empty list of non-empty strings, else a 400
 * in the real API's schema wording. A valid list goes to the turn's translator, whose scan cuts
 * the turn at the first match; it is not run-bound, so it travels with the plan, not the run spec.
 */
import { SurfaceError } from '../../../../src/anthropic/http/surface-error';
import { TurnPlan } from '../../../../src/anthropic/request';
import { invalidRequest, planDefault, rejectionOf } from '../../../mocks/anthropic/plan-context';

const VALID = { model: 'opus', max_tokens: 1024, messages: [{ role: 'user', content: 'Hello' }] };
const withStops = (stopSequences: unknown) => ({ ...VALID, stop_sequences: stopSequences });

describe('planTurn validates stop_sequences (spec section 4.1)', () => {
  it.each([['END'], [{ 0: 'END' }], [7]])('requires a list: %p', (stopSequences) => {
    expect(rejectionOf(withStops(stopSequences))).toEqual(invalidRequest('stop_sequences: Input should be a valid list'));
  });

  it('requires at least one sequence', () => {
    expect(rejectionOf(withStops([]))).toEqual(
      invalidRequest('stop_sequences: List should have at least 1 item after validation, not 0')
    );
  });

  it.each([[7], [null], [['END']]])('requires each sequence to be a string: %p', (sequence) => {
    expect(rejectionOf(withStops(['END', sequence]))).toEqual(
      invalidRequest('stop_sequences.1: Input should be a valid string')
    );
  });

  it('requires each sequence to be non-empty', () => {
    expect(rejectionOf(withStops(['', 'END']))).toEqual(
      invalidRequest('stop_sequences.0: String should have at least 1 character')
    );
  });

  it('accepts them absent or null', () => {
    expect(planDefault(VALID)).not.toBeInstanceOf(SurfaceError);
    expect(planDefault(withStops(null))).not.toBeInstanceOf(SurfaceError);
  });

  it("hands a valid list to the turn's translator, and nothing to the run", () => {
    const plan = planDefault(withStops(['END', '\n\nHuman:'])) as TurnPlan;

    expect(plan.translatorConfig).toEqual({ stopSequences: ['END', '\n\nHuman:'] });
    expect(plan.runSpec).toEqual((planDefault(VALID) as TurnPlan).runSpec);
  });

  it('hands the translator an empty list when there are none', () => {
    expect((planDefault(VALID) as TurnPlan).translatorConfig).toEqual({ stopSequences: [] });
  });
});
