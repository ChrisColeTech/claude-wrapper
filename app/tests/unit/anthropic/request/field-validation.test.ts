/**
 * The rejections of the body, `model`, `max_tokens` and `system` (spec sections 3, 4.1, 6, 12):
 * the exact status, type and message `planTurn` answers before anything is spawned.
 */
import { createCatalogue } from '../../../../src/anthropic/catalogue';
import { SurfaceError } from '../../../../src/anthropic/surface-error';
import { planTurn } from '../../../../src/anthropic/request';
import {
  invalidRequest, NO_SESSIONS, planDefault, rejectionOf, runContext
} from '../../../mocks/anthropic/plan-context';

const VALID = { model: 'claude-sonnet-5-5', max_tokens: 1024, messages: [{ role: 'user', content: 'Hello' }] };

describe('planTurn rejects the body', () => {
  it.each([[[]], ['text'], [null], [7]])('that is not a JSON object: %p', (body) => {
    expect(rejectionOf(body)).toEqual(invalidRequest('The request body must be a JSON object'));
  });
});

describe('planTurn validates model (spec section 3)', () => {
  it('requires it', () => {
    const { model: _model, ...request } = VALID;

    expect(rejectionOf(request)).toEqual(invalidRequest('model: Field required'));
  });

  it.each([[7], [null], [['opus']]])('requires a string: %p', (model) => {
    expect(rejectionOf({ ...VALID, model })).toEqual(invalidRequest('model: Input should be a valid string'));
  });

  it.each(['claude-opus-4-1', 'OPUS', 'default', 'sonnet[1m]', ''])(
    'answers 404 with the real API’s message for a name outside the catalogue: %p',
    (model) => {
      expect(rejectionOf({ ...VALID, model })).toEqual({ status: 404, type: 'not_found_error', message: `model: ${model}` });
    }
  );
});

describe('planTurn validates max_tokens (spec sections 4.1, 12)', () => {
  const overLimit = (maxTokens: number, limit: number, id: string) =>
    `max_tokens: ${maxTokens} > ${limit}, which is the maximum allowed number of output tokens for ${id}`;

  it('requires it', () => {
    const { max_tokens: _maxTokens, ...request } = VALID;

    expect(rejectionOf(request)).toEqual(invalidRequest('max_tokens: Field required'));
  });

  it.each([['1024'], [10.5], [true], [null], [[1024]]])('requires an integer: %p', (maxTokens) => {
    expect(rejectionOf({ ...VALID, max_tokens: maxTokens })).toEqual(
      invalidRequest('max_tokens: Input should be a valid integer')
    );
  });

  it.each([[0], [-1]])('rejects %p, including the real API’s cache pre-warm 0', (maxTokens) => {
    expect(rejectionOf({ ...VALID, max_tokens: maxTokens })).toEqual(
      invalidRequest('max_tokens: Input should be greater than or equal to 1')
    );
  });

  it.each([
    ['claude-sonnet-5-5', 128_001, overLimit(128_001, 128_000, 'claude-sonnet-5-5')],
    ['haiku', 64_001, overLimit(64_001, 64_000, 'claude-haiku-4-5-20251001')]
  ])('rejects more than the %s entry allows, with the real API’s message', (model, maxTokens, message) => {
    expect(rejectionOf({ ...VALID, model, max_tokens: maxTokens })).toEqual(invalidRequest(message));
  });

  it.each([
    ['claude-fable-5-1', 128_000], ['opus', 128_000], ['sonnet', 128_000], ['haiku', 64_000], ['haiku', 1]
  ])('accepts %s with max_tokens %p, within its entry', (model, maxTokens) => {
    expect(planDefault({ ...VALID, model, max_tokens: maxTokens })).not.toBeInstanceOf(SurfaceError);
  });

  it('sets no upper bound when the catalogue entry has none', () => {
    const catalogue = createCatalogue([{
      id: 'local-model', type: 'model', display_name: 'Local', created_at: '2026-01-01T00:00:00Z',
      max_input_tokens: null, max_tokens: null, capabilities: null, aliases: []
    }]);
    const request = { ...VALID, model: 'local-model', max_tokens: 1_000_000 };

    expect(planTurn(request, catalogue, NO_SESSIONS, runContext())).not.toBeInstanceOf(SurfaceError);
  });
});

describe('planTurn validates system (spec section 6)', () => {
  it.each([[7], [{ type: 'text', text: 'Be terse.' }], [true]])('requires a string or a list of text blocks: %p', (system) => {
    expect(rejectionOf({ ...VALID, system })).toEqual(
      invalidRequest('system: Input should be a valid string or a list of text blocks')
    );
  });

  it('requires each block to be a text block with string text', () => {
    expect(rejectionOf({ ...VALID, system: ['Be terse.'] })).toEqual(
      invalidRequest('system.0: Input should be a valid dictionary')
    );
    expect(rejectionOf({ ...VALID, system: [{ type: 'text', text: 'a' }, { type: 'image', text: 'b' }] })).toEqual(
      invalidRequest("system.1.type: Input should be 'text'")
    );
    expect(rejectionOf({ ...VALID, system: [{ type: 'text' }] })).toEqual(invalidRequest('system.0.text: Field required'));
    expect(rejectionOf({ ...VALID, system: [{ type: 'text', text: 3 }] })).toEqual(
      invalidRequest('system.0.text: Input should be a valid string')
    );
  });

  it('rejects an empty system text block with the real API’s message', () => {
    expect(rejectionOf({ ...VALID, system: [{ type: 'text', text: '' }] })).toEqual(
      invalidRequest('system: text content blocks must be non-empty')
    );
  });

  it.each([['Be\u0000terse.'], [[{ type: 'text', text: 'Be terse.\u0000' }]]])(
    'rejects a NUL character, which no argument list can carry: %p',
    (system) => {
      expect(rejectionOf({ ...VALID, system })).toEqual(
        invalidRequest('system: must not contain the NUL character, which cannot be passed to upstream')
      );
    }
  );
});
