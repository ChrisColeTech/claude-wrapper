/**
 * `stop_sequences` (spec sections 4.1 and 12): a non-empty list of non-empty strings, else a 400
 * in the real API's schema wording. The scan that honours them belongs to the output-limits
 * ticket; until it lands, a valid list is an honest 400 rather than a silently ignored stop.
 */
import { SurfaceError } from '../../../../src/anthropic/http/surface-error';
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

  it('rejects a valid list until the stop-sequence scan exists, rather than ignoring it', () => {
    expect(rejectionOf(withStops(['END', '\n\nHuman:']))).toEqual(
      invalidRequest('stop_sequences: not supported on this surface yet')
    );
  });
});
