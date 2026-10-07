/**
 * The response's `diagnostics` (spec sections 4.1 and 12): the client's request `diagnostics` is
 * accepted and ignored, so the response says `diagnostics: null` whatever upstream reports about
 * its own request (a resumed run carries upstream's `cache_miss_reason`).
 */
import { ApiEvent } from '../../../../src/anthropic/translate';
import { MESSAGE_START, PLAIN_CALL, streamEvent, translate } from '../../../mocks/anthropic/turn-frames';
import { recordedFrames, recordedStdout } from '../../../mocks/upstream/recordings';

type StartFrame = { type: string; event?: { type: string; message: { diagnostics?: unknown } } };

const messageStartOf = (events: unknown[]) =>
  (events as ApiEvent[]).find(event => event.type === 'message_start') as { message: { diagnostics?: unknown } };

describe('translator: response diagnostics', () => {
  it.each(['cli-probes/p6-resume-snapshot-off.jsonl', 'cli-probes/p7-resume-snapshot-on.jsonl'])(
    'relays null where upstream reports its own cache diagnostics (%s)',
    (fixture) => {
      const upstream = (recordedStdout(fixture) as StartFrame[])
        .find(frame => frame.type === 'stream_event' && frame.event?.type === 'message_start');
      expect(upstream?.event?.message.diagnostics).toEqual(expect.objectContaining({ cache_miss_reason: expect.anything() }));

      expect(messageStartOf(translate(recordedFrames(fixture))).message.diagnostics).toBeNull();
    }
  );

  it('keeps every other message_start field as upstream sent it', () => {
    const start = { ...MESSAGE_START, message: { ...MESSAGE_START.message, diagnostics: { cache_miss_reason: null } } };

    const [first] = translate([streamEvent(start), ...PLAIN_CALL.slice(1).map(event => streamEvent(event))]);

    expect(first).toEqual({ ...MESSAGE_START, message: { ...MESSAGE_START.message, diagnostics: null } });
  });
});
