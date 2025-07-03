/**
 * Tools management tests
 */
import { CLAUDE_CODE_TOOLS, ToolManager } from '../../src/tools';

describe('Tools Management', () => {
  it('should have all Claude Code tools defined', () => {
    expect(CLAUDE_CODE_TOOLS).toHaveLength(16); // All tools
    expect(CLAUDE_CODE_TOOLS).toContain('Task');
    expect(CLAUDE_CODE_TOOLS).toContain('Bash');
    expect(CLAUDE_CODE_TOOLS).toContain('Read');
    expect(CLAUDE_CODE_TOOLS).toContain('Write');
    expect(CLAUDE_CODE_TOOLS).toContain('Glob');
    expect(CLAUDE_CODE_TOOLS).toContain('Grep');
  });

  it('should configure tools with default settings', () => {
    const config = ToolManager.configureTools({});
    expect(config.max_turns).toBe(10);
    expect(config.tools).toEqual(CLAUDE_CODE_TOOLS);
    expect(config.tools_enabled).toBe(true);
  });

  it('should disable tools when requested', () => {
    const config = ToolManager.configureTools({ disable_tools: true });
    expect(config.max_turns).toBe(1);
    expect(config.disabled_tools).toEqual(CLAUDE_CODE_TOOLS);
    expect(config.tools_enabled).toBe(false);
  });
});
