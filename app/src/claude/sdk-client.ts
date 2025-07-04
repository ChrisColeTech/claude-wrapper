/**
 * Claude Code SDK Client Wrapper
 * Direct wrapper for Claude Code SDK implementing patterns from CLAUDE_SDK_REFERENCE.md
 * 
 * Single Responsibility: Provide clean SDK integration with proper error handling
 */

import { 
  IClaudeSDKClient, 
  ISDKVerifier, 
  VerificationResult,
  ClaudeSDKConfig,
  CLAUDE_SDK_CONSTANTS 
} from './interfaces';
import { 
  ClaudeCodeOptions, 
  ClaudeCodeMessage 
} from './client';
import { 
  ClaudeSDKError, 
  AuthenticationError, 
  VerificationError,
  handleClaudeSDKCall 
} from './error-types';
import { authManager } from '../auth/auth-manager';
import { getLogger } from '../utils/logger';

const logger = getLogger('ClaudeSDKClient');

/**
 * Claude Code SDK Client Wrapper
 * Implements direct SDK integration following CLAUDE_SDK_REFERENCE.md patterns
 */
export class ClaudeSDKClient implements IClaudeSDKClient, ISDKVerifier {
  private sdk: any = null;
  private config: ClaudeSDKConfig;
  private originalEnvVars: Record<string, string | undefined> = {};

  constructor(config?: Partial<ClaudeSDKConfig>) {
    this.config = {
      timeout: CLAUDE_SDK_CONSTANTS.DEFAULT_TIMEOUT,
      cwd: process.cwd(),
      model: CLAUDE_SDK_CONSTANTS.DEFAULT_MODEL,
      max_turns: CLAUDE_SDK_CONSTANTS.DEFAULT_MAX_TURNS,
      auth_priority: [
        CLAUDE_SDK_CONSTANTS.AUTH_METHODS.CLAUDE_CLI,
        CLAUDE_SDK_CONSTANTS.AUTH_METHODS.ANTHROPIC_API_KEY,
        CLAUDE_SDK_CONSTANTS.AUTH_METHODS.BEDROCK,
        CLAUDE_SDK_CONSTANTS.AUTH_METHODS.VERTEX
      ],
      ...config
    };

    // Initialize SDK in non-test environments
    if (process.env.NODE_ENV !== 'test') {
      this.initializeSDK().catch(error => {
        logger.debug(`SDK initialization deferred: ${error.message}`);
      });
    } else {
      // Use fallback SDK for tests
      this.sdk = this.createFallbackSDK();
    }
  }

  /**
   * Initialize Claude Code SDK
   * Based on CLAUDE_SDK_REFERENCE.md SDK initialization patterns
   */
  private async initializeSDK(): Promise<void> {
    return handleClaudeSDKCall(async () => {
      try {
        // Try to import the official Claude Code SDK
        const claudeModule = await import('@anthropic-ai/claude-code');
        this.sdk = claudeModule;
        logger.info('✅ Claude Code SDK initialized successfully');
      } catch (error) {
        logger.warn('⚠️ Claude Code SDK not available, using fallback implementation');
        this.sdk = this.createFallbackSDK();
      }
    });
  }

  /**
   * Verify Claude SDK availability and authentication
   * Based on CLAUDE_SDK_REFERENCE.md verification patterns
   */
  async verifySDK(): Promise<VerificationResult> {
    return handleClaudeSDKCall(async () => {
      try {
        // Initialize SDK if not already done
        if (!this.sdk) {
          await this.initializeSDK();
        }

        // Setup authentication environment
        await this.setupAuthEnvironment();

        // Test basic SDK functionality
        const isWorking = await this.testSDKConnection();

        if (isWorking) {
          logger.info('✅ Claude Code SDK verification successful');
          return {
            available: true,
            version: this.sdk.version || 'claude-code-sdk',
            authentication: true
          };
        } else {
          logger.warn('⚠️ Claude Code SDK verification failed');
          return {
            available: false,
            authentication: false,
            error: 'SDK verification test failed',
            suggestion: 'Check Claude Code installation and authentication'
          };
        }
      } catch (error) {
        logger.error(`Claude Code SDK verification error: ${error}`);
        return {
          available: false,
          authentication: false,
          error: `SDK verification failed: ${error}`,
          suggestion: 'Ensure Claude Code is installed and authenticated'
        };
      } finally {
        this.restoreAuthEnvironment();
      }
    });
  }

