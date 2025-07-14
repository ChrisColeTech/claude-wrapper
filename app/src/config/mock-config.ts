/**
 * Mock Configuration Manager
 * Provides centralized configuration for mock mode functionality
 */

export interface MockConfig {
  enabled: boolean;
  responseDelay: {
    min: number;
    max: number;
  };
  responses: {
    useCache: boolean;
    cacheSize: number;
    variation: number;
  };
  errors: {
    rate: number;
    types: string[];
  };
  tokens: {
    charactersPerToken: number;
    variation: number;
  };
}

export const DEFAULT_MOCK_CONFIG: MockConfig = {
  enabled: false,
  responseDelay: {
    min: 100,
    max: 500
  },
  responses: {
    useCache: true,
    cacheSize: 100,
    variation: 0.3
  },
  errors: {
    rate: 0.0,
    types: ['timeout', 'validation', 'cli_error', 'network']
  },
  tokens: {
    charactersPerToken: 4,
    variation: 0.2
  }
};

export class MockConfigManager {
  private static config: MockConfig | null = null;

  static getConfig(): MockConfig {
    if (!this.config) {
      this.config = this.loadConfig();
    }
    return this.config;
  }

  static isMockMode(): boolean {
    return this.getConfig().enabled;
  }

  static resetConfig(): void {
    this.config = null;
  }

  private static loadConfig(): MockConfig {
    const enabled = process.env['MOCK_MODE'] === 'true' || 
                   process.env['NODE_ENV'] === 'test';

    return {
      enabled,
      responseDelay: {
        min: this.getNumberFromEnv('MOCK_RESPONSE_DELAY_MIN', DEFAULT_MOCK_CONFIG.responseDelay.min),
        max: this.getNumberFromEnv('MOCK_RESPONSE_DELAY_MAX', DEFAULT_MOCK_CONFIG.responseDelay.max)
      },
      responses: {
        useCache: this.getBooleanFromEnv('MOCK_USE_CACHE', DEFAULT_MOCK_CONFIG.responses.useCache),
        cacheSize: this.getNumberFromEnv('MOCK_CACHE_SIZE', DEFAULT_MOCK_CONFIG.responses.cacheSize),
        variation: this.getNumberFromEnv('MOCK_RESPONSE_VARIATION', DEFAULT_MOCK_CONFIG.responses.variation)
      },
      errors: {
        rate: this.getNumberFromEnv('MOCK_ERROR_RATE', DEFAULT_MOCK_CONFIG.errors.rate),
        types: DEFAULT_MOCK_CONFIG.errors.types
      },
      tokens: {
        charactersPerToken: this.getNumberFromEnv('MOCK_CHARS_PER_TOKEN', DEFAULT_MOCK_CONFIG.tokens.charactersPerToken),
        variation: this.getNumberFromEnv('MOCK_TOKEN_VARIATION', DEFAULT_MOCK_CONFIG.tokens.variation)
      }
    };
  }

  private static getNumberFromEnv(key: string, defaultValue: number): number {
    const value = process.env[key];
    if (!value) return defaultValue;
    
    const parsed = parseFloat(value);
    if (isNaN(parsed)) {
      console.warn(`Invalid ${key} environment variable: ${value}, using default: ${defaultValue}`);
      return defaultValue;
    }
    return parsed;
  }

  private static getBooleanFromEnv(key: string, defaultValue: boolean): boolean {
    const value = process.env[key];
    if (!value) return defaultValue;
    return value.toLowerCase() === 'true' || value === '1';
  }

  static getRandomDelay(): number {
    const config = this.getConfig();
    const { min, max } = config.responseDelay;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  static shouldSimulateError(): boolean {
    const config = this.getConfig();
    return Math.random() < config.errors.rate;
  }

  static getRandomErrorType(): string {
    const config = this.getConfig();
    const types = config.errors.types;
    return types[Math.floor(Math.random() * types.length)] || 'system';
  }
}