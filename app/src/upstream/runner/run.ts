/**
 * The run core, shared by every adapter: NDJSON framing of stdout into typed frames, control
 * request matching, stdin writes, the stderr ring, exit tracking, and the runner's own end of a
 * run on a failure. Adapters supply only the process (`process.ts`).
 */
import { ControlResponse, describeFrame, Frame, parseFrame } from '../frames';
import { Clock } from '../../utils/clock';
import { logger as defaultLogger } from '../../utils/logger';
import { createControlChannel } from './control-channel';
import { createFrameQueue } from './frame-queue';
import { createLineFramer } from './line-framer';
import { ProcessSink, ProcessStarter, UpstreamProcess } from './process';
import { RunFailure } from './run-failure';
import { createRunTimers, RunTimerSet } from './run-timers';
import { createStderrRing } from './stderr-ring';
import { Run, RunExit, RunFailureReason, RunTimers, UserMessage } from './types';

export const MAX_LINE_BYTES = 16 * 1024 * 1024;
export const STDERR_RING_BYTES = 64 * 1024;
/** After stdin ends: how long upstream gets to exit before SIGTERM, then before SIGKILL. */
export const CLOSE_GRACE_MS = 2_000;
export const TERM_GRACE_MS = 5_000;

export interface RunLogger {
  debug(message: string, context?: unknown): void;
}

export interface RunOptions {
  timers: RunTimers;
  clock: Clock;
  logger?: RunLogger;
}

class RunCore {
  readonly queue = createFrameQueue<Frame>();
  readonly exited: Promise<RunExit>;
  private readonly framer = createLineFramer(MAX_LINE_BYTES);
  private readonly stderr = createStderrRing(STDERR_RING_BYTES);
  private readonly control = createControlChannel();
  private readonly escalation: unknown[] = [];
  private readonly log: RunLogger;
  private readonly timers: RunTimerSet;
  private upstream: UpstreamProcess | undefined;
  private failure: RunFailureReason | undefined;
  private inputClosed = false;
  private ended = false;
  private settleExit: (exit: RunExit) => void = () => undefined;

  constructor(private readonly options: RunOptions) {
    this.log = options.logger ?? defaultLogger;
    this.timers = createRunTimers(options.timers, options.clock, timer => this.fail({ kind: 'timeout', timer }));
    this.exited = new Promise<RunExit>(resolve => { this.settleExit = resolve; });
  }

  start(starter: ProcessStarter): void {
    this.upstream = starter(this.sink());
  }

  async send(message: UserMessage): Promise<void> {
    this.assertOpen();
    this.timers.sent();
    await this.process().write(JSON.stringify({ type: 'user', message, parent_tool_use_id: null, session_id: '' }) + '\n');
  }

  async interrupt(): Promise<ControlResponse> {
    this.assertOpen();
    const request = this.control.open('interrupt');
    await this.process().write(request.line).catch((error: Error) => request.abandon(error));
    return request.response;
  }

  park(): () => void {
    return this.timers.park();
  }

  close(): Promise<RunExit> {
    if (this.inputClosed || this.ended) return this.exited;
    this.inputClosed = true;
    this.process().endInput();
    const { clock } = this.options;
    this.escalation.push(clock.setTimeout(() => {
      this.process().kill('SIGTERM');
      this.escalation.push(clock.setTimeout(() => this.process().kill('SIGKILL'), TERM_GRACE_MS));
    }, CLOSE_GRACE_MS));
    return this.exited;
  }

  kill(): Promise<RunExit> {
    if (!this.ended) this.process().kill('SIGKILL');
    return this.exited;
  }

  private sink(): ProcessSink {
    return {
      stdout: chunk => this.onStdout(chunk),
      stderr: chunk => this.stderr.push(chunk),
      error: error => this.fail({ kind: 'spawn_failed', message: error.message }),
      exit: (code, signal) => this.onExit(code, signal)
    };
  }

  private onStdout(chunk: Buffer): void {
    if (this.failure || this.ended) return;
    const { lines, oversize } = this.framer.push(chunk);
    lines.forEach(line => this.deliver(line));
    if (oversize) this.fail({ kind: 'line_too_long', limitBytes: MAX_LINE_BYTES });
  }

  private deliver(line: string): void {
    const frame = parseFrame(line);
    this.timers.frame(frame);
    if (frame.type === 'unknown') {
      this.log.debug('Upstream frame outside the frame union', { frame: describeFrame(frame) });
    }
    if (frame.type === 'control_response') {
      this.control.settle(frame.response);
    }
    this.queue.push(frame);
  }

  private fail(reason: RunFailureReason): void {
    if (this.failure || this.ended) return;
    this.failure = reason;
    this.timers.stop();
    this.queue.fail(new RunFailure(reason));
    void this.close();
  }

  private onExit(code: number | null, signal: string | null): void {
    if (this.ended) return;
    if (!this.failure) this.framer.end().forEach(line => this.deliver(line));
    this.ended = true;
    this.timers.stop();
    this.escalation.forEach(handle => this.options.clock.clearTimeout(handle));
    this.control.rejectAll(new Error('upstream exited before answering'));
    this.queue.end();
    const failure = this.failure ? { failure: this.failure } : {};
    this.settleExit({ code, signal, stderr: this.stderr.text(), ...failure });
  }

  private assertOpen(): void {
    if (this.inputClosed || this.ended) throw new Error("the run's input is closed");
  }

  private process(): UpstreamProcess {
    if (!this.upstream) throw new Error('an adapter reported to the run before start returned');
    return this.upstream;
  }
}

export function createRun(starter: ProcessStarter, options: RunOptions): Run {
  const core = new RunCore(options);
  core.start(starter);
  return {
    frames: core.queue,
    send: message => core.send(message),
    interrupt: () => core.interrupt(),
    close: () => core.close(),
    kill: () => core.kill(),
    park: () => core.park(),
    exited: core.exited
  };
}
