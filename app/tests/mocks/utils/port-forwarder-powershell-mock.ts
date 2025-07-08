/**
 * PowerShell Execution Mock for Port Forwarder Tests
 * Provides controlled PowerShell command execution simulation
 */

import { promisify } from 'util';

export interface PowerShellExecResult {
  stdout: string;
  stderr: string;
}

export interface PowerShellMockConfig {
  shouldFailExecution?: boolean;
  shouldRequireAdmin?: boolean;
  shouldTimeout?: boolean;
  executionDelay?: number;
  customStdout?: string;
  customStderr?: string;
}

export class PowerShellExecutionMockFactory {
  private static mockExecAsync: jest.MockedFunction<typeof promisify>;
  private static config: PowerShellMockConfig = {};

  static setup(config: PowerShellMockConfig = {}): jest.MockedFunction<typeof promisify> {
    this.config = { ...config };
    
    this.mockExecAsync = jest.fn().mockImplementation(async (command: string) => {
      if (this.config.shouldTimeout) {
        throw new Error('Command timed out');
      }

      if (this.config.executionDelay) {
        await new Promise(resolve => setTimeout(resolve, this.config.executionDelay));
      }

      if (this.config.shouldFailExecution) {
        throw new Error('PowerShell execution failed');
      }

      const result: PowerShellExecResult = {
        stdout: this.config.customStdout || '',
        stderr: this.config.customStderr || ''
      };

      if (this.config.shouldRequireAdmin) {
        result.stderr = 'Access is denied. Administrator privileges required.';
      }

      return result;
    });

    return this.mockExecAsync;
  }

  static reset(): void {
    this.config = {};
    if (this.mockExecAsync) {
      this.mockExecAsync.mockReset();
    }
  }

  static setExecutionResult(stdout: string, stderr: string = ''): void {
    this.config.customStdout = stdout;
    this.config.customStderr = stderr;
  }

  static setFailureMode(shouldFail: boolean): void {
    this.config.shouldFailExecution = shouldFail;
  }

  static setAdminRequirement(requireAdmin: boolean): void {
    this.config.shouldRequireAdmin = requireAdmin;
  }

  static setTimeoutMode(shouldTimeout: boolean): void {
    this.config.shouldTimeout = shouldTimeout;
  }

  static setExecutionDelay(delay: number): void {
    this.config.executionDelay = delay;
  }

  static getMockInstance(): jest.MockedFunction<typeof promisify> {
    return this.mockExecAsync;
  }

  static getCallHistory(): Array<{ command: string; options?: any }> {
    if (!this.mockExecAsync) return [];
    
    return this.mockExecAsync.mock.calls.map(call => ({
      command: call[0] as string,
      options: call[1]
    }));
  }

  static getLastCall(): { command: string; options?: any } | null {
    const history = this.getCallHistory();
    return history.length > 0 ? history[history.length - 1] : null;
  }

  static verifyCommandCalled(expectedCommand: string): boolean {
    const history = this.getCallHistory();
    return history.some(call => call.command.includes(expectedCommand));
  }

  static verifyNetshPortProxyAdd(port: number, wslIP: string): boolean {
    const expectedCommand = `netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=${port} connectaddress=${wslIP} connectport=${port}`;
    return this.verifyCommandCalled(expectedCommand);
  }

  static verifyNetshPortProxyDelete(port: number): boolean {
    const expectedCommand = `netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=${port}`;
    return this.verifyCommandCalled(expectedCommand);
  }

  static verifyPowerShellWrapper(command: string): boolean {
    const expectedWrapper = `powershell.exe -Command "${command}"`;
    return this.verifyCommandCalled(expectedWrapper);
  }
}