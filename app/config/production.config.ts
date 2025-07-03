/**
 * Phase 15A Production Configuration Setup
 * Production-ready configuration with security and performance optimizations
 * Based on Python implementation production patterns
 */

import { config } from 'dotenv';
import { resolve } from 'path';

/**
 * Production Configuration Interface
 * Defines all configuration options for production deployment
 */
export interface ProductionConfig {
  // Server Configuration
  server: {
    port: number;
    host: string;
    timeout: number;
    keepAliveTimeout: number;
    headersTimeout: number;
    maxHeaderSize: number;
    bodyParserLimit: string;
  };

  // Security Configuration
  security: {
    corsEnabled: boolean;
    corsOrigins: string[];
    rateLimitEnabled: boolean;
    rateLimitWindow: number;
    rateLimitMax: number;
    helmetEnabled: boolean;
    trustProxy: boolean;
  };

  // Logging Configuration
  logging: {
    level: string;
    format: string;
    enableConsole: boolean;
    enableFile: boolean;
    enableError: boolean;
    maxFiles: number;
    maxSize: string;
    colorize: boolean;
  };

  // Performance Configuration
  performance: {
    compressionEnabled: boolean;
    compressionLevel: number;
    cacheEnabled: boolean;
    cacheTtl: number;
    sessionCleanupInterval: number;
    maxConcurrentRequests: number;
  };

  // Authentication Configuration
  authentication: {
    enabled: boolean;
    tokenExpiry: number;
    secretRotationInterval: number;
    maxLoginAttempts: number;
    lockoutDuration: number;
  };

  // Monitoring Configuration
  monitoring: {
    healthCheckEnabled: boolean;
    healthCheckInterval: number;
    metricsEnabled: boolean;
    metricsPort: number;
    alertingEnabled: boolean;
    uptimeThreshold: number;
  };

  // Feature Flags
  features: {
    debugEndpoints: boolean;
    compatibilityEndpoints: boolean;
    sessionPersistence: boolean;
    streamingEnabled: boolean;
    toolsEnabled: boolean;
    verboseLogging: boolean;
  };
}

/**
 * Default Production Configuration
 * Secure, performance-optimized defaults for production deployment
 */
export const defaultProductionConfig: ProductionConfig = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    timeout: parseInt(process.env.SERVER_TIMEOUT || '30000', 10), // 30 seconds
    keepAliveTimeout: parseInt(process.env.KEEP_ALIVE_TIMEOUT || '5000', 10),
    headersTimeout: parseInt(process.env.HEADERS_TIMEOUT || '10000', 10),
    maxHeaderSize: parseInt(process.env.MAX_HEADER_SIZE || '8192', 10),
    bodyParserLimit: process.env.BODY_PARSER_LIMIT || '10mb'
  },

  security: {
    corsEnabled: process.env.CORS_ENABLED !== 'false',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['*'],
    rateLimitEnabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    helmetEnabled: process.env.HELMET_ENABLED !== 'false',
    trustProxy: process.env.TRUST_PROXY === 'true'
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    enableConsole: process.env.LOG_CONSOLE !== 'false',
    enableFile: process.env.LOG_FILE === 'true',
    enableError: process.env.LOG_ERROR !== 'false',
    maxFiles: parseInt(process.env.LOG_MAX_FILES || '5', 10),
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    colorize: process.env.LOG_COLORIZE === 'true'
  },

  performance: {
    compressionEnabled: process.env.COMPRESSION_ENABLED !== 'false',
    compressionLevel: parseInt(process.env.COMPRESSION_LEVEL || '6', 10),
    cacheEnabled: process.env.CACHE_ENABLED !== 'false',
    cacheTtl: parseInt(process.env.CACHE_TTL || '300', 10), // 5 minutes
    sessionCleanupInterval: parseInt(process.env.SESSION_CLEANUP_INTERVAL || '3600000', 10), // 1 hour
    maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '1000', 10)
  },

  authentication: {
    enabled: process.env.AUTH_ENABLED !== 'false',
    tokenExpiry: parseInt(process.env.TOKEN_EXPIRY || '3600', 10), // 1 hour
    secretRotationInterval: parseInt(process.env.SECRET_ROTATION_INTERVAL || '86400000', 10), // 24 hours
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
    lockoutDuration: parseInt(process.env.LOCKOUT_DURATION || '900000', 10) // 15 minutes
  },

  monitoring: {
    healthCheckEnabled: process.env.HEALTH_CHECK_ENABLED !== 'false',
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000', 10), // 30 seconds
    metricsEnabled: process.env.METRICS_ENABLED === 'true',
    metricsPort: parseInt(process.env.METRICS_PORT || '9090', 10),
    alertingEnabled: process.env.ALERTING_ENABLED === 'true',
    uptimeThreshold: parseFloat(process.env.UPTIME_THRESHOLD || '0.99') // 99% uptime
  },

  features: {
    debugEndpoints: process.env.DEBUG_ENDPOINTS === 'true',
    compatibilityEndpoints: process.env.COMPATIBILITY_ENDPOINTS !== 'false',
    sessionPersistence: process.env.SESSION_PERSISTENCE !== 'false',
    streamingEnabled: process.env.STREAMING_ENABLED !== 'false',
    toolsEnabled: process.env.TOOLS_ENABLED !== 'false',
    verboseLogging: process.env.VERBOSE_LOGGING === 'true'
  }
};

