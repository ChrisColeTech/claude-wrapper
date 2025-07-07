/**
 * Interactive CLI prompts for API key setup
 * Based on original claude-wrapper interactive setup
 * Single Responsibility: Interactive user prompts and API key setup
 */

import { createInterface, Interface } from 'readline';
import { generateSecureToken } from '../utils/crypto';
import { SECURITY_PROMPTS, SECURITY_ENV_VARS } from '../config/security-constants';

/**
 * Interface for readline operations (DIP compliance)
 */
export interface IReadlineInterface {
  question(query: string): Promise<string>;
  close(): void;
}

/**
 * Wrapper for Node.js readline interface
 */
export class ReadlineWrapper implements IReadlineInterface {
  private rl: Interface;

  constructor() {
    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async question(query: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(query, (answer) => {
        resolve(answer);
      });
    });
  }

  close(): void {
    this.rl.close();
  }
}

/**
 * Interactive API key setup options
 */
export interface ApiKeySetupOptions {
  skipIfSet?: boolean;
  tokenLength?: number;
  readline?: IReadlineInterface;
}

/**
 * Result of API key setup
 */
export interface ApiKeySetupResult {
  apiKey: string | null;
  userChoice: 'yes' | 'no' | 'existing';
  message: string;
}

/**
 * Interactive API key setup class
 */
export class InteractiveApiKeySetup {
  private readline: IReadlineInterface;

  constructor(readline?: IReadlineInterface) {
    this.readline = readline || new ReadlineWrapper();
  }

  /**
   * Prompt user for API key protection setup
   * Based on original promptForApiProtection() function
   * 
   * @param options Setup options
   * @returns API key setup result
   */
  async promptForApiProtection(options: ApiKeySetupOptions = {}): Promise<ApiKeySetupResult> {
    const {
      skipIfSet = true,
      tokenLength = 32
    } = options;

    try {
      // Check if API_KEY is already set via environment variable
      if (skipIfSet && process.env[SECURITY_ENV_VARS.API_KEY]) {
        return {
          apiKey: null,
          userChoice: 'existing',
          message: 'API key already configured via environment variable'
        };
      }

      // Display information about API key protection
      console.log('\n' + SECURITY_PROMPTS.HEADER);
      console.log(SECURITY_PROMPTS.DIVIDER);
      SECURITY_PROMPTS.DESCRIPTION.forEach(line => console.log(line));

      // Prompt user for choice
      const choice = await this.readline.question(SECURITY_PROMPTS.QUESTION);

      const normalizedChoice = choice.toLowerCase().trim();

      if (normalizedChoice === 'y' || normalizedChoice === 'yes') {
        // Generate secure token
        const apiKey = generateSecureToken(tokenLength);
        
        console.log('');
        console.log(SECURITY_PROMPTS.SUCCESS_HEADER);
        console.log(SECURITY_PROMPTS.DIVIDER);
        console.log(`🔑 Your API key: ${this.maskApiKey(apiKey)}`);
        console.log('');
        SECURITY_PROMPTS.SUCCESS_MESSAGES.forEach(line => console.log(line));
        console.log('');

        return {
          apiKey,
          userChoice: 'yes',
          message: 'API key protection enabled with generated token'
        };
      } else {
        console.log('');
        console.log(SECURITY_PROMPTS.DISABLED_MESSAGE);
        console.log(SECURITY_PROMPTS.DISABLED_DESCRIPTION);
        console.log('');

        return {
          apiKey: null,
          userChoice: 'no',
          message: 'API key protection disabled by user choice'
        };
      }
    } finally {
      this.readline.close();
    }
  }

  /**
   * Mask API key for safe display
   * 
   * @param apiKey API key to mask
   * @returns Masked API key
   */
  private maskApiKey(apiKey: string): string {
    if (!apiKey || apiKey.length < 8) {
      return '***';
    }
    return `${apiKey.substring(0, 3)}${'*'.repeat(apiKey.length - 6)}${apiKey.substring(apiKey.length - 3)}`;
  }
}

/**
 * Convenience function for API key setup
 * Based on original promptForApiProtection() function
 * 
 * @param options Setup options
 * @returns Generated API key or null
 */
export async function promptForApiProtection(options: ApiKeySetupOptions = {}): Promise<string | null> {
  const setup = new InteractiveApiKeySetup(options.readline);
  const result = await setup.promptForApiProtection(options);
  return result.apiKey;
}

/**
 * Main interactive setup function
 * Matches original claude-wrapper interactive pattern
 */
export async function interactiveSetup(): Promise<void> {
  console.log('🚀 Starting Claude Wrapper...');
  
  // Only prompt for API key if not already set
  if (!process.env[SECURITY_ENV_VARS.API_KEY]) {
    await promptForApiProtection();
  }
  
  console.log('Setup complete!');
}