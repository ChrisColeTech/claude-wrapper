/**
 * A hand-driven upstream process for the run core's tests: the test pushes stdout and stderr
 * bytes and the exit, and reads back what the run wrote to stdin and which signals it sent.
 */
import { KillSignal, ProcessSink, ProcessStarter, UpstreamProcess } from '../../../src/upstream/runner/process';

export interface ScriptedProcess {
  /** Pass to `createRun`. */
  readonly start: ProcessStarter;
  stdout(chunk: string | Buffer): void;
  /** Writes each value as one JSON line on stdout. */
  frames(...values: unknown[]): void;
  stderr(chunk: string | Buffer): void;
  fail(error: Error): void;
  exit(code: number | null, signal?: string | null): void;
  /** Every stdin write, in order. */
  readonly written: string[];
  /** Every stdin write parsed as JSON lines. */
  writtenLines(): unknown[];
  readonly inputEnded: () => boolean;
  readonly kills: KillSignal[];
}

export function createScriptedProcess(): ScriptedProcess {
  let sink: ProcessSink | undefined;
  let inputEnded = false;
  const written: string[] = [];
  const kills: KillSignal[] = [];
  const attached = (): ProcessSink => {
    if (!sink) throw new Error('the run has not started the process');
    return sink;
  };
  const toBuffer = (chunk: string | Buffer): Buffer => (typeof chunk === 'string' ? Buffer.from(chunk) : chunk);

  const process: UpstreamProcess = {
    write: async (text) => { written.push(text); },
    endInput: () => { inputEnded = true; },
    kill: (signal) => { kills.push(signal); }
  };

  return {
    start: (s) => { sink = s; return process; },
    stdout: (chunk) => attached().stdout(toBuffer(chunk)),
    frames: (...values) => attached().stdout(Buffer.from(values.map(v => JSON.stringify(v) + '\n').join(''))),
    stderr: (chunk) => attached().stderr(toBuffer(chunk)),
    fail: (error) => attached().error(error),
    exit: (code, signal = null) => attached().exit(code, signal),
    written,
    writtenLines: () => written.join('').split('\n').filter(line => line !== '').map(line => JSON.parse(line)),
    inputEnded: () => inputEnded,
    kills
  };
}
