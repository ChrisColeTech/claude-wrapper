import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class ClaudeResolver {
  private claudeCommand: string | null = null;

  /**
   * Find and cache the Claude command that works on this system
   */
  async findClaudeCommand(): Promise<string> {
    if (this.claudeCommand) {
      return this.claudeCommand;
    }

    const candidates = [
      // Try direct command (works with global installs)
      'claude',
      
      // Try with bash to resolve aliases
      'bash -c "claude"',
      
      // Common installation paths
      '~/.claude/local/claude',
      '/usr/local/bin/claude',
      '/usr/bin/claude',
      
      // npm global install paths
      '$(npm root -g)/@anthropic-ai/claude-code/bin/claude',
      
      // Try via npx
      'npx @anthropic-ai/claude-code'
    ];

    for (const candidate of candidates) {
      try {
        console.log(`🔍 Trying Claude command: ${candidate}`);
        
        // Test if this command works
        const testCommand = candidate.includes('bash -c') 
          ? `${candidate.replace('"claude"', '"claude --version"')}`
          : `${candidate} --version`;
          
        const { stdout } = await execAsync(testCommand, { timeout: 5000 });
        
        if (stdout.includes('Claude Code')) {
          console.log(`✅ Found working Claude command: ${candidate}`);
          this.claudeCommand = candidate;
          return candidate;
        }
      } catch (error) {
        console.log(`❌ Failed to use ${candidate}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        continue;
      }
    }

    throw new Error('Could not find working Claude CLI installation. Please install Claude Code CLI.');
  }

  /**
   * Execute a Claude command with the resolved Claude installation
   */
  async executeClaudeCommand(prompt: string, model: string): Promise<string> {
    const claudeCmd = await this.findClaudeCommand();
    
    // Use stdin for long prompts to avoid command line length limits
    const command = claudeCmd.includes('bash -c') 
      ? `echo '${prompt.replace(/'/g, "'\"'\"'")}' | ${claudeCmd.replace('"claude"', `"claude --print --model ${model}"`)}`
      : `echo '${prompt.replace(/'/g, "'\"'\"'")}' | ${claudeCmd} --print --model ${model}`;

    console.log(`🚀 Executing: echo '[prompt]' | claude --print --model ${model}`);
    
    try {
      const { stdout, stderr } = await execAsync(command, { 
        maxBuffer: 1024 * 1024 * 10,
        timeout: 30000
      });
      
      if (stderr && stderr.trim()) {
        console.log('Claude CLI warning:', stderr.trim());
      }
      
      return stdout.trim();
    } catch (error) {
      throw new Error(`Claude CLI execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Singleton instance
export const claudeResolver = new ClaudeResolver();