# Claude Wrapper Architecture Guide

## 🎯 Overview

This document provides architectural guidelines and best practices for the claude-wrapper project. All development must follow these principles to ensure maintainable, scalable, and reliable code.

**Reference**: See [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) for the complete project organization.

## 🏗️ Architectural Principles

### **SOLID Principles (Mandatory)**

#### **S - Single Responsibility Principle**
- **Rule**: Each class has ONE reason to change
- **Implementation**: 
  - Classes <200 lines of code
  - Functions <50 lines of code
  - Maximum 5 parameters per function
- **Example**: `AuthManager` orchestrates auth, `AnthropicProvider` handles only Anthropic authentication

#### **O - Open/Closed Principle**
- **Rule**: Open for extension, closed for modification
- **Implementation**: Use strategy patterns and interfaces
- **Example**: New authentication providers implement `IAuthProvider` interface

#### **L - Liskov Substitution Principle**
- **Rule**: Derived classes must be substitutable for base classes
- **Implementation**: Consistent interfaces and behavior contracts
- **Example**: All storage implementations (`MemoryStorage`, `RedisStorage`) work identically

#### **I - Interface Segregation Principle**
- **Rule**: Clients shouldn't depend on interfaces they don't use
- **Implementation**: 
  - Interfaces <5 methods each
  - Single-purpose interfaces
- **Example**: `ISessionReader` vs `ISessionWriter` vs `ISessionManager`

#### **D - Dependency Inversion Principle**
- **Rule**: Depend on abstractions, not concretions
- **Implementation**: Inject all dependencies via constructor
- **Example**: `ClaudeService` receives `IClaudeClient` interface, not concrete implementation

### **DRY Principle (Don't Repeat Yourself)**

#### **Code Duplication Rules**
- **Maximum**: 3 lines of duplicate code before extraction
- **Extraction Targets**: Utilities, constants, shared functions
- **Implementation**: Extract to dedicated utility files with named exports

#### **Configuration Management**
- **Rule**: No magic numbers or strings in code
- **Implementation**: All constants in `constants.ts` files
- **Example**: 
  ```typescript
  // ❌ Bad
  if (sessions.size > 10000) { /* ... */ }
  
  // ✅ Good
  if (sessions.size > SESSION_LIMITS.MAX_SESSIONS) { /* ... */ }
  ```

## 🚫 Anti-Pattern Prevention

### **Forbidden Patterns**

#### **No God Classes**
- **Rule**: Classes focused on single responsibility
- **Limit**: <200 lines per class
- **Solution**: Break large classes into focused components

#### **No Deep Nesting**
- **Rule**: Maximum 3 levels of nesting
- **Solution**: Use early returns and guard clauses
- **Example**:
  ```typescript
  // ❌ Bad - Deep nesting
  if (user) {
    if (user.isAuthenticated) {
      if (user.hasPermission) {
        // ... logic
      }
    }
  }
  
  // ✅ Good - Early returns
  if (!user) return;
  if (!user.isAuthenticated) return;
  if (!user.hasPermission) return;
  // ... logic
  ```

#### **No Inline Complex Logic**
- **Rule**: Extract complex logic to named, testable methods
- **Implementation**: Private methods with descriptive names
- **Testing**: Each extracted method gets unit tests

#### **No Hardcoded Values**
- **Rule**: All configuration via environment variables or constants
- **Implementation**: Configuration files and environment validation

#### **No Direct Dependencies**
- **Rule**: Use dependency injection for all external dependencies
- **Implementation**: Constructor injection with interfaces

## 📁 File Organization Patterns

### **Directory Structure Rules**

#### **Feature-Based Organization**
- **Rule**: Group by feature/domain, not by type
- **Structure**: `/auth/`, `/claude/`, `/sessions/`, `/tools/`
- **Within Features**: `interfaces/`, `services/`, `utils/`, `types/`

#### **File Naming Conventions**
- **Services**: `*.service.ts` (e.g., `claude.service.ts`)
- **Interfaces**: `*.ts` (e.g., `auth-provider.ts`)
- **Utilities**: `*.utils.ts` (e.g., `validation.utils.ts`)
- **Types**: `*.types.ts` (e.g., `session.types.ts`)
- **Constants**: `*.constants.ts` (e.g., `auth.constants.ts`)

#### **Import Organization**
```typescript
// 1. Node.js built-ins
import { EventEmitter } from 'events';

// 2. External libraries
import express from 'express';
import { z } from 'zod';

// 3. Internal modules (absolute paths)
import { IAuthProvider } from '@/auth/interfaces/auth-provider';
import { SESSION_CONSTANTS } from '@/utils/constants';

// 4. Relative imports (same feature only)
import { validateCredentials } from './auth-utils';
```

## 🔧 Code Quality Standards

### **TypeScript Requirements**

#### **Strict Mode (Mandatory)**
- **Configuration**: `"strict": true` in `tsconfig.json`
- **Rules**: All code must pass `tsc --strict --noEmit`
- **No**: `any` types, implicit returns, unused variables

#### **Type Safety**
- **Interfaces**: Define contracts for all data structures
- **Generics**: Use for reusable components
- **Union Types**: For controlled value sets
- **Example**:
  ```typescript
  interface AuthResult<T = unknown> {
    success: boolean;
    data?: T;
    error?: AuthError;
  }
  ```

### **Error Handling Standards**

#### **Custom Error Classes**
- **Rule**: Specific error types for different scenarios
- **Implementation**: Extend base `Error` class
- **Properties**: Include contextual information
- **Example**:
  ```typescript
  export class AuthenticationError extends Error {
    constructor(
      message: string,
      public readonly provider: string,
      public readonly code: string
    ) {
      super(message);
      this.name = 'AuthenticationError';
    }
  }
  ```

#### **Error Handling Patterns**
- **Async Functions**: Always use try/catch
- **Result Pattern**: Return results with error information
- **Logging**: Log errors with context
- **User Errors**: Sanitize sensitive information

### **Testing Requirements**

#### **Coverage Standards**
- **Unit Tests**: 100% coverage for business logic
- **Integration Tests**: All component interactions
- **E2E Tests**: Critical user workflows
- **Performance Tests**: Response time validation

#### **Test Structure**
- **Naming**: `describe('Component', () => { test('should do X when Y') })`
- **Arrange-Act-Assert**: Clear test structure
- **Mocking**: Mock external dependencies, test business logic
- **Data**: Use fixtures for test data

## 🔄 Component Interaction Patterns

### **Dependency Injection**

#### **Constructor Injection (Primary)**
```typescript
export class ClaudeService {
  constructor(
    private readonly client: IClaudeClient,
    private readonly sessionManager: ISessionManager,
    private readonly logger: ILogger
  ) {}
}
```

#### **Factory Pattern (Secondary)**
```typescript
export class AuthProviderFactory {
  createProvider(type: AuthProviderType): IAuthProvider {
    switch (type) {
      case 'anthropic': return new AnthropicProvider();
      case 'bedrock': return new BedrockProvider();
      default: throw new Error(`Unknown provider: ${type}`);
    }
  }
}
```

### **Event-Driven Architecture**

#### **EventEmitter Usage**
- **Rule**: Extend EventEmitter for pub/sub patterns
- **Cleanup**: Always implement `removeAllListeners()` in cleanup methods
- **Types**: Define event interfaces for type safety

#### **Example Implementation**
```typescript
interface MonitorEvents {
  'health-check': (status: HealthStatus) => void;
  'performance-metric': (metric: PerformanceMetric) => void;
}

export class SystemMonitor extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50); // Prevent memory leaks
  }
  
  destroy(): void {
    this.removeAllListeners();
  }
}
```

## 📊 Performance Guidelines

### **Memory Management**

#### **Resource Lifecycle**
- **Creation**: Track all created resources (timers, connections, listeners)
- **Cleanup**: Implement cleanup methods for all classes
- **Monitoring**: Add memory usage tracking
- **Example**:
  ```typescript
  export class ResourceManager {
    private timers = new Set<NodeJS.Timeout>();
    private intervals = new Set<NodeJS.Timeout>();
    
    createTimer(callback: () => void, delay: number): NodeJS.Timeout {
      const timer = setTimeout(callback, delay);
      this.timers.add(timer);
      return timer;
    }
    
    cleanup(): void {
      this.timers.forEach(timer => clearTimeout(timer));
      this.intervals.forEach(interval => clearInterval(interval));
      this.timers.clear();
      this.intervals.clear();
    }
  }
  ```

