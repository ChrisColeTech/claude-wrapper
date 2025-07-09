# Architecture Guide - Claude Wrapper

## 🏗️ Architecture Principles

### **SOLID Principles Implementation**

This project strictly adheres to SOLID principles to ensure maintainable, scalable, and testable code:

#### **Single Responsibility Principle (SRP)**
- **One Purpose Per Component**: Each class and module has a single, well-defined responsibility
- **Clear Boundaries**: Authentication, session management, streaming, and core logic are separated
- **Focused Interfaces**: Each component exposes only the methods necessary for its purpose

#### **Open/Closed Principle (OCP)**
- **Extension Without Modification**: New features can be added without changing existing code
- **Plugin Architecture**: Authentication providers, streaming handlers, and validators are extensible
- **Configuration-Driven**: New behaviors are added through configuration, not code changes

#### **Liskov Substitution Principle (LSP)**
- **Interface Compatibility**: All implementations of an interface can be used interchangeably
- **Behavioral Consistency**: Substitutions maintain the expected behavior of the system
- **Error Handling**: All implementations handle errors in a consistent manner

#### **Interface Segregation Principle (ISP)**
- **Minimal Interfaces**: Components depend only on the methods they actually use
- **Focused Contracts**: Interfaces are specific to the client's needs
- **No Forced Dependencies**: Components are not forced to depend on unused methods

#### **Dependency Inversion Principle (DIP)**
- **Abstraction Dependencies**: High-level modules depend on abstractions, not concrete implementations
- **Dependency Injection**: Dependencies are injected rather than created internally
- **Testability**: All dependencies can be mocked for testing

### **DRY (Don't Repeat Yourself) Principles**

#### **Code Reuse Strategies**
- **Utility Functions**: Common operations are extracted into reusable utilities
- **Base Classes**: Shared behavior is implemented in base classes
- **Configuration Constants**: Repeated values are defined as constants
- **Template Patterns**: Common patterns are abstracted into reusable templates

#### **Knowledge Representation**
- **Single Source of Truth**: Each piece of knowledge has one authoritative representation
- **Centralized Configuration**: All configuration is managed in a single location
- **Shared Type Definitions**: Common types are defined once and imported everywhere

## 🚫 Anti-Pattern Prevention

### **Patterns to Avoid**

Based on analysis of the original project's over-engineering, we explicitly avoid these patterns:

#### **❌ Excessive Abstraction**
- **Factory Pattern Overuse**: Simple constructors are preferred over factory patterns
- **Interface Proliferation**: Direct class usage instead of interface hierarchies
- **Dependency Injection Containers**: Constructor injection without complex DI frameworks

#### **❌ Premature Optimization**
- **Complex Caching Systems**: Simple in-memory caching where needed
- **Performance Monitoring Infrastructure**: Basic metrics without complex abstraction
- **Memory Management Patterns**: Rely on Node.js garbage collection

#### **❌ Over-Engineering**
- **Event-Driven Architecture**: Linear request/response flow is simpler
- **Complex State Management**: Stateless design with minimal state
- **Resource Lifecycle Management**: Simple cleanup patterns

### **✅ Preferred Patterns**

#### **Direct Implementation**
```typescript
// ✅ Simple, direct approach
class ClaudeWrapper {
  private claudeClient: ClaudeClient;
  private validator: ResponseValidator;

  constructor() {
    this.claudeClient = new ClaudeClient();
    this.validator = new ResponseValidator();
  }
}

// ❌ Over-engineered approach
interface IClaudeClientFactory {
  createClient(): IClaudeClient;
}
interface IValidatorFactory {
  createValidator(): IResponseValidator;
}
class ClaudeWrapper {
  constructor(
    private clientFactory: IClaudeClientFactory,
    private validatorFactory: IValidatorFactory
  ) {}
}
```

