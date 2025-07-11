/**
 * WSL Helper Utilities
 * Handles WSL detection and Windows port forwarding script generation
 */

import { execSync } from 'child_process';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { logger } from './logger';

export interface WSLInfo {
  isWSL: boolean;
  wslIP?: string;
  windowsHost?: string;
}

export class WSLHelper {
  /**
   * Detect if running in WSL environment
   */
  static isWSL(): boolean {
    try {
      // Check for WSL-specific environment variables
      if (process.env['WSL_DISTRO_NAME'] || process.env['WSL_INTEROP']) {
        return true;
      }
      
      // Check /proc/version for WSL signature
      if (existsSync('/proc/version')) {
        const version = execSync('cat /proc/version', { encoding: 'utf8' });
        return version.toLowerCase().includes('microsoft') || version.toLowerCase().includes('wsl');
      }
      
      return false;
    } catch (error) {
      logger.debug('WSL detection failed', error);
      return false;
    }
  }

  /**
   * Get WSL IP address
   */
  static getWSLIP(): string | null {
    try {
      // Try multiple methods to get WSL IP
      const methods = [
        // Method 1: hostname -I (most reliable)
        () => execSync('hostname -I', { encoding: 'utf8' }).trim().split(' ')[0],
        
        // Method 2: ip route
        () => {
          const route = execSync('ip route show default', { encoding: 'utf8' });
          const match = route.match(/via (\d+\.\d+\.\d+\.\d+)/);
          if (match) {
            // Get the interface IP, not the gateway
            const iface = execSync('ip route get 1.1.1.1', { encoding: 'utf8' });
            const ipMatch = iface.match(/src (\d+\.\d+\.\d+\.\d+)/);
            return ipMatch ? ipMatch[1] : null;
          }
          return null;
        },
        
        // Method 3: Parse /etc/resolv.conf
        () => {
          const resolv = execSync('cat /etc/resolv.conf', { encoding: 'utf8' });
          const match = resolv.match(/nameserver (\d+\.\d+\.\d+\.\d+)/);
          if (match && match[1]) {
            // WSL IP is usually gateway IP with .1 changed to .2 (or similar)
            const gateway = match[1];
            const parts = gateway.split('.');
            parts[3] = (parseInt(parts[3] || '0') + 1).toString();
            return parts.join('.');
          }
          return null;
        }
      ];

      for (const method of methods) {
        try {
          const ip = method();
          if (ip && this.isValidIP(ip)) {
            logger.debug('WSL IP detected', { ip, method: method.name });
            return ip;
          }
        } catch (error) {
          logger.debug('WSL IP method failed', { method: method.name, error });
        }
      }

      return null;
    } catch (error) {
      logger.debug('WSL IP detection failed', error);
      return null;
    }
  }

  /**
   * Validate IP address format
   */
  private static isValidIP(ip: string): boolean {
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    
    return parts.every(part => {
      const num = parseInt(part);
      return num >= 0 && num <= 255 && part === num.toString();
    });
  }

  /**
   * Get WSL information
   */
  static getWSLInfo(): WSLInfo {
    const isWSL = this.isWSL();
    
    if (!isWSL) {
      return { isWSL: false };
    }

    const wslIP = this.getWSLIP();
    return {
      isWSL: true,
      wslIP: wslIP || undefined,
      windowsHost: 'localhost' // Windows host from WSL perspective
    } as WSLInfo;
  }

  /**
   * Generate Windows port forwarding script
   */
  static generatePortForwardingScript(port: number, wslIP: string): {
    batchScript: string;
    powershellScript: string;
    scriptPath: string;
  } {
    const batchScript = `@echo off
REM Claude Wrapper WSL Port Forwarding Script
REM Generated automatically for port ${port}

echo Setting up port forwarding for Claude Wrapper...
echo Port: ${port}
echo WSL IP: ${wslIP}
echo.

REM Remove existing port forwarding (if any)
netsh interface portproxy delete v4tov4 listenport=${port} >nul 2>&1

REM Add new port forwarding
netsh interface portproxy add v4tov4 listenport=${port} listenaddress=0.0.0.0 connectport=${port} connectaddress=${wslIP}

if %errorlevel% neq 0 (
    echo ERROR: Failed to set up port forwarding. Please run as Administrator.
    echo.
    echo Right-click on Command Prompt and select "Run as administrator"
    echo Then run this script again.
    pause
    exit /b 1
)

echo SUCCESS: Port forwarding configured!
echo.
echo Your Claude Wrapper server is now accessible from Windows at:
echo   http://localhost:${port}
echo   http://127.0.0.1:${port}
echo.
echo To remove port forwarding later, run:
echo   netsh interface portproxy delete v4tov4 listenport=${port}
echo.
pause`;

    const powershellScript = `# Claude Wrapper WSL Port Forwarding Script
# Generated automatically for port ${port}

Write-Host "Setting up port forwarding for Claude Wrapper..." -ForegroundColor Green
Write-Host "Port: ${port}" -ForegroundColor Cyan
Write-Host "WSL IP: ${wslIP}" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click on PowerShell and select 'Run as administrator'" -ForegroundColor Yellow
    Write-Host "Then run this script again." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

try {
    # Remove existing port forwarding (if any)
    netsh interface portproxy delete v4tov4 listenport=${port} 2>$null
    
    # Add new port forwarding
    netsh interface portproxy add v4tov4 listenport=${port} listenaddress=0.0.0.0 connectport=${port} connectaddress=${wslIP}
    
    Write-Host "SUCCESS: Port forwarding configured!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your Claude Wrapper server is now accessible from Windows at:" -ForegroundColor Yellow
    Write-Host "  http://localhost:${port}" -ForegroundColor Cyan
    Write-Host "  http://127.0.0.1:${port}" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To remove port forwarding later, run:" -ForegroundColor Yellow
    Write-Host "  netsh interface portproxy delete v4tov4 listenport=${port}" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "ERROR: Failed to set up port forwarding: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Read-Host "Press Enter to continue"`;

    // Try to find Windows filesystem path
    let scriptPath = '/tmp';
    try {
      // Common Windows paths accessible from WSL
      const windowsPaths = [
        '/mnt/c/temp',
        '/mnt/c/tmp', 
        '/mnt/c/Users/Public',
        '/mnt/c/Windows/temp'
      ];
      
      for (const path of windowsPaths) {
        if (existsSync(path)) {
          scriptPath = path;
          break;
        }
      }
    } catch (error) {
      logger.debug('Windows path detection failed', error);
    }

    return {
      batchScript,
      powershellScript,
      scriptPath
    };
  }


