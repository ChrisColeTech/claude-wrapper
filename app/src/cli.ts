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
import { WSLHelper } from './utils/wsl-helper';


/**
 * CLI options interface
 */
export interface CliOptions {
  port?: string;
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
      .name('wrapper')
      .description(`${packageJson.description}\n\nAvailable commands: 'wrapper' (recommended) or 'claude-wrapper'`)
      .version(packageJson.version)
      .option('-p, --port <port>', 'port to run server on (default: 8000)')
      .option('-v, --version', 'output the version number')
      .option('-d, --debug', 'enable debug mode (runs in foreground)')
      .option('-k, --api-key <key>', 'set API key for endpoint protection')
      .option('-n, --no-interactive', 'disable interactive API key setup')
      .option('-P, --production', 'enable production server management features')
      .option('-H, --health-monitoring', 'enable health monitoring system')
      .option('-s, --stop', 'stop background server')
      .option('-t, --status', 'check background server status')
      .helpOption('-h, --help', 'display help for command')
      .argument('[port]', 'port to run server on (default: 8000) - alternative to --port option')
      .addHelpText('after', `
Examples:
  wrapper                    Start server on default port (8000)
  wrapper 9999              Start server on port 9999
  wrapper -p 8080           Start server on port 8080
  wrapper -v                Show version number
  wrapper -d                Start in debug mode
  wrapper -k my-key         Start with API key protection
  wrapper -n                Skip interactive API key setup
  wrapper -s                Stop background server
  wrapper -t                Check server status
  
Alternative command: You can also use 'claude-wrapper' instead of 'wrapper'`);
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
          ...(options.debug !== undefined && { debug: options.debug }),
          ...(options.interactive !== undefined && { interactive: options.interactive })
        });

        const wslInfo = WSLHelper.getWSLInfo();
        
        console.log(`🚀 Claude Wrapper server started in background (PID: ${pid})`);
        console.log(`\n📡 API Endpoints:`);
        console.log(`   POST   http://localhost:${port}/v1/chat/completions      - Main chat API`);
        console.log(`   GET    http://localhost:${port}/v1/models                - List available models`);
        console.log(`   GET    http://localhost:${port}/v1/sessions              - List active sessions`);
        console.log(`   GET    http://localhost:${port}/v1/sessions/stats        - Session statistics`);
        console.log(`   GET    http://localhost:${port}/v1/sessions/:id          - Get session details`);
        console.log(`   DELETE http://localhost:${port}/v1/sessions/:id          - Delete session`);
        console.log(`   POST   http://localhost:${port}/v1/sessions/:id/messages - Add to session`);
        console.log(`   GET    http://localhost:${port}/v1/auth/status            - Auth status`);
        console.log(`\n🔧 System Endpoints:`);
        console.log(`   GET    http://localhost:${port}/health                   - Health check`);
        console.log(`   GET    http://localhost:${port}/docs                     - Swagger UI`);
        console.log(`   GET    http://localhost:${port}/swagger.json             - OpenAPI spec`);
        console.log(`   GET    http://localhost:${port}/logs                     - Server logs`);
        console.log(`   POST   http://localhost:${port}/logs/clear               - Clear logs`);
        
        // WSL-specific information and port forwarding
        if (wslInfo.isWSL && wslInfo.wslIP) {
          console.log(`\n🌐 WSL Access (for Windows): http://${wslInfo.wslIP}:${port}`);
          
          try {
            // Generate and save port forwarding scripts
            const { batchFile, powershellFile } = WSLHelper.savePortForwardingScripts(parseInt(port), wslInfo.wslIP);
            
            // Convert WSL paths to Windows paths for display
            const windowsBatchPath = batchFile.replace(/^\/mnt\/c/, 'C:').replace(/\//g, '\\');
            const windowsPowershellPath = powershellFile.replace(/^\/mnt\/c/, 'C:').replace(/\//g, '\\');
            
            console.log(`\n🌉 WSL Port Forwarding Scripts:`);
            console.log(`   Batch Script:      ${windowsBatchPath}`);
            console.log(`   PowerShell Script: ${windowsPowershellPath}`);
            console.log(`\n💡 Open File Explorer, navigate to a script path, and run as Administrator`);
            console.log(`🔧 Or copy the path and run from Command Prompt/PowerShell as Administrator`);
          } catch (error) {
            logger.warn('Failed to generate WSL port forwarding scripts', error);
          }
        } else if (wslInfo.isWSL) {
          console.log(`\n⚠️  WSL detected but could not determine IP address`);
          console.log(`   Use: netsh interface portproxy add v4tov4 listenport=${port} listenaddress=0.0.0.0 connectport=${port} connectaddress=<WSL_IP>`);
        }
        
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
    if (options.debug) {
      process.env['DEBUG_MODE'] = 'true';
    }

    // Import and start server directly
    const app = await import('./api/server');
    const { signalHandler } = await import('./process/signals');
    
    const wslInfo = WSLHelper.getWSLInfo();
    
    console.log(`🚀 Claude Wrapper server starting in foreground (debug mode)`);
    console.log(`\n📡 API Endpoints:`);
    console.log(`   POST   http://localhost:${port}/v1/chat/completions      - Main chat API`);
    console.log(`   GET    http://localhost:${port}/v1/models                - List available models`);
    console.log(`   GET    http://localhost:${port}/v1/sessions              - List active sessions`);
    console.log(`   GET    http://localhost:${port}/v1/sessions/stats        - Session statistics`);
    console.log(`   GET    http://localhost:${port}/v1/sessions/:id          - Get session details`);
    console.log(`   DELETE http://localhost:${port}/v1/sessions/:id          - Delete session`);
    console.log(`   POST   http://localhost:${port}/v1/sessions/:id/messages - Add to session`);
    console.log(`   GET    http://localhost:${port}/v1/auth/status            - Auth status`);
    console.log(`\n🔧 System Endpoints:`);
    console.log(`   GET    http://localhost:${port}/health                   - Health check`);
    console.log(`   GET    http://localhost:${port}/docs                     - Swagger UI`);
    console.log(`   GET    http://localhost:${port}/swagger.json             - OpenAPI spec`);
    console.log(`   GET    http://localhost:${port}/logs                     - Server logs`);
    console.log(`   POST   http://localhost:${port}/logs/clear               - Clear logs`);
    
    // WSL-specific information and port forwarding
    if (wslInfo.isWSL && wslInfo.wslIP) {
      console.log(`\n🌐 WSL Access (for Windows): http://${wslInfo.wslIP}:${port}`);
      
      try {
        // Generate and save port forwarding scripts
        const { batchFile, powershellFile } = WSLHelper.savePortForwardingScripts(parseInt(port), wslInfo.wslIP);
        
        // Convert WSL paths to Windows paths for display
        const windowsBatchPath = batchFile.replace(/^\/mnt\/c/, 'C:').replace(/\//g, '\\');
        const windowsPowershellPath = powershellFile.replace(/^\/mnt\/c/, 'C:').replace(/\//g, '\\');
        
        console.log(`\n🌉 WSL Port Forwarding Scripts:`);
        console.log(`   Batch Script:      ${windowsBatchPath}`);
        console.log(`   PowerShell Script: ${windowsPowershellPath}`);
        console.log(`\n💡 Open File Explorer, navigate to a script path, and run as Administrator`);
        console.log(`🔧 Or copy the path and run from Command Prompt/PowerShell as Administrator`);
      } catch (error) {
        logger.warn('Failed to generate WSL port forwarding scripts', error);
      }
    } else if (wslInfo.isWSL) {
      console.log(`\n⚠️  WSL detected but could not determine IP address`);
      console.log(`   Use: netsh interface portproxy add v4tov4 listenport=${port} listenaddress=0.0.0.0 connectport=${port} connectaddress=<WSL_IP>`);
    }
    
    console.log(`\n🐛 Debug mode enabled - server will run in foreground`);
    console.log(`📝 Press Ctrl+C to stop the server`);

    const server = app.default.listen(parseInt(port), '0.0.0.0', () => {
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