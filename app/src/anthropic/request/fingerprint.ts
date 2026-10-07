/**
 * The fingerprint (spec section 5, ADR 0002): a conversation's transcript in its canonical form,
 * hashed. The canonical form is the normalisation table's, applied by the same functions the
 * request goes through (`withoutIgnoredContent`: `thinking` and `redacted_thinking` dropped,
 * `cache_control` stripped; `normaliseMessages`: same-role neighbours merged, string content as
 * one text block), so the returned answer and the client's echo of it meet in one form. On top,
 * what JSON itself does not mean: a content block's `null` field is its absent field (the SDK's
 * `TextBlock` echoes `citations: null`), and object keys are sorted. A tool's `input` is kept
 * exactly, nulls included. Changing this form invalidates every live fingerprint, which costs
 * each conversation one replayed turn.
 */
import { createHash } from 'crypto';
import { withoutIgnoredContent } from './ignored-content';
import { normaliseMessages } from './normalise';
import { ContentBlock, NormalisedMessage } from './turn-plan';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** Sorted keys at every depth, so the serialisation is one string per value. */
function sorted(value: unknown): Json {
  if (Array.isArray(value)) return value.map(sorted);
  if (typeof value !== 'object' || value === null) return value as Json;
  const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return Object.fromEntries(entries.map(([key, item]) => [key, sorted(item)]));
}

/** A block's fields less the null ones; a tool result's nested blocks alike. */
function canonicalBlock(block: ContentBlock): Json {
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(block)) {
    if (value === null) continue;
    fields[key] = key === 'content' && Array.isArray(value) ? value.map(item => canonicalBlock(item)) : value;
  }
  return sorted(fields);
}

/** The fingerprint of a transcript: SHA-256, hex, of its canonical form. */
export function fingerprint(messages: readonly NormalisedMessage[]): string {
  const canonical = normaliseMessages(withoutIgnoredContent(messages))
    .map(message => ({ role: message.role, content: message.content.map(canonicalBlock) }));
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