  /**
   * Get script storage path
   */
  private static getScriptStoragePath(): string {
    // Use mounted C: drive for easier access
    const scriptPath = '/mnt/c/claude-wrapper';
    
    // Check if we can access the mounted C: drive
    try {
      if (existsSync('/mnt/c')) {
        return scriptPath;
      }
    } catch (error) {
      logger.debug('Mounted C: drive not accessible', error);
    }
    
    // Fallback to temp directory
    return '/tmp/claude-wrapper';
  }

  /**
   * Save port forwarding scripts to disk
   */
  static savePortForwardingScripts(port: number, wslIP: string): {
    batchFile: string;
    powershellFile: string;
    instructions: string;
  } {
    const { batchScript, powershellScript } = this.generatePortForwardingScript(port, wslIP);
    const scriptPath = this.getScriptStoragePath();
    
    try {
      // Ensure directory exists
      if (!existsSync(scriptPath)) {
        mkdirSync(scriptPath, { recursive: true });
      }

      const batchFile = join(scriptPath, `claude-wrapper-port-${port}.bat`);
      const powershellFile = join(scriptPath, `claude-wrapper-port-${port}.ps1`);

      writeFileSync(batchFile, batchScript);
      writeFileSync(powershellFile, powershellScript);

      logger.info('Port forwarding scripts generated', { 
        port, 
        wslIP, 
        batchFile, 
        powershellFile 
      });

      // Convert WSL path to Windows path for clickable links
      const windowsBatchPath = batchFile.replace(/^\/mnt\/c/, 'C:').replace(/\//g, '\\');
      const windowsPowershellPath = powershellFile.replace(/^\/mnt\/c/, 'C:').replace(/\//g, '\\');

      const instructions = `
🌉 WSL Port Forwarding Setup Required

To access your Claude Wrapper server from Windows, you need to set up port forwarding.

📁 Scripts have been saved to:
   Batch Script:      ${windowsBatchPath}
   PowerShell Script: ${windowsPowershellPath}

🚀 To set up port forwarding:
   1. Open File Explorer and navigate to one of the paths above
   2. Right-click the script and select "Run as administrator"
   3. Or copy the path and run from Command Prompt/PowerShell as Administrator
   
🔧 Manual Setup (if scripts don't work):
   netsh interface portproxy add v4tov4 listenport=${port} listenaddress=0.0.0.0 connectport=${port} connectaddress=${wslIP}

📡 After setup, access your server at:
   http://localhost:${port}
`;

      return {
        batchFile,
        powershellFile,
        instructions
      };
    } catch (error) {
      logger.error('Failed to save port forwarding scripts', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Display WSL port forwarding information
   */
  static displayPortForwardingInfo(port: number): void {
    const wslInfo = this.getWSLInfo();
    
    if (!wslInfo.isWSL) {
      return; // Not in WSL, no need for port forwarding
    }

    if (!wslInfo.wslIP) {
      logger.warn('WSL detected but could not determine IP address');
      console.log(`
⚠️  WSL Environment Detected

Could not automatically determine WSL IP address.
To access your server from Windows, you may need to set up port forwarding manually:

netsh interface portproxy add v4tov4 listenport=${port} listenaddress=0.0.0.0 connectport=${port} connectaddress=<WSL_IP>

Find your WSL IP with: hostname -I
`);
      return;
    }

    try {
      const { instructions } = this.savePortForwardingScripts(port, wslInfo.wslIP);
      console.log(instructions);
    } catch (error) {
      logger.error('Failed to generate port forwarding scripts', error instanceof Error ? error : new Error(String(error)));
      console.log(`
⚠️  WSL Port Forwarding Required

Manual setup required:
netsh interface portproxy add v4tov4 listenport=${port} listenaddress=0.0.0.0 connectport=${port} connectaddress=${wslInfo.wslIP}

Run the above command in Windows Command Prompt (as Administrator)
`);
    }
  }
}