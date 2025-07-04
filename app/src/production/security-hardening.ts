/**
 * Production Security Hardening
 * Single Responsibility: Security hardening for tool call processing
 * 
 * Based on Phase 15A requirements:
 * - Rate limiting for tool calls
 * - Abuse prevention mechanisms
 * - Input sanitization for production
 * - Audit trail logging
 */

import { Request } from 'express';
import winston from 'winston';

export interface IRateLimit {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

export interface ISecurityHardening {
  checkRateLimit(req: Request): Promise<SecurityCheckResult>;
  sanitizeToolInput(input: any): any;
  auditLog(operation: string, details: AuditDetails): void;
  validateToolSecurity(toolName: string, parameters: any): SecurityValidationResult;
}

export interface SecurityCheckResult {
  allowed: boolean;
  reason?: string;
  retryAfter?: number;
}

export interface SecurityValidationResult {
  valid: boolean;
  sanitizedParameters?: any;
  errors?: string[];
}

export interface AuditDetails {
  userId?: string;
  sessionId?: string;
  toolName?: string;
  parameters?: any;
  result?: any;
  timestamp: number;
  duration?: number;
  success: boolean;
  error?: string;
}

export interface RateLimitState {
  count: number;
  resetTime: number;
  firstRequest: number;
}

export class SecurityHardening implements ISecurityHardening {
  private rateLimitStore: Map<string, RateLimitState>;
  private logger: winston.Logger;
  private rateLimitConfig: IRateLimit;

  constructor(
    logger: winston.Logger,
    rateLimitConfig: IRateLimit = {
      windowMs: 60000, // 1 minute
      maxRequests: 100
    }
  ) {
    this.logger = logger;
    this.rateLimitConfig = rateLimitConfig;
    this.rateLimitStore = new Map();
    
    // Cleanup expired entries every 5 minutes
    setInterval(() => this.cleanupExpiredEntries(), 5 * 60 * 1000);
  }

  async checkRateLimit(req: Request): Promise<SecurityCheckResult> {
    const key = this.generateRateLimitKey(req);
    const now = Date.now();
    const state = this.rateLimitStore.get(key);

    if (!state) {
      // First request for this key
      this.rateLimitStore.set(key, {
        count: 1,
        resetTime: now + this.rateLimitConfig.windowMs,
        firstRequest: now
      });
      return { allowed: true };
    }

    // Check if window has expired
    if (now >= state.resetTime) {
      // Reset the window
      this.rateLimitStore.set(key, {
        count: 1,
        resetTime: now + this.rateLimitConfig.windowMs,
        firstRequest: now
      });
      return { allowed: true };
    }

    // Check if limit exceeded
    if (state.count >= this.rateLimitConfig.maxRequests) {
      this.auditLog('rate_limit_exceeded', {
        userId: this.extractUserId(req),
        sessionId: this.extractSessionId(req),
        timestamp: now,
        success: false,
        error: 'Rate limit exceeded'
      });

      return {
        allowed: false,
        reason: 'Rate limit exceeded',
        retryAfter: Math.ceil((state.resetTime - now) / 1000)
      };
    }

    // Increment counter
    state.count++;
    this.rateLimitStore.set(key, state);

    return { allowed: true };
  }

  sanitizeToolInput(input: any): any {
    if (typeof input !== 'object' || input === null) {
      return input;
    }

    const sanitized = Array.isArray(input) ? [] : {};

    for (const [key, value] of Object.entries(input)) {
      // Remove potentially dangerous properties
      if (this.isDangerousProperty(key)) {
        continue;
      }

      // Sanitize string values
      if (typeof value === 'string') {
        (sanitized as any)[key] = this.sanitizeString(value);
      } else if (typeof value === 'object' && value !== null) {
        (sanitized as any)[key] = this.sanitizeToolInput(value);
      } else {
        (sanitized as any)[key] = value;
      }
    }

    return sanitized;
  }

  auditLog(operation: string, details: AuditDetails): void {
    const auditEntry = {
      operation,
      timestamp: details.timestamp,
      userId: details.userId || 'anonymous',
      sessionId: details.sessionId || 'none',
      toolName: details.toolName || 'unknown',
      success: details.success,
      duration: details.duration,
      error: details.error
    };

    this.logger.info('Security audit', {
      audit: auditEntry,
      level: details.success ? 'info' : 'warn'
    });

    // Store critical security events in structured format
    if (!details.success || operation.includes('security_violation')) {
      this.logger.warn('Security event detected', {
        securityEvent: auditEntry,
        parameters: this.sanitizeForLogging(details.parameters),
        result: this.sanitizeForLogging(details.result)
      });
    }
  }

