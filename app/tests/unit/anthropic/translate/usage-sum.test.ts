/**
 * Pass 11, the usage sum (spec section 11): the final `message_delta.usage` adds every earlier
 * model call's suppressed `message_delta.usage` (and the server tools' request counts), while
 * `message_start.usage` stays the first call's. Hand-built frames; the expected sums are worked
 * out by hand.
 */
import { ApiEvent, createTranslator, TurnEvent } from '../../../../src/anthropic/translate';
import { Frame } from '../../../../src/upstream/frames';
import { structuredAnswer } from '../../../mocks/anthropic/structured-output-frames';
import { PLAIN_CALL, streamEvent } from '../../../mocks/anthropic/turn-frames';

const translate = (frames: Frame[], structuredOutput = false): TurnEvent[] => {
  const translator = createTranslator({ logger: { debug: () => undefined }, structuredOutput });
  return [...frames.flatMap(frame => translator.push(frame)), ...translator.end()];
};
const deltaOf = (events: TurnEvent[]) => events.find(event => event.type === 'message_delta') as Extract<ApiEvent, { type: 'message_delta' }>;

describe('usage sum (spec section 11)', () => {
  it("adds a failed StructuredOutput answer's suppressed call to the answer's usage", () => {
    const events = translate([...structuredAnswer('toolu_1', '{"a":', true), ...structuredAnswer('toolu_2', '{"a":1}')], true);

    expect(deltaOf(events).usage).toEqual({ output_tokens: 18 });
    expect(events.filter(event => event.type === 'message_start')).toHaveLength(1);
    expect(events[0]).toEqual(expect.objectContaining({ message: expect.objectContaining({ usage: { input_tokens: 5, output_tokens: 1 } }) }));
  });

  it('relays a single call’s usage as upstream sent it', () => {
    const events = translate(PLAIN_CALL.map(event => streamEvent(event)));

    expect(deltaOf(events).usage).toEqual({ output_tokens: 7 });
  });

  it('never lets an internal signal out of the translator', () => {
    const events = translate([...structuredAnswer('toolu_1', '{"a":', true), ...structuredAnswer('toolu_2', '{"a":1}')], true);

    expect(events.map(event => event.type).filter(type => ['call_start', 'usage', 'server_tool_result'].includes(type))).toEqual([]);
  });
});
