# Code Examples - Claude Wrapper Patterns

## 🎯 Overview

This document provides code examples and patterns for enhancing the POC and extracting essential features from the original claude-wrapper project. It focuses on practical implementations that maintain simplicity while adding production-ready capabilities.

## 📁 POC Enhancement Patterns

### **Core Wrapper Enhancement**

#### **Current POC Pattern**
```typescript
// src/wrapper.ts - Current POC implementation
export class ClaudeWrapper {
  private claudeClient: ClaudeClient;
  private validator: ResponseValidator;

  constructor() {
    this.claudeClient = new ClaudeClient();
    this.validator = new ResponseValidator();
  }

  async handleChatCompletion(request: OpenAIRequest): Promise<OpenAIResponse> {
    const enhancedRequest = this.addFormatInstructions(request);
    const rawResponse = await this.claudeClient.execute(enhancedRequest);
    return this.validateAndCorrect(rawResponse, enhancedRequest);
  }
}
```

#### **Enhanced Production Pattern**
```typescript
// app/src/core/wrapper.ts - Enhanced production version
export class ClaudeWrapper {
  private claudeClient: ClaudeClient;
  private validator: ResponseValidator;
  private sessionManager: SessionManager;
  private logger: Logger;

  constructor(
    claudeClient: ClaudeClient,
    validator: ResponseValidator,
    sessionManager: SessionManager,
    logger: Logger
  ) {
    this.claudeClient = claudeClient;
    this.validator = validator;
    this.sessionManager = sessionManager;
    this.logger = logger;
  }

  async handleChatCompletion(request: OpenAIRequest): Promise<OpenAIResponse> {
    const requestId = this.generateRequestId();
    this.logger.info('Processing chat completion', { requestId, model: request.model });

    try {
      // Session management
      const session = await this.sessionManager.getOrCreateSession(request.session_id);
      const enhancedRequest = this.addFormatInstructions(request, session);
      
      // Execute request
      const rawResponse = await this.claudeClient.execute(enhancedRequest);
      const validatedResponse = await this.validateAndCorrect(rawResponse, enhancedRequest);
      
      // Update session
      await this.sessionManager.updateSession(session.id, enhancedRequest, validatedResponse);
      
      this.logger.info('Chat completion successful', { requestId, tokens: validatedResponse.usage.total_tokens });
      return validatedResponse;
      
    } catch (error) {
      this.logger.error('Chat completion failed', error, { requestId });
      throw error;
    }
  }

  async handleStreamingCompletion(request: OpenAIRequest): Promise<AsyncGenerator<OpenAIStreamChunk>> {
    const requestId = this.generateRequestId();
    this.logger.info('Processing streaming completion', { requestId, model: request.model });

    try {
      const session = await this.sessionManager.getOrCreateSession(request.session_id);
      const enhancedRequest = this.addFormatInstructions(request, session);
      
      const stream = this.claudeClient.executeStreaming(enhancedRequest);
      return this.processStreamingResponse(stream, session, requestId);
      
    } catch (error) {
      this.logger.error('Streaming completion failed', error, { requestId });
      throw error;
    }
  }

  private generateRequestId(): string {
    return `chatcmpl-${Math.random().toString(36).substring(2, 15)}`;
  }
}
```

### **Session Management Pattern**

#### **Simple Session Implementation**
```typescript
// app/src/session/storage.ts - In-memory TTL storage
export interface Session {
  id: string;
  messages: OpenAIMessage[];
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
}

export class SessionStorage {
  private sessions = new Map<string, Session>();
  private cleanupInterval: NodeJS.Timeout;

  constructor(private ttlMinutes: number = 60) {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Clean every minute
  }

  async get(sessionId: string): Promise<Session | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    
    if (session.expiresAt < new Date()) {
      this.sessions.delete(sessionId);
      return null;
    }
    
    return session;
  }

  async set(sessionId: string, session: Session): Promise<void> {
    session.lastActivity = new Date();
    session.expiresAt = new Date(Date.now() + this.ttlMinutes * 60000);
    this.sessions.set(sessionId, session);
  }

  async delete(sessionId: string): Promise<boolean> {
    return this.sessions.delete(sessionId);
  }

  private cleanup(): void {
    const now = new Date();
    for (const [id, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        this.sessions.delete(id);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.sessions.clear();
  }
}
```

