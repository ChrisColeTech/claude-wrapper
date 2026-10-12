import { ClaudeResolver } from '../../../src/core/claude-resolver';
import { CommandExecutionError, ICommandRunner } from '../../../src/process/command-runner';
import { ClaudeCliError, TimeoutError } from '../../../src/utils/errors';

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('../../../src/config/env', () => ({
  EnvironmentManager: {
    getConfig: jest.fn(),
    isMockMode: jest.fn(() => false)
  }
}));

const { EnvironmentManager } = jest.requireMock('../../../src/config/env');

describe('ClaudeResolver', () => {
  let run: jest.MockedFunction<ICommandRunner['run']>;
  let runner: ICommandRunner;

  beforeEach(() => {
    run = jest.fn();
    runner = { run };
    EnvironmentManager.getConfig.mockReturnValue({
      port: 3000,
      timeout: 30000,
      claudeCommand: '/config/claude',
      claudeCommandArgs: [],
      logLevel: 'info'
    });
  });

  it('uses an explicitly configured executable and argument list', async () => {
    EnvironmentManager.getConfig.mockReturnValue({
      port: 3000,
      timeout: 30000,
      claudeCommand: process.execPath,
      claudeCommandArgs: ['/safe/claude.js'],
      logLevel: 'info'
    });

    const resolver = new ClaudeResolver(runner);

    await expect(resolver.findClaudeCommand()).resolves.toBe(`${process.execPath} /safe/claude.js`);
  });

  it('resolves and verifies Claude from PATH without a shell', async () => {
    EnvironmentManager.getConfig.mockReturnValue({
      port: 3000,
      timeout: 30000,
      claudeCommand: undefined,
      claudeCommandArgs: [],
      logLevel: 'info'
    });
    run
      .mockResolvedValueOnce({ stdout: '/usr/local/bin/claude\n', stderr: '' })
      .mockResolvedValueOnce({ stdout: 'Claude Code 1.0', stderr: '' });

    const resolver = new ClaudeResolver(runner);

    await expect(resolver.findClaudeCommand()).resolves.toBe('/usr/local/bin/claude');
    expect(run).toHaveBeenNthCalledWith(
      1,
      process.platform === 'win32'
        ? { command: 'where.exe', args: ['claude'] }
        : { command: 'which', args: ['claude'] },
      '',
      3000
    );
  });

  it('passes prompt and arguments separately from the executable', async () => {
    run.mockResolvedValue({ stdout: 'Claude response\n', stderr: '' });
    const resolver = new ClaudeResolver(runner);
    const model = 'sonnet; echo unsafe';

    const result = await resolver.executeClaudeCommandWithSession("prompt with ' quotes", model, 'session-id', true);

    expect(result).toBe('Claude response');
    expect(run).toHaveBeenCalledWith({
      command: '/config/claude',
      args: [
        '--print', '--model', model,
        '--resume', 'session-id',
        '--output-format', 'json'
      ]
    }, "prompt with ' quotes", 30000);
  });

  it('maps runner timeouts to TimeoutError', async () => {
    run.mockRejectedValue(new CommandExecutionError('timed out', true));
    const resolver = new ClaudeResolver(runner);

    await expect(resolver.executeClaudeCommand('prompt', 'sonnet')).rejects.toThrow(TimeoutError);
  });

  it('maps process failures to ClaudeCliError', async () => {
    run.mockRejectedValue(new CommandExecutionError('permission denied'));
    const resolver = new ClaudeResolver(runner);

    await expect(resolver.executeClaudeCommand('prompt', 'sonnet')).rejects.toThrow(ClaudeCliError);
  });

  it('fails clearly when no candidate can be executed', async () => {
    EnvironmentManager.getConfig.mockReturnValue({
      port: 3000,
      timeout: 30000,
      claudeCommand: undefined,
      claudeCommandArgs: [],
      logLevel: 'info'
    });
    run.mockRejectedValue(new CommandExecutionError('not found'));
    const resolver = new ClaudeResolver(runner);

    await expect(resolver.findClaudeCommand()).rejects.toThrow('@anthropic-ai/claude-code');
    expect(run).toHaveBeenCalledTimes(1);
  });
});
