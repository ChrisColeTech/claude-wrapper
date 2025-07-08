/**
 * Multi-provider authentication providers
 * Based on claude-wrapper/app/src/auth/providers/ patterns
 * 
 * Single Responsibility: Authentication provider implementations
 */

import { spawn } from 'child_process';

/**
 * Supported authentication methods
 */
export enum AuthMethod {
  ANTHROPIC = 'anthropic',
  BEDROCK = 'bedrock', 
  VERTEX = 'vertex',
  CLAUDE_CLI = 'claude_cli'
}

/**
 * Authentication validation result
 */
export interface AuthValidationResult {
  valid: boolean;
  errors: string[];
  config: Record<string, any>;
  method: AuthMethod;
}

/**
 * Environment variables for authentication
 */
export interface AuthEnvironment {
  [key: string]: string | undefined;
}

/**
 * Base interface for authentication providers (ISP compliance)
 */
export interface IAuthProvider {
  validate(): Promise<AuthValidationResult>;
  getMethod(): AuthMethod;
  getRequiredEnvVars(): string[];
  isConfigured(): boolean;
}

/**
 * Extended interface for auto-detect providers
 */
export interface IAutoDetectProvider extends IAuthProvider {
  canDetect(): boolean;
}

/**
 * Anthropic API provider implementation
 */