#### **Session Manager Pattern**
```typescript
// app/src/session/manager.ts - Session lifecycle management
export class SessionManager {
  constructor(private storage: SessionStorage) {}

  async getOrCreateSession(sessionId?: string): Promise<Session> {
    if (!sessionId) {
      return this.createNewSession();
    }

    const existing = await this.storage.get(sessionId);
    if (existing) {
      return existing;
    }

    return this.createNewSession(sessionId);
  }

  async updateSession(sessionId: string, request: OpenAIRequest, response: OpenAIResponse): Promise<void> {
    const session = await this.storage.get(sessionId);
    if (!session) return;

    // Add messages to session history
    session.messages.push(...request.messages);
    
    if (response.choices?.[0]?.message) {
      session.messages.push(response.choices[0].message);
    }

    await this.storage.set(sessionId, session);
  }

  private createNewSession(id?: string): Session {
    const sessionId = id || `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date();
    
    return {
      id: sessionId,
      messages: [],
      createdAt: now,
      lastActivity: now,
      expiresAt: new Date(now.getTime() + 60 * 60000) // 1 hour
    };
  }
}
```

### **Streaming Implementation Pattern**

#### **Server-Sent Events Handler**
```typescript
// app/src/streaming/handler.ts - SSE streaming implementation
export class StreamingHandler {
  constructor(private logger: Logger) {}

  async createStream(
    request: OpenAIRequest,
    claudeStream: AsyncGenerator<string>,
    sessionId: string
  ): Promise<AsyncGenerator<OpenAIStreamChunk>> {
    const streamId = `chatcmpl-${Math.random().toString(36).substring(2, 15)}`;
    const created = Math.floor(Date.now() / 1000);

    return this.processClaudeStream(claudeStream, {
      id: streamId,
      model: request.model,
      created,
      sessionId
    });
  }

  private async* processClaudeStream(
    claudeStream: AsyncGenerator<string>,
    streamInfo: { id: string; model: string; created: number; sessionId: string }
  ): AsyncGenerator<OpenAIStreamChunk> {
    try {
      let content = '';
      let toolCallBuffer = '';
      
      for await (const chunk of claudeStream) {
        const streamChunk = this.parseClaudeChunk(chunk, streamInfo);
        if (streamChunk) {
          content += streamChunk.choices[0]?.delta?.content || '';
          yield streamChunk;
        }
      }

      // Send final chunk
      yield {
        id: streamInfo.id,
        object: 'chat.completion.chunk',
        created: streamInfo.created,
        model: streamInfo.model,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: 'stop'
        }]
      };

    } catch (error) {
      this.logger.error('Streaming error', error, { streamId: streamInfo.id });
      yield {
        id: streamInfo.id,
        object: 'chat.completion.chunk',
        created: streamInfo.created,
        model: streamInfo.model,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: 'error'
        }]
      };
    }
  }

  private parseClaudeChunk(chunk: string, streamInfo: any): OpenAIStreamChunk | null {
    // Parse Claude's response format and convert to OpenAI streaming format
    try {
      const parsed = JSON.parse(chunk);
      
      return {
        id: streamInfo.id,
        object: 'chat.completion.chunk',
        created: streamInfo.created,
        model: streamInfo.model,
        choices: [{
          index: 0,
          delta: {
            content: parsed.content || ''
          },
          finish_reason: null
        }]
      };
    } catch (error) {
      return null;
    }
  }
}
```

### **Authentication Pattern**

#### **Multi-Provider Authentication**
```typescript
// app/src/auth/providers.ts - Authentication providers
export interface AuthProvider {
  name: string;
  authenticate(credentials: any): Promise<AuthResult>;
  validate(token: string): Promise<boolean>;
}

export interface AuthResult {
  success: boolean;
  token?: string;
  error?: string;
  expiresAt?: Date;
}

export class AnthropicProvider implements AuthProvider {
  name = 'anthropic';

