/**
 * The text scan behind the stop-sequence pass: one scanner per text block. Each chunk is scanned
 * together with the tail held back from the last one, so a sequence split across deltas is
 * found; the hold-back is the longest sequence's length minus one character, the most a partial
 * match can span. A surrogate pair is never split between relayed text and the hold-back.
 */

export interface ScanResult {
  /** The text that may be relayed now: everything before the hold-back, or before the match. */
  relay: string;
  /** The sequence that matched, when one did; the scan is over. */
  match?: string;
}

export interface StopScanner {
  push(chunk: string): ScanResult;
  /** The held-back tail, at the block's end; it can hold no whole sequence. */
  flush(): string;
}

interface Found {
  start: number;
  end: number;
  sequence: string;
}

/** The sequence the model completed first: the earliest end, then the earliest start. */
function firstCompleted(text: string, sequences: readonly string[]): Found | undefined {
  let first: Found | undefined;
  for (const sequence of sequences) {
    const start = text.indexOf(sequence);
    if (start < 0) continue;
    const end = start + sequence.length;
    if (!first || end < first.end || (end === first.end && start < first.start)) first = { start, end, sequence };
  }
  return first;
}

const isHighSurrogate = (code: number): boolean => code >= 0xd800 && code <= 0xdbff;

class Scanner implements StopScanner {
  private held = '';
  private readonly holdBack: number;

  constructor(private readonly sequences: readonly string[]) {
    this.holdBack = Math.max(...sequences.map(sequence => sequence.length)) - 1;
  }

  push(chunk: string): ScanResult {
    const text = this.held + chunk;
    const found = firstCompleted(text, this.sequences);
    if (found) {
      this.held = '';
      return { relay: text.slice(0, found.start), match: found.sequence };
    }
    let split = Math.max(0, text.length - this.holdBack);
    if (split > 0 && isHighSurrogate(text.charCodeAt(split - 1))) split -= 1;
    this.held = text.slice(split);
    return { relay: text.slice(0, split) };
  }

  flush(): string {
    const rest = this.held;
    this.held = '';
    return rest;
  }
}

/** `sequences` must be non-empty strings, at least one. */
export function createStopScanner(sequences: readonly string[]): StopScanner {
  return new Scanner(sequences);
}
