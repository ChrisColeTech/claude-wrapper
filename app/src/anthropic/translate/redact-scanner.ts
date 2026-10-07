/**
 * The redaction pass's scanner over one block's payload, chunk by chunk: each armed string is
 * replaced with `[redacted]`, matched case-insensitively as a whole word (no letter, mark, digit
 * or underscore touching either end, so a short name never redacts part of another word; a JSON
 * escape such as `\n` counts as a boundary). A tail that could still grow into a match is held
 * back until the next chunk decides it, and released at the block's end, so a string split
 * across deltas is caught; a chunk with nothing to hold is relayed as it came.
 *
 * In a tool input's raw JSON a match must lie inside a string literal and not start on an
 * escaped character, so the replacement never touches JSON structure and the input stays valid.
 */
export const REDACTED = '[redacted]';

/** How a payload is read: model text as is, or the raw JSON text of a tool input. */
export type PayloadKind = 'text' | 'json';

export interface PayloadScanner {
  /** The next chunk in; what may be relayed now, armed strings replaced. */
  push(chunk: string): string;
  /** The block ended: whatever is still held, the end counting as a word boundary. */
  flush(): string;
}

interface Needle {
  /** The whole string at a position. */
  full: RegExp;
  /** A prefix of it running to the end of the text: the rest may come in the next chunk. */
  partial: RegExp;
}

/** Where a position of a tool input's JSON text sits. */
interface JsonPosition {
  inString: boolean;
  escaped: boolean;
}

const WORD = /^[\p{L}\p{M}\p{N}_]$/u;
const ESCAPE_BEFORE = /\\(?:[nrtbf]|u[0-9a-fA-F]{4})$/;
/** Enough of the relayed text to judge the boundary before a match: a `\uXXXX` escape. */
const CONTEXT = 6;
const PENDING = -2;
const NONE = -1;
const OUTSIDE: JsonPosition = { inString: false, escaped: false };

const escapeRegExp = (text: string): string => text.replace(/[\\^$.*+?()[\]{}|/]/g, '\\$&');

function compile(armed: string): Needle {
  const chars = Array.from(armed).map(escapeRegExp);
  const prefixes = chars.slice(1).reduceRight((rest, char) => `(?:${char}${rest})?`, '');
  return { full: new RegExp(chars.join(''), 'iuy'), partial: new RegExp(`${chars[0]}${prefixes}$`, 'iuy') };
}

/** Longest first, so a full name wins over a display name it starts with. */
function needlesFor(strings: readonly string[], kind: PayloadKind): Needle[] {
  const usable = kind === 'json' ? strings.filter(armed => !/["\\]/.test(armed)) : strings;
  return [...usable].sort((a, b) => b.length - a.length).filter(armed => armed.length > 0).map(compile);
}

const lastChar = (text: string): string => Array.from(text).pop() ?? '';
const charAt = (text: string, index: number): string => String.fromCodePoint(text.codePointAt(index) ?? 0);
const charLength = (text: string, index: number): number => ((text.codePointAt(index) ?? 0) > 0xffff ? 2 : 1);

function step(position: JsonPosition, char: string): JsonPosition {
  if (!position.inString) return char === '"' ? { inString: true, escaped: false } : OUTSIDE;
  if (position.escaped) return { inString: true, escaped: false };
  if (char === '\\') return { inString: true, escaped: true };
  return char === '"' ? OUTSIDE : position;
}

class Scanner implements PayloadScanner {
  private held = '';
  /** The last characters relayed, as upstream sent them. */
  private before = '';
  /** Where `held` starts in the JSON text. */
  private position: JsonPosition = OUTSIDE;

  constructor(private readonly needles: Needle[], private readonly kind: PayloadKind) {}

  push(chunk: string): string {
    return this.scan(this.held + chunk, false);
  }

  flush(): string {
    return this.scan(this.held, true);
  }

  private scan(text: string, final: boolean): string {
    let relayed = '';
    let from = 0;
    let index = 0;
    let position = this.position;
    while (index < text.length) {
      const end = this.mayStartAt(text, index, position) ? this.matchAt(text, index, final) : NONE;
      if (end === PENDING) break;
      if (end !== NONE) {
        relayed += text.slice(from, index) + REDACTED;
        from = index = end;
        continue;
      }
      if (this.kind === 'json') position = step(position, text.charAt(index));
      index += charLength(text, index);
    }
    this.before = (this.before + text.slice(Math.max(0, index - CONTEXT), index)).slice(-CONTEXT);
    this.held = text.slice(index);
    this.position = position;
    return relayed + text.slice(from, index);
  }

  private mayStartAt(text: string, index: number, position: JsonPosition): boolean {
    if (this.kind === 'json' && (!position.inString || position.escaped)) return false;
    const preceding = (this.before + text.slice(Math.max(0, index - CONTEXT), index)).slice(-CONTEXT);
    return !WORD.test(lastChar(preceding)) || ESCAPE_BEFORE.test(preceding);
  }

  /** The end of the armed string starting here, `PENDING` while the next chunk decides, or `NONE`. */
  private matchAt(text: string, index: number, final: boolean): number {
    for (const needle of this.needles) {
      needle.full.lastIndex = index;
      const found = needle.full.exec(text);
      if (found) {
        const end = index + found[0].length;
        if (end === text.length) return final ? end : PENDING;
        if (!WORD.test(charAt(text, end))) return end;
        continue;
      }
      needle.partial.lastIndex = index;
      if (!final && needle.partial.test(text)) return PENDING;
    }
    return NONE;
  }
}

export function createScanner(strings: readonly string[], kind: PayloadKind): PayloadScanner {
  return new Scanner(needlesFor(strings, kind), kind);
}
