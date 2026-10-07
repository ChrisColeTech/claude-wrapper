/**
 * The per-block bookkeeping the stop-sequence scan (pass 8) and redaction (pass 9) share: each
 * content block's deltas are scanned as one text by a scanner of its own, made at the block's
 * first scanned delta and flushed when the block stops or the turn ends.
 */

/** A scanner that may hold back a tail of what it was given. */
export interface Flushing {
  /** Everything still held; the scanner is done. */
  flush(): string;
}

export class BlockScanners<S extends Flushing> {
  private readonly scanners = new Map<number, S>();

  /** The scanner of block `index`, made by `make` on first use. */
  at(index: number, make: () => S): S {
    let scanner = this.scanners.get(index);
    if (!scanner) {
      scanner = make();
      this.scanners.set(index, scanner);
    }
    return scanner;
  }

  /** Block `index` is done: its scanner, now gone, and the text it still held; none when it had no scanner. */
  release(index: number): { scanner: S; rest: string } | undefined {
    const scanner = this.scanners.get(index);
    if (!scanner) return undefined;
    this.scanners.delete(index);
    return { scanner, rest: scanner.flush() };
  }

  /** Forgets block `index`'s scanner and what it held. */
  drop(index: number): void {
    this.scanners.delete(index);
  }

  /** The blocks that have a scanner, in the order they got one. */
  get indices(): number[] {
    return [...this.scanners.keys()];
  }
}
