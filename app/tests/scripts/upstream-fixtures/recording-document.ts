/**
 * A recording parsed so its strings can be walked and rewritten: one JSON
 * document (a pretty-printed summary), or lines that are each JSON (a frame
 * log) or plain text (stderr, harness output). A JSON string that itself holds
 * JSON, such as the `frame` field of a wire log, is decoded so its frames are
 * walked too. Only the parts that change are re-serialized; everything else is
 * written back byte for byte.
 */

interface Dirtyable {
  dirty: boolean;
}

/** A JSON string holding JSON, decoded; re-encoded only when changed. */
class NestedJson implements Dirtyable {
  dirty = false;
  constructor(readonly value: unknown, private readonly raw: string) {}
  toJSON(): string {
    return this.dirty ? JSON.stringify(this.value) : this.raw;
  }
}

interface JsonUnit extends Dirtyable {
  readonly kind: 'json';
  readonly value: unknown;
  readonly raw: string;
  readonly indent: string;
  readonly tail: string;
}

interface TextUnit {
  readonly kind: 'text';
  raw: string;
}

type Unit = JsonUnit | TextUnit;

export interface RecordingDocument {
  readonly units: Unit[];
}

export type JsonObject = Record<string, unknown>;

export interface Visitor {
  /** Every JSON object, in document order, with the object that holds it. */
  object?(obj: JsonObject, parent: JsonObject | null, markDirty: () => void): void;
  /** Every string (keys included) and every plain-text line; returns its replacement. */
  string?(s: string): string;
}

export function parseRecording(text: string): RecordingDocument {
  const whole = parseJson(text);
  if (whole !== undefined && text.trim().includes('\n')) {
    const indent = /\n([ \t]+)\S/.exec(text)?.[1] ?? '';
    return { units: [jsonUnit(whole, text.trimEnd(), indent, text.slice(text.trimEnd().length))] };
  }
  return { units: text.split('\n').map(lineUnit) };
}

export function serializeRecording(doc: RecordingDocument): string {
  return doc.units.map(serializeUnit).join('\n');
}

export function walkRecording(doc: RecordingDocument, visitor: Visitor): void {
  for (const unit of doc.units) {
    if (unit.kind === 'text') {
      if (visitor.string) unit.raw = visitor.string(unit.raw);
      continue;
    }
    walkValue(unit.value, { visitor, chain: [unit], parent: null });
  }
}

function lineUnit(line: string): Unit {
  const tail = line.endsWith('\r') ? '\r' : '';
  const body = tail ? line.slice(0, -1) : line;
  const value = /^\s*[[{]/.test(body) ? parseJson(body) : undefined;
  return value === undefined ? { kind: 'text', raw: line } : jsonUnit(value, body, '', tail);
}

function jsonUnit(value: unknown, raw: string, indent: string, tail: string): JsonUnit {
  return { kind: 'json', value: decodeNested(value), raw, indent, tail, dirty: false };
}

function serializeUnit(unit: Unit): string {
  if (unit.kind === 'text') return unit.raw;
  const body = unit.dirty ? JSON.stringify(unit.value, null, unit.indent || undefined) : unit.raw;
  return body + unit.tail;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** Replaces, in place, every string that holds a JSON object or array with its decoded form. */
function decodeNested(value: unknown): unknown {
  if (typeof value === 'string') {
    const inner = /^\s*[[{]/.test(value) ? parseJson(value) : undefined;
    return inner !== null && typeof inner === 'object' ? new NestedJson(decodeNested(inner), value) : value;
  }
  if (value === null || typeof value !== 'object') return value;
  const container = value as JsonObject;
  for (const key of Object.keys(container)) container[key] = decodeNested(container[key]);
  return value;
}

interface WalkContext {
  readonly visitor: Visitor;
  readonly chain: Dirtyable[];
  readonly parent: JsonObject | null;
}

function walkValue(value: unknown, ctx: WalkContext): unknown {
  if (typeof value === 'string') return rewriteString(value, ctx);
  if (value instanceof NestedJson) {
    walkValue(value.value, { ...ctx, chain: [...ctx.chain, value] });
    return value;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => { value[i] = walkValue(item, ctx); });
    return value;
  }
  return value !== null && typeof value === 'object' ? walkObject(value as JsonObject, ctx) : value;
}

function walkObject(obj: JsonObject, ctx: WalkContext): JsonObject {
  const markDirty = (): void => ctx.chain.forEach(d => { d.dirty = true; });
  ctx.visitor.object?.(obj, ctx.parent, markDirty);
  const inner = { ...ctx, parent: obj };
  const keys = Object.keys(obj);
  const entries = Object.entries(obj).map(([k, v]) => [rewriteString(k, ctx), walkValue(v, inner)] as const);
  if (entries.some(([k], i) => k !== keys[i])) {
    for (const key of keys) delete obj[key];
  }
  for (const [k, v] of entries) obj[k] = v;
  return obj;
}

function rewriteString(s: string, ctx: WalkContext): string {
  const out = ctx.visitor.string ? ctx.visitor.string(s) : s;
  if (out !== s) ctx.chain.forEach(d => { d.dirty = true; });
  return out;
}
