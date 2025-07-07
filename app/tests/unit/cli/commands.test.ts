import { createCommands } from '../../../src/cli/commands';

describe('CLI Commands', () => {
  it('should create command program', () => {
    const program = createCommands();
    expect(program).toBeDefined();
    expect(program.name()).toBe('claude-wrapper');
  });
});