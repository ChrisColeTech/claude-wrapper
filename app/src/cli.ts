#!/usr/bin/env node
/**
 * Claude Wrapper CLI Entry Point
 * Matches original claude-wrapper CLI pattern with options/flags
 * Single Responsibility: CLI argument parsing and application startup
 */

import { Command } from 'commander';
import { EnvironmentManager } from './config/env';
import { logger } from './utils/logger';
import { interactiveSetup } from './cli/interactive';
import * as packageJson from '../package.json';
import { processManager } from './process/manager';


/**
 * CLI options interface
 */
export interface CliOptions {
  port?: string;
  verbose?: boolean;
  debug?: boolean;
  interactive?: boolean;
  apiKey?: string;
  stop?: boolean;
  status?: boolean;
  production?: boolean;
  healthMonitoring?: boolean;
}

/**
 * CLI argument parser following original pattern
 */
class CliParser {
  private program: Command;

  constructor() {
    this.program = new Command();
    this.setupProgram();
  }

  /**
   * Setup CLI program with options (not subcommands) like original
   */
  private setupProgram(): void {
    this.program
      .name(packageJson.name)
      .description(packageJson.description)
      .version(packageJson.version)
      .option('-p, --port <port>', 'port to run server on (default: 8000)')
      .option('-v, --verbose', 'enable verbose logging')
      .option('-d, --debug', 'enable debug mode (runs in foreground)')
      .option('-k, --api-key <key>', 'set API key for endpoint protection')
      .option('-n, --no-interactive', 'disable interactive API key setup')
      .option('-P, --production', 'enable production server management features')
      .option('-H, --health-monitoring', 'enable health monitoring system')
      .option('-s, --stop', 'stop background server')
      .option('-t, --status', 'check background server status')
      .helpOption('-h, --help', 'display help for command')
      .argument('[port]', 'port to run server on (default: 8000) - alternative to --port option');
  }

  /**
   * Parse command line arguments
   */
  parseArguments(argv: string[]): CliOptions {
    this.program.parse(argv);
    const options = this.program.opts() as CliOptions;
    const args = this.program.args;
    
    return this.processOptions(options, args);
  }

  /**
   * Process parsed options and arguments
   */
  private processOptions(options: CliOptions, args: string[]): CliOptions {
    // Handle port from --port option or positional argument
    let portToUse = options.port;
    
    if (!portToUse && args.length > 0) {
      const portArg = args[0]!;
      const portNum = parseInt(portArg, 10);
      
      if (!isNaN(portNum) && portNum >= 1 && portNum <= 65535) {
        portToUse = portArg;
        logger.info(`Using port from command line: ${portNum}`);
      } else {
        logger.warn(`Invalid port number: ${portArg}. Using default.`);
      }
    }
    
    if (portToUse) {
      options.port = portToUse;
    }
    
    return options;
  }
}

/**
 * CLI application runner following original daemon pattern
 */
class CliRunner {
  private parser: CliParser;

  constructor() {
    this.parser = new CliParser();
  }

