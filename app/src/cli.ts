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
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as packageJson from '../package.json';

const execAsync = promisify(exec);

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
      .option('-d, --debug', 'enable debug mode')
      .option('--api-key <key>', 'set API key for endpoint protection')
      .option('--no-interactive', 'disable interactive API key setup')
      .option('--production', 'enable production server management features')
      .option('--health-monitoring', 'enable health monitoring system')
      .option('--stop', 'stop background server')
      .option('--status', 'check background server status')
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
    const port = options.port || EnvironmentManager.getConfig().port.toString() || '8000';

    // Check if already running
    if (this.isServerRunning()) {
      console.log(`⚠️  Server already running on port ${port}`);
      process.exit(0);
      return;
    }

    // Interactive setup if enabled (like original)
    if (options.interactive !== false && !options.apiKey) {
      try {
        await interactiveSetup();
      } catch (error) {
        logger.warn('Interactive setup skipped:', error);
      }
    }

    // Spawn detached background server process
    const serverScript = path.join(__dirname, 'server-daemon.js');
    const args = ['--port', port];
    
    if (options.apiKey) {
      args.push('--api-key', options.apiKey);
    }
    if (options.verbose) {
      args.push('--verbose');
    }
    if (options.debug) {
      args.push('--debug');
    }

    const child = spawn(process.execPath, [serverScript, ...args], {
      detached: true,
      stdio: 'ignore'
    });

    // Save PID for daemon management
    this.savePid(child.pid!);
    
    child.unref(); // Allow parent to exit
    
    console.log(`🚀 Claude Wrapper server started in background (PID: ${child.pid})`);
    console.log(`📡 API available at http://localhost:${port}/v1/chat/completions`);
    console.log(`📊 Health check at http://localhost:${port}/health`);
    
    process.exit(0); // Exit CLI immediately
  }

  /**
   * Check if server is already running
   */
  private isServerRunning(): boolean {
    const pidFile = this.getPidFile();
    
    if (!fs.existsSync(pidFile)) {
      return false;
    }

    try {
      const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim());
      process.kill(pid, 0); // Check if process exists
      return true;
    } catch {
      // Process doesn't exist, clean up stale PID file
      try {
        fs.unlinkSync(pidFile);
      } catch (error) {
        // Ignore cleanup errors
      }
      return false;
    }
  }


  /**
   * Get PID file path
   */
  private getPidFile(): string {
    return path.join(os.tmpdir(), 'claude-wrapper.pid');
  }

  /**
   * Save process PID
   */
  private savePid(pid: number): void {
    try {
      fs.writeFileSync(this.getPidFile(), pid.toString());
    } catch (error) {
      logger.warn('Failed to save PID file:', error);
    }
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
      if (fs.existsSync(pidFile)) {
        fs.unlinkSync(pidFile); // Remove stale PID file
      }
    }
  }

  /**
   * Check daemon status
   */
  private async checkDaemonStatus(): Promise<void> {
    const pidFile = this.getPidFile();
    
    if (!fs.existsSync(pidFile)) {
      console.log('📊 Server Status: NOT RUNNING');
      return;
    }

    const pid = fs.readFileSync(pidFile, 'utf8').trim();
    
    try {
      process.kill(parseInt(pid), 0); // Check if process exists
      console.log('📊 Server Status: RUNNING');
      console.log(`   PID: ${pid}`);
      
      // Try to test health endpoint
      try {
        const { stdout } = await execAsync('curl -s --connect-timeout 1 http://localhost:8000/health');
        if (stdout.includes('healthy')) {
          console.log('   Health: ✅ OK');
        }
      } catch {
        console.log('   Health: ❓ Unknown');
      }
      
    } catch {
      console.log('📊 Server Status: NOT RUNNING (stale PID file)');
      fs.unlinkSync(pidFile);
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