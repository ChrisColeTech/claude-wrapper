/**
 * Live values split across streaming deltas. The CLI's partial messages carry
 * a content block's text in several `content_block_delta` chunks, so a value
 * can arrive in pieces. Each block's chunks are joined before searching; a
 * match is rewritten as the placeholder in the chunk where it starts, and the
 * rest of the match is removed from the chunks after it. The number of deltas
 * and every line's JSON stay intact.
 */
import { JsonObject, RecordingDocument, walkRecording } from './recording-document';
import { LiveValue, LiveValues } from './live-values';
import { valueMatcher } from './matcher';

const DELTA_FIELDS = ['text', 'thinking', 'partial_json'] as const;

interface Fragment {
  readonly delta: JsonObject;
  readonly field: string;
  readonly markDirty: () => void;
}

/** Rewrites matches inside joined delta streams; returns how many were found. */
export function scrubDeltaStreams(doc: RecordingDocument, values: LiveValues): number {
  const open = new Map<string, Fragment[]>();
  const closed: Fragment[][] = [];
  const close = (key: string): void => {
    const stream = open.get(key);
    if (stream) closed.push(stream);
    open.delete(key);
  };
  walkRecording(doc, {
    object(obj, parent, markDirty) {
      const scope = parent?.['type'] === 'stream_event' ? String(parent['parent_tool_use_id'] ?? '') : '';
      const key = `${scope}#${String(obj['index'])}`;
      const type = obj['type'];
      if (type === 'content_block_start' || type === 'content_block_stop') close(key);
      if (type === 'message_start' || type === 'message_stop') {
        [...open.keys()].filter(k => k.startsWith(`${scope}#`)).forEach(close);
      }
      const fragment = type === 'content_block_delta' ? fragmentOf(obj['delta'], markDirty) : null;
      if (fragment) open.set(key, [...(open.get(key) ?? []), fragment]);
    },
  });
  [...open.keys()].forEach(close);
  return closed.reduce((n, stream) => n + values.reduce((m, v) => m + scrubStream(stream, v), 0), 0);
}

function fragmentOf(delta: unknown, markDirty: () => void): Fragment | null {
  if (delta === null || typeof delta !== 'object') return null;
  const obj = delta as JsonObject;
  const field = DELTA_FIELDS.find(f => typeof obj[f] === 'string');
  return field ? { delta: obj, field, markDirty } : null;
}

function scrubStream(stream: Fragment[], value: LiveValue): number {
  const texts = stream.map(f => f.delta[f.field] as string);
  const rewritten = rewriteFragments(texts, valueMatcher(value.value), value.placeholder);
  rewritten.texts.forEach((text, i) => {
    const fragment = stream[i];
    if (!fragment || text === texts[i]) return;
    fragment.delta[fragment.field] = text;
    fragment.markDirty();
  });
  return rewritten.count;
}

/** Rewrites matches in the concatenation of `texts`, keeping one entry per fragment. */
export function rewriteFragments(texts: string[], re: RegExp, placeholder: string): { texts: string[]; count: number } {
  const joined = texts.join('');
  const matches = [...joined.matchAll(re)].map(m => ({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length }));
  if (!matches.length) return { texts, count: 0 };
  let start = 0;
  const out = texts.map(text => {
    const end = start + text.length;
    let piece = '';
    let pos = start;
    for (const m of matches.filter(x => x.end > start && x.start < end)) {
      piece += joined.slice(pos, Math.max(pos, m.start));
      if (m.start >= start) piece += placeholder;
      pos = Math.min(end, m.end);
    }
    piece += joined.slice(pos, end);
    start = end;
    return piece;
  });
  return { texts: out, count: matches.length };
}
