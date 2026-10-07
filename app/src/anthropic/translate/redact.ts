/**
 * Pass 9, redaction (spec section 6): with strings armed, each occurrence in a `text_delta` or
 * `input_json_delta` payload is replaced with `[redacted]`, which holds no character that is
 * significant inside a JSON string, so client tool inputs and structured-output text stay valid
 * for the SDKs' partial-JSON parsers. Each block's payload is scanned as one text: a held tail
 * is released with the next delta or, at the latest, as one more delta just before the block's
 * `content_block_stop`. Every other event, and every delta that needed no change, is relayed as
 * it came. Nothing armed, nothing changes.
 */
import { JsonObject } from '../../upstream/frames';
import { Pass } from './pass';
import { createScanner, PayloadKind, PayloadScanner } from './redact-scanner';
import { ApiEvent, TurnEvent } from './turn-event';

type DeltaEvent = Extract<ApiEvent, { type: 'content_block_delta' }>;

const PAYLOADS: Readonly<Record<string, { field: string; kind: PayloadKind }>> = {
  text_delta: { field: 'text', kind: 'text' },
  input_json_delta: { field: 'partial_json', kind: 'json' }
};

interface OpenPayload {
  deltaType: string;
  scanner: PayloadScanner;
}

const deltaOf = (index: number, deltaType: string, payload: string): DeltaEvent => ({
  type: 'content_block_delta', index, delta: { type: deltaType, [PAYLOADS[deltaType]?.field ?? 'text']: payload }
});

class Redaction implements Pass<TurnEvent, TurnEvent> {
  private readonly open = new Map<number, OpenPayload>();

  constructor(private readonly strings: readonly string[]) {}

  push(event: TurnEvent): TurnEvent[] {
    if (event.type === 'content_block_delta') return this.onDelta(event);
    if (event.type === 'content_block_stop') return [...this.release(event.index), event];
    return [event];
  }

  end(): TurnEvent[] {
    return [...this.open.keys()].flatMap(index => this.release(index));
  }

  private onDelta(event: DeltaEvent): TurnEvent[] {
    const deltaType = String(event.delta['type']);
    const payload = PAYLOADS[deltaType];
    const chunk = payload ? event.delta[payload.field] : undefined;
    if (!payload || typeof chunk !== 'string') return [event];

    const relayed = this.scannerFor(event.index, deltaType, payload.kind).push(chunk);
    if (relayed === chunk) return [event];
    if (relayed === '') return [];
    const delta: JsonObject = { ...event.delta, [payload.field]: relayed };
    return [{ ...event, delta }];
  }

  private scannerFor(index: number, deltaType: string, kind: PayloadKind): PayloadScanner {
    const open = this.open.get(index);
    if (open) return open.scanner;
    const scanner = createScanner(this.strings, kind);
    this.open.set(index, { deltaType, scanner });
    return scanner;
  }

  private release(index: number): TurnEvent[] {
    const open = this.open.get(index);
    if (!open) return [];
    this.open.delete(index);
    const rest = open.scanner.flush();
    return rest === '' ? [] : [deltaOf(index, open.deltaType, rest)];
  }
}

export function createRedaction(strings: readonly string[]): Pass<TurnEvent, TurnEvent> {
  const armed = strings.filter(armed => armed.length > 0);
  if (armed.length === 0) return { push: event => [event], end: () => [] };
  return new Redaction(armed);
}
