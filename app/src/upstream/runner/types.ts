/**
 * The runner's interface (spec section 16): `startRun(spec) → Run`. Nothing above it knows a
 * process exists; the spawn runner drives the real CLI and the replay runner plays a recording.
 */
import { ControlResponse, Frame, JsonObject } from '../frames';

/** Milliseconds; a value that is not a positive finite number disables that timer. */
export interface RunTimers {
  /** Start to the first `system/init`. */
  startup: number;
  /** Any frame resets it; paused while the run is idle after a `result` until the next send. */
  stall: number;
  /** Active time from start; time between `park()` and its `unpark()` is excluded. */
  lifetime: number;
}

export interface RunEndpoint {
  url: string;
  token: string;
}

/**
 * A run's private directory for its `0600` files (the MCP config, the hook settings). The spawn
 * runner creates it owner-only (`0700`) with every file before spawning, and removes it with
 * everything in it once the process has exited, before `exited` settles. The replay runner only
 * records it.
 */
export interface RunDirectory {
  /** Absolute; must not exist yet (its parent is created when missing). */
  path: string;
  /** File name (one path segment) to its content; each is written with mode `0600`. */
  files: Readonly<Record<string, string>>;
}

export interface RunSpec {
  /** The argument list after the binary, passed verbatim (no shell). */
  flags: string[];
  /** The bridge server's endpoint, when the turn exposes client tools. */
  mcp?: RunEndpoint;
  /** The hook endpoint, when a server tool is enabled. */
  hooks?: RunEndpoint;
  /** The child's whole environment; nothing is inherited. */
  env: Record<string, string>;
  cwd: string;
  /** The run's private directory; absent: none. */
  runDir?: RunDirectory;
  timers: RunTimers;
}

/** A Messages API user message; `send` wraps it in a stream-json `user` line. */
export interface UserMessage {
  role: 'user';
  content: string | JsonObject[];
}

export type RunTimerName = 'startup' | 'stall' | 'lifetime';

export type RunFailureReason =
  | { kind: 'timeout'; timer: RunTimerName }
  | { kind: 'line_too_long'; limitBytes: number }
  | { kind: 'spawn_failed'; message: string };

export interface RunExit {
  code: number | null;
  signal: string | null;
  /** The last 64 KB of stderr, for error messages. */
  stderr: string;
  /** Set when the runner ended the run itself. */
  failure?: RunFailureReason;
}

export interface Run {
  /**
   * Every frame in upstream order. One shared iterator: leaving a `for await` early (a parked turn)
   * keeps the rest for the next consumer. Ends after upstream's stdout ends; throws `RunFailure`
   * after the last queued frame when the runner ended the run.
   */
  readonly frames: AsyncIterable<Frame>;
  /** Writes one stream-json `user` line; resolves once stdin has taken it (drain-aware). */
  send(message: UserMessage): Promise<void>;
  /** Writes `control_request {subtype: "interrupt"}`; resolves with its `control_response` payload. */
  interrupt(): Promise<ControlResponse>;
  /** Ends stdin; if upstream has not exited 2 s later, SIGTERM, then SIGKILL 5 s after that. */
  close(): Promise<RunExit>;
  /** SIGKILL at once, the scheduler's last resort; a run that has exited is not signalled. */
  kill(): Promise<RunExit>;
  /** Stops the lifetime timer until the returned `unpark` is called (park time is excluded). */
  park(): () => void;
  /** Always settles, also after a failure (the runner closes the run itself). */
  readonly exited: Promise<RunExit>;
}

export interface Runner {
  startRun(spec: RunSpec): Run;
}