  validateToolSecurity(toolName: string, parameters: any): SecurityValidationResult {
    const errors: string[] = [];
    let sanitizedParameters = parameters;

    try {
      // Validate tool name
      if (!this.isValidToolName(toolName)) {
        errors.push(`Invalid tool name: ${toolName}`);
      }

      // Sanitize parameters
      sanitizedParameters = this.sanitizeToolInput(parameters);

      // Check for malicious patterns
      const maliciousPatterns = this.detectMaliciousPatterns(sanitizedParameters);
      if (maliciousPatterns.length > 0) {
        errors.push(`Malicious patterns detected: ${maliciousPatterns.join(', ')}`);
      }

      // Validate parameter structure
      const structureErrors = this.validateParameterStructure(toolName, sanitizedParameters);
      errors.push(...structureErrors);

      return {
        valid: errors.length === 0,
        sanitizedParameters: errors.length === 0 ? sanitizedParameters : undefined,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      errors.push(`Security validation failed: ${error instanceof Error ? error.message : String(error)}`);
      return {
        valid: false,
        errors
      };
    }
  }

  private generateRateLimitKey(req: Request): string {
    if (this.rateLimitConfig.keyGenerator) {
      return this.rateLimitConfig.keyGenerator(req);
    }

    // Default key generation: IP + User-Agent hash
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    const userId = this.extractUserId(req) || 'anonymous';
    
    return `${ip}:${userId}:${this.hashString(userAgent)}`;
  }

  private extractUserId(req: Request): string | undefined {
    // Extract user ID from request context
    return (req as any).userId || (req as any).user?.id;
  }

  private extractSessionId(req: Request): string | undefined {
    // Extract session ID from request
    return req.headers['x-session-id'] as string || (req as any).sessionId;
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, state] of this.rateLimitStore.entries()) {
      if (now >= state.resetTime) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.rateLimitStore.delete(key));

    if (expiredKeys.length > 0) {
      this.logger.debug(`Cleaned up ${expiredKeys.length} expired rate limit entries`);
    }
  }

  private isDangerousProperty(key: string): boolean {
    const dangerousProps = [
      '__proto__',
      'constructor',
      'prototype',
      'eval',
      'function',
      'script',
      'exec',
      'system',
      'process'
    ];
    return dangerousProps.includes(key.toLowerCase());
  }

  private sanitizeString(value: string): string {
    // Remove potentially dangerous patterns
    return value
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: protocols
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .replace(/eval\s*\(/gi, '') // Remove eval calls
      .trim();
  }

  private isValidToolName(toolName: string): boolean {
    // Validate against known tool names
    const validTools = [
      'Task', 'Bash', 'Glob', 'Grep', 'LS', 'exit_plan_mode',
      'Read', 'Edit', 'MultiEdit', 'Write', 'NotebookRead',
      'NotebookEdit', 'WebFetch', 'TodoRead', 'TodoWrite', 'WebSearch'
    ];
    
    return validTools.includes(toolName) && /^[A-Za-z][A-Za-z0-9_]*$/.test(toolName);
  }

  private detectMaliciousPatterns(parameters: any): string[] {
    const patterns: string[] = [];
    const maliciousRegexes = [
      /\$\{.*\}/g, // Template injection
      /<%.*%>/g, // Template injection
      /\.\.\//g, // Path traversal
      /\/etc\/passwd/g, // System file access
      /cmd\.exe/g, // Windows command execution
      /bash|sh|zsh/g, // Shell execution
      /rm\s+-rf/g, // Dangerous file operations
    ];

    const jsonStr = JSON.stringify(parameters);
    
    maliciousRegexes.forEach((regex, index) => {
      if (regex.test(jsonStr)) {
        patterns.push(`Pattern${index + 1}`);
      }
    });

    return patterns;
  }

  private validateParameterStructure(toolName: string, parameters: any): string[] {
    const errors: string[] = [];

    if (typeof parameters !== 'object' || parameters === null) {
      errors.push('Parameters must be an object');
      return errors;
    }

    // Basic structure validation
    const parameterCount = Object.keys(parameters).length;
    if (parameterCount > 20) {
      errors.push('Too many parameters (max 20)');
    }

    // Check for deeply nested objects
    if (this.getObjectDepth(parameters) > 5) {
      errors.push('Parameters too deeply nested (max depth 5)');
    }

    return errors;
  }

  private getObjectDepth(obj: any): number {
    if (typeof obj !== 'object' || obj === null) {
      return 0;
    }

    let maxDepth = 0;
    for (const value of Object.values(obj)) {
      const depth = this.getObjectDepth(value);
      maxDepth = Math.max(maxDepth, depth);
    }

    return maxDepth + 1;
  }

  private sanitizeForLogging(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sanitized = Array.isArray(data) ? [] : {};
    
    for (const [key, value] of Object.entries(data)) {
      // Remove sensitive data from logs
      if (this.isSensitiveKey(key)) {
        (sanitized as any)[key] = '[REDACTED]';
      } else if (typeof value === 'object') {
        (sanitized as any)[key] = this.sanitizeForLogging(value);
      } else {
        (sanitized as any)[key] = value;
      }
    }

    return sanitized;
  }

  private isSensitiveKey(key: string): boolean {
    const sensitiveKeys = [
      'password', 'secret', 'token', 'key', 'auth',
      'credential', 'private', 'confidential'
    ];
    return sensitiveKeys.some(sensitive => 
      key.toLowerCase().includes(sensitive)
    );
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

export default SecurityHardening;