  /**
   * Run the CLI application
   */
  async run(argv: string[] = process.argv): Promise<void> {
    try {
      const options = this.parser.parseArguments(argv);


      // Handle daemon commands first (like original)
      if (options.stop) {
        await this.stopDaemon();
        process.exit(0);
        return;
      }

      if (options.status) {
        await this.checkDaemonStatus();
        process.exit(0);
        return;
      }

      // Default behavior: start server (like original)
      await this.startServer(options);

    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * Start server with options
   */
  private async startServer(options: CliOptions): Promise<void> {
    const port = options.port || EnvironmentManager.getConfig().port.toString();

    // Interactive setup if enabled (like original)
    if (options.interactive !== false && !options.apiKey) {
      try {
        await interactiveSetup();
      } catch (error) {
        logger.warn('Interactive setup skipped:', error);
      }
    }


    try {
      // Run in foreground if debug mode is enabled
      if (options.debug) {
        await this.startForegroundServer(options, port);
      } else {
        const pid = await processManager.start({
          port,
          ...(options.apiKey && { apiKey: options.apiKey }),
          ...(options.verbose !== undefined && { verbose: options.verbose }),
          ...(options.debug !== undefined && { debug: options.debug }),
          ...(options.interactive !== undefined && { interactive: options.interactive })
        });

        console.log(`🚀 Claude Wrapper server started in background (PID: ${pid})`);
        console.log(`📡 API available at http://localhost:${port}/v1/chat/completions`);
        console.log(`📊 Health check at http://localhost:${port}/health`);
        console.log(`📚 Swagger UI at http://localhost:${port}/docs`);
        console.log(`📋 OpenAPI spec at http://localhost:${port}/swagger.json`);
        
        process.exit(0);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('already running')) {
        console.log(`⚠️  ${error.message}`);
        process.exit(0);
      }
      throw error;
    }
  }

  /**
   * Start server in foreground (for debug mode)
   */
  private async startForegroundServer(options: CliOptions, port: string): Promise<void> {
    // Set environment variables
    if (options.apiKey) {
      process.env['API_KEY'] = options.apiKey;
    }
    if (options.verbose) {
      process.env['VERBOSE'] = 'true';
    }
    if (options.debug) {
      process.env['DEBUG_MODE'] = 'true';
    }

    // Import and start server directly
    const app = await import('./api/server');
    const { signalHandler } = await import('./process/signals');
    
    console.log(`🚀 Claude Wrapper server starting in foreground (debug mode)`);
    console.log(`📡 API available at http://localhost:${port}/v1/chat/completions`);
    console.log(`📊 Health check at http://localhost:${port}/health`);
    console.log(`📚 Swagger UI at http://localhost:${port}/docs`);
    console.log(`📋 OpenAPI spec at http://localhost:${port}/swagger.json`);
    console.log(`🐛 Debug mode enabled - server will run in foreground`);
    console.log(`📝 Press Ctrl+C to stop the server`);

    const server = app.default.listen(parseInt(port), () => {
      console.log(`✅ Server listening on port ${port}`);
    });

    // Setup graceful shutdown
    signalHandler.setupGracefulShutdown(server);
    
    // Keep the process alive (don't exit)
    return new Promise(() => {
      // This promise never resolves, keeping the process running
    });
  }

  /**
   * Stop daemon server
   */
  private async stopDaemon(): Promise<void> {
    try {
      const stopped = await processManager.stop();
      if (stopped) {
        console.log(`✅ Server stopped successfully`);
      } else {
        console.log('❌ No background server found');
      }
    } catch (error) {
      console.log(`❌ Failed to stop server: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Check daemon status
   */
  private async checkDaemonStatus(): Promise<void> {
    try {
      const status = await processManager.status();
      
      if (status.running) {
        console.log('📊 Server Status: RUNNING');
        console.log(`   PID: ${status.pid}`);
        
        if (status.health) {
          const healthIcon = status.health === 'healthy' ? '✅' : 
                            status.health === 'unhealthy' ? '❌' : '❓';
          console.log(`   Health: ${healthIcon} ${status.health.toUpperCase()}`);
        }
      } else {
        console.log('📊 Server Status: NOT RUNNING');
      }
    } catch (error) {
      console.log(`❌ Failed to check status: ${error instanceof Error ? error.message : error}`);
    }
  }


  /**
   * Handle CLI errors
   */
  private handleError(error: Error): void {
    console.log('\n💥 Startup Failed!');
    console.log('==================================================');
    console.error(`❌ Failed to start server: ${error.message}`);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Check if port is already in use');
    console.error('   2. Verify Claude Code CLI is installed');
    console.error('   3. Try running with --debug for more details');
    console.log('==================================================\n');
    
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

export { CliParser, CliRunner };