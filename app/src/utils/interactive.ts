/**
 * Interactive CLI prompts for API key setup
 * Based on Python main.py:60-104
 * 
 * Single Responsibility: Interactive user prompts and API key setup
 */

import { createInterface, Interface } from 'readline';
import { generateSecureToken } from './crypto';

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
   * Based on Python prompt_for_api_protection() function
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
      if (skipIfSet && process.env.API_KEY) {
        return {
          apiKey: null,
          userChoice: 'existing',
          message: 'API key already configured via environment variable'
        };
      }

      // Display information about API key protection
      console.log('\n🔐 API Key Protection Setup');
      console.log('━'.repeat(50));
      console.log('You can optionally protect your API endpoints with a bearer token.');
      console.log('This adds an extra layer of security for remote access.');
      console.log('');
      console.log('If enabled, clients must include: Authorization: Bearer <token>');
      console.log('');

      // Prompt user for choice
      const choice = await this.readline.question(
        'Would you like to enable API key protection? (y/N): '
      );

      const normalizedChoice = choice.toLowerCase().trim();

      if (normalizedChoice === 'y' || normalizedChoice === 'yes') {
        // Generate secure token
        const apiKey = generateSecureToken(tokenLength);
        
        console.log('');
        console.log('✅ API key protection enabled!');
        console.log('━'.repeat(50));
        console.log(`🔑 Your API key: ${apiKey}`);
        console.log('');
        console.log('⚠️  IMPORTANT: Save this key securely!');
        console.log('   • This key will not be shown again');
        console.log('   • You can also set it via API_KEY environment variable');
        console.log('   • Include it in requests: Authorization: Bearer <key>');
        console.log('');

        return {
          apiKey,
          userChoice: 'yes',
          message: 'API key protection enabled with generated token'
        };
      } else {
        console.log('');
        console.log('ℹ️  API key protection disabled.');
        console.log('   Endpoints will be accessible without authentication.');
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
   * Display API key information for existing setup
   * 
   * @param apiKey Existing API key (masked for security)
   */
  displayExistingApiKeyInfo(apiKey: string): void {
    console.log('\n🔐 API Key Protection Status');
    console.log('━'.repeat(50));
    console.log('✅ API key protection is ENABLED');
    console.log(`🔑 API key: ${this.maskApiKey(apiKey)}`);
    console.log('');
    console.log('ℹ️  Clients must include: Authorization: Bearer <token>');
    console.log('');
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
 * Based on Python prompt_for_api_protection() function
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
 * Display API key status information
 * 
 * @param apiKey Current API key (if any)
 */
export function displayApiKeyStatus(apiKey?: string): void {
  const setup = new InteractiveApiKeySetup();
  
  if (apiKey) {
    setup.displayExistingApiKeyInfo(apiKey);
  } else {
    console.log('\n🔐 API Key Protection Status');
    console.log('━'.repeat(50));
    console.log('⚪ API key protection is DISABLED');
    console.log('   Endpoints are accessible without authentication');
    console.log('');
  }
}
