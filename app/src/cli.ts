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
import { createSecurityConfigManager } from './auth/security-config';
import { ProductionServerManager } from './server/production-server-manager';
import { healthMonitor, startHealthMonitoring } from './monitoring/health-monitor';
import { createApp } from './server';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

/**
 * Test-safe process exit
 */
function safeExit(code: number): void {
  if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
    process.exit(code);
  }
  // In test mode, don't exit - let the test continue
}

/**
 * CLI options interface
 */
export interface CliOptions {
  port?: string;
  verbose?: boolean;
  debug?: boolean;
  interactive?: boolean;
  apiKey?: string;
  help?: boolean;
  version?: boolean;
  stop?: boolean;
  status?: boolean;
  production?: boolean;
  healthMonitoring?: boolean;
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
      .option('--api-key <key>', 'set API key for endpoint protection')
      .option('--no-interactive', 'disable interactive API key setup')
      .option('--production', 'enable production server management with enhanced features')
      .option('--health-monitoring', 'enable health monitoring system')
      .option('--stop', 'stop background server')
      .option('--status', 'check background server status')
      .helpOption('-h, --help', 'display help for command')
      .argument('[port]', 'port to run server on (default: 8000) - alternative to --port option');

    // Only use exitOverride in test environment to prevent process.exit
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
      this.program.exitOverride();
    }
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
        // Extract negative number from error message
        const negativeNumMatch = error.message.match(/unknown option '(-\d+)'/);
        if (negativeNumMatch) {
          const negativeArg = negativeNumMatch[1];
          console.log(`Invalid port number: ${negativeArg}. Using default.`);
          
          // Return options with no port set (will use default)
          return {
            port: undefined,
            verbose: false,
            debug: false,
            interactive: true,
            production: false,
            healthMonitoring: false
          };
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

    if (options.apiKey) {
      // Basic API key validation
      if (typeof options.apiKey !== 'string' || options.apiKey.trim().length < 8) {
        throw new Error('API key must be at least 8 characters long.');
      }
      if (options.apiKey.length > 256) {
        throw new Error('API key must be at most 256 characters long.');
      }
    }
  }
}

/**
 * CLI application runner
 */
export class CliRunner {
  private parser: CliParser;
  private productionServerManager: ProductionServerManager | null = null;

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
        safeExit(0);
        return;
      }

      if (options.status) {
        await this.checkDaemonStatus();
        safeExit(0);
        return;
      }

      // Default behavior: start daemon
      await this.startDaemon(options);
      safeExit(0);
      return;

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
    // Skip signal handlers in test environment to prevent memory leaks
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
      return;
    }

    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);
      
      server.close(() => {
        logger.info('HTTP server closed');
        safeExit(0);
      });

      // Force exit after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        safeExit(1);
      }, 10000);
    };

    // Skip signal handlers in test environment to prevent memory leaks
    if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));
    }
  }

  /**
   * Setup graceful shutdown handlers for production server
   * @param logger Logger instance
   */
  private setupProductionGracefulShutdown(logger: any): void {
    // Skip signal handlers in test environment to prevent memory leaks
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
      return;
    }

    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting production server graceful shutdown...`);
      
      try {
        if (this.productionServerManager) {
          const shutdownResult = await this.productionServerManager.shutdown();
          if (shutdownResult.success) {
            logger.info('Production server shutdown completed successfully', {
              shutdownTime: shutdownResult.shutdownTime,
              resourcesReleased: shutdownResult.resourcesReleased
            });
          } else {
            logger.error('Production server shutdown failed', {
              errors: shutdownResult.errors
            });
          }
        }

        // Stop health monitoring if it was started
        if (healthMonitor) {
          healthMonitor.shutdown();
          logger.info('Health monitoring stopped');
        }

        logger.info('All systems shutdown complete');
        safeExit(0);
      } catch (error) {
        logger.error('Error during production shutdown:', error);
        safeExit(1);
      }
    };

    // Skip signal handlers in test environment to prevent memory leaks
    if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));
      process.on('SIGUSR2', () => shutdown('SIGUSR2'));
    }
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
    
    safeExit(1);
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

    // Use nohup approach that we know works
    const { exec } = require('child_process');
    
    const envVars = [
      `PORT=${port}`,
      ...(options.verbose ? ['VERBOSE=true'] : []),
      ...(options.debug ? ['DEBUG_MODE=true'] : []),
      ...(options.production ? ['NODE_ENV=production'] : []),
      'CLAUDE_WRAPPER_DAEMON=true'
    ].join(' ');
    
    const serverScript = path.join(__dirname, 'index.js');
    const command = `${envVars} nohup node ${serverScript} > ${logFile} 2>&1 & echo $!`;
    
    const childPid = await new Promise<string>((resolve, reject) => {
      exec(command, (error: any, stdout: any, stderr: any) => {
        if (error) {
          reject(error);
          return;
        }
        const pid = stdout.trim();
        resolve(pid);
      });
    });

    // Write PID file
    fs.writeFileSync(pidFile, childPid);

    // Give the process a moment to start
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log(`✅ Server started in background`);
    console.log(`   PID: ${childPid}`);
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
      
      // Try to detect port and test health
      for (const port of [8000, 8001, 8002, 8003, 8004, 8005, 8006, 8007, 8008]) {
        try {
          const { stdout } = await execAsync(`curl -s --connect-timeout 1 http://localhost:${port}/health`);
          if (stdout.includes('healthy')) {
            console.log(`   Health: ✅ OK (port ${port})`);
            break;
          }
        } catch {
          // Continue checking other ports
        }
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
    safeExit(1);
  });
}