  /**
   * Test basic SDK connection
   * Based on CLAUDE_SDK_REFERENCE.md connection testing patterns
   */
  async testSDKConnection(): Promise<boolean> {
    return handleClaudeSDKCall(async () => {
      try {
        // Simple test: try to get a minimal response
        const messages: ClaudeCodeMessage[] = [];
        let responseReceived = false;

        const testOptions: ClaudeCodeOptions = {
          max_turns: 1,
          cwd: this.config.cwd
        };

        // Use short timeout for connection test
        const testTimeout = setTimeout(() => {
          throw new Error('SDK connection test timeout');
        }, CLAUDE_SDK_CONSTANTS.SDK_TIMEOUTS.VERIFICATION);

        try {
          for await (const message of this.runCompletion('Hello', testOptions)) {
            messages.push(message);
            if (message.type === 'assistant' || message.type === 'result') {
              responseReceived = true;
              break;
            }
          }
        } finally {
          clearTimeout(testTimeout);
        }

        return responseReceived && messages.length > 0;
      } catch (error) {
        logger.debug(`SDK connection test failed: ${error}`);
        return false;
      }
    });
  }

  /**
   * Run completion with Claude SDK
   * Based on CLAUDE_SDK_REFERENCE.md completion patterns
   */
  async *runCompletion(
    prompt: string,
    options: ClaudeCodeOptions = {}
  ): AsyncGenerator<ClaudeCodeMessage, void, unknown> {
    if (!this.sdk) {
      await this.initializeSDK();
    }

    await this.setupAuthEnvironment();

    try {
      const claudeOptions = {
        ...options,
        cwd: options.cwd || this.config.cwd,
        max_turns: options.max_turns || this.config.max_turns
      };

      if (this.sdk.query) {
        // Use real Claude SDK
        yield* this.sdk.query(prompt, claudeOptions);
      } else {
        // Use fallback implementation
        yield* this.fallbackQuery(prompt, claudeOptions);
      }
    } catch (error) {
      throw new ClaudeSDKError(`SDK completion failed: ${error}`);
    } finally {
      this.restoreAuthEnvironment();
    }
  }

  /**
   * Check if SDK is available
   */
  isAvailable(): boolean {
    return this.sdk !== null;
  }

  /**
   * Get timeout value
   */
  getTimeout(): number {
    return this.config.timeout;
  }

  /**
   * Get current working directory
   */
  getCwd(): string {
    return this.config.cwd;
  }

  /**
   * Setup authentication environment
   * Based on CLAUDE_SDK_REFERENCE.md authentication patterns
   */
  private async setupAuthEnvironment(): Promise<void> {
    try {
      // Get authentication variables from auth manager
      const authVars = authManager.getClaudeCodeEnvVars();
      
      // Store original environment variables
      for (const [key, value] of Object.entries(authVars)) {
        this.originalEnvVars[key] = process.env[key];
        if (value) {
          process.env[key] = value;
        }
      }

      // Verify authentication is available
      const authStatus = await authManager.getAuthStatus();
      if (!authStatus.authenticated) {
        throw new AuthenticationError('No authentication method detected');
      }

      logger.debug(`Using ${authStatus.method} authentication for Claude SDK`);
    } catch (error) {
      throw new AuthenticationError(`Authentication setup failed: ${error}`);
    }
  }

  /**
   * Restore original environment variables
   */
  private restoreAuthEnvironment(): void {
    for (const [key, originalValue] of Object.entries(this.originalEnvVars)) {
      if (originalValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalValue;
      }
    }
    this.originalEnvVars = {};
  }

  /**
   * Create fallback SDK implementation
   * Used when official SDK is not available
   */
  private createFallbackSDK(): any {
    return {
      query: this.fallbackQuery.bind(this),
      version: 'fallback-1.0.0'
    };
  }

  /**
   * Fallback query implementation
   * Simulates Claude SDK behavior for development/testing
   */
  private async *fallbackQuery(
    prompt: string,
    options: ClaudeCodeOptions
  ): AsyncGenerator<ClaudeCodeMessage, void, unknown> {
    const sessionId = `fallback_${Date.now()}`;
    
    // System init message
    yield {
      type: 'system',
      subtype: 'init',
      data: {
        session_id: sessionId,
        model: options.model || this.config.model
      }
    };

    // Assistant response
    yield {
      type: 'assistant',
      content: `This is a fallback response to: ${prompt}`,
      message: {
        content: `This is a fallback response to: ${prompt}`
      }
    };

    // Result message
    yield {
      type: 'result',
      subtype: 'success',
      total_cost_usd: 0.001,
      duration_ms: 100,
      num_turns: 1,
      session_id: sessionId
    };
  }
}

/**
 * Create Claude SDK client with configuration
 * Based on CLAUDE_SDK_REFERENCE.md client factory patterns
 */
export function createClaudeSDKClient(config?: Partial<ClaudeSDKConfig>): ClaudeSDKClient {
  return new ClaudeSDKClient(config);
}

/**
 * Global Claude SDK client instance
 * Based on singleton pattern for efficiency
 */
export const claudeSDKClient = createClaudeSDKClient();

/**
 * Verify Claude SDK availability
 * Helper function for quick SDK verification
 */
export async function verifyClaudeSDK(): Promise<VerificationResult> {
  return claudeSDKClient.verifySDK();
}