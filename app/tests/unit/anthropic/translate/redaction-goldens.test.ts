/**
 * The account-email disclosure recordings as redaction goldens (spec section 6, Testing
 * Decisions): asked for the address in its context, the model quotes it; with redaction armed the
 * client sees `[redacted]` instead. The fixtures carry the scrub's placeholders, so redaction is
 * armed on those, never on an operator's live values. `r3` is the committed golden
 * (`tests/fixtures/turn-streams/r3-baseline-disclosure.redacted.json`); every disclosure is
 * checked against the recording's own `assistant` text, which the translator never reads.
 *
 * After a deliberate change to the turn stream, rewrite the golden and review the diff:
 *   UPDATE_TURN_STREAM_GOLDENS=1 npm run test:unit -- tests/unit/anthropic/translate/redaction-goldens
 */
import * as fs from 'fs';
import * as path from 'path';
import { createTranslator, TurnEvent } from '../../../../src/anthropic/translate';
import { translate } from '../../../mocks/anthropic/turn-frames';
import { recordedFrames, recordedStdout } from '../../../mocks/upstream/recordings';
import { EMAIL_PLACEHOLDER, NAME_PLACEHOLDER } from '../../../scripts/upstream-fixtures/live-values';

const DISCLOSURES = ['r3-baseline-disclosure', 'r2-exclude-dynamic', 'r5-disable-attachments-env', 'r6-nonessential-traffic-env'];
const GOLDEN = path.resolve(__dirname, '..', '..', '..', 'fixtures', 'turn-streams', 'r3-baseline-disclosure.redacted.json');
const UPDATE = process.env['UPDATE_TURN_STREAM_GOLDENS'] === '1';

type Recorded = { type: string; message?: { content: { type: string; text?: string }[] } };

function translateArmed(fixture: string): TurnEvent[] {
  const translator = createTranslator({ logger: { debug: jest.fn() }, redact: [EMAIL_PLACEHOLDER, NAME_PLACEHOLDER] });
  return [...recordedFrames(fixture).flatMap(frame => translator.push(frame)), ...translator.end()];
}

const textOf = (events: TurnEvent[]): string => events
  .flatMap(event => (event.type === 'content_block_delta' && event.delta['type'] === 'text_delta' ? [event.delta['text']] : []))
  .join('');

const withoutTextDeltas = (events: TurnEvent[]): TurnEvent[] =>
  events.filter(event => !(event.type === 'content_block_delta' && event.delta['type'] === 'text_delta'));

/** The answer as the recording's `assistant` frames hold it. */
function recordedText(fixture: string): string {
  return (recordedStdout(fixture) as Recorded[]).filter(frame => frame.type === 'assistant')
    .flatMap(frame => frame.message?.content ?? []).filter(block => block.type === 'text').map(block => block.text).join('');
}

describe('redaction golden: r3, the baseline disclosure', () => {
  const events = translateArmed('cli-probes/r3-baseline-disclosure.jsonl');

  it('matches the committed turn stream', () => {
    if (UPDATE) fs.writeFileSync(GOLDEN, JSON.stringify(events, null, 2) + '\n');
    expect(events).toEqual(JSON.parse(fs.readFileSync(GOLDEN, 'utf8')));
  });

  it('quotes [redacted] where the recording quotes the address', () => {
    expect(textOf(events)).toBe('The email address in my context is: **[redacted]**');
  });
});

describe.each(DISCLOSURES)('redaction of a recorded disclosure: %s', (name) => {
  const fixture = `cli-probes/${name}.jsonl`;
  const events = translateArmed(fixture);

  it("is the recorded answer with each quoted address replaced, and the client sees no trace of it", () => {
    expect(recordedText(fixture).toLowerCase()).toContain(EMAIL_PLACEHOLDER);
    expect(textOf(events)).toBe(recordedText(fixture).split(EMAIL_PLACEHOLDER).join('[redacted]'));
    expect(JSON.stringify(events).toLowerCase()).not.toContain(EMAIL_PLACEHOLDER);
  });

  it('changes nothing but the text deltas', () => {
    expect(withoutTextDeltas(events)).toEqual(withoutTextDeltas(translate(recordedFrames(fixture))));
  });
});
