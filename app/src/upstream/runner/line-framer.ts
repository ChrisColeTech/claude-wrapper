/**
 * NDJSON framing over stdout bytes: a line ends at `\n` (a trailing `\r` is dropped), may be split
 * across any number of chunks, and is decoded as UTF-8 only once whole. A line longer than the
 * ceiling is reported as soon as the pending bytes pass it, so stdout is never buffered whole.
 */

export type FramerResult = { lines: string[]; oversize: boolean };

export interface LineFramer {
  push(chunk: Buffer): FramerResult;
  /** The partial last line, if any, once stdout has ended. */
  end(): string[];
}

const NEWLINE = 0x0a;

function decode(parts: Buffer[]): string {
  const text = Buffer.concat(parts).toString('utf8');
  return text.endsWith('\r') ? text.slice(0, -1) : text;
}

export function createLineFramer(maxLineBytes: number): LineFramer {
  let pending: Buffer[] = [];
  let pendingBytes = 0;

  const take = (rest: Buffer): string => {
    const line = decode([...pending, rest]);
    pending = [];
    pendingBytes = 0;
    return line;
  };

  const keep = (lines: string[], line: string): void => {
    if (line !== '') lines.push(line);
  };

  return {
    push(chunk) {
      const lines: string[] = [];
      let start = 0;
      for (let at = chunk.indexOf(NEWLINE); at !== -1; at = chunk.indexOf(NEWLINE, start)) {
        if (pendingBytes + at - start > maxLineBytes) return { lines, oversize: true };
        keep(lines, take(chunk.subarray(start, at)));
        start = at + 1;
      }
      const rest = chunk.subarray(start);
      pending.push(rest);
      pendingBytes += rest.length;
      return { lines, oversize: pendingBytes > maxLineBytes };
    },
    end() {
      const lines: string[] = [];
      if (pendingBytes > 0) keep(lines, take(Buffer.alloc(0)));
      return lines;
    }
  };
}