export class AnthropicProvider implements IAutoDetectProvider {
  /**
   * Validate Anthropic API key authentication
   */
  async validate(): Promise<AuthValidationResult> {
    const errors: string[] = [];
    const config: Record<string, any> = {};

    // Check for API key
    if (!process.env["ANTHROPIC_API_KEY"]) {
      errors.push('ANTHROPIC_API_KEY environment variable not set');
      return {
        valid: false,
        errors,
        config,
        method: AuthMethod.ANTHROPIC
      };
    }

    // Validate API key format
    const apiKey = process.env["ANTHROPIC_API_KEY"];
    if (!apiKey.startsWith('sk-ant-')) {
      errors.push('ANTHROPIC_API_KEY must start with "sk-ant-"');
    }

    if (apiKey.length < 20) {
      errors.push('ANTHROPIC_API_KEY appears to be too short');
    }

    // Test API key by attempting a simple Claude Code CLI call
    try {
      const testResult = await this.testClaudeCliWithAuth();
      if (!testResult.success) {
        errors.push(`API key validation failed: ${testResult.error}`);
      } else {
        config["validated"] = true;
        config["keyPrefix"] = apiKey.substring(0, 10) + '...';
      }
    } catch (error) {
      errors.push(`Authentication test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      config,
      method: AuthMethod.ANTHROPIC
    };
  }

  /**
   * Get authentication method
   */
  getMethod(): AuthMethod {
    return AuthMethod.ANTHROPIC;
  }

  /**
   * Get required environment variables
   */
  getRequiredEnvVars(): string[] {
    return ['ANTHROPIC_API_KEY'];
  }

  /**
   * Check if provider is configured
   */
  isConfigured(): boolean {
    return !!process.env["ANTHROPIC_API_KEY"];
  }

  /**
   * Check if provider can be auto-detected
   */
  canDetect(): boolean {
    return this.isConfigured();
  }

  /**
   * Test Claude CLI with Anthropic authentication
   */
  private async testClaudeCliWithAuth(): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const child = spawn('claude', ['--print', 'Test authentication'], {
        env: {
          ...process.env,
          ANTHROPIC_API_KEY: process.env["ANTHROPIC_API_KEY"]
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0 && stdout.trim().length > 0) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: stderr || 'No response from Claude CLI' });
        }
      });

      child.on('error', (error) => {
        resolve({ success: false, error: error.message });
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        child.kill();
        resolve({ success: false, error: 'Authentication test timeout' });
      }, 10000);
    });
  }
}

/**
 * AWS Bedrock provider implementation
 */
export class BedrockProvider implements IAutoDetectProvider {
  /**
   * Validate AWS Bedrock authentication
   */
  async validate(): Promise<AuthValidationResult> {
    const errors: string[] = [];
    const config: Record<string, any> = {};

    // Check required AWS credentials
    const requiredVars = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'];
    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        errors.push(`${varName} environment variable not set`);
      }
    }

    // Check for region
    if (!process.env["AWS_REGION"]) {
      errors.push('AWS_REGION environment variable not set');
    }

    // Validate access key format
    if (process.env["AWS_ACCESS_KEY_ID"]) {
      const accessKey = process.env["AWS_ACCESS_KEY_ID"];
      if (!accessKey.startsWith('AKIA') && !accessKey.startsWith('ASIA')) {
        errors.push('AWS_ACCESS_KEY_ID format appears invalid');
      }
    }

    // Test Bedrock authentication
    if (errors.length === 0) {
      try {
        const testResult = await this.testBedrockAuth();
        if (!testResult.success) {
          errors.push(`Bedrock authentication failed: ${testResult.error}`);
        } else {
          config["validated"] = true;
          config["region"] = process.env["AWS_REGION"];
          config["accessKeyPrefix"] = process.env["AWS_ACCESS_KEY_ID"]?.substring(0, 10) + '...';
        }
      } catch (error) {
        errors.push(`Bedrock test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      config,
      method: AuthMethod.BEDROCK
    };
  }

  /**
   * Get authentication method
   */
  getMethod(): AuthMethod {
    return AuthMethod.BEDROCK;
  }

  /**
   * Get required environment variables
   */
  getRequiredEnvVars(): string[] {
    return ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION'];
  }

  /**
   * Check if provider is configured
   */
  isConfigured(): boolean {
    return !!(process.env["AWS_ACCESS_KEY_ID"] && process.env["AWS_SECRET_ACCESS_KEY"]);
  }

  /**
   * Check if provider can be auto-detected
   */
  canDetect(): boolean {
    return this.isConfigured() && process.env["CLAUDE_CODE_USE_BEDROCK"] === '1';
  }

  /**
   * Test Bedrock authentication
   */
  private async testBedrockAuth(): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const child = spawn('claude', ['--print', 'Test Bedrock auth'], {
        env: {
          ...process.env,
          CLAUDE_CODE_USE_BEDROCK: '1',
          AWS_ACCESS_KEY_ID: process.env["AWS_ACCESS_KEY_ID"],
          AWS_SECRET_ACCESS_KEY: process.env["AWS_SECRET_ACCESS_KEY"],
          AWS_REGION: process.env["AWS_REGION"]
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0 && stdout.trim().length > 0) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: stderr || 'No response from Claude CLI with Bedrock' });
        }
      });

      child.on('error', (error) => {
        resolve({ success: false, error: error.message });
      });

      // Timeout after 15 seconds (Bedrock can be slower)
      setTimeout(() => {
        child.kill();
        resolve({ success: false, error: 'Bedrock authentication test timeout' });
      }, 15000);
    });
  }
}

/**
 * Google Vertex AI provider implementation
 */
export class VertexProvider implements IAutoDetectProvider {
  /**
   * Validate Google Vertex AI authentication
   */
  async validate(): Promise<AuthValidationResult> {
    const errors: string[] = [];
    const config: Record<string, any> = {};

    // Check for Google Application Credentials
    if (!process.env["GOOGLE_APPLICATION_CREDENTIALS"]) {
      errors.push('GOOGLE_APPLICATION_CREDENTIALS environment variable not set');
    }

    // Check for project ID
    if (!process.env["GOOGLE_CLOUD_PROJECT"] && !process.env["GCLOUD_PROJECT"]) {
      errors.push('GOOGLE_CLOUD_PROJECT or GCLOUD_PROJECT environment variable not set');
    }

    // Validate credentials file exists
    if (process.env["GOOGLE_APPLICATION_CREDENTIALS"]) {
      try {
        const fs = require('fs');
        if (!fs.existsSync(process.env["GOOGLE_APPLICATION_CREDENTIALS"])) {
          errors.push('Google Application Credentials file does not exist');
        }
      } catch (error) {
        errors.push('Cannot access Google Application Credentials file');
      }
    }

    // Test Vertex authentication
    if (errors.length === 0) {
      try {
        const testResult = await this.testVertexAuth();
        if (!testResult.success) {
          errors.push(`Vertex authentication failed: ${testResult.error}`);
        } else {
          config["validated"] = true;
          config["project"] = process.env["GOOGLE_CLOUD_PROJECT"] || process.env["GCLOUD_PROJECT"];
          config["credentialsFile"] = process.env["GOOGLE_APPLICATION_CREDENTIALS"];
        }
      } catch (error) {
        errors.push(`Vertex test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      config,
      method: AuthMethod.VERTEX
    };
  }

  /**
   * Get authentication method
   */
  getMethod(): AuthMethod {
    return AuthMethod.VERTEX;
  }

  /**
   * Get required environment variables
   */
  getRequiredEnvVars(): string[] {
    return ['GOOGLE_APPLICATION_CREDENTIALS', 'GOOGLE_CLOUD_PROJECT'];
  }

  /**
   * Check if provider is configured
   */
  isConfigured(): boolean {
    return !!(process.env["GOOGLE_APPLICATION_CREDENTIALS"] && 
              (process.env["GOOGLE_CLOUD_PROJECT"] || process.env["GCLOUD_PROJECT"]));
  }

  /**
   * Check if provider can be auto-detected
   */
  canDetect(): boolean {
    return this.isConfigured() && process.env["CLAUDE_CODE_USE_VERTEX"] === '1';
  }

  /**
   * Test Vertex AI authentication
   */
  private async testVertexAuth(): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const child = spawn('claude', ['--print', 'Test Vertex auth'], {
        env: {
          ...process.env,
          CLAUDE_CODE_USE_VERTEX: '1',
          GOOGLE_APPLICATION_CREDENTIALS: process.env["GOOGLE_APPLICATION_CREDENTIALS"],
          GOOGLE_CLOUD_PROJECT: process.env["GOOGLE_CLOUD_PROJECT"] || process.env["GCLOUD_PROJECT"]
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0 && stdout.trim().length > 0) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: stderr || 'No response from Claude CLI with Vertex' });
        }
      });

      child.on('error', (error) => {
        resolve({ success: false, error: error.message });
      });

      // Timeout after 15 seconds (Vertex can be slower)
      setTimeout(() => {
        child.kill();
        resolve({ success: false, error: 'Vertex authentication test timeout' });
      }, 15000);
    });
  }
}

/**
 * Claude CLI provider implementation (fallback)
 */
export class ClaudeCliProvider implements IAuthProvider {
  /**
   * Validate Claude CLI authentication
   */
  async validate(): Promise<AuthValidationResult> {
    const errors: string[] = [];
    const config: Record<string, any> = {};

    try {
      // Test basic Claude CLI functionality
      const testResult = await this.testCliAuth();
      if (!testResult.success) {
        errors.push(`Claude CLI authentication failed: ${testResult.error}`);
      } else {
        config["validated"] = true;
        config["method"] = 'system_auth';
      }
    } catch (error) {
      errors.push(`CLI test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      config,
      method: AuthMethod.CLAUDE_CLI
    };
  }

  /**
   * Get authentication method
   */
  getMethod(): AuthMethod {
    return AuthMethod.CLAUDE_CLI;
  }

  /**
   * Get required environment variables
   */
  getRequiredEnvVars(): string[] {
    return []; // CLI uses system authentication
  }

  /**
   * Check if provider is configured
   */
  isConfigured(): boolean {
    return true; // CLI is always available as fallback
  }

  /**
   * Test Claude CLI authentication
   */
  private async testCliAuth(): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const child = spawn('claude', ['--print', 'Test CLI auth'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0 && stdout.trim().length > 0) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: stderr || 'Claude CLI not authenticated' });
        }
      });

      child.on('error', (error) => {
        resolve({ success: false, error: error.message });
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        child.kill();
        resolve({ success: false, error: 'CLI authentication test timeout' });
      }, 10000);
    });
  }
}