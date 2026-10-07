/**
 * Scrubs one recording's text: every live value becomes its placeholder, in
 * plain text, in JSON strings at any nesting, and across streaming deltas.
 * A recording without live values comes back byte-identical.
 */
import { LiveValues } from './live-values';
import { valueMatcher } from './matcher';
import { parseRecording, serializeRecording, walkRecording } from './recording-document';
import { scrubDeltaStreams } from './delta-streams';

export interface ScrubResult {
  readonly text: string;
  readonly replaced: number;
}

export function scrubRecording(text: string, values: LiveValues): ScrubResult {
  const doc = parseRecording(text);
  let replaced = scrubDeltaStreams(doc, values);
  walkRecording(doc, {
    string(s) {
      const out = replaceAll(s, values);
      replaced += out.count;
      return out.text;
    },
  });
  return { text: replaced ? serializeRecording(doc) : text, replaced };
}

/**
 * How many live values a recording carries: what the scrub would replace, or
 * the plain-text count when that is higher (a value inside a JSON key or in a
 * shape the scrub does not rewrite).
 */
export function countLiveValues(text: string, values: LiveValues): number {
  return Math.max(scrubRecording(text, values).replaced, replaceAll(text, values).count);
}

function replaceAll(text: string, values: LiveValues): { text: string; count: number } {
  let count = 0;
  let out = text;
  for (const v of values) {
    out = out.replace(valueMatcher(v.value), () => {
      count++;
      return v.placeholder;
    });
  }
  return { text: out, count };
}
