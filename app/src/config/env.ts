import { EnvironmentConfig } from '../types';
import { API_CONSTANTS, LOG_LEVELS } from './constants';
import { SECURITY_ENV_VARS } from './security-constants';

export class EnvironmentManager {
  private static config: EnvironmentConfig | null = null;

  static getConfig(): EnvironmentConfig {
    if (!this.config) {
      this.config = this.loadConfig();
    }
    return this.config;
  }

  private static loadConfig(): EnvironmentConfig {
    return {
      port: this.getNumberFromEnv('PORT', API_CONSTANTS.DEFAULT_PORT),
      timeout: this.getNumberFromEnv('TIMEOUT', API_CONSTANTS.DEFAULT_TIMEOUT),
      claudeCommand: process.env['CLAUDE_COMMAND'],
      logLevel: this.getLogLevelFromEnv('LOG_LEVEL', 'info'),
    };
  }

  private static getNumberFromEnv(key: string, defaultValue: number): number {
    const value = process.env[key];
    if (!value) return defaultValue;
    
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      console.warn(`Invalid ${key} environment variable: ${value}, using default: ${defaultValue}`);
      return defaultValue;
    }
    return parsed;
  }

  private static getLogLevelFromEnv(key: string, defaultValue: 'debug' | 'info' | 'warn' | 'error'): 'debug' | 'info' | 'warn' | 'error' {
    const value = process.env[key]?.toLowerCase();
    if (!value) return defaultValue;
    
    if (Object.values(LOG_LEVELS).includes(value as any)) {
      return value as 'debug' | 'info' | 'warn' | 'error';
    }
    
    console.warn(`Invalid ${key} environment variable: ${value}, using default: ${defaultValue}`);
    return defaultValue;
  }

  static isProduction(): boolean {
    return process.env['NODE_ENV'] === 'production';
  }

  static isDevelopment(): boolean {
    return process.env['NODE_ENV'] === 'development';
  }

  /**
   * CLI-specific environment variable handling
   */
  static getApiKey(): string | undefined {
    return process.env[SECURITY_ENV_VARS.API_KEY];
  }

  static isDebugMode(): boolean {
    return process.env['DEBUG_MODE'] === 'true' || process.env['DEBUG_MODE'] === '1';
  }

  static isDaemonMode(): boolean {
    return process.env['CLAUDE_WRAPPER_DAEMON'] === 'true';
  }

  static getRequiredApiKey(): boolean {
    return process.env[SECURITY_ENV_VARS.REQUIRE_API_KEY] === 'true';
  }

  static isMockMode(): boolean {
    return process.env['MOCK_MODE'] === 'true' || process.env['MOCK_MODE'] === '1';
  }
}