#### **Template-Based Solutions**
```typescript
// ✅ POC's proven template approach
const formatInstruction = {
  role: 'system',
  content: `Return raw JSON only: {"id":"${requestId}","object":"chat.completion",...}`
};

// ❌ Complex parser approach
class ResponseParser {
  parse(response: string): OpenAIResponse {
    // Complex parsing logic with multiple stages
  }
}
```

## 🏛️ Architecture Layers

### **Layer 1: HTTP API Layer**
- **Responsibility**: Handle HTTP requests and responses
- **Components**: Express routes, middleware, request/response transformation
- **Principles**: Thin layer, minimal business logic, proper error handling

### **Layer 2: Business Logic Layer**
- **Responsibility**: Core application logic and orchestration
- **Components**: Wrapper, session management, streaming coordination
- **Principles**: Stateless where possible, clear interfaces, testable

### **Layer 3: Integration Layer**
- **Responsibility**: External service integration
- **Components**: Claude client, authentication providers, storage
- **Principles**: Abstracted interfaces, error handling, retry logic

### **Layer 4: Infrastructure Layer**
- **Responsibility**: Cross-cutting concerns and utilities
- **Components**: Logging, configuration, validation, utilities
- **Principles**: Shared services, consistent patterns, minimal coupling

## 🏗️ Component Architecture

### **Core Components**

#### **ClaudeWrapper (Primary Orchestrator)**
```typescript
interface IClaudeWrapper {
  handleChatCompletion(request: OpenAIRequest): Promise<OpenAIResponse>;
  handleStreamingCompletion(request: OpenAIRequest): AsyncGenerator<OpenAIStreamChunk>;
}

class ClaudeWrapper implements IClaudeWrapper {
  // Single responsibility: Orchestrate request/response flow
  // Open/closed: Extensible through configuration
  // Dependency inversion: Depends on abstractions
}
```

#### **Authentication System**
```typescript
interface IAuthProvider {
  authenticate(credentials: AuthCredentials): Promise<AuthResult>;
  validate(token: string): Promise<boolean>;
}

class AuthManager {
  // Interface segregation: Minimal, focused interface
  // Liskov substitution: All providers are interchangeable
}
```

#### **Session Management**
```typescript
interface ISessionStorage {
  get(id: string): Promise<Session | null>;
  set(id: string, session: Session): Promise<void>;
  delete(id: string): Promise<boolean>;
}

class SessionManager {
  // Single responsibility: Manage session lifecycle
  // DRY: Centralized session logic
}
```

#### **Streaming Support**
```typescript
interface IStreamingHandler {
  createStream(request: OpenAIRequest): AsyncGenerator<OpenAIStreamChunk>;
  handleToolCalls(stream: AsyncGenerator): AsyncGenerator<OpenAIStreamChunk>;
}

class StreamingManager {
  // Open/closed: Extensible streaming formats
  // Dependency inversion: Depends on stream abstractions
}
```

### **Supporting Infrastructure**

#### **Configuration Management**
```typescript
class ConfigManager {
  // Single responsibility: Centralized configuration
  // DRY: Single source of truth for all settings
  
  static get(key: string): string | undefined {
    return process.env[key];
  }
  
  static getRequired(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Required environment variable ${key} is not set`);
    }
    return value;
  }
}
```

#### **Error Handling**
```typescript
class ErrorHandler {
  // Single responsibility: Centralized error handling
  // DRY: Consistent error format across all components
  
  static handleError(error: Error, context: string): OpenAIErrorResponse {
    // Consistent error format
    // Proper logging
    // Security-conscious error messages
  }
}
```

#### **Logging System**
```typescript
class Logger {
  // Single responsibility: Structured logging
  // DRY: Consistent log format across all components
  
  static info(message: string, context?: object): void;
  static error(message: string, error?: Error, context?: object): void;
  static debug(message: string, context?: object): void;
}
```

## 🔧 Design Patterns

### **Composition over Inheritance**
```typescript
// ✅ Preferred: Composition
class ClaudeWrapper {
  private claudeClient: ClaudeClient;
  private validator: ResponseValidator;
  private sessionManager: SessionManager;
  
