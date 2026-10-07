/**
 * The last N bytes of upstream's stderr, kept for error messages; older bytes are dropped.
 */

export interface StderrRing {
  push(chunk: Buffer): void;
  text(): string;
}

export function createStderrRing(maxBytes: number): StderrRing {
  let chunks: Buffer[] = [];
  let bytes = 0;

  return {
    push(chunk) {
      chunks.push(chunk);
      bytes += chunk.length;
      while (bytes > maxBytes) {
        const first = chunks[0] as Buffer;
        const excess = bytes - maxBytes;
        if (first.length <= excess) {
          chunks = chunks.slice(1);
          bytes -= first.length;
        } else {
          chunks[0] = first.subarray(excess);
          bytes -= excess;
        }
      }
    },
    text: () => Buffer.concat(chunks).toString('utf8')
  };
}
