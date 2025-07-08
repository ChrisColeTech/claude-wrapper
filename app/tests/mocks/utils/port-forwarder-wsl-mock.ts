/**
 * WSL Detector Mock for Port Forwarder Tests
 * Provides controlled WSL environment simulation
 */

export interface WSLInfo {
  isWSL: boolean;
  distroName?: string;
  wslVersion?: string;
  ip?: string;
}

export interface WSLMockConfig {
  isWSLEnvironment?: boolean;
  wslIP?: string;
  shouldFailIPRetrieval?: boolean;
  isNetworkingAvailable?: boolean;
  shouldFailNetworkCheck?: boolean;
  distroName?: string;
  wslVersion?: string;
}

export class WSLDetectorMockFactory {
  private static config: WSLMockConfig = {};
  private static mockWSLDetector: any = {};

  static setup(config: WSLMockConfig = {}): any {
    this.config = {
      isWSLEnvironment: true,
      wslIP: '172.20.0.1',
      isNetworkingAvailable: true,
      distroName: 'Ubuntu',
      wslVersion: '2',
      ...config
    };

    this.mockWSLDetector = {
      isWSL: jest.fn().mockReturnValue(this.config.isWSLEnvironment),
      getWSLIP: jest.fn().mockImplementation(async () => {
        if (this.config.shouldFailIPRetrieval) {
          throw new Error('Failed to retrieve WSL IP address');
        }
        return this.config.wslIP;
      }),
      isWSLNetworkingAvailable: jest.fn().mockImplementation(async () => {
        if (this.config.shouldFailNetworkCheck) {
          throw new Error('Failed to check WSL networking availability');
        }
        return this.config.isNetworkingAvailable;
      }),
      getWSLInfo: jest.fn().mockImplementation(async () => {
        if (!this.config.isWSLEnvironment) {
          return { isWSL: false };
        }

        const info: WSLInfo = {
          isWSL: true,
          ...(this.config.distroName && { distroName: this.config.distroName }),
          ...(this.config.wslVersion && { wslVersion: this.config.wslVersion }),
          ...(this.config.wslIP && { ip: this.config.wslIP })
        };

        return info;
      })
    };

    return this.mockWSLDetector;
  }

  static reset(): void {
    this.config = {};
    if (this.mockWSLDetector) {
      Object.keys(this.mockWSLDetector).forEach(key => {
        if (typeof this.mockWSLDetector[key]?.mockReset === 'function') {
          this.mockWSLDetector[key].mockReset();
        }
      });
    }
  }

  static setWSLEnvironment(isWSL: boolean): void {
    this.config.isWSLEnvironment = isWSL;
    if (this.mockWSLDetector.isWSL) {
      this.mockWSLDetector.isWSL.mockReturnValue(isWSL);
    }
  }

  static setWSLIP(ip: string): void {
    this.config.wslIP = ip;
    if (this.mockWSLDetector.getWSLIP) {
      this.mockWSLDetector.getWSLIP.mockResolvedValue(ip);
    }
  }

  static setIPRetrievalFailure(shouldFail: boolean): void {
    this.config.shouldFailIPRetrieval = shouldFail;
    if (this.mockWSLDetector.getWSLIP) {
      if (shouldFail) {
        this.mockWSLDetector.getWSLIP.mockRejectedValue(new Error('Failed to retrieve WSL IP address'));
      } else {
        this.mockWSLDetector.getWSLIP.mockResolvedValue(this.config.wslIP);
      }
    }
  }

  static setNetworkingAvailability(available: boolean): void {
    this.config.isNetworkingAvailable = available;
    if (this.mockWSLDetector.isWSLNetworkingAvailable) {
      this.mockWSLDetector.isWSLNetworkingAvailable.mockResolvedValue(available);
    }
  }

  static setNetworkCheckFailure(shouldFail: boolean): void {
    this.config.shouldFailNetworkCheck = shouldFail;
    if (this.mockWSLDetector.isWSLNetworkingAvailable) {
      if (shouldFail) {
        this.mockWSLDetector.isWSLNetworkingAvailable.mockRejectedValue(new Error('Failed to check WSL networking availability'));
      } else {
        this.mockWSLDetector.isWSLNetworkingAvailable.mockResolvedValue(this.config.isNetworkingAvailable);
      }
    }
  }

  static setDistroInfo(distroName: string, wslVersion: string): void {
    this.config.distroName = distroName;
    this.config.wslVersion = wslVersion;
    this.updateWSLInfoMock();
  }

  static getMockInstance(): any {
    return this.mockWSLDetector;
  }

  static verifyIsWSLCalled(): boolean {
    return this.mockWSLDetector.isWSL?.mock?.calls?.length > 0;
  }

  static verifyGetWSLIPCalled(): boolean {
    return this.mockWSLDetector.getWSLIP?.mock?.calls?.length > 0;
  }

  static verifyNetworkingCheckCalled(): boolean {
    return this.mockWSLDetector.isWSLNetworkingAvailable?.mock?.calls?.length > 0;
  }

  static getIsWSLCallCount(): number {
    return this.mockWSLDetector.isWSL?.mock?.calls?.length || 0;
  }

  static getGetWSLIPCallCount(): number {
    return this.mockWSLDetector.getWSLIP?.mock?.calls?.length || 0;
  }

  static getNetworkingCheckCallCount(): number {
    return this.mockWSLDetector.isWSLNetworkingAvailable?.mock?.calls?.length || 0;
  }

  private static updateWSLInfoMock(): void {
    if (this.mockWSLDetector.getWSLInfo) {
      this.mockWSLDetector.getWSLInfo.mockImplementation(async () => {
        if (!this.config.isWSLEnvironment) {
          return { isWSL: false };
        }

        const info: WSLInfo = {
          isWSL: true,
          ...(this.config.distroName && { distroName: this.config.distroName }),
          ...(this.config.wslVersion && { wslVersion: this.config.wslVersion }),
          ...(this.config.wslIP && { ip: this.config.wslIP })
        };

        return info;
      });
    }
  }

  static simulateWSLEnvironment(): void {
    this.setWSLEnvironment(true);
    this.setWSLIP('172.20.0.1');
    this.setNetworkingAvailability(true);
    this.setDistroInfo('Ubuntu', '2');
  }

  static simulateNonWSLEnvironment(): void {
    this.setWSLEnvironment(false);
    this.setNetworkingAvailability(false);
  }

  static simulateNetworkingIssues(): void {
    this.setWSLEnvironment(true);
    this.setIPRetrievalFailure(true);
    this.setNetworkCheckFailure(true);
  }
}