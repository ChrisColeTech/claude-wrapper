/**
 * A recorded upstream run as the replay runner plays it: stdout frames at their recorded times,
 * gates where upstream waited for the host (the user message, an interrupt, stdin's end), and
 * the exit. Parsed from the fixture formats: `wire` logs (`{t_ms, dir, frame}` per line, `line`
 * in older logs) and plain `frames` recordings (stdout only, no timing).
 */

export type RecordedFrame = { kind: 'frame'; atMs: number; line: string };
export type RecordedGate =
  | { kind: 'gate'; atMs: number; awaits: 'user' | 'eof' }
  | { kind: 'gate'; atMs: number; awaits: 'interrupt'; requestId: string };
export type RecordedExit = { kind: 'exit'; atMs: number; code: number | null; signal: string | null };
export type RecordingEvent = RecordedFrame | RecordedGate | RecordedExit;

export interface Recording {
  readonly events: readonly RecordingEvent[];
}

/** The gap given to each frame of a recording without timing. */
export const SYNTHETIC_GAP_MS = 1;

type WireEntry = { t_ms: number; dir: string; frame?: unknown; line?: unknown };

const EXIT_MARKER = /^\[exit code=(\S+) signal=(\S+)\]$/;

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function hostGate(atMs: number, text: string): RecordedGate | undefined {
  if (text === '[stdin EOF]') return { kind: 'gate', atMs, awaits: 'eof' };
  const value = parseJson(text) as { type?: unknown; request_id?: unknown; request?: { subtype?: unknown } } | undefined;
  if (value?.type === 'user') return { kind: 'gate', atMs, awaits: 'user' };
  if (value?.type === 'control_request' && value.request?.subtype === 'interrupt' && typeof value.request_id === 'string') {
    return { kind: 'gate', atMs, awaits: 'interrupt', requestId: value.request_id };
  }
  return undefined;
}

function exitOf(atMs: number, text: string): RecordedExit | undefined {
  const match = EXIT_MARKER.exec(text);
  if (!match) return undefined;
  const code = match[1] === 'null' ? null : Number(match[1]);
  return { kind: 'exit', atMs, code, signal: match[2] === 'null' ? null : (match[2] as string) };
}

function wireEvent(entry: WireEntry): RecordingEvent | undefined {
  const text = entry.frame ?? entry.line;
  if (typeof text !== 'string') return undefined;
  switch (entry.dir) {
    case 'cli->host': return { kind: 'frame', atMs: entry.t_ms, line: text };
    case 'host->cli': return hostGate(entry.t_ms, text);
    case 'proc': return exitOf(entry.t_ms, text);
    default: return undefined;
  }
}

function fromWire(lines: string[]): RecordingEvent[] {
  const events: RecordingEvent[] = [];
  for (const line of lines) {
    const event = wireEvent(JSON.parse(line) as WireEntry);
    if (event) events.push(event);
    if (event?.kind === 'exit') break;
  }
  return events;
}

/** Upstream emits `system/init` per user message, so each init (and the first frame) follows one. */
function fromFrames(lines: string[]): RecordingEvent[] {
  return lines.flatMap((line, index): RecordingEvent[] => {
    const atMs = index * SYNTHETIC_GAP_MS;
    const frame: RecordedFrame = { kind: 'frame', atMs, line };
    const value = parseJson(line) as { type?: unknown; subtype?: unknown } | undefined;
    const isInit = value?.type === 'system' && value.subtype === 'init';
    return index === 0 || isInit ? [{ kind: 'gate', atMs, awaits: 'user' }, frame] : [frame];
  });
}

/** Exit 0 after a successful last `result`, else 1 (the CLI contract's exit codes). */
function derivedExit(events: RecordingEvent[], atMs: number): RecordedExit {
  const results = events
    .filter((event): event is RecordedFrame => event.kind === 'frame')
    .map(event => parseJson(event.line) as { type?: unknown; is_error?: unknown } | undefined)
    .filter(value => value?.type === 'result');
  const last = results[results.length - 1];
  return { kind: 'exit', atMs, code: last && last.is_error === false ? 0 : 1, signal: null };
}

/** A recording that never exited waits for stdin's end, then exits as its last result says. */
function withExit(events: RecordingEvent[]): RecordingEvent[] {
  if (events.some(event => event.kind === 'exit')) return events;
  const lastAt = events.length > 0 ? (events[events.length - 1] as RecordingEvent).atMs : 0;
  const eof: RecordedGate = { kind: 'gate', atMs: lastAt + SYNTHETIC_GAP_MS, awaits: 'eof' };
  return [...events, eof, derivedExit(events, lastAt + 2 * SYNTHETIC_GAP_MS)];
}

/** Parses a fixture's text; a wire log with several runs yields its first run. */
export function parseRecording(text: string): Recording {
  const lines = text.split('\n').filter(line => line.trim() !== '');
  const first = parseJson(lines[0] ?? '') as { t_ms?: unknown; dir?: unknown } | undefined;
  const isWire = typeof first?.t_ms === 'number' && typeof first.dir === 'string';
  return { events: withExit(isWire ? fromWire(lines) : fromFrames(lines)) };
}
