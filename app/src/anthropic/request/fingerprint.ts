/**
 * The fingerprint (spec section 5, ADR 0002): a conversation's transcript in its canonical form,
 * hashed. The canonical form is the normalisation table's (same-role neighbours merged, string
 * content as one text block, `thinking` and `redacted_thinking` dropped, `cache_control` ignored),
 * plus what JSON itself does not mean: a content block's `null` field is its absent field (the
 * SDK's `TextBlock` echoes `citations: null`), and object keys are sorted. A tool's `input` is
 * kept exactly, nulls included. Changing this form invalidates every live fingerprint, which
 * costs each conversation one replayed turn.
 */
import { createHash } from 'crypto';
import { ContentBlock, NormalisedMessage } from './turn-plan';

const DROPPED_BLOCKS = new Set(['thinking', 'redacted_thinking']);
const IGNORED_FIELDS = new Set(['cache_control']);

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** Sorted keys at every depth, so the serialisation is one string per value. */
function sorted(value: unknown): Json {
  if (Array.isArray(value)) return value.map(sorted);
  if (typeof value !== 'object' || value === null) return value as Json;
  const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return Object.fromEntries(entries.map(([key, item]) => [key, sorted(item)]));
}

/** A block's own fields, less the ignored and the null ones; nested blocks (a tool result's) alike. */
function canonicalBlock(block: ContentBlock): Json {
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(block)) {
    if (value === null || IGNORED_FIELDS.has(key)) continue;
    fields[key] = key === 'content' && Array.isArray(value) ? value.map(item => canonicalBlock(item)) : value;
  }
  return sorted(fields);
}

function canonicalTranscript(messages: readonly NormalisedMessage[]): Json {
  const canonical: { role: string; content: Json[] }[] = [];
  for (const message of messages) {
    const content = message.content.filter(block => !DROPPED_BLOCKS.has(block.type)).map(canonicalBlock);
    const previous = canonical[canonical.length - 1];
    if (previous?.role === message.role) previous.content.push(...content);
    else canonical.push({ role: message.role, content });
  }
  return canonical;
}

/** The fingerprint of a transcript: SHA-256, hex, of its canonical form. */
export function fingerprint(messages: readonly NormalisedMessage[]): string {
  return createHash('sha256').update(JSON.stringify(canonicalTranscript(messages))).digest('hex');
}
