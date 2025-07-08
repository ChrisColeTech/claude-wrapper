/**
 * Network Operations Mock for Port Forwarder Tests
 * Provides controlled network operation simulation
 */

export interface PortForwardingRule {
  port: number;
  wslIP: string;
  created: Date;
}

export interface NetworkMockConfig {
  shouldFailPortValidation?: boolean;
  shouldFailIPValidation?: boolean;
  activePortsOverride?: number[];
  wslIPOverride?: string;
  networkAvailable?: boolean;
}

export class NetworkOperationsMockFactory {
  private static config: NetworkMockConfig = {};
  private static activeForwards: Map<number, PortForwardingRule> = new Map();

  static setup(config: NetworkMockConfig = {}): void {
    this.config = { 
      networkAvailable: true,
      ...config 
    };
    this.activeForwards.clear();
  }

  static reset(): void {
    this.config = {};
    this.activeForwards.clear();
  }

  static isValidPort(port: number): boolean {
    if (this.config.shouldFailPortValidation) {
      return false;
    }
    return port >= 1 && port <= 65535;
  }

  static isValidWSLIP(ip: string): boolean {
    if (this.config.shouldFailIPValidation) {
      return false;
    }
    
    const ipPattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipPattern.test(ip);
  }

  static isNetworkAvailable(): boolean {
    return this.config.networkAvailable ?? true;
  }

  static addActiveForward(port: number, wslIP: string): PortForwardingRule {
    const rule: PortForwardingRule = {
      port,
      wslIP,
      created: new Date()
    };
    this.activeForwards.set(port, rule);
    return rule;
  }

  static removeActiveForward(port: number): boolean {
    return this.activeForwards.delete(port);
  }

  static getActiveForward(port: number): PortForwardingRule | undefined {
    return this.activeForwards.get(port);
  }

  static getAllActiveForwards(): PortForwardingRule[] {
    return Array.from(this.activeForwards.values());
  }

  static isPortForwarded(port: number): boolean {
    return this.activeForwards.has(port);
  }

  static clearAllForwards(): void {
    this.activeForwards.clear();
  }

  static getForwardCount(): number {
    return this.activeForwards.size;
  }

  static getActivePorts(): number[] {
    if (this.config.activePortsOverride) {
      return this.config.activePortsOverride;
    }
    return Array.from(this.activeForwards.keys());
  }

  static setNetworkAvailability(available: boolean): void {
    this.config.networkAvailable = available;
  }

  static setPortValidationMode(shouldFail: boolean): void {
    this.config.shouldFailPortValidation = shouldFail;
  }

  static setIPValidationMode(shouldFail: boolean): void {
    this.config.shouldFailIPValidation = shouldFail;
  }

  static setActivePortsOverride(ports: number[]): void {
    this.config.activePortsOverride = ports;
  }

  static setWSLIPOverride(ip: string): void {
    this.config.wslIPOverride = ip;
  }

  static getWSLIPOverride(): string | undefined {
    return this.config.wslIPOverride;
  }

  static simulatePortConflict(port: number): boolean {
    return this.activeForwards.has(port);
  }

  static simulateNetworkOperation(operation: 'add' | 'remove', port: number, wslIP?: string): boolean {
    if (!this.isNetworkAvailable()) {
      return false;
    }

    if (operation === 'add' && wslIP) {
      if (!this.isValidPort(port) || !this.isValidWSLIP(wslIP)) {
        return false;
      }
      this.addActiveForward(port, wslIP);
      return true;
    }

    if (operation === 'remove') {
      return this.removeActiveForward(port);
    }

    return false;
  }

  static verifyForwardingRule(port: number, expectedWSLIP: string): boolean {
    const rule = this.getActiveForward(port);
    return rule?.wslIP === expectedWSLIP;
  }

  static getNetworkStats(): {
    totalForwards: number;
    activePorts: number[];
    networkAvailable: boolean;
    lastOperation: Date | null;
  } {
    return {
      totalForwards: this.getForwardCount(),
      activePorts: this.getActivePorts(),
      networkAvailable: this.isNetworkAvailable(),
      lastOperation: this.activeForwards.size > 0 ? 
        Math.max(...Array.from(this.activeForwards.values()).map(r => r.created.getTime())) > 0 ? 
        new Date(Math.max(...Array.from(this.activeForwards.values()).map(r => r.created.getTime()))) : null : null
    };
  }
}