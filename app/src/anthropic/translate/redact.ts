/**
 * Pass 9, redaction (spec section 6): with strings armed, each occurrence in a `text_delta` or
 * `input_json_delta` payload is replaced with `[redacted]`, which holds no character that is
 * significant inside a JSON string, so client tool inputs and structured-output text stay valid
 * for the SDKs' partial-JSON parsers. Each block's payload is scanned as one text: a held tail
 * is released with the next delta or, at the latest, as one more delta just before the block's
 * `content_block_stop`. Every other event, and every delta that needed no change, is relayed as
 * it came. Nothing armed, nothing changes.
 *
 * On a structured-output run every text block is the answer's JSON, so its text is scanned as JSON
 * too (`textKind: 'json'`): an armed string such as `true` is never replaced outside a string
 * value, and the SDKs' `parse()` helpers still read the text.
 */
import { JsonObject } from '../../upstream/frames';
import { BlockScanners } from './block-scanners';
import { identity, Pass } from './pass';
import { createScanner, PayloadKind, PayloadScanner } from './redact-scanner';
import { ApiEvent, TurnEvent } from './turn-event';

type DeltaEvent = Extract<ApiEvent, { type: 'content_block_delta' }>;

const PAYLOAD_FIELDS: Readonly<Record<string, string>> = { text_delta: 'text', input_json_delta: 'partial_json' };

interface OpenPayload {
  deltaType: string;
  scanner: PayloadScanner;
  flush(): string;
}

const deltaOf = (index: number, deltaType: string, payload: string): DeltaEvent => ({
  type: 'content_block_delta', index, delta: { type: deltaType, [PAYLOAD_FIELDS[deltaType] ?? 'text']: payload }
});

class Redaction implements Pass<TurnEvent, TurnEvent> {
  private readonly open = new BlockScanners<OpenPayload>();

  constructor(private readonly strings: readonly string[], private readonly textKind: PayloadKind) {}

  push(event: TurnEvent): TurnEvent[] {
    if (event.type === 'content_block_delta') return this.onDelta(event);
    if (event.type === 'content_block_stop') return [...this.release(event.index), event];
    return [event];
  }

  end(): TurnEvent[] {
    return this.open.indices.flatMap(index => this.release(index));
  }

  private onDelta(event: DeltaEvent): TurnEvent[] {
    const deltaType = String(event.delta['type']);
    const field = PAYLOAD_FIELDS[deltaType];
    const chunk = field ? event.delta[field] : undefined;
    if (!field || typeof chunk !== 'string') return [event];

    const kind = deltaType === 'text_delta' ? this.textKind : 'json';
    const relayed = this.scannerFor(event.index, deltaType, kind).push(chunk);
    if (relayed === chunk) return [event];
    if (relayed === '') return [];
    const delta: JsonObject = { ...event.delta, [field]: relayed };
    return [{ ...event, delta }];
  }

  private scannerFor(index: number, deltaType: string, kind: PayloadKind): PayloadScanner {
    return this.open.at(index, () => {
      const scanner = createScanner(this.strings, kind);
      return { deltaType, scanner, flush: () => scanner.flush() };
    }).scanner;
  }

  private release(index: number): TurnEvent[] {
    const released = this.open.release(index);
    if (!released || released.rest === '') return [];
    return [deltaOf(index, released.scanner.deltaType, released.rest)];
  }
}

/** `textKind` is how text deltas are read: `'json'` on a structured-output run. */
export function createRedaction(strings: readonly string[], textKind: PayloadKind = 'text'): Pass<TurnEvent, TurnEvent> {
  const armed = strings.filter(armed => armed.length > 0);
  if (armed.length === 0) return identity();
  return new Redaction(armed, textKind);
}
