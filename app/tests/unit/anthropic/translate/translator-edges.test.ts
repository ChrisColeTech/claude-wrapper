/**
 * The stream translator's plain-turn rules on hand-built frames (spec section 11): which frames
 * are not relayed, where the turn ends, and a `result` that fails the turn.
 */
import { TurnEvent } from '../../../../src/anthropic/translate';
import {
  frameOf, MESSAGE_START, PLAIN_CALL, resultFrame, streamEvent, TEXT_START, textDelta, translate
} from '../../../mocks/anthropic/turn-frames';

const types = (events: TurnEvent[]): string[] => events.map(event => event.type);

describe('translator: what is not relayed', () => {
  it('drops a synthetic assistant frame and logs it', () => {
    const debug = jest.fn();
    const synthetic = frameOf({ type: 'assistant', parent_tool_use_id: null, message: { id: 'x',
      model: '<synthetic>', role: 'assistant', content: [{ type: 'text', text: 'API Error: 400 bad' }] } });

    const events = translate([streamEvent(MESSAGE_START), synthetic], debug);

    expect(types(events)).toEqual(['message_start']);
    expect(debug).toHaveBeenCalledWith('Synthetic assistant frame dropped from the turn stream');
  });

  it('never takes an assistant frame as input', () => {
    const assistant = frameOf({ type: 'assistant', parent_tool_use_id: null,
      message: { id: 'msg_1', model: 'claude-fable-5-1', content: [{ type: 'text', text: 'hi' }] } });

    expect(translate([assistant])).toEqual([]);
  });

  it('drops the stream events of a sub-agent (non-null parent_tool_use_id)', () => {
    const events = translate([streamEvent(MESSAGE_START), streamEvent(TEXT_START, 'toolu_1'), streamEvent(TEXT_START)]);

    expect(types(events)).toEqual(['message_start', 'content_block_start']);
  });

  it('suppresses a later message_start inside the turn', () => {
    const later = { ...MESSAGE_START, message: { ...MESSAGE_START.message, id: 'msg_2' } };

    expect(translate([streamEvent(MESSAGE_START), streamEvent(later)])).toHaveLength(1);
  });

  it('relays nothing after the turn-ending message_stop', () => {
    const events = translate([...PLAIN_CALL, ...PLAIN_CALL].map(event => streamEvent(event)));

    expect(types(events)).toEqual(PLAIN_CALL.map(event => event.type));
  });

  it('drops an event type the API does not define, and logs it', () => {
    const debug = jest.fn();

    const events = translate([streamEvent(MESSAGE_START), streamEvent({ type: 'message_pause' })], debug);

    expect(types(events)).toEqual(['message_start']);
    expect(debug).toHaveBeenCalledWith('Field dropped from the turn stream', { field: 'message_pause' });
  });

  it('keeps only the type of a content block type it does not know', () => {
    const novel = { type: 'content_block_start', index: 0, content_block: { type: 'novel', secret: 'x' } };

    const events = translate([streamEvent(MESSAGE_START), streamEvent(novel)]);

    expect(events[1]).toEqual({ type: 'content_block_start', index: 0, content_block: { type: 'novel' } });
  });
});

describe('translator: result', () => {
  it('fails the turn with upstream text when an error result arrives before the end, and stops there', () => {
    const events = translate([streamEvent(MESSAGE_START), streamEvent(TEXT_START),
      resultFrame({ is_error: true, result: 'API Error: 500 upstream broke' }), streamEvent(textDelta('late'))]);

    expect(types(events)).toEqual(['message_start', 'content_block_start', 'fail']);
    expect(events[2]).toEqual({ type: 'fail', error: expect.objectContaining({
      status: 500, type: 'api_error', message: 'API Error: 500 upstream broke'
    }) });
  });

  it('fails with the joined errors of a non-success subtype, else with the subtype', () => {
    const [joined] = translate([resultFrame({ subtype: 'error_max_turns', is_error: true, result: undefined,
      errors: ['first', 'second'] })]);
    const [bare] = translate([resultFrame({ subtype: 'error_during_execution', result: undefined })]);

    expect(joined).toEqual({ type: 'fail', error: expect.objectContaining({ message: 'first; second' }) });
    expect(bare).toEqual({ type: 'fail', error: expect.objectContaining({ message: 'error_during_execution' }) });
  });

  it('ignores the result once the turn has ended, error or not', () => {
    const frames = [...PLAIN_CALL.map(event => streamEvent(event)), resultFrame({ is_error: true, result: 'late' })];

    expect(types(translate(frames))).toEqual(PLAIN_CALL.map(event => event.type));
  });

  it('produces nothing for a successful result', () => {
    expect(translate([resultFrame()])).toEqual([]);
  });
});
