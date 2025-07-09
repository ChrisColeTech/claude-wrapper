import { createCommands } from '../../../src/cli/commands';

describe('CLI Integration', () => {
  let program: any;

  beforeEach(() => {
    program = createCommands();
  });

  it('should create CLI program with correct name and version', () => {
    expect(program.name()).toBe('claude-wrapper');
    expect(program.version()).toBe('1.0.0');
  });

  it('should have start command', () => {
    const commands = program.commands;
    const startCommand = commands.find((cmd: any) => cmd.name() === 'start');
    expect(startCommand).toBeDefined();
    expect(startCommand.description()).toBe('Start the Claude wrapper server');
  });

  it('should have stop command', () => {
    const commands = program.commands;
    const stopCommand = commands.find((cmd: any) => cmd.name() === 'stop');
    expect(stopCommand).toBeDefined();
    expect(stopCommand.description()).toBe('Stop the Claude wrapper server');
  });

  it('should have status command', () => {
    const commands = program.commands;
    const statusCommand = commands.find((cmd: any) => cmd.name() === 'status');
    expect(statusCommand).toBeDefined();
    expect(statusCommand.description()).toBe('Check server status');
  });

  it('should have correct program description', () => {
    expect(program.description()).toBe('Claude API wrapper with OpenAI compatibility');
  });
});