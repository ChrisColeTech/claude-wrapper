import { spawn } from 'child_process';

export interface CommandSpec {
  command: string;
  args: string[];
}

export interface CommandResult {
  stdout: string;
  stderr: string;
}

export interface ICommandRunner {
  run(spec: CommandSpec, input: string, timeoutMs: number): Promise<CommandResult>;
}

export class CommandExecutionError extends Error {
  constructor(
    message: string,
    public readonly timedOut: boolean = false
  ) {
    super(message);
    this.name = 'CommandExecutionError';
  }
}

const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;

export class CommandRunner implements ICommandRunner {
  constructor(private readonly workingDirectory: string = process.cwd()) {}

  run(spec: CommandSpec, input: string, timeoutMs: number): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(spec.command, spec.args, {
        shell: false,
        windowsHide: true,
        cwd: this.workingDirectory,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let settled = false;
      let timedOut = false;
      let killTimer: ReturnType<typeof setTimeout> | undefined;

      const finish = (error?: Error, result?: CommandResult): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (killTimer) clearTimeout(killTimer);
        if (error) reject(error);
        else resolve(result as CommandResult);
      };

      const append = (chunks: Buffer[], chunk: Buffer | string, stream: string): number => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        const size = stream === 'stdout' ? stdoutBytes + buffer.length : stderrBytes + buffer.length;
        if (size > MAX_OUTPUT_BYTES) {
          child.kill('SIGKILL');
          finish(new CommandExecutionError(`${stream} exceeded ${MAX_OUTPUT_BYTES} bytes`));
        }
        chunks.push(buffer);
        return size;
      };

      child.stdout.on('data', (chunk: Buffer | string) => {
        stdoutBytes = append(stdout, chunk, 'stdout');
      });
      child.stderr.on('data', (chunk: Buffer | string) => {
        stderrBytes = append(stderr, chunk, 'stderr');
      });
      child.once('error', error => finish(new CommandExecutionError(error.message, timedOut)));
      child.once('close', code => {
        if (timedOut) finish(new CommandExecutionError(`Process timed out after ${timeoutMs}ms`, true));
        else if (code === 0) finish(undefined, {
          stdout: Buffer.concat(stdout).toString('utf8'),
          stderr: Buffer.concat(stderr).toString('utf8')
        });
        else finish(new CommandExecutionError(
          Buffer.concat(stderr).toString('utf8').trim() || `Process exited with code ${code}`
        ));
      });

      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        killTimer = setTimeout(() => child.kill('SIGKILL'), 1000);
      }, timeoutMs);

      child.stdin.once('error', error => finish(new CommandExecutionError(error.message)));
      child.stdin.end(input);
    });
  }
}