#### **Bounded Collections**
- **Rule**: All collections must have maximum size limits
- **Implementation**: Use Map with size checking, implement LRU eviction
- **Monitoring**: Track collection sizes

### **Async Operations**

#### **Promise Handling**
- **Rule**: Always handle rejections
- **Timeouts**: Add timeouts for external calls
- **Concurrency**: Use `Promise.allSettled()` for parallel operations
- **Example**:
  ```typescript
  async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Operation timeout')), timeoutMs);
    });
    
    return Promise.race([operation(), timeoutPromise]);
  }
  ```

## 🔒 Security Guidelines

### **Input Validation**

#### **Validation Strategy**
- **Rule**: Validate all inputs at boundaries
- **Tools**: Use Zod for schema validation
- **Sanitization**: Sanitize user inputs
- **Example**:
  ```typescript
  const ChatCompletionSchema = z.object({
    messages: z.array(MessageSchema).min(1).max(100),
    model: z.string().refine(isValidModel),
    stream: z.boolean().optional()
  });
  ```

### **Authentication & Authorization**

#### **Credential Handling**
- **Rule**: Never log credentials or API keys
- **Storage**: Use environment variables or secure vaults
- **Transmission**: Always use HTTPS for credential transmission
- **Validation**: Validate credential formats

#### **API Security**
- **Rate Limiting**: Implement per-endpoint rate limits
- **CORS**: Configure CORS properly for production
- **Headers**: Add security headers (HSTS, CSP, etc.)

## 📝 Documentation Standards

### **Code Documentation**

#### **JSDoc Comments**
- **Public APIs**: Document all public methods and classes
- **Complex Logic**: Explain non-obvious implementations
- **Examples**: Provide usage examples for public APIs
- **Format**:
  ```typescript
  /**
   * Authenticates a user using the specified provider.
   * 
   * @param provider - The authentication provider to use
   * @param credentials - User credentials for authentication
   * @returns Promise resolving to authentication result
   * @throws {AuthenticationError} When authentication fails
   * @example
   * ```typescript
   * const result = await authService.authenticate('anthropic', { apiKey: 'sk-...' });
   * ```
   */
  ```

### **README Files**
- **Feature Modules**: Each major feature gets a README
- **Setup Instructions**: Clear setup and usage instructions
- **Examples**: Working code examples
- **Troubleshooting**: Common issues and solutions

## 🧪 Testing Architecture

### **Test Categories**

#### **Unit Tests**
- **Scope**: Individual classes and functions
- **Isolation**: Mock all external dependencies
- **Coverage**: 100% line and branch coverage
- **Speed**: <1ms per test

#### **Integration Tests**
- **Scope**: Component interactions
- **Real Dependencies**: Use real implementations where possible
- **Scenarios**: Test error conditions and edge cases
- **Speed**: <100ms per test

#### **E2E Tests**
- **Scope**: Complete user workflows
- **Environment**: Test environment with real dependencies
- **Scenarios**: Critical business flows
- **Speed**: <5s per test

### **Test Organization**
```typescript
// tests/unit/auth/anthropic-provider.test.ts
describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;
  
  beforeEach(() => {
    provider = new AnthropicProvider();
  });
  
  describe('authenticate', () => {
    test('should authenticate with valid API key', async () => {
      // Arrange
      const credentials = { apiKey: 'sk-valid-key' };
      
      // Act
      const result = await provider.authenticate(credentials);
      
      // Assert
      expect(result.success).toBe(true);
    });
  });
});
```

## 🚀 Deployment Considerations

### **Environment Configuration**
- **Rule**: All environment-specific configuration via env vars
- **Validation**: Validate required env vars on startup
- **Defaults**: Provide sensible defaults for development
- **Documentation**: Document all required environment variables

### **Health Checks**
- **Implementation**: Comprehensive health check endpoints
- **Dependencies**: Check all external dependencies
- **Graceful Degradation**: Continue operating when possible
- **Monitoring**: Integrate with monitoring systems

### **Graceful Shutdown**
- **Signal Handling**: Handle SIGTERM and SIGINT
- **Resource Cleanup**: Clean up all resources
- **Request Draining**: Allow in-flight requests to complete
- **Timeout**: Maximum shutdown time limit

---

**Remember**: These guidelines ensure code quality, maintainability, and reliability. All code must follow these patterns, and code reviews should enforce compliance with these standards.