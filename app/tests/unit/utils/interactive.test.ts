/**
 * Test suite for Interactive Utilities
 * Comprehensive unit tests for API key setup and interactive prompts
 * Following existing test patterns with 100% coverage and performance requirements
 */

import {
  InteractiveApiKeySetup,
  ReadlineWrapper,
  promptForApiProtection,
  displayApiKeyStatus,
  IReadlineInterface,
  ApiKeySetupOptions,
  ApiKeySetupResult
} from '../../../src/utils/interactive';
import { generateSecureToken, validateTokenFormat } from '../../../src/utils/crypto';
import { SECURITY_PROMPTS, API_KEY_SECURITY } from '../../../src/auth/security-constants';

// Mock readline interface for testing
class MockReadlineInterface implements IReadlineInterface {
  private responses: string[] = [];
  private currentIndex = 0;
  private closed = false;

  constructor(responses: string[] = []) {
    this.responses = responses;
  }

  async question(query: string): Promise<string> {
    if (this.currentIndex >= this.responses.length) {
      return '';
    }
    return this.responses[this.currentIndex++];
  }

  close(): void {
    this.closed = true;
  }

  isClosed(): boolean {
    return this.closed;
  }

  setResponses(responses: string[]): void {
    this.responses = responses;
    this.currentIndex = 0;
  }
}

describe('Interactive Utilities', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let mockConsoleLog: jest.SpyInstance;

  beforeEach(() => {
    originalEnv = { ...process.env };
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    mockConsoleLog.mockRestore();
  });

  describe('ReadlineWrapper', () => {
    let wrapper: ReadlineWrapper;

    beforeEach(() => {
      wrapper = new ReadlineWrapper();
    });

    afterEach(() => {
      wrapper.close();
    });

    it('should create readline interface correctly', () => {
      expect(wrapper).toBeInstanceOf(ReadlineWrapper);
    });

    it('should implement IReadlineInterface', () => {
      expect(typeof wrapper.question).toBe('function');
      expect(typeof wrapper.close).toBe('function');
    });

    it('should close properly', () => {
      expect(() => wrapper.close()).not.toThrow();
    });

    // Note: Testing actual readline interaction requires more complex setup
    // In real scenarios, this would be tested with integration tests
  });

  describe('InteractiveApiKeySetup', () => {
    let setup: InteractiveApiKeySetup;
    let mockReadline: MockReadlineInterface;

    beforeEach(() => {
      mockReadline = new MockReadlineInterface();
      setup = new InteractiveApiKeySetup(mockReadline);
    });

    describe('promptForApiProtection', () => {
      it('should return existing key result when API_KEY is set and skipIfSet is true', async () => {
        process.env.API_KEY = generateSecureToken(32);
        
        const result = await setup.promptForApiProtection({ skipIfSet: true });
        
        expect(result.userChoice).toBe('existing');
        expect(result.apiKey).toBeNull();
        expect(result.message).toBe('API key already configured via environment variable');
        expect(mockReadline.isClosed()).toBe(true);
      });

      it('should proceed with prompt when API_KEY is set but skipIfSet is false', async () => {
        process.env.API_KEY = generateSecureToken(32);
        mockReadline.setResponses(['n']);
        
        const result = await setup.promptForApiProtection({ skipIfSet: false });
        
        expect(result.userChoice).toBe('no');
        expect(result.apiKey).toBeNull();
      });

      it('should generate API key when user answers "y"', async () => {
        delete process.env.API_KEY;
        mockReadline.setResponses(['y']);
        
        const result = await setup.promptForApiProtection();
        
        expect(result.userChoice).toBe('yes');
        expect(result.apiKey).toBeTruthy();
        expect(result.apiKey!.length).toBe(32); // Default length
        expect(validateTokenFormat(result.apiKey!)).toBe(true);
        expect(result.message).toBe('API key protection enabled with generated token');
      });

      it('should generate API key when user answers "yes"', async () => {
        delete process.env.API_KEY;
        mockReadline.setResponses(['yes']);
        
        const result = await setup.promptForApiProtection();
        
        expect(result.userChoice).toBe('yes');
        expect(result.apiKey).toBeTruthy();
        expect(validateTokenFormat(result.apiKey!)).toBe(true);
      });

      it('should return no key when user answers "n"', async () => {
        delete process.env.API_KEY;
        mockReadline.setResponses(['n']);
        
        const result = await setup.promptForApiProtection();
        
        expect(result.userChoice).toBe('no');
        expect(result.apiKey).toBeNull();
        expect(result.message).toBe('API key protection disabled by user choice');
      });

      it('should return no key when user answers "no"', async () => {
        delete process.env.API_KEY;
        mockReadline.setResponses(['no']);
        
        const result = await setup.promptForApiProtection();
        
        expect(result.userChoice).toBe('no');
        expect(result.apiKey).toBeNull();
      });

      it('should return no key for empty response (default to no)', async () => {
        delete process.env.API_KEY;
        mockReadline.setResponses(['']);
        
        const result = await setup.promptForApiProtection();
        
        expect(result.userChoice).toBe('no');
        expect(result.apiKey).toBeNull();
      });

      it('should return no key for any other response', async () => {
        delete process.env.API_KEY;
        mockReadline.setResponses(['maybe', 'invalid', '123']);
        
        for (let i = 0; i < 3; i++) {
          mockReadline.setResponses([['maybe', 'invalid', '123'][i]]);
          const result = await setup.promptForApiProtection();
          
          expect(result.userChoice).toBe('no');
          expect(result.apiKey).toBeNull();
        }
      });

      it('should use custom token length when specified', async () => {
        delete process.env.API_KEY;
        mockReadline.setResponses(['y']);
        
        const customLength = 64;
        const result = await setup.promptForApiProtection({ tokenLength: customLength });
        
        expect(result.apiKey!.length).toBe(customLength);
        expect(validateTokenFormat(result.apiKey!)).toBe(true);
      });

      it('should handle case-insensitive responses', async () => {
        delete process.env.API_KEY;
        
        const testCases = ['Y', 'YES', 'Yes', 'yEs'];
        
        for (const response of testCases) {
          mockReadline.setResponses([response]);
          const result = await setup.promptForApiProtection();
          
          expect(result.userChoice).toBe('yes');
          expect(result.apiKey).toBeTruthy();
        }
      });

      it('should trim whitespace from responses', async () => {
        delete process.env.API_KEY;
        mockReadline.setResponses([' y ', '  yes  ', '\tno\t']);
        
        // Test yes with whitespace
        mockReadline.setResponses([' y ']);
        let result = await setup.promptForApiProtection();
        expect(result.userChoice).toBe('yes');
        
        // Test no with whitespace
        mockReadline.setResponses(['\tno\t']);
        result = await setup.promptForApiProtection();
        expect(result.userChoice).toBe('no');
      });

      it('should display proper prompts using constants', async () => {
        delete process.env.API_KEY;
        mockReadline.setResponses(['n']);
        
        await setup.promptForApiProtection();
        
        // Verify security prompts were displayed
        expect(mockConsoleLog).toHaveBeenCalledWith('\n' + SECURITY_PROMPTS.HEADER);
        expect(mockConsoleLog).toHaveBeenCalledWith(SECURITY_PROMPTS.DIVIDER);
        
        // Check that all description lines were displayed
        SECURITY_PROMPTS.DESCRIPTION.forEach(line => {
          expect(mockConsoleLog).toHaveBeenCalledWith(line);
        });
      });

      it('should display success messages when key is generated', async () => {
        delete process.env.API_KEY;
        mockReadline.setResponses(['y']);
        
        const result = await setup.promptForApiProtection();
        
        expect(mockConsoleLog).toHaveBeenCalledWith(SECURITY_PROMPTS.SUCCESS_HEADER);
        expect(mockConsoleLog).toHaveBeenCalledWith(`🔑 Your API key: ${result.apiKey}`);
        
        // Check that all success messages were displayed
        SECURITY_PROMPTS.SUCCESS_MESSAGES.forEach(line => {
          expect(mockConsoleLog).toHaveBeenCalledWith(line);
        });
      });

      it('should display disabled messages when user declines', async () => {
        delete process.env.API_KEY;
        mockReadline.setResponses(['n']);
        
        await setup.promptForApiProtection();
        
        expect(mockConsoleLog).toHaveBeenCalledWith(SECURITY_PROMPTS.DISABLED_MESSAGE);
        expect(mockConsoleLog).toHaveBeenCalledWith(SECURITY_PROMPTS.DISABLED_DESCRIPTION);
      });

      it('should close readline interface after completion', async () => {
        delete process.env.API_KEY;
        mockReadline.setResponses(['n']);
        
        await setup.promptForApiProtection();
        
        expect(mockReadline.isClosed()).toBe(true);
      });

      it('should close readline interface even if error occurs', async () => {
        delete process.env.API_KEY;
        
        // Mock the crypto module directly on the imported module
        const crypto = require('../../../src/utils/crypto');
        const originalGenerateSecureToken = crypto.generateSecureToken;
        crypto.generateSecureToken = jest.fn(() => {
          throw new Error('Crypto error');
        });
        
        mockReadline.setResponses(['y']);
        
        await expect(setup.promptForApiProtection()).rejects.toThrow('Crypto error');
        expect(mockReadline.isClosed()).toBe(true);
        
        // Restore original function
        crypto.generateSecureToken = originalGenerateSecureToken;
      });
    });

    describe('displayExistingApiKeyInfo', () => {
      it('should display existing API key information correctly', () => {
        const testApiKey = 'test-api-key-12345';
        
        setup.displayExistingApiKeyInfo(testApiKey);
        
        expect(mockConsoleLog).toHaveBeenCalledWith('\n' + SECURITY_PROMPTS.STATUS_HEADER);
        expect(mockConsoleLog).toHaveBeenCalledWith(SECURITY_PROMPTS.DIVIDER);
        expect(mockConsoleLog).toHaveBeenCalledWith(SECURITY_PROMPTS.STATUS_ENABLED);
        expect(mockConsoleLog).toHaveBeenCalledWith(SECURITY_PROMPTS.CLIENT_AUTH_FORMAT);
      });

      it('should mask API key correctly in display', () => {
        const testApiKey = 'test-api-key-12345';
        
        setup.displayExistingApiKeyInfo(testApiKey);
        
        // Find the call that contains the masked API key
        const maskedKeyCalls = mockConsoleLog.mock.calls.filter(call => 
          call[0] && call[0].includes('🔑 API key:')
        );
        
        expect(maskedKeyCalls.length).toBe(1);
        expect(maskedKeyCalls[0][0]).toMatch(/🔑 API key: tes\*+.*$/);
        expect(maskedKeyCalls[0][0]).not.toContain(testApiKey);
      });

      it('should handle short API keys in masking', () => {
        const shortKey = 'abc';
        
        setup.displayExistingApiKeyInfo(shortKey);
        
        const maskedKeyCalls = mockConsoleLog.mock.calls.filter(call => 
          call[0] && call[0].includes('🔑 API key:')
        );
        
        expect(maskedKeyCalls[0][0]).toBe('🔑 API key: ***');
      });
    });

    describe('maskApiKey private method', () => {
      it('should mask long API keys correctly', () => {
        const testApiKey = 'abcdef123456789';
        
        // Access private method for testing via type assertion
        const maskedKey = (setup as any).maskApiKey(testApiKey);
        
        expect(maskedKey).toMatch(/^abc\*+.+$/);
        expect(maskedKey).not.toContain('def123456789');
        expect(maskedKey.length).toBeGreaterThan(3);
      });

      it('should handle short API keys', () => {
        const shortKey = 'abc';
        const maskedKey = (setup as any).maskApiKey(shortKey);
        
        expect(maskedKey).toBe('***');
      });

      it('should handle empty/null API keys', () => {
        expect((setup as any).maskApiKey('')).toBe('***');
        expect((setup as any).maskApiKey(null)).toBe('***');
        expect((setup as any).maskApiKey(undefined)).toBe('***');
      });

      it('should handle exactly 8 character API keys', () => {
        const eightCharKey = '12345678';
        const maskedKey = (setup as any).maskApiKey(eightCharKey);
        
        expect(maskedKey).toMatch(/^123\*+.+$/);
        expect(maskedKey.length).toBeGreaterThan(3);
      });
    });
  });

  describe('promptForApiProtection convenience function', () => {
    let mockReadline: MockReadlineInterface;

    beforeEach(() => {
      mockReadline = new MockReadlineInterface();
    });

    it('should return API key when user enables protection', async () => {
      delete process.env.API_KEY;
      mockReadline.setResponses(['y']);
      
      const apiKey = await promptForApiProtection({ readline: mockReadline });
      
      expect(apiKey).toBeTruthy();
      expect(typeof apiKey).toBe('string');
      expect(apiKey!.length).toBe(32);
      expect(validateTokenFormat(apiKey!)).toBe(true);
    });

    it('should return null when user disables protection', async () => {
      delete process.env.API_KEY;
      mockReadline.setResponses(['n']);
      
      const apiKey = await promptForApiProtection({ readline: mockReadline });
      
      expect(apiKey).toBeNull();
    });

    it('should return null when API_KEY already exists and skipIfSet is true', async () => {
      process.env.API_KEY = generateSecureToken(32);
      
      const apiKey = await promptForApiProtection({ skipIfSet: true, readline: mockReadline });
      
      expect(apiKey).toBeNull();
    });

    it('should use custom token length', async () => {
      delete process.env.API_KEY;
      mockReadline.setResponses(['y']);
      
      const customLength = 48;
      const apiKey = await promptForApiProtection({ 
        tokenLength: customLength,
        readline: mockReadline 
      });
      
      expect(apiKey!.length).toBe(customLength);
    });

    it('should use default options when none provided', async () => {
      delete process.env.API_KEY;
      mockReadline.setResponses(['y']);
      
      const apiKey = await promptForApiProtection({ readline: mockReadline });
      
      expect(apiKey!.length).toBe(32); // Default length
    });
  });

  describe('displayApiKeyStatus', () => {
    it('should display enabled status when API key is provided', () => {
      const testApiKey = 'test-api-key-12345';
      
      displayApiKeyStatus(testApiKey);
      
      expect(mockConsoleLog).toHaveBeenCalledWith('\n' + SECURITY_PROMPTS.STATUS_HEADER);
      expect(mockConsoleLog).toHaveBeenCalledWith(SECURITY_PROMPTS.STATUS_ENABLED);
      expect(mockConsoleLog).toHaveBeenCalledWith(SECURITY_PROMPTS.CLIENT_AUTH_FORMAT);
    });

    it('should display disabled status when no API key is provided', () => {
      displayApiKeyStatus();
      
      expect(mockConsoleLog).toHaveBeenCalledWith('\n' + SECURITY_PROMPTS.STATUS_HEADER);
      expect(mockConsoleLog).toHaveBeenCalledWith(SECURITY_PROMPTS.STATUS_DISABLED);
      expect(mockConsoleLog).toHaveBeenCalledWith(SECURITY_PROMPTS.STATUS_DISABLED_DESCRIPTION);
    });

    it('should display disabled status when empty API key is provided', () => {
      displayApiKeyStatus('');
      
      expect(mockConsoleLog).toHaveBeenCalledWith(SECURITY_PROMPTS.STATUS_DISABLED);
    });

    it('should display disabled status when null API key is provided', () => {
      displayApiKeyStatus(undefined);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(SECURITY_PROMPTS.STATUS_DISABLED);
    });
  });

  describe('Performance Requirements', () => {
    it('should complete promptForApiProtection within 500ms', async () => {
      const mockReadline = new MockReadlineInterface(['n']);
      delete process.env.API_KEY;
      
      const startTime = Date.now();
      await promptForApiProtection({ readline: mockReadline });
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(500);
    });

    it('should complete API key generation within 100ms', async () => {
      const mockReadline = new MockReadlineInterface(['y']);
      delete process.env.API_KEY;
      
      const startTime = Date.now();
      const apiKey = await promptForApiProtection({ readline: mockReadline });
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(100);
      expect(apiKey).toBeTruthy();
    });

    it('should handle multiple concurrent prompts efficiently', async () => {
      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        const mockReadline = new MockReadlineInterface(['n']);
        promises.push(promptForApiProtection({ readline: mockReadline }));
      }
      
      const startTime = Date.now();
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // All 10 should complete within 1s
      expect(results.every(result => result === null)).toBe(true);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle readline interface errors gracefully', async () => {
      // Ensure clean environment
      delete process.env.API_KEY;
      
      // Create a proper mock that actually rejects
      let closeCalled = false;
      const errorReadline: IReadlineInterface = {
        question: jest.fn().mockRejectedValue(new Error('Readline error')),
        close: () => {
          closeCalled = true;
        }
      };
      
      const setup = new InteractiveApiKeySetup(errorReadline);
      
      // The error should propagate and readline should be closed
      await expect(setup.promptForApiProtection({ skipIfSet: false })).rejects.toThrow('Readline error');
      expect(closeCalled).toBe(true);
    });

    it('should handle crypto errors during key generation', async () => {
      const mockReadline = new MockReadlineInterface(['y']);
      delete process.env.API_KEY;
      
      // Mock the crypto module directly
      const crypto = require('../../../src/utils/crypto');
      const originalGenerateSecureToken = crypto.generateSecureToken;
      crypto.generateSecureToken = jest.fn(() => {
        throw new Error('Crypto generation failed');
      });
      
      const setup = new InteractiveApiKeySetup(mockReadline);
      
      await expect(setup.promptForApiProtection()).rejects.toThrow('Crypto generation failed');
      
      // Restore original function
      crypto.generateSecureToken = originalGenerateSecureToken;
    });

    it('should handle invalid token lengths gracefully', async () => {
      const mockReadline = new MockReadlineInterface(['y']);
      delete process.env.API_KEY;
      
      // Test with invalid lengths that would cause generateSecureToken to throw
      await expect(promptForApiProtection({ 
        tokenLength: 0, 
        readline: mockReadline 
      })).rejects.toThrow();
    });

    it('should handle console.log errors gracefully', async () => {
      const mockReadline = new MockReadlineInterface(['n']);
      delete process.env.API_KEY;
      
      // Mock console.log to throw error
      const originalConsoleLog = console.log;
      console.log = jest.fn(() => {
        throw new Error('Console error');
      });
      
      // Should throw because console.log error will propagate
      await expect(promptForApiProtection({ readline: mockReadline })).rejects.toThrow('Console error');
      
      // Restore original console.log
      console.log = originalConsoleLog;
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long API keys in environment', async () => {
      const longApiKey = 'a'.repeat(300); // Longer than typical
      process.env.API_KEY = longApiKey;
      
      const mockReadline = new MockReadlineInterface();
      const result = await promptForApiProtection({ 
        skipIfSet: true, 
        readline: mockReadline 
      });
      
      expect(result).toBe(null); // Should return null when API_KEY exists and skipIfSet is true
    });

    it('should handle special characters in user input', async () => {
      delete process.env.API_KEY;
      const mockReadline = new MockReadlineInterface(['!@#$%^&*()']);
      
      const result = await promptForApiProtection({ readline: mockReadline });
      
      expect(result).toBe(null); // Invalid response defaults to no, so no API key generated
    });

    it('should handle unicode characters in responses', async () => {
      delete process.env.API_KEY;
      const unicodeResponses = ['ñö', '👍', '是', 'עברית'];
      
      for (const response of unicodeResponses) {
        const mockReadline = new MockReadlineInterface([response]);
        const result = await promptForApiProtection({ readline: mockReadline });
        
        expect(result).toBe(null); // All should default to no, so no API key generated
      }
    });

    it('should handle extremely long user responses', async () => {
      delete process.env.API_KEY;
      const longResponse = 'y'.repeat(10000); // This becomes 'yyyyyyy...' which is NOT 'y'
      const mockReadline = new MockReadlineInterface([longResponse]);
      
      const result = await promptForApiProtection({ readline: mockReadline });
      
      // Should NOT recognize 'yyyyyyy...' as 'y' - should return null (no protection)
      expect(result).toBeNull();
    });
  });
});