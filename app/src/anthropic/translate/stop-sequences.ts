/**
 * Pass 8, the stop-sequence scan (spec section 12, ADR 0004). `text_delta` payloads only are
 * scanned (thinking, tool and server-tool input pass untouched), each text block as one text, a
 * tail held back so a match split across deltas is found and flushed at `content_block_stop`.
 * On a match the text before it is relayed, the open block is closed, and the turn ends with
 * `message_delta {stop_reason: "stop_sequence", stop_sequence}`, `message_stop` and the `cut`
 * signal; every event after it is ignored.
 *
 * The cut call's usage: input and cache counters from its `message_start`, and `output_tokens`
 * estimated as that `message_start`'s count plus the characters relayed in the call divided by
 * four, since upstream is interrupted before it reports the call's usage. The usage-sum pass adds
 * earlier calls' sums on top. This pass reads a call's `message_start`, so a flattener that
 * suppresses later calls' must still let their usage reach it.
 */
import { JsonObject } from '../../upstream/frames';
import { Pass } from './pass';
import { createStopScanner, StopScanner } from './stop-scanner';
import { ApiEvent, CutSignal, TurnEvent } from './turn-event';

type DeltaEvent = Extract<ApiEvent, { type: 'content_block_delta' }>;

const CUT: CutSignal = { type: 'cut', reason: 'stop_sequence' };
const INPUT_COUNTERS = ['input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens'];
/** The delta payloads whose characters count towards the cut call's estimated output. */
const PAYLOAD_FIELDS: Readonly<Record<string, string>> = {
  text_delta: 'text', input_json_delta: 'partial_json', thinking_delta: 'thinking'
};

const textDelta = (index: number, text: string): DeltaEvent =>
  ({ type: 'content_block_delta', index, delta: { type: 'text_delta', text } });

const characters = (text: string): number => Array.from(text).length;

class StopSequenceScan implements Pass<TurnEvent, TurnEvent> {
  private readonly scanners = new Map<number, StopScanner>();
  private readonly open = new Set<number>();
  private callUsage: JsonObject = {};
  private relayedCharacters = 0;
  private cut = false;

  constructor(private readonly sequences: readonly string[]) {}

  push(event: TurnEvent): TurnEvent[] {
    if (this.cut) return [];
    switch (event.type) {
      case 'message_start':
        this.callUsage = (event.message['usage'] as JsonObject | undefined) ?? {};
        this.relayedCharacters = 0;
        return [event];
      case 'content_block_start':
        this.open.add(event.index);
        return [event];
      case 'content_block_delta':
        return this.onDelta(event);
      case 'content_block_stop':
        this.open.delete(event.index);
        return [...this.release(event.index), event];
      default:
        return [event];
    }
  }

  end(): TurnEvent[] {
    if (this.cut) return [];
    return [...this.scanners.keys()].flatMap(index => this.release(index));
  }

  private onDelta(event: DeltaEvent): TurnEvent[] {
    const deltaType = String(event.delta['type']);
    const payload = event.delta[PAYLOAD_FIELDS[deltaType] ?? ''];
    if (typeof payload !== 'string') return [event];
    if (deltaType !== 'text_delta') return this.relayed([event], payload);

    const { relay, match } = this.scannerFor(event.index).push(payload);
    if (match !== undefined) return this.cutAt(event.index, relay, match);
    if (relay === '') return [];
    return this.relayed([relay === payload ? event : textDelta(event.index, relay)], relay);
  }

  private relayed(events: TurnEvent[], text: string): TurnEvent[] {
    this.relayedCharacters += characters(text);
    return events;
  }

  private scannerFor(index: number): StopScanner {
    let scanner = this.scanners.get(index);
    if (!scanner) {
      scanner = createStopScanner(this.sequences);
      this.scanners.set(index, scanner);
    }
    return scanner;
  }

  private release(index: number): TurnEvent[] {
    const scanner = this.scanners.get(index);
    if (!scanner) return [];
    this.scanners.delete(index);
    const rest = scanner.flush();
    return rest === '' ? [] : this.relayed([textDelta(index, rest)], rest);
  }

  /** The text before the match, every open block closed, then the turn's end. */
  private cutAt(index: number, before: string, sequence: string): TurnEvent[] {
    this.scanners.delete(index);
    const events: TurnEvent[] = before === '' ? [] : this.relayed([textDelta(index, before)], before);
    for (const open of [...this.open].sort((a, b) => a - b)) {
      events.push(...this.release(open), { type: 'content_block_stop', index: open });
    }
    this.cut = true;
    return [...events, this.stopDelta(sequence), { type: 'message_stop' }, CUT];
  }

  private stopDelta(sequence: string): ApiEvent {
    const usage: JsonObject = {};
    for (const counter of INPUT_COUNTERS) {
      if (typeof this.callUsage[counter] === 'number') usage[counter] = this.callUsage[counter];
    }
    const started = typeof this.callUsage['output_tokens'] === 'number' ? this.callUsage['output_tokens'] : 0;
    usage['output_tokens'] = started + Math.ceil(this.relayedCharacters / 4);
    return {
      type: 'message_delta',
      delta: { stop_reason: 'stop_sequence', stop_sequence: sequence, stop_details: null, container: null },
      usage
    };
  }
}

/** Nothing to scan for, nothing changes. */
export function createStopSequenceScan(sequences: readonly string[]): Pass<TurnEvent, TurnEvent> {
  const armed = sequences.filter(sequence => sequence.length > 0);
  if (armed.length === 0) return { push: event => [event], end: () => [] };
  return new StopSequenceScan(armed);
}
