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
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

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
  start?: boolean;
  stop?: boolean;
  status?: boolean;
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
      .option('-p, --port <port>', 'port to run server on (default: 8000)')
      .option('-v, --verbose', 'enable verbose logging')
      .option('-d, --debug', 'enable debug mode')
      .option('--no-interactive', 'disable interactive API key setup')
      .option('--start', 'start server in background (daemon mode)')
      .option('--stop', 'stop background server')
      .option('--status', 'check background server status')
      .helpOption('-h, --help', 'display help for command')
      .argument('[port]', 'port to run server on (default: 8000) - alternative to --port option');
  }

  /**
   * Parse command line arguments (matches Python sys.argv behavior)
   * @param argv Command line arguments
   * @returns Parsed CLI options
   */
  parseArguments(argv: string[]): CliOptions {
    try {
      this.program.parse(argv);
    } catch (error) {
      // Handle the case where a negative number is passed as a positional argument
      // Commander.js interprets -1, -2, etc. as options, but we want them as positional args
      if (error instanceof Error && error.message && error.message.includes('unknown option')) {
        const match = error.message.match(/unknown option '(-\d+)'/);
        if (match) {
          const negativeArg = match[1];
          // Re-parse with the negative number treated as a positional argument
          const filteredArgv = argv.filter(arg => arg !== negativeArg);
          this.program.parse(filteredArgv);
          const options = this.program.opts() as CliOptions;
          const args = [negativeArg]; // Treat the negative number as a positional arg
          return this.processOptions(options, args);
        }
      }
      throw error;
    }
    
    const options = this.program.opts() as CliOptions;
    const args = this.program.args;
    return this.processOptions(options, args);
  }

  /**
   * Process parsed options and arguments
   * @param options Parsed options
   * @param args Parsed arguments
   * @returns Processed CLI options
   */
  private processOptions(options: CliOptions, args: string[]): CliOptions {
    // Handle port from --port option or positional argument
    // Priority: --port option takes precedence over positional argument
    let portToUse = options.port;
    
    if (!portToUse && args.length > 0) {
      const portArg = args[0];
      try {
        // Python int() is stricter than parseInt - must be exact integer string
        const portNum = parseInt(portArg, 10);
        const isExactInteger = portArg === portNum.toString() && !portArg.includes('.');
        
        if (!isNaN(portNum) && isExactInteger && portNum >= 1 && portNum <= 65535) {
          portToUse = portArg;
          console.log(`Using port from command line: ${portNum}`);
        } else {
          console.log(`Invalid port number: ${portArg}. Using default.`);
        }
      } catch (error) {
        console.log(`Invalid port number: ${portArg}. Using default.`);
      }
    }
    
    if (portToUse) {
      options.port = portToUse;
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

      // Handle daemon commands first
      if (options.stop) {
        await this.stopDaemon();
        process.exit(0);
      }

      if (options.status) {
        await this.checkDaemonStatus();
        process.exit(0);
      }

      if (options.start) {
        await this.startDaemon(options);
        process.exit(0);
      }

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

      // Reload config after setting environment variables
      const { loadEnvironmentConfig } = await import('./utils/env');
      const updatedConfig = loadEnvironmentConfig();

      // Create logger with updated config
      const logger = createLogger(updatedConfig);
      
      // Show startup banner
      console.log('\n🚀 Claude Code OpenAI Wrapper v1.0.0');
      console.log('==================================================');
      console.log('Starting server...');
      console.log(`Port: ${updatedConfig.PORT}`);
      console.log(`Debug: ${updatedConfig.DEBUG_MODE ? 'enabled' : 'disabled'}`);
      console.log(`Verbose: ${updatedConfig.VERBOSE ? 'enabled' : 'disabled'}`);
      console.log('==================================================\n');
      
      logger.info('Starting Claude Code OpenAI Wrapper', {
        version: '1.0.0',
        options: {
          port: updatedConfig.PORT,
          verbose: updatedConfig.VERBOSE,
          debug: updatedConfig.DEBUG_MODE,
          interactive: options.interactive !== false
        }
      });

      // Interactive API key setup (matches Python main.py lines 859-861)
      // This MUST run BEFORE server start
      if (options.interactive !== false) {
        logger.debug('Running interactive API key setup...');
        const runtimeApiKey = await promptForApiProtection();
        if (runtimeApiKey) {
          authManager.setApiKey(runtimeApiKey);
          logger.info('Runtime API key configured for server protection');
        }
      }

      // Start the server with progress indicators
      console.log('🔧 Initializing authentication providers...');
      const result = await createAndStartServer(updatedConfig);
      
      console.log('\n🎉 Server is ready and running!');
      console.log('==================================================');
      console.log(`🌐 Server URL: ${result.url}`);
      console.log(`📡 Port: ${result.port}`);
      console.log('\n📋 Available endpoints:');
      console.log(`   Health:          ${result.url}/health`);
      console.log(`   Chat:            ${result.url}/v1/chat/completions`);
      console.log(`   Models:          ${result.url}/v1/models`);
      console.log(`   Sessions:        ${result.url}/v1/sessions`);
      console.log(`   Auth Status:     ${result.url}/v1/auth/status`);
      console.log('\n💡 Test with:');
      console.log(`   curl ${result.url}/health`);
      console.log('==================================================\n');
      
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
    console.log('\n💥 Startup Failed!');
    console.log('==================================================');
    
    if (error instanceof EnvironmentError) {
      console.error(`❌ Configuration Error: ${error.message}`);
      console.error('\n🔧 Troubleshooting:');
      console.error('   1. Check your environment variables');
      console.error('   2. Verify .env file configuration');
      console.error('   3. Ensure all required dependencies are installed');
    } else {
      console.error(`❌ Failed to start server: ${error.message}`);
      console.error('\n🔧 Troubleshooting:');
      console.error('   1. Check if port is already in use');
      console.error('   2. Verify Claude Code CLI is installed (claude --version)');
      console.error('   3. Check authentication setup');
      console.error('   4. Try running with --debug for more details');
    }
    
    console.log('==================================================\n');
    process.exit(1);
  }

  /**
   * Get PID file path
   */
  private getPidFile(): string {
    return path.join(os.tmpdir(), 'claude-wrapper.pid');
  }

  /**
   * Get log file path
   */
  private getLogFile(): string {
    return path.join(os.tmpdir(), 'claude-wrapper.log');
  }

  /**
   * Start server in daemon mode
   */
  private async startDaemon(options: CliOptions): Promise<void> {
    const pidFile = this.getPidFile();
    const logFile = this.getLogFile();

    // Check if already running
    if (fs.existsSync(pidFile)) {
      const pid = fs.readFileSync(pidFile, 'utf8').trim();
      try {
        process.kill(parseInt(pid), 0); // Check if process exists
        console.log('❌ Server is already running (PID: ' + pid + ')');
        console.log('   Use --stop to stop it first, or --status to check');
        return;
      } catch {
        // Process doesn't exist, remove stale PID file
        fs.unlinkSync(pidFile);
      }
    }

    console.log('🚀 Starting claude-wrapper in background...');
    
    const port = options.port || '8000';
    const args = [port, '--no-interactive'];
    if (options.verbose) args.push('--verbose');
    if (options.debug) args.push('--debug');

    // Spawn detached process using node directly to avoid recursion
    const { spawn } = require('child_process');
    const nodePath = process.execPath;
    const scriptPath = path.join(__dirname, 'index.js'); // Use absolute path to index.js
    
    const child = spawn(nodePath, [scriptPath], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PORT: port,
        VERBOSE: options.verbose ? 'true' : undefined,
        DEBUG_MODE: options.debug ? 'true' : undefined
      }
    });

    // Write PID file
    fs.writeFileSync(pidFile, child.pid.toString());

    // Setup logging
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });
    child.stdout.pipe(logStream);
    child.stderr.pipe(logStream);

    child.unref(); // Allow parent to exit

    console.log(`✅ Server started in background`);
    console.log(`   PID: ${child.pid}`);
    console.log(`   Port: ${port}`);
    console.log(`   Logs: ${logFile}`);
    console.log(`   Stop: claude-wrapper --stop`);
  }

  /**
   * Stop daemon server
   */
  private async stopDaemon(): Promise<void> {
    const pidFile = this.getPidFile();
    
    if (!fs.existsSync(pidFile)) {
      console.log('❌ No background server found');
      return;
    }

    const pid = fs.readFileSync(pidFile, 'utf8').trim();
    
    try {
      process.kill(parseInt(pid), 'SIGTERM');
      fs.unlinkSync(pidFile);
      console.log(`✅ Server stopped (PID: ${pid})`);
    } catch (error) {
      console.log(`❌ Failed to stop server: ${error}`);
      fs.unlinkSync(pidFile); // Remove stale PID file
    }
  }

  /**
   * Check daemon status
   */
  private async checkDaemonStatus(): Promise<void> {
    const pidFile = this.getPidFile();
    const logFile = this.getLogFile();
    
    if (!fs.existsSync(pidFile)) {
      console.log('📊 Server Status: NOT RUNNING');
      return;
    }

    const pid = fs.readFileSync(pidFile, 'utf8').trim();
    
    try {
      process.kill(parseInt(pid), 0); // Check if process exists
      console.log('📊 Server Status: RUNNING');
      console.log(`   PID: ${pid}`);
      console.log(`   Logs: ${logFile}`);
      
      // Try to get port from curl
      try {
        const { stdout } = await execAsync('curl -s http://localhost:8000/health');
        if (stdout.includes('healthy')) {
          console.log('   Health: ✅ OK (port 8000)');
        }
      } catch {
        console.log('   Health: ❓ Could not connect to port 8000');
      }
      
    } catch {
      console.log('📊 Server Status: NOT RUNNING (stale PID file)');
      fs.unlinkSync(pidFile);
    }
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
