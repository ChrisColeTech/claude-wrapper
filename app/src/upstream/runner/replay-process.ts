/**
 * The replay adapter at the process seam: plays a `Recording` as upstream's stdout on the
 * injected clock. Frames keep their recorded offsets from the last gate passed, times
 * `timeScale`. A gate holds playback until the run does what the host did when recording: sends
 * the user message, interrupts, or ends stdin. An interrupt jumps to the recorded interrupt tail
 * when one lies ahead (frames before it are skipped) and is acknowledged on the spot otherwise.
 */
import { Clock, TimerHandle } from '../../utils/clock';
import { KillSignal, ProcessSink, ProcessStarter, UpstreamProcess } from './process';
import { RecordedGate, Recording, RecordingEvent } from './recording';

export interface ReplayProcessOptions {
  clock: Clock;
  timeScale: number;
  /** Each stdin line the run wrote, parsed (or as text when not JSON). */
  onInput(line: unknown): void;
}

type ControlLine = { type?: unknown; request_id?: unknown; request?: { subtype?: unknown } };

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const acknowledgement = (requestId: string): string => JSON.stringify({
  type: 'control_response', response: { subtype: 'success', request_id: requestId, response: { still_queued: [] } }
});

class ReplayProcess implements UpstreamProcess {
  private cursor = 0;
  private anchor: { atMs: number; at: number };
  private userCredits = 0;
  private eofSeen = false;
  private pendingInterrupt: string | undefined;
  private readonly taken = new Map<number, string>();
  private readonly liveIds = new Map<string, string>();
  private timer: TimerHandle | undefined;
  private playing = true;
  private exited = false;

  constructor(private readonly events: readonly RecordingEvent[], private readonly sink: ProcessSink,
    private readonly options: ReplayProcessOptions) {
    this.anchor = { atMs: events[0]?.atMs ?? 0, at: options.clock.now() };
    this.kick();
  }

  write(text: string): Promise<void> {
    text.split('\n').filter(line => line !== '').forEach(line => this.input(line));
    this.kick();
    return Promise.resolve();
  }

  endInput(): void {
    this.eofSeen = true;
    this.kick();
  }

  kill(signal: KillSignal): void {
    if (!this.playing) return;
    this.stop();
    this.options.clock.setTimeout(() => this.finish(null, signal), 0);
  }

  private input(line: string): void {
    const value = parseJson(line) as ControlLine | undefined;
    this.options.onInput(value ?? line);
    if (value?.type === 'user') this.userCredits += 1;
    if (value?.type === 'control_request' && value.request?.subtype === 'interrupt') {
      this.pendingInterrupt = String(value.request_id);
    }
  }

  private kick(): void {
    if (!this.playing) return;
    if (this.timer !== undefined) this.options.clock.clearTimeout(this.timer);
    this.timer = this.options.clock.setTimeout(() => this.pump(), 0);
  }

  private pump(): void {
    this.timer = undefined;
    while (this.playing && this.cursor < this.events.length) {
      const event = this.events[this.cursor] as RecordingEvent;
      if (event.kind === 'gate' && this.pass(event)) {
        this.cursor += 1;
      } else if (this.pendingInterrupt !== undefined) {
        this.takeInterrupt(this.pendingInterrupt);
      } else if (event.kind === 'gate') {
        return;
      } else if (this.wait(event.atMs) > 0) {
        this.timer = this.options.clock.setTimeout(() => this.pump(), this.wait(event.atMs));
        return;
      } else {
        this.cursor += 1;
        if (event.kind === 'frame') this.emit(event.line);
        else this.finish(event.code, event.signal);
      }
    }
  }

  private wait(atMs: number): number {
    const due = this.anchor.at + (atMs - this.anchor.atMs) * this.options.timeScale;
    return due - this.options.clock.now();
  }

  /** Passing a gate re-anchors the recorded timing to now. */
  private pass(gate: RecordedGate): boolean {
    if (!this.satisfied(gate)) return false;
    this.anchor = { atMs: gate.atMs, at: this.options.clock.now() };
    return true;
  }

  private satisfied(gate: RecordedGate): boolean {
    switch (gate.awaits) {
      case 'user':
        if (this.userCredits === 0) return false;
        this.userCredits -= 1;
        return true;
      case 'eof':
        return this.eofSeen;
      case 'interrupt': {
        const liveId = this.taken.get(this.cursor);
        if (liveId !== undefined) this.liveIds.set(gate.requestId, liveId);
        return liveId !== undefined;
      }
    }
  }

  private takeInterrupt(liveId: string): void {
    this.pendingInterrupt = undefined;
    const gate = this.interruptAhead();
    if (gate === undefined) this.sink.stdout(Buffer.from(acknowledgement(liveId) + '\n'));
    else {
      this.cursor = gate;
      this.taken.set(gate, liveId);
    }
  }

  /** The next recorded interrupt, when only frames lie between it and the cursor. */
  private interruptAhead(): number | undefined {
    for (let index = this.cursor; index < this.events.length; index++) {
      const event = this.events[index] as RecordingEvent;
      if (event.kind === 'gate') return event.awaits === 'interrupt' && !this.taken.has(index) ? index : undefined;
      if (event.kind === 'exit') return undefined;
    }
    return undefined;
  }

  private emit(line: string): void {
    this.sink.stdout(Buffer.from(this.withLiveId(line) + '\n'));
  }

  /** The tail's `control_response` answers the run's own request id, not the recorded one. */
  private withLiveId(line: string): string {
    if (this.liveIds.size === 0) return line;
    const value = parseJson(line) as { type?: unknown; response?: { request_id?: unknown } } | undefined;
    const liveId = this.liveIds.get(String(value?.response?.request_id));
    if (value?.type !== 'control_response' || !value.response || liveId === undefined) return line;
    return JSON.stringify({ ...value, response: { ...value.response, request_id: liveId } });
  }

  private stop(): void {
    this.playing = false;
    if (this.timer !== undefined) this.options.clock.clearTimeout(this.timer);
    this.timer = undefined;
  }

  private finish(code: number | null, signal: string | null): void {
    if (this.exited) return;
    this.exited = true;
    this.stop();
    this.sink.exit(code, signal);
  }
}

export function replayProcess(recording: Recording, options: ReplayProcessOptions): ProcessStarter {
  return sink => new ReplayProcess(recording.events, sink, options);
}
