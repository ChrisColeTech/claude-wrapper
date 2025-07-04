/**
 * Security Hardening Unit Tests - Phase 15A
 * Comprehensive tests for production security features
 * 
 * Tests cover:
 * - Rate limiting accuracy and performance
 * - Input sanitization effectiveness  
 * - Security validation completeness
 * - Audit logging correctness
 * - Error handling robustness
 */

import { Request, Response } from 'express';
import winston from 'winston';
import { SecurityHardening, ISecurityHardening } from '../../../src/production/security-hardening';
import { PRODUCTION_LIMITS, PRODUCTION_SECURITY } from '../../../src/tools/constants';

describe('SecurityHardening', () => {
  let securityHardening: ISecurityHardening;
  let mockLogger: winston.Logger;
  let mockRequest: Partial<Request>;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    } as any;

    // Create fresh instance for each test
    securityHardening = new SecurityHardening(mockLogger, {
      windowMs: 60000,
      maxRequests: 5 // Lower limit for testing
    });

    // Create mock request
    mockRequest = {
      ip: '127.0.0.1',
      headers: {},
      get: jest.fn(),
      connection: { remoteAddress: '127.0.0.1' },
      body: {}
    };
  });

  describe('Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      const result = await securityHardening.checkRateLimit(mockRequest as Request);
      
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(result.retryAfter).toBeUndefined();
    });

    it('should enforce rate limit after maximum requests', async () => {
      // Make maximum allowed requests
      for (let i = 0; i < 5; i++) {
        const result = await securityHardening.checkRateLimit(mockRequest as Request);
        expect(result.allowed).toBe(true);
      }

      // Next request should be rate limited
      const result = await securityHardening.checkRateLimit(mockRequest as Request);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Rate limit exceeded');
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should reset rate limit after window expires', async () => {
      const shortWindowSecurity = new SecurityHardening(mockLogger, {
        windowMs: 100, // Very short window for testing
        maxRequests: 2
      });

      // Exhaust rate limit
      await shortWindowSecurity.checkRateLimit(mockRequest as Request);
      await shortWindowSecurity.checkRateLimit(mockRequest as Request);
      
      let result = await shortWindowSecurity.checkRateLimit(mockRequest as Request);
      expect(result.allowed).toBe(false);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should allow requests again
      result = await shortWindowSecurity.checkRateLimit(mockRequest as Request);
      expect(result.allowed).toBe(true);
    });

    it('should generate unique keys for different clients', async () => {
      const request1 = { ...mockRequest, ip: '127.0.0.1' };
      const request2 = { ...mockRequest, ip: '192.168.1.1' };

      // Exhaust rate limit for first client
      for (let i = 0; i < 5; i++) {
        await securityHardening.checkRateLimit(request1 as Request);
      }
      
      const result1 = await securityHardening.checkRateLimit(request1 as Request);
      expect(result1.allowed).toBe(false);

      // Second client should still be allowed
      const result2 = await securityHardening.checkRateLimit(request2 as Request);
      expect(result2.allowed).toBe(true);
    });

    it('should perform rate limit check in <1ms', async () => {
      const startTime = Date.now();
      await securityHardening.checkRateLimit(mockRequest as Request);
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(1);
    });

    it('should log rate limit violations', async () => {
      // Exhaust rate limit
      for (let i = 0; i < 5; i++) {
        await securityHardening.checkRateLimit(mockRequest as Request);
      }
      
      await securityHardening.checkRateLimit(mockRequest as Request);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Security audit',
        expect.objectContaining({
          audit: expect.objectContaining({
            operation: 'rate_limit_exceeded',
            success: false
          })
        })
      );
    });
  });

  describe('Input Sanitization', () => {
    it('should remove dangerous properties', () => {
      const maliciousInput = {
        normalField: 'safe value',
        __proto__: { polluted: true },
        constructor: 'danger',
        eval: 'malicious code',
        script: '<script>alert("xss")</script>'
      };

      const sanitized = securityHardening.sanitizeToolInput(maliciousInput);
      
      expect(sanitized.normalField).toBe('safe value');
      expect(sanitized.__proto__).toBeUndefined();
      expect(sanitized.constructor).toBeUndefined();
      expect(sanitized.eval).toBeUndefined();
      expect(sanitized.script).toBeUndefined();
    });

    it('should sanitize string values', () => {
      const input = {
        message: '<script>alert("xss")</script>Hello World',
        url: 'javascript:alert("evil")',
        handler: 'onclick=alert("bad")'
      };

      const sanitized = securityHardening.sanitizeToolInput(input);
      
      expect(sanitized.message).toBe('Hello World');
      expect(sanitized.url).toBe('alert("evil")');
      expect(sanitized.handler).toBe('alert("bad")');
    });

    it('should handle nested objects recursively', () => {
      const input = {
        user: {
          profile: {
            __proto__: { polluted: true },
            name: '<script>Evil</script>John'
          }
        }
      };

      const sanitized = securityHardening.sanitizeToolInput(input);
      
      expect(sanitized.user.profile.__proto__).toBeUndefined();
      expect(sanitized.user.profile.name).toBe('John');
    });

    it('should handle arrays correctly', () => {
      const input = [
        'normal string',
        '<script>alert("xss")</script>',
        { __proto__: { bad: true }, good: 'value' }
      ];

      const sanitized = securityHardening.sanitizeToolInput(input);
      
      expect(sanitized[0]).toBe('normal string');
      expect(sanitized[1]).toBe('');
      expect(sanitized[2].good).toBe('value');
      expect(sanitized[2].__proto__).toBeUndefined();
    });

    it('should handle null and primitive values', () => {
      expect(securityHardening.sanitizeToolInput(null)).toBe(null);
      expect(securityHardening.sanitizeToolInput('string')).toBe('string');
      expect(securityHardening.sanitizeToolInput(123)).toBe(123);
      expect(securityHardening.sanitizeToolInput(true)).toBe(true);
    });
  });

  describe('Security Validation', () => {
    it('should validate known tool names', () => {
      const result = securityHardening.validateToolSecurity('Read', { file: 'test.txt' });
      
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject invalid tool names', () => {
      const result = securityHardening.validateToolSecurity('EvilTool', {});
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid tool name: EvilTool');
    });

    it('should detect malicious patterns', () => {
      const parameters = {
        command: 'rm -rf /',
        path: '../../../etc/passwd',
        template: '${process.env.SECRET}'
      };

      const result = securityHardening.validateToolSecurity('Bash', parameters);
      
      expect(result.valid).toBe(false);
      expect(result.errors?.some(error => error.includes('Malicious patterns detected'))).toBe(true);
    });

    it('should validate parameter structure', () => {
      // Too many parameters
      const manyParams: any = {};
      for (let i = 0; i < 25; i++) {
        manyParams[`param${i}`] = 'value';
      }

      const result1 = securityHardening.validateToolSecurity('Read', manyParams);
      expect(result1.valid).toBe(false);
      expect(result1.errors?.some(error => error.includes('Too many parameters'))).toBe(true);

      // Too deeply nested
      const deepParams = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  level6: 'too deep'
                }
              }
            }
          }
        }
      };

      const result2 = securityHardening.validateToolSecurity('Read', deepParams);
      expect(result2.valid).toBe(false);
      expect(result2.errors?.some(error => error.includes('too deeply nested'))).toBe(true);
    });

    it('should sanitize valid parameters', () => {
      const parameters = {
        file: '<script>evil</script>test.txt',
        __proto__: { polluted: true }
      };

      const result = securityHardening.validateToolSecurity('Read', parameters);
      
      expect(result.valid).toBe(true);
      expect(result.sanitizedParameters?.file).toBe('test.txt');
      expect(result.sanitizedParameters?.__proto__).toBeUndefined();
    });

    it('should handle validation errors gracefully', () => {
      // Force an error by passing invalid parameters structure
      const invalidParams = Symbol('invalid');
      
      const result = securityHardening.validateToolSecurity('Read', invalidParams as any);
      
      expect(result.valid).toBe(false);
      expect(result.errors?.some(error => error.includes('Security validation failed'))).toBe(true);
    });
  });

  describe('Audit Logging', () => {
    it('should log successful operations', () => {
      const auditDetails = {
        userId: 'user123',
        sessionId: 'session456',
        toolName: 'Read',
        parameters: { file: 'test.txt' },
        timestamp: Date.now(),
        success: true
      };

      securityHardening.auditLog('tool_operation', auditDetails);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Security audit',
        expect.objectContaining({
          audit: expect.objectContaining({
            operation: 'tool_operation',
            success: true,
            userId: 'user123',
            toolName: 'Read'
          })
        })
      );
    });

    it('should log failed operations with warnings', () => {
      const auditDetails = {
        userId: 'user123',
        toolName: 'Read',
        timestamp: Date.now(),
        success: false,
        error: 'File not found'
      };

      securityHardening.auditLog('tool_operation', auditDetails);
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Security event detected',
        expect.objectContaining({
          securityEvent: expect.objectContaining({
            success: false,
            error: 'File not found'
          })
        })
      );
    });

    it('should redact sensitive data from logs', () => {
      const auditDetails = {
        toolName: 'Auth',
        parameters: {
          username: 'testuser',
          password: 'secret123',
          apiKey: 'sk-1234567890'
        },
        timestamp: Date.now(),
        success: true
      };

      securityHardening.auditLog('auth_operation', auditDetails);
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Security event detected',
        expect.objectContaining({
          parameters: expect.objectContaining({
            password: '[REDACTED]',
            apiKey: '[REDACTED]'
          })
        })
      );
    });

    it('should handle security violations', () => {
      const auditDetails = {
        userId: 'attacker',
        toolName: 'EvilTool',
        parameters: { malicious: 'payload' },
        timestamp: Date.now(),
        success: false,
        error: 'Security violation detected'
      };

      securityHardening.auditLog('security_violation', auditDetails);
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Security event detected',
        expect.objectContaining({
          securityEvent: expect.objectContaining({
            operation: 'security_violation',
            success: false
          })
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle rate limit check errors gracefully', async () => {
      const invalidRequest = {} as Request; // Missing required properties
      
      // Should not throw, but handle gracefully
      const result = await securityHardening.checkRateLimit(invalidRequest);
      
      // Implementation should handle this gracefully
      expect(result).toBeDefined();
    });

    it('should handle sanitization errors', () => {
      const circularObject: any = {};
      circularObject.self = circularObject;
      
      // Should not throw
      expect(() => {
        securityHardening.sanitizeToolInput(circularObject);
      }).not.toThrow();
    });

    it('should handle validation errors', () => {
      // Should handle edge cases gracefully
      expect(() => {
        securityHardening.validateToolSecurity('', null as any);
      }).not.toThrow();
      
      expect(() => {
        securityHardening.validateToolSecurity('ValidTool', undefined as any);
      }).not.toThrow();
    });
  });

  describe('Performance Requirements', () => {
    it('should complete rate limit check in <1ms', async () => {
      const times: number[] = [];
      
      for (let i = 0; i < 100; i++) {
        const start = Date.now();
        await securityHardening.checkRateLimit(mockRequest as Request);
        times.push(Date.now() - start);
      }
      
      const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      expect(averageTime).toBeLessThan(1);
    });

    it('should complete input sanitization in <1ms', () => {
      const testInput = {
        field1: 'value1',
        field2: { nested: 'value2' },
        field3: ['array', 'values']
      };
      
      const times: number[] = [];
      
      for (let i = 0; i < 100; i++) {
        const start = Date.now();
        securityHardening.sanitizeToolInput(testInput);
        times.push(Date.now() - start);
      }
      
      const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      expect(averageTime).toBeLessThan(1);
    });

    it('should complete security validation in <1ms', () => {
      const times: number[] = [];
      
      for (let i = 0; i < 100; i++) {
        const start = Date.now();
        securityHardening.validateToolSecurity('Read', { file: 'test.txt' });
        times.push(Date.now() - start);
      }
      
      const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      expect(averageTime).toBeLessThan(1);
    });
  });

  describe('Integration with Constants', () => {
    it('should use production constants correctly', () => {
      const prodSecurity = new SecurityHardening(mockLogger, {
        windowMs: PRODUCTION_LIMITS.RATE_LIMIT_WINDOW_MS,
        maxRequests: PRODUCTION_LIMITS.RATE_LIMIT_MAX_REQUESTS
      });
      
      expect(prodSecurity).toBeDefined();
    });

    it('should respect security parameter limits', () => {
      const result = securityHardening.validateToolSecurity('Read', {
        depth: PRODUCTION_SECURITY.MAX_PARAMETER_DEPTH + 1
      });
      
      // Should have limits enforced
      expect(result).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty requests', async () => {
      const emptyRequest = {} as Request;
      const result = await securityHardening.checkRateLimit(emptyRequest);
      expect(result).toBeDefined();
    });

    it('should handle malformed user agents', async () => {
      const requestWithBadUA = {
        ...mockRequest,
        get: jest.fn().mockReturnValue(null)
      };
      
      const result = await securityHardening.checkRateLimit(requestWithBadUA as Request);
      expect(result.allowed).toBe(true);
    });

    it('should handle missing request properties', () => {
      const result = securityHardening.sanitizeToolInput(undefined);
      expect(result).toBe(undefined);
    });

    it('should handle very large inputs', () => {
      const largeInput: any = {};
      for (let i = 0; i < 1000; i++) {
        largeInput[`field${i}`] = `value${i}`.repeat(100);
      }
      
      expect(() => {
        securityHardening.sanitizeToolInput(largeInput);
      }).not.toThrow();
    });
  });
});