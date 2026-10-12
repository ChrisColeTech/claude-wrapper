import { CommandExecutionError, CommandRunner } from '../../../src/process/command-runner';

describe('CommandRunner', () => {
  const runner = new CommandRunner();

  it('writes input to stdin and captures output', async () => {
    const result = await runner.run({
      command: process.execPath,
      args: ['-e', 'process.stdin.pipe(process.stdout)']
    }, 'safe prompt', 5000);

    expect(result).toEqual({ stdout: 'safe prompt', stderr: '' });
  });

  it('keeps arguments separate from shell syntax', async () => {
    const unsafeLookingArgument = 'value; echo injected';
    const result = await runner.run({
      command: process.execPath,
      args: ['-e', 'process.stdout.write(process.argv[1])', unsafeLookingArgument]
    }, '', 5000);

    expect(result.stdout).toBe(unsafeLookingArgument);
  });

  it('terminates commands that exceed their timeout', async () => {
    await expect(runner.run({
      command: process.execPath,
      args: ['-e', 'setTimeout(() => {}, 10000)']
    }, '', 20)).rejects.toEqual(expect.objectContaining({
      name: 'CommandExecutionError',
      timedOut: true
    }));
  });

  it('rejects non-zero exit codes without exposing a shell', async () => {
    await expect(runner.run({
      command: process.execPath,
      args: ['-e', 'process.stderr.write("failed"); process.exit(2)']
    }, '', 5000)).rejects.toEqual(expect.objectContaining<Partial<CommandExecutionError>>({
      message: 'failed',
      timedOut: false
    }));
  });
});