  async authenticate(credentials: { apiKey: string }): Promise<AuthResult> {
    try {
      // Validate API key with Anthropic
      const response = await fetch('https://api.anthropic.com/v1/auth/validate', {
        headers: {
          'Authorization': `Bearer ${credentials.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        return {
          success: true,
          token: credentials.apiKey,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        };
      }

      return {
        success: false,
        error: 'Invalid API key'
      };
    } catch (error) {
      return {
        success: false,
        error: 'Authentication failed'
      };
    }
  }

  async validate(token: string): Promise<boolean> {
    // Simple token validation for demo
    return token.startsWith('sk-ant-');
  }
}

export class CLIProvider implements AuthProvider {
  name = 'cli';

  async authenticate(credentials: any): Promise<AuthResult> {
    // Check if Claude CLI is available and authenticated
    try {
      const { exec } = require('child_process');
      const result = await new Promise<string>((resolve, reject) => {
        exec('claude --version', (error, stdout) => {
          if (error) reject(error);
          else resolve(stdout);
        });
      });

      return {
        success: true,
        token: 'cli-authenticated',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };
    } catch (error) {
      return {
        success: false,
        error: 'Claude CLI not available'
      };
    }
  }

  async validate(token: string): Promise<boolean> {
    return token === 'cli-authenticated';
  }
}
```

#### **Authentication Manager**
```typescript
// app/src/auth/manager.ts - Authentication lifecycle management
export class AuthManager {
  private providers = new Map<string, AuthProvider>();
  private currentAuth: AuthResult | null = null;

  constructor() {
    this.registerProvider(new AnthropicProvider());
    this.registerProvider(new CLIProvider());
  }

  registerProvider(provider: AuthProvider): void {
    this.providers.set(provider.name, provider);
  }

  async authenticate(providerName: string, credentials: any): Promise<AuthResult> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      return {
        success: false,
        error: `Unknown provider: ${providerName}`
      };
    }

    const result = await provider.authenticate(credentials);
    if (result.success) {
      this.currentAuth = result;
    }

    return result;
  }

  async validateRequest(token?: string): Promise<boolean> {
    if (!token && !this.currentAuth) return false;
    
    const authToken = token || this.currentAuth?.token;
    if (!authToken) return false;

    // Find provider that can validate this token
    for (const provider of this.providers.values()) {
      if (await provider.validate(authToken)) {
        return true;
      }
    }

    return false;
  }

  getAuthStatus(): { authenticated: boolean; provider?: string; expiresAt?: Date } {
    if (!this.currentAuth || !this.currentAuth.success) {
      return { authenticated: false };
    }

    return {
      authenticated: true,
      provider: this.getCurrentProvider(),
      expiresAt: this.currentAuth.expiresAt
    };
  }

  private getCurrentProvider(): string {
    // Determine which provider is currently active
    return 'cli'; // Simplified for demo
  }
}
```

### **CLI Interface Pattern**

#### **Command Structure**
```typescript
// app/src/cli/commands.ts - CLI command definitions
import { Command } from 'commander';

export class CLICommands {
  private program: Command;

  constructor() {
    this.program = new Command();
    this.setupCommands();
  }

  private setupCommands(): void {
    this.program
      .name('claude-wrapper')
      .description('Claude Code CLI wrapper with OpenAI compatibility')
      .version('1.0.0');

    this.program
      .command('start')
      .description('Start the Claude wrapper server')
      .option('-p, --port <port>', 'Port to listen on', '3000')
      .option('-d, --daemon', 'Run as daemon')
      .action(this.startServer);

    this.program
      .command('stop')
      .description('Stop the Claude wrapper server')
      .action(this.stopServer);

    this.program
      .command('status')
      .description('Show server status')
      .action(this.showStatus);

    this.program
      .command('setup')
      .description('Interactive setup wizard')
      .action(this.runSetup);
  }

  private async startServer(options: { port: string; daemon: boolean }): Promise<void> {
    const port = parseInt(options.port);
    
    if (options.daemon) {
      // Start as daemon
      await this.startDaemon(port);
    } else {
      // Start in foreground
      await this.startForeground(port);
    }
  }

  private async stopServer(): Promise<void> {
    // Stop daemon process
    console.log('Stopping Claude wrapper server...');
    // Implementation
  }

  private async showStatus(): Promise<void> {
    // Show server status
    console.log('Claude wrapper server status:');
    // Implementation
  }

  private async runSetup(): Promise<void> {
    // Interactive setup wizard
    console.log('Claude wrapper setup wizard');
    // Implementation
  }

  async run(args: string[]): Promise<void> {
    await this.program.parseAsync(args);
  }
}
```

### **Error Handling Pattern**

#### **Error Classification**
```typescript
// app/src/utils/errors.ts - Error handling utilities
export class WrapperError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'WrapperError';
  }
}

export class ValidationError extends WrapperError {
  constructor(message: string, param?: string) {
    super(message, 'invalid_request_error', 400, { param });
  }
}

export class AuthenticationError extends WrapperError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'authentication_error', 401);
  }
}

export class ClaudeError extends WrapperError {
  constructor(message: string, originalError?: Error) {
    super(message, 'claude_error', 502, { originalError: originalError?.message });
  }
}

export function handleError(error: unknown): OpenAIErrorResponse {
  if (error instanceof WrapperError) {
    return {
      error: {
        message: error.message,
        type: error.code,
        code: error.code,
        param: error.details?.param
      }
    };
  }

  if (error instanceof Error) {
    return {
      error: {
        message: 'Internal server error',
        type: 'internal_server_error',
        code: 'internal_error'
      }
    };
  }

  return {
    error: {
      message: 'Unknown error',
      type: 'internal_server_error',
      code: 'unknown_error'
    }
  };
}
```

### **Configuration Pattern**

#### **Environment Configuration**
```typescript
// app/src/config/env.ts - Environment configuration
export interface Config {
  port: number;
  sessionTTL: number;
  claudeModel: string;
  authRequired: boolean;
  logLevel: string;
}

export class ConfigManager {
  private static instance: ConfigManager;
  private config: Config;

  private constructor() {
    this.config = this.loadConfig();
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private loadConfig(): Config {
    return {
      port: parseInt(process.env.PORT || '3000'),
      sessionTTL: parseInt(process.env.SESSION_TTL || '60'),
      claudeModel: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
      authRequired: process.env.AUTH_REQUIRED === 'true',
      logLevel: process.env.LOG_LEVEL || 'info'
    };
  }

  get(): Config {
    return this.config;
  }

  getPort(): number {
    return this.config.port;
  }

  getSessionTTL(): number {
    return this.config.sessionTTL;
  }

  isAuthRequired(): boolean {
    return this.config.authRequired;
  }
}
```

## 🔄 Original Project Extraction Patterns

### **Good Patterns to Extract**

#### **1. Service Layer Pattern**
```typescript
// From claude-wrapper/app/src/services/session-service.ts
export class SessionService {
  constructor(private sessionManager: SessionManager) {}

  async createSession(request: CreateSessionRequest): Promise<Session> {
    // Clean, focused service method
    return this.sessionManager.createSession(request);
  }

  async getSession(sessionId: string): Promise<Session | null> {
    return this.sessionManager.getSession(sessionId);
  }
}
```

#### **2. Request Validation Pattern**
```typescript
// From claude-wrapper/app/src/validation/validator.ts
export class RequestValidator {
  validateChatRequest(request: OpenAIRequest): ValidationResult {
    const errors: string[] = [];

    if (!request.model) {
      errors.push('Model is required');
    }

    if (!request.messages || !Array.isArray(request.messages)) {
      errors.push('Messages must be an array');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
```

### **Over-Engineered Patterns to Avoid**

#### **1. Complex Factory Pattern**
```typescript
// ❌ Don't do this - from original project
interface IClaudeClientFactory {
  createClient(provider: string): IClaudeClient;
}

class ClaudeClientFactory implements IClaudeClientFactory {
  createClient(provider: string): IClaudeClient {
    // Complex factory logic
  }
}

// ✅ Do this instead
class ClaudeWrapper {
  private claudeClient: ClaudeClient;
  
  constructor() {
    this.claudeClient = new ClaudeClient();
  }
}
```

#### **2. Complex Middleware Pipeline**
```typescript
// ❌ Don't do this - overly complex
class ValidationMiddleware {
  validate(request: Request): Promise<ValidationResult> {
    // Complex validation pipeline
  }
}

class AuthMiddleware {
  authenticate(request: Request): Promise<AuthResult> {
    // Complex auth pipeline
  }
}

// ✅ Do this instead - simple middleware
export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = [];
  
  if (!req.body.model) errors.push('Model is required');
  if (!req.body.messages) errors.push('Messages are required');
  
  if (errors.length > 0) {
    return res.status(400).json({ error: { message: errors.join(', ') } });
  }
  
  next();
};
```

## 🚀 Implementation Sequence

### **Phase 1: Core Enhancement**
1. Enhance ClaudeWrapper with dependency injection
2. Add basic logging and error handling
3. Create configuration management
4. Add request validation

### **Phase 2: Session Management**
1. Implement SessionStorage with TTL
2. Create SessionManager for lifecycle management
3. Add session endpoints to API
4. Integrate session support in wrapper

### **Phase 3: Streaming Support**
1. Implement StreamingHandler for SSE
2. Add streaming support to ClaudeClient
3. Create streaming endpoint
4. Add proper connection management

### **Phase 4: Authentication**
1. Implement AuthProvider interface
2. Create provider implementations
3. Add AuthManager for lifecycle
4. Add authentication middleware

### **Phase 5: CLI Interface**
1. Create CLI command structure
2. Add daemon mode support
3. Implement process management
4. Add interactive setup

This structured approach ensures each phase builds on the previous one while maintaining the POC's simplicity and avoiding over-engineering from the original project.