  constructor(
    claudeClient: ClaudeClient,
    validator: ResponseValidator,
    sessionManager: SessionManager
  ) {
    this.claudeClient = claudeClient;
    this.validator = validator;
    this.sessionManager = sessionManager;
  }
}

// ❌ Avoid: Deep inheritance hierarchies
class BaseWrapper {
  abstract process(request: any): Promise<any>;
}
class ClaudeWrapper extends BaseWrapper {
  // Multiple levels of inheritance
}
```

### **Strategy Pattern for Extensibility**
```typescript
interface AuthStrategy {
  authenticate(credentials: any): Promise<AuthResult>;
}

class AnthropicAuth implements AuthStrategy {
  authenticate(credentials: AnthropicCredentials): Promise<AuthResult> {
    // Anthropic-specific authentication
  }
}

class AWSAuth implements AuthStrategy {
  authenticate(credentials: AWSCredentials): Promise<AuthResult> {
    // AWS-specific authentication
  }
}
```

### **Template Method for Consistent Flows**
```typescript
abstract class BaseRequestHandler {
  async handleRequest(request: OpenAIRequest): Promise<OpenAIResponse> {
    // Template method defining the flow
    const validated = await this.validateRequest(request);
    const processed = await this.processRequest(validated);
    return this.formatResponse(processed);
  }
  
  protected abstract validateRequest(request: OpenAIRequest): Promise<OpenAIRequest>;
  protected abstract processRequest(request: OpenAIRequest): Promise<any>;
  protected abstract formatResponse(result: any): OpenAIResponse;
}
```

## 🧪 Testing Architecture

### **Testing Strategy**
- **Unit Tests**: Test individual components in isolation
- **Integration Tests**: Test component interactions
- **End-to-End Tests**: Test complete user workflows

### **Test Structure**
```typescript
// Unit Test Example
describe('ClaudeWrapper', () => {
  let wrapper: ClaudeWrapper;
  let mockClaudeClient: jest.Mocked<ClaudeClient>;
  let mockValidator: jest.Mocked<ResponseValidator>;
  
  beforeEach(() => {
    mockClaudeClient = createMockClaudeClient();
    mockValidator = createMockValidator();
    wrapper = new ClaudeWrapper(mockClaudeClient, mockValidator);
  });
  
  it('should handle chat completion request', async () => {
    // Test implementation
  });
});
```

### **Mocking Strategy**
- **Interface-based Mocking**: Mock interfaces, not implementations
- **Dependency Injection**: All dependencies are injectable for testing
- **Test Utilities**: Shared test utilities for common operations

## 📊 Performance Considerations

### **Optimization Strategies**
- **Lazy Loading**: Load components only when needed
- **Connection Pooling**: Reuse connections where appropriate
- **Caching**: Strategic caching for expensive operations
- **Streaming**: Use streaming for large responses

### **Memory Management**
- **Automatic Cleanup**: Rely on Node.js garbage collection
- **Resource Disposal**: Proper cleanup of resources
- **Memory Monitoring**: Basic memory usage tracking

### **Error Recovery**
- **Retry Logic**: Automatic retry for transient failures
- **Circuit Breaker**: Prevent cascading failures
- **Graceful Degradation**: Fallback behaviors for failures

## 🔒 Security Architecture

### **Security Principles**
- **Defense in Depth**: Multiple layers of security
- **Principle of Least Privilege**: Minimal necessary permissions
- **Secure by Default**: Secure default configurations

### **Authentication Security**
- **Token Security**: Secure token generation and validation
- **Credential Protection**: Secure credential storage
- **Session Security**: Secure session management

### **Data Protection**
- **Input Validation**: Comprehensive input validation
- **Output Encoding**: Proper output encoding
- **Logging Security**: Secure logging practices

This architecture ensures a clean, maintainable, and scalable codebase that follows established software engineering principles while avoiding common anti-patterns and over-engineering pitfalls.