/**
 * Production Configuration Manager
 * Handles loading, validation, and management of production configuration
 */
export class ProductionConfigManager {
  private config: ProductionConfig;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || resolve(process.cwd(), '.env.production');
    this.config = { ...defaultProductionConfig };
    this.loadConfiguration();
  }

  /**
   * Load configuration from environment and files
   */
  private loadConfiguration(): void {
    // Load production environment file if it exists
    try {
      config({ path: this.configPath });
    } catch (error) {
      console.warn(`Production config file not found at ${this.configPath}, using environment variables only`);
    }

    // Validate and apply environment overrides
    this.validateConfiguration();
    this.applySecurityDefaults();
    this.optimizeForProduction();
  }

  /**
   * Validate configuration values
   */
  private validateConfiguration(): void {
    // Validate port range
    if (this.config.server.port < 1 || this.config.server.port > 65535) {
      throw new Error('Invalid server port: must be between 1 and 65535');
    }

    // Validate timeout values
    if (this.config.server.timeout < 1000) {
      console.warn('Server timeout is very low, minimum recommended is 1000ms');
    }

    // Validate security settings
    if (this.config.security.rateLimitMax < 1) {
      throw new Error('Rate limit max must be at least 1');
    }

    // Validate logging level
    const validLogLevels = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'];
    if (!validLogLevels.includes(this.config.logging.level)) {
      throw new Error(`Invalid log level: ${this.config.logging.level}`);
    }

    // Validate performance settings
    if (this.config.performance.compressionLevel < 0 || this.config.performance.compressionLevel > 9) {
      throw new Error('Compression level must be between 0 and 9');
    }

    // Validate monitoring settings
    if (this.config.monitoring.uptimeThreshold < 0 || this.config.monitoring.uptimeThreshold > 1) {
      throw new Error('Uptime threshold must be between 0 and 1');
    }
  }

  /**
   * Apply security-focused defaults for production
   */
  private applySecurityDefaults(): void {
    // Force secure settings in production
    if (process.env.NODE_ENV === 'production') {
      // Disable debug features in production
      this.config.features.debugEndpoints = false;
      this.config.features.verboseLogging = false;

      // Enable security features
      this.config.security.helmetEnabled = true;
      this.config.security.rateLimitEnabled = true;

      // Secure logging
      if (this.config.logging.level === 'debug' || this.config.logging.level === 'silly') {
        this.config.logging.level = 'info';
        console.warn('Debug logging disabled in production for security');
      }

      // Secure CORS
      if (this.config.security.corsOrigins.includes('*')) {
        console.warn('Wildcard CORS origin detected in production - consider restricting to specific domains');
      }
    }
  }

  /**
   * Optimize configuration for production performance
   */
  private optimizeForProduction(): void {
    if (process.env.NODE_ENV === 'production') {
      // Enable performance features
      this.config.performance.compressionEnabled = true;
      this.config.performance.cacheEnabled = true;

      // Optimize timeouts for production
      if (this.config.server.keepAliveTimeout > this.config.server.timeout) {
        this.config.server.keepAliveTimeout = this.config.server.timeout - 1000;
      }

      // Optimize session cleanup for production load
      if (this.config.performance.sessionCleanupInterval > 7200000) { // 2 hours
        this.config.performance.sessionCleanupInterval = 3600000; // 1 hour
        console.info('Session cleanup interval optimized for production');
      }
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): ProductionConfig {
    return { ...this.config };
  }

  /**
   * Get server configuration
   */
  getServerConfig(): ProductionConfig['server'] {
    return { ...this.config.server };
  }

  /**
   * Get security configuration
   */
  getSecurityConfig(): ProductionConfig['security'] {
    return { ...this.config.security };
  }

  /**
   * Get logging configuration
   */
  getLoggingConfig(): ProductionConfig['logging'] {
    return { ...this.config.logging };
  }

  /**
   * Get performance configuration
   */
  getPerformanceConfig(): ProductionConfig['performance'] {
    return { ...this.config.performance };
  }

  /**
   * Get monitoring configuration
   */
  getMonitoringConfig(): ProductionConfig['monitoring'] {
    return { ...this.config.monitoring };
  }

  /**
   * Get feature flags
   */
  getFeatureFlags(): ProductionConfig['features'] {
    return { ...this.config.features };
  }

  /**
   * Update configuration at runtime (for specific values)
   */
  updateConfig(updates: Partial<ProductionConfig>): void {
    this.config = { ...this.config, ...updates };
    this.validateConfiguration();
  }

  /**
   * Get configuration summary for monitoring
   */
  getConfigSummary(): {
    environment: string;
    serverPort: number;
    securityEnabled: boolean;
    featuresEnabled: string[];
    performanceOptimized: boolean;
  } {
    return {
      environment: process.env.NODE_ENV || 'development',
      serverPort: this.config.server.port,
      securityEnabled: this.config.security.rateLimitEnabled && this.config.security.helmetEnabled,
      featuresEnabled: Object.entries(this.config.features)
        .filter(([, enabled]) => enabled)
        .map(([feature]) => feature),
      performanceOptimized: this.config.performance.compressionEnabled && this.config.performance.cacheEnabled
    };
  }

  /**
   * Export configuration for external systems
   */
  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Create production configuration template
   */
  static createProductionTemplate(): string {
    return `# Claude Wrapper Production Configuration
# Copy this file to .env.production and customize for your deployment

# Server Configuration
PORT=3000
HOST=0.0.0.0
SERVER_TIMEOUT=30000
KEEP_ALIVE_TIMEOUT=5000
HEADERS_TIMEOUT=10000
MAX_HEADER_SIZE=8192
BODY_PARSER_LIMIT=10mb

# Security Configuration
CORS_ENABLED=true
CORS_ORIGINS=https://yourdomain.com,https://api.yourdomain.com
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
HELMET_ENABLED=true
TRUST_PROXY=true

# Logging Configuration
LOG_LEVEL=info
LOG_FORMAT=json
LOG_CONSOLE=true
LOG_FILE=true
LOG_ERROR=true
LOG_MAX_FILES=5
LOG_MAX_SIZE=20m
LOG_COLORIZE=false

# Performance Configuration
COMPRESSION_ENABLED=true
COMPRESSION_LEVEL=6
CACHE_ENABLED=true
CACHE_TTL=300
SESSION_CLEANUP_INTERVAL=3600000
MAX_CONCURRENT_REQUESTS=1000

# Authentication Configuration
AUTH_ENABLED=true
TOKEN_EXPIRY=3600
SECRET_ROTATION_INTERVAL=86400000
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION=900000

# Monitoring Configuration
HEALTH_CHECK_ENABLED=true
HEALTH_CHECK_INTERVAL=30000
METRICS_ENABLED=true
METRICS_PORT=9090
ALERTING_ENABLED=true
UPTIME_THRESHOLD=0.99

# Feature Flags
DEBUG_ENDPOINTS=false
COMPATIBILITY_ENDPOINTS=true
SESSION_PERSISTENCE=true
STREAMING_ENABLED=true
TOOLS_ENABLED=true
VERBOSE_LOGGING=false

# Claude Code Authentication
ANTHROPIC_API_KEY=your-anthropic-api-key-here
# OR for Bedrock:
# AWS_ACCESS_KEY_ID=your-aws-access-key
# AWS_SECRET_ACCESS_KEY=your-aws-secret-key
# CLAUDE_CODE_USE_BEDROCK=1
# OR for Vertex AI:
# CLAUDE_CODE_USE_VERTEX=1
# GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
`;
  }
}

// Global production configuration instance
export const productionConfig = new ProductionConfigManager();

// Export configuration getter for easy access
export const getProductionConfig = (): ProductionConfig => productionConfig.getConfig();
export const getServerConfig = (): ProductionConfig['server'] => productionConfig.getServerConfig();
export const getSecurityConfig = (): ProductionConfig['security'] => productionConfig.getSecurityConfig();
export const getLoggingConfig = (): ProductionConfig['logging'] => productionConfig.getLoggingConfig();
export const getPerformanceConfig = (): ProductionConfig['performance'] => productionConfig.getPerformanceConfig();
export const getMonitoringConfig = (): ProductionConfig['monitoring'] => productionConfig.getMonitoringConfig();
export const getFeatureFlags = (): ProductionConfig['features'] => productionConfig.getFeatureFlags();