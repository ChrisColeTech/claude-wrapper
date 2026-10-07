/**
 * `tool_choice` (spec sections 4.1 and 7): `auto`, absent and `none` plan a turn; `any` and `tool`
 * are a 400 with the real API's message on every catalogue model, Haiku 4.5 included (upstream
 * cannot force a tool call); `disable_parallel_tool_use` is accepted and ignored.
 */
import { SurfaceError } from '../../../../src/anthropic/http/surface-error';
import { invalidRequest, planDefault, rejectionOf } from '../../../mocks/anthropic/plan-context';

const MODELS = ['claude-fable-5-1', 'opus', 'sonnet', 'haiku'];
const request = (model: string, toolChoice: unknown) => ({
  model, max_tokens: 1024, messages: [{ role: 'user', content: 'Hello' }], tool_choice: toolChoice
});
const FORCED = invalidRequest('tool_choice: type "tool" and "any" are not supported for this model.');

describe('planTurn validates tool_choice (spec section 7)', () => {
  it.each(MODELS)('rejects any and tool with the real API’s message (%s)', (model) => {
    expect(rejectionOf(request(model, { type: 'any' }))).toEqual(FORCED);
    expect(rejectionOf(request(model, { type: 'tool', name: 'get_weather' }))).toEqual(FORCED);
    expect(rejectionOf(request(model, { type: 'any', disable_parallel_tool_use: true }))).toEqual(FORCED);
  });

  it.each([
    [{ type: 'auto' }], [{ type: 'auto', disable_parallel_tool_use: true }], [{ type: 'auto', disable_parallel_tool_use: false }],
    [{ type: 'none' }], [null]
  ])('accepts %p, disable_parallel_tool_use ignored', (toolChoice) => {
    expect(planDefault(request('opus', toolChoice))).not.toBeInstanceOf(SurfaceError);
  });

  it('plans the same turn whether disable_parallel_tool_use is set or not', () => {
    expect(planDefault(request('opus', { type: 'auto', disable_parallel_tool_use: true })))
      .toEqual(planDefault(request('opus', { type: 'auto' })));
  });

  it('checks the shape', () => {
    expect(rejectionOf(request('opus', 'auto'))).toEqual(invalidRequest('tool_choice: Input should be a valid dictionary'));
    expect(rejectionOf(request('opus', {}))).toEqual(invalidRequest('tool_choice.type: Field required'));
    expect(rejectionOf(request('opus', { type: 'required' }))).toEqual(
      invalidRequest("tool_choice.type: Input should be 'auto', 'any', 'tool' or 'none'")
    );
    expect(rejectionOf(request('opus', { type: 'auto', disable_parallel_tool_use: 'yes' }))).toEqual(
      invalidRequest('tool_choice.disable_parallel_tool_use: Input should be a valid boolean')
    );
  });
});
