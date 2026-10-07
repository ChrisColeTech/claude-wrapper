/**
 * The runner's internal seam: upstream as a process the run core drives. Two adapters plug in
 * here, the spawned CLI (`spawn-runner.ts`) and a recording played back (`replay-process.ts`);
 * framing, control matching, timers and exit tracking live once, in the core (`run.ts`).
 */

export type KillSignal = 'SIGTERM' | 'SIGKILL';

/** What a process reports. `exit` comes exactly once, after the last `stdout` chunk. */
export interface ProcessSink {
  stdout(chunk: Buffer): void;
  stderr(chunk: Buffer): void;
  /** The process could not be started or its pipes failed; `exit` still follows. */
  error(error: Error): void;
  exit(code: number | null, signal: string | null): void;
}

export interface UpstreamProcess {
  /** Resolves once the text is handed to stdin, waiting for drain when the pipe is full. */
  write(text: string): Promise<void>;
  endInput(): void;
  kill(signal: KillSignal): void;
}

/** Starts the process, reporting to `sink`; never reports before it has returned. */
export type ProcessStarter = (sink: ProcessSink) => UpstreamProcess;
