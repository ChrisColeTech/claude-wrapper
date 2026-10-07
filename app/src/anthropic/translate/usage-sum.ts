/**
 * Pass 11, the usage sum (spec section 11), the last pass: the turn's final `message_delta.usage`
 * is the field-wise sum of every model call's `message_delta.usage` (the calls the flattener
 * suppressed arrive as internal `usage` signals) plus the server tools' request counts. On a cut
 * the surface's own `message_delta` carries the cut call's usage, and the earlier calls' sums are
 * added on top the same way. `message_start.usage` stays the first call's. This pass also removes
 * every internal signal, so none leaves the translator.
 */
import { JsonObject } from '../../upstream/frames';
import { Pass } from './pass';
import { isInternalSignal, TurnEvent } from './turn-event';

/** The counters summed: the SDK's `MessageDeltaUsage`, nested objects field by field. */
const SUMMED: Readonly<Record<string, readonly string[] | null>> = {
  input_tokens: null,
  output_tokens: null,
  cache_creation_input_tokens: null,
  cache_read_input_tokens: null,
  output_tokens_details: ['thinking_tokens'],
  server_tool_use: ['web_search_requests', 'web_fetch_requests']
};

const isObject = (value: unknown): value is JsonObject => typeof value === 'object' && value !== null && !Array.isArray(value);
const numberOf = (value: unknown): number => (typeof value === 'number' ? value : 0);

function addFields(into: JsonObject, from: JsonObject, fields: readonly string[]): JsonObject {
  const sum: JsonObject = { ...into };
  for (const field of fields) {
    if (typeof from[field] === 'number') sum[field] = numberOf(into[field]) + numberOf(from[field]);
  }
  return sum;
}

/** `into` plus the summed counters of `from`; counters `from` lacks are left as they are. */
function addUsage(into: JsonObject, from: JsonObject): JsonObject {
  const sum: JsonObject = { ...into };
  for (const [field, nested] of Object.entries(SUMMED)) {
    if (nested === null) {
      if (typeof from[field] === 'number') sum[field] = numberOf(into[field]) + numberOf(from[field]);
    } else if (isObject(from[field])) {
      sum[field] = addFields(isObject(into[field]) ? into[field] : {}, from[field], nested);
    }
  }
  return sum;
}

class UsageSum implements Pass<TurnEvent, TurnEvent> {
  private earlier: JsonObject | undefined;

  push(event: TurnEvent): TurnEvent[] {
    if (event.type === 'usage') this.earlier = addUsage(this.earlier ?? {}, event.usage);
    if (isInternalSignal(event)) return [];
    if (event.type !== 'message_delta' || !this.earlier) return [event];
    return [{ ...event, usage: addUsage(event.usage, this.earlier) }];
  }

  end(): TurnEvent[] {
    return [];
  }
}

export function createUsageSum(): Pass<TurnEvent, TurnEvent> {
  return new UsageSum();
}
