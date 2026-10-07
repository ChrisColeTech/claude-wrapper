/**
 * The spawn runner: drives the operator's installed Claude Code. The binary is spawned directly
 * (no shell) with exactly the spec's argument list, working directory and environment; stdout and
 * stderr go to the run core, stdin writes wait for drain, and the exit is reported once the
 * child's pipes have closed. The spec's run directory is created before the spawn and removed
 * before the exit is reported; a start that fails on either is a `spawn_failed` run.
 */
import { ChildProcess, spawn as nodeSpawn, SpawnOptions } from 'child_process';
import { Writable } from 'stream';
import { EnvironmentManager } from '../../config/env';
import { Clock, systemClock } from '../../utils/clock';
import { ProcessSink, ProcessStarter, UpstreamProcess } from './process';
import { createRun, RunLogger } from './run';
import { createRunDirectory, removeRunDirectory } from './run-directory';
import { Runner, RunSpec } from './types';

export type SpawnFunction = (command: string, args: string[], options: SpawnOptions) => ChildProcess;

export interface SpawnRunnerOptions {
  /** The Claude Code binary; defaults to `CLAUDE_COMMAND`, else `claude` on the child's PATH. */
  command?: string;
  clock?: Clock;
  logger?: RunLogger;
  /** Replaces `child_process.spawn` (tests). */
  spawn?: SpawnFunction;
}

function writeDrained(stdin: Writable | null, text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!stdin || stdin.writableEnded || stdin.destroyed) {
      reject(new Error("upstream's stdin is closed"));
      return;
    }
    const flushed = stdin.write(text, error => { if (error) reject(error); });
    if (flushed) resolve();
    else stdin.once('drain', resolve);
  });
}

/** A start that failed before there was a child: reported once `start` has returned. */
function failedStart(sink: ProcessSink, error: unknown): UpstreamProcess {
  queueMicrotask(() => {
    sink.error(error instanceof Error ? error : new Error(String(error)));
    sink.exit(null, null);
  });
  return {
    write: () => Promise.reject(new Error("upstream's stdin is closed")),
    endInput: () => undefined,
    kill: () => undefined
  };
}

function spawnProcess(command: string, spec: RunSpec, spawn: SpawnFunction): ProcessStarter {
  return sink => {
    const { runDir } = spec;
    try {
      if (runDir) createRunDirectory(runDir);
    } catch (error) {
      return failedStart(sink, error);
    }
    const removeRunDir = (): void => { if (runDir) removeRunDirectory(runDir); };
    try {
      const child = spawn(command, spec.flags, {
        cwd: spec.cwd, env: spec.env, stdio: ['pipe', 'pipe', 'pipe'], shell: false, windowsHide: true
      });
      return attachChild(child, sink, removeRunDir);
    } catch (error) {
      removeRunDir();
      return failedStart(sink, error);
    }
  };
}

/** Reports the child to the sink; `cleanUp` runs once, after the exit and before it is reported. */
function attachChild(child: ChildProcess, sink: ProcessSink, cleanUp: () => void): UpstreamProcess {
  let finished = false;
  const finish = (code: number | null, signal: string | null): void => {
    if (finished) return;
    finished = true;
    cleanUp();
    sink.exit(code, signal);
  };
  child.stdout?.on('data', (chunk: Buffer) => sink.stdout(chunk));
  child.stderr?.on('data', (chunk: Buffer) => sink.stderr(chunk));
  // A write racing the exit fails with EPIPE; the write's own callback reports it.
  child.stdin?.on('error', () => undefined);
  child.on('error', error => {
    if (child.pid !== undefined) return;
    sink.error(error);
    finish(null, null);
  });
  child.once('close', (code: number | null, signal: string | null) => finish(code, signal));
  return {
    write: text => writeDrained(child.stdin, text),
    endInput: () => { child.stdin?.end(); },
    kill: signal => { child.kill(signal); }
  };
}

export function createSpawnRunner(options: SpawnRunnerOptions = {}): Runner {
  const command = options.command ?? EnvironmentManager.getConfig().claudeCommand ?? 'claude';
  const clock = options.clock ?? systemClock;
  const spawn = options.spawn ?? (nodeSpawn as SpawnFunction);
  const logger = options.logger ? { logger: options.logger } : {};
  return {
    startRun: spec => createRun(spawnProcess(command, spec, spawn), { timers: spec.timers, clock, ...logger })
  };
}
