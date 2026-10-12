import { IClaudeResolver } from '../types';
import path from 'path';
import { ClaudeCliError, TimeoutError } from '../utils/errors';
import { logger } from '../utils/logger';
import { EnvironmentManager } from '../config/env';
import {
  CommandExecutionError,
  CommandRunner,
  CommandSpec,
  ICommandRunner
} from '../process/command-runner';
import { resolveWindowsCommand } from '../process/windows-command';

const RESOLUTION_TIMEOUT_MS = 3000;

export class ClaudeResolver implements IClaudeResolver {
  private claudeCommand: CommandSpec | null = null;

  constructor(private readonly runner: ICommandRunner = new CommandRunner()) {}

  async findClaudeCommand(): Promise<string> {
    const spec = await this.resolveClaudeCommand();
    return [spec.command, ...spec.args].join(' ');
  }

  async executeClaudeCommand(prompt: string, model: string): Promise<string> {
    return this.executeClaudeCommandWithSession(prompt, model, null, false);
  }

  async executeClaudeCommandWithSession(
    prompt: string,
    model: string,
    sessionId: string | null,
    useJsonOutput: boolean
  ): Promise<string> {
    const base = await this.resolveClaudeCommand();
    const args = [...base.args, '--print', '--model', model];
    if (sessionId) args.push('--resume', sessionId);
    if (useJsonOutput) args.push('--output-format', 'json');

    logger.debug('Executing Claude command with session', {
      model,
      promptLength: prompt.length,
      sessionId,
      useJsonOutput
    });

    try {
      const result = await this.runner.run(
        await resolveWindowsCommand({ command: base.command, args }),
        prompt,
        EnvironmentManager.getConfig().timeout
      );
      if (result.stderr.trim()) {
        logger.warn('Claude CLI warning', { stderr: result.stderr.trim() });
      }
      return result.stdout.trim();
    } catch (error) {
      logger.error('Claude CLI execution failed', error as Error);
      if (error instanceof CommandExecutionError && error.timedOut) {
        throw new TimeoutError(`Claude CLI execution timed out after ${EnvironmentManager.getConfig().timeout}ms`);
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ClaudeCliError(`Claude CLI execution failed: ${message}`);
    }
  }

  private async resolveClaudeCommand(): Promise<CommandSpec> {
    if (this.claudeCommand) return this.claudeCommand;

    const config = EnvironmentManager.getConfig();
    if (config.claudeCommand) {
      if (/^(?:docker|podman)\s+/i.test(config.claudeCommand)) {
        throw new ClaudeCliError(
          'CLAUDE_COMMAND must contain only an executable. Put arguments in CLAUDE_COMMAND_ARGS as a JSON array.'
        );
      }
      let configured: CommandSpec = {
        command: config.claudeCommand,
        args: config.claudeCommandArgs || []
      };
      if (
        process.platform === 'win32' &&
        path.extname(configured.command) === '' &&
        !/[\\/]/.test(configured.command)
      ) {
        const lookup = await this.runner.run(
          { command: 'where.exe', args: [configured.command] },
          '',
          RESOLUTION_TIMEOUT_MS
        );
        const resolved = lookup.stdout.split(/\r?\n/).map(line => line.trim()).find(Boolean);
        if (resolved) configured = { command: resolved, args: configured.args };
      }
      this.claudeCommand = await resolveWindowsCommand(configured);
      return this.claudeCommand;
    }

    const candidates = await this.commandCandidates();
    for (const candidate of candidates) {
      if (await this.testClaudeCommand(candidate)) {
        this.claudeCommand = candidate;
        logger.info('Found Claude command', { command: candidate.command });
        return candidate;
      }
    }

    throw new ClaudeCliError(
      'Claude CLI not found. Install Claude Code, ensure claude is in PATH, or set CLAUDE_COMMAND.'
    );
  }

  private async commandCandidates(): Promise<CommandSpec[]> {
    const candidates: CommandSpec[] = [];
    const lookup: CommandSpec = process.platform === 'win32'
      ? { command: 'where.exe', args: ['claude'] }
      : { command: 'which', args: ['claude'] };

    try {
      const result = await this.runner.run(lookup, '', RESOLUTION_TIMEOUT_MS);
      const path = result.stdout.split(/\r?\n/).map(line => line.trim()).find(Boolean);
      if (path) candidates.push({ command: path, args: [] });
    } catch (error) {
      logger.debug('Claude PATH lookup failed', { error });
    }

    const cliPath = process.env['CLAUDE_CLI_PATH'];
    if (cliPath) candidates.push({ command: cliPath, args: [] });

    const dockerImage = process.env['CLAUDE_DOCKER_IMAGE'];
    if (dockerImage && /^[a-zA-Z0-9._/:@-]+$/.test(dockerImage)) {
      candidates.push({ command: 'docker', args: ['run', '--rm', '-i', dockerImage] });
    }
    candidates.push(
      { command: 'docker', args: ['run', '--rm', '-i', 'anthropic/claude'] },
      { command: 'podman', args: ['run', '--rm', '-i', 'anthropic/claude'] }
    );
    return candidates;
  }

  private async testClaudeCommand(spec: CommandSpec): Promise<boolean> {
    try {
      const prepared = await resolveWindowsCommand({
        command: spec.command,
        args: [...spec.args, '--version']
      });
      const result = await this.runner.run(prepared, '', RESOLUTION_TIMEOUT_MS);
      const output = `${result.stdout}${result.stderr}`.toLowerCase();
      return output.includes('claude') || output.includes('anthropic');
    } catch (error) {
      logger.debug('Claude command test failed', { command: spec.command, error });
      return false;
    }
  }
}
