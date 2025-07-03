#!/usr/bin/env node
/**
 * Claude Code OpenAI Wrapper - CLI Entry Point
 * Command-line interface for starting the server
 * 
 * Based on Python implementation main.py CLI behavior
 * Single Responsibility: CLI argument parsing and application startup
 */

import { Command } from 'commander';
import { config, EnvironmentError } from './utils/env';
import { createLogger } from './utils/logger';
import { createAndStartServer } from './server';
import { authManager } from './auth/auth-manager';
import { promptForApiProtection } from './utils/interactive';

/**
 * CLI options interface
 */
export interface CliOptions {
  port?: string;
  verbose?: boolean;
  debug?: boolean;
  interactive?: boolean;
  help?: boolean;
  version?: boolean;
}

/**
 * CLI argument parser and validator
 */
export class CliParser {
  private program: Command;

  constructor() {
    this.program = new Command();
    this.setupCommands();
  }

  /**
   * Setup CLI commands and options - simplified to match Python behavior
   * Python only accepts a single port argument via sys.argv
   */
  private setupCommands(): void {
    this.program
      .name('claude-wrapper')
      .description('OpenAI-compatible API wrapper for Claude Code CLI')
      .version('1.0.0')
      .option('-v, --verbose', 'enable verbose logging')
      .option('-d, --debug', 'enable debug mode')
      .option('--no-interactive', 'disable interactive API key setup')
      .helpOption('-h, --help', 'display help for command')
      .argument('[port]', 'port to run server on (default: 8000)');
  }

  /**
   * Parse command line arguments (matches Python sys.argv behavior)
   * @param argv Command line arguments
   * @returns Parsed CLI options
   */
  parseArguments(argv: string[]): CliOptions {
    this.program.parse(argv);
    const options = this.program.opts() as CliOptions;
    const args = this.program.args;
    
    // Handle port argument like Python does with sys.argv[1]
    if (args.length > 0) {
      const portArg = args[0];
      try {
        // Python int() is stricter than parseInt - must be exact integer string
        const portNum = parseInt(portArg, 10);
        const isExactInteger = portArg === portNum.toString() && !portArg.includes('.');
        
        if (!isNaN(portNum) && isExactInteger && portNum >= 1 && portNum <= 65535) {
          options.port = portArg;
          console.log(`Using port from command line: ${portNum}`);
        } else {
          console.log(`Invalid port number: ${portArg}. Using default.`);
        }
      } catch (error) {
        console.log(`Invalid port number: ${portArg}. Using default.`);
      }
    }
    
    return options;
  }

  /**
   * Validate CLI options
   * @param options CLI options to validate
   */
  validateOptions(options: CliOptions): void {
    if (options.port) {
      const portNum = parseInt(options.port, 10);
      if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
        throw new Error(`Invalid port number: ${options.port}. Must be between 1 and 65535.`);
      }
    }
  }
}

/**
 * CLI application runner
 */
export class CliRunner {
  private parser: CliParser;

  constructor() {
    this.parser = new CliParser();
  }

  /**
   * Run the CLI application
   * @param argv Command line arguments
   */
  async run(argv: string[] = process.argv): Promise<void> {
    try {
      const options = this.parser.parseArguments(argv);
      this.parser.validateOptions(options);

      // Override environment variables with CLI options
      if (options.port) {
        process.env.PORT = options.port;
      }
      if (options.verbose) {
        process.env.VERBOSE = 'true';
      }
      if (options.debug) {
        process.env.DEBUG_MODE = 'true';
      }

      // Create logger first to show startup messages
      const logger = createLogger(config);
      
      logger.info('Starting Claude Code OpenAI Wrapper', {
        version: '1.0.0',
        options: {
          port: options.port || config.PORT,
          verbose: options.verbose || config.VERBOSE,
          debug: options.debug || config.DEBUG_MODE,
          interactive: options.interactive !== false
        }
      });

      // Interactive API key setup (matches Python main.py lines 859-861)
      // This MUST run BEFORE server start
      if (options.interactive !== false) {
        logger.info('Running interactive API key setup...');
        const runtimeApiKey = await promptForApiProtection();
        if (runtimeApiKey) {
          authManager.setApiKey(runtimeApiKey);
          logger.info('Runtime API key configured for server protection');
        }
      }

      // Start the server
      const result = await createAndStartServer(config);
      
      logger.info('🚀 Server is ready!', {
        url: result.url,
        port: result.port,
        endpoints: [
          `${result.url}/health`,
          `${result.url}/v1/chat/completions`,
          `${result.url}/v1/models`
        ]
      });

      // Setup graceful shutdown
      this.setupGracefulShutdown(result.server, logger);

    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * Setup graceful shutdown handlers
   * @param server HTTP server instance
   * @param logger Logger instance
   */
  private setupGracefulShutdown(server: any, logger: any): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);
      
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });

      // Force exit after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  /**
   * Handle CLI errors
   * @param error Error to handle
   */
  private handleError(error: Error): void {
    if (error instanceof EnvironmentError) {
      console.error(`❌ Configuration Error: ${error.message}`);
      console.error('Please check your environment variables and try again.');
    } else {
      console.error(`❌ Failed to start server: ${error.message}`);
    }
    
    process.exit(1);
  }
}

// Main execution
if (require.main === module) {
  const cli = new CliRunner();
  cli.run().catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}
