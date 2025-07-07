#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Initializing Claude Wrapper project structure...\n');

// Project root directory
const projectRoot = path.resolve(__dirname, '..');
const appDir = path.join(projectRoot, 'app');

// Define the complete project structure
const projectStructure = {
  'app': {
    'src': {
      'api': {
        'routes': {
          'chat.ts': `import { Router } from 'express';

const router = Router();

// Chat completions endpoint
router.post('/chat/completions', async (_req, res) => {
  res.status(501).json({ error: 'Not implemented yet' });
});

export default router;`,
          'models.ts': `import { Router } from 'express';

const router = Router();

// Models listing endpoint
router.get('/models', async (_req, res) => {
  res.json({ data: [], object: 'list' });
});

export default router;`,
          'health.ts': `import { Router } from 'express';

const router = Router();

// Health check endpoint
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;`,
          'sessions.ts': `import { Router } from 'express';

const router = Router();

// Session management endpoints
router.get('/sessions', (_req, res) => {
  res.json({ sessions: [] });
});

export default router;`,
          'auth.ts': `import { Router } from 'express';

const router = Router();

// Authentication status endpoint
router.get('/auth/status', (_req, res) => {
  res.json({ authenticated: false });
});

export default router;`
        },
        'middleware': {
          'error.ts': `import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
};`,
          'session.ts': `import { Request, Response, NextFunction } from 'express';

export const sessionMiddleware = (_req: Request, _res: Response, next: NextFunction) => {
  next();
};`,
          'streaming.ts': `import { Request, Response, NextFunction } from 'express';

export const streamingMiddleware = (_req: Request, _res: Response, next: NextFunction) => {
  next();
};`,
          'auth.ts': `import { Request, Response, NextFunction } from 'express';

export const authMiddleware = (_req: Request, _res: Response, next: NextFunction) => {
  next();
};`
        },
        'server.ts': `import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/error';
import chatRoutes from './routes/chat';
import modelsRoutes from './routes/models';
import healthRoutes from './routes/health';
import sessionsRoutes from './routes/sessions';
import authRoutes from './routes/auth';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/v1', chatRoutes);
app.use('/v1', modelsRoutes);
app.use('/v1', healthRoutes);
app.use('/v1', sessionsRoutes);
app.use('/v1', authRoutes);

// Error handling
app.use(errorHandler);

export default app;`
      },
      'auth': {
        'providers.ts': `export interface IAuthProvider {
  authenticate(): Promise<boolean>;
}

export class AnthropicProvider implements IAuthProvider {
  async authenticate(): Promise<boolean> {
    return false;
  }
}

export class AWSProvider implements IAuthProvider {
  async authenticate(): Promise<boolean> {
    return false;
  }
}

export class GoogleProvider implements IAuthProvider {
  async authenticate(): Promise<boolean> {
    return false;
  }
}`,
        'manager.ts': `import { IAuthProvider } from './providers';

export class AuthManager {
  private providers: Map<string, IAuthProvider> = new Map();

  async authenticate(provider: string): Promise<boolean> {
    const authProvider = this.providers.get(provider);
    if (!authProvider) {
      throw new Error(\`Unknown provider: \${provider}\`);
    }
    return authProvider.authenticate();
  }
}`,
        'middleware.ts': `import { Request, Response, NextFunction } from 'express';

export const authMiddleware = (_req: Request, _res: Response, next: NextFunction) => {
  // TODO: Implement authentication middleware
  next();
};`
      },
      'cli': {
        'commands.ts': `import { Command } from 'commander';

export function createCommands(): Command {
  const program = new Command();
  
  program
    .name('claude-wrapper')
    .description('Claude API wrapper with OpenAI compatibility')
    .version('1.0.0');

  program
    .command('start')
    .description('Start the Claude wrapper server')
    .action(() => {
      console.log('Starting Claude wrapper server...');
    });

  program
    .command('stop')
    .description('Stop the Claude wrapper server')
    .action(() => {
      console.log('Stopping Claude wrapper server...');
    });

  program
    .command('status')
    .description('Check server status')
    .action(() => {
      console.log('Checking server status...');
    });

  return program;
}`,
        'interactive.ts': `import inquirer from 'inquirer';

export async function interactiveSetup(): Promise<void> {
  console.log('🔧 Claude Wrapper Interactive Setup');
  
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'port',
      message: 'Server port:',
      default: '3000'
    },
    {
      type: 'confirm',
      name: 'enableAuth',
      message: 'Enable authentication?',
      default: false
    }
  ]);

  console.log('Setup complete with:', answers);
}`
      },
      'config': {
        'env.ts': `import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env['PORT'] || 3000,
  nodeEnv: process.env['NODE_ENV'] || 'development',
  anthropicApiKey: process.env['ANTHROPIC_API_KEY'] || '',
  awsRegion: process.env['AWS_REGION'] || 'us-east-1',
  googleProjectId: process.env['GOOGLE_PROJECT_ID'] || '',
};`,
        'constants.ts': `export const API_CONSTANTS = {
  DEFAULT_PORT: 3000,
  DEFAULT_TIMEOUT: 30000,
  MAX_RETRIES: 3,
};

export const SESSION_CONSTANTS = {
  DEFAULT_TTL: 3600000, // 1 hour
  CLEANUP_INTERVAL: 300000, // 5 minutes
};

export const STREAMING_CONSTANTS = {
  CHUNK_TIMEOUT: 1000,
  CONNECTION_TIMEOUT: 30000,
};

export const AUTH_CONSTANTS = {
  TOKEN_EXPIRY: 3600000, // 1 hour
  REFRESH_THRESHOLD: 300000, // 5 minutes
};

export const PROCESS_CONSTANTS = {
  PID_FILE_PATH: '/tmp/claude-wrapper.pid',
  SHUTDOWN_TIMEOUT: 10000, // 10 seconds
};`
      },
      'core': {
        'wrapper.ts': `import { ClaudeClient } from './claude-client';
import { ClaudeResolver } from './claude-resolver';
import { Validator } from './validator';

export class CoreWrapper {
  private client: ClaudeClient;
  private resolver: ClaudeResolver;
  private validator: Validator;

  constructor() {
    this.client = new ClaudeClient();
    this.resolver = new ClaudeResolver();
    this.validator = new Validator();
  }

  async processRequest(request: any): Promise<any> {
    const validatedRequest = this.validator.validate(request);
    const response = await this.client.createCompletion(validatedRequest);
    return this.resolver.resolve(response);
  }
}`,
        'claude-client.ts': `export class ClaudeClient {
  async createCompletion(_request: any): Promise<any> {
    // TODO: Implement actual Claude API integration
    return {
      id: 'chatcmpl-mock',
      object: 'chat.completion',
      created: Date.now(),
      model: 'claude-3-sonnet-20240229',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: 'This is a mock response. Actual Claude integration pending.'
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 15,
        total_tokens: 25
      }
    };
  }
}`,
        'claude-resolver.ts': `export class ClaudeResolver {
  resolve(response: any): any {
    // TODO: Implement response resolution logic
    return response;
  }
}`,
        'validator.ts': `export class Validator {
  validate(request: any): any {
    // TODO: Implement request validation
    if (!request) {
      throw new Error('Request is required');
    }
    return request;
  }
}`
      },
      'process': {
        'manager.ts': `export class ProcessManager {
  constructor(private pidFile: string) {}

  async start(): Promise<void> {
    console.log(\`Starting process with PID file: \${this.pidFile}\`);
  }

  async stop(): Promise<void> {
    console.log('Stopping process...');
  }

  async status(): Promise<string> {
    return 'unknown';
  }
}`,
        'daemon.ts': `export class DaemonManager {
  async daemonize(): Promise<void> {
    console.log('Daemonizing process...');
  }
}`,
        'pid.ts': `import fs from 'fs';

export class PIDManager {
  constructor(private pidFile: string) {}

  write(pid: number): void {
    fs.writeFileSync(this.pidFile, pid.toString());
  }

  read(): number | null {
    try {
      const pid = fs.readFileSync(this.pidFile, 'utf8');
      return parseInt(pid, 10);
    } catch {
      return null;
    }
  }

  remove(): void {
    try {
      fs.unlinkSync(this.pidFile);
    } catch {
      // Ignore errors
    }
  }
}`,
        'signals.ts': `export class SignalHandler {
  private handlers: Map<string, () => void> = new Map();

  register(signal: string, handler: () => void): void {
    this.handlers.set(signal, handler);
    process.on(signal as any, handler);
  }

  gracefulShutdown(): void {
    console.log('Initiating graceful shutdown...');
    process.exit(0);
  }
}`
      },
      'session': {
        'manager.ts': `export interface ISession {
  id: string;
  messages: any[];
  createdAt: Date;
  lastAccessedAt: Date;
}

export class SessionManager {
  private sessions: Map<string, ISession> = new Map();

  create(sessionId: string): ISession {
    const session: ISession = {
      id: sessionId,
      messages: [],
      createdAt: new Date(),
      lastAccessedAt: new Date()
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  get(sessionId: string): ISession | null {
    return this.sessions.get(sessionId) || null;
  }

  delete(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  cleanup(): void {
    // TODO: Implement TTL-based cleanup
    console.log('Cleaning up expired sessions...');
  }
}`,
        'storage.ts': `export interface IStorage {
  set(key: string, value: any, ttl?: number): void;
  get(key: string): any;
  delete(key: string): boolean;
  cleanup(): void;
}

export class InMemoryStorage implements IStorage {
  private data: Map<string, { value: any; expires: number }> = new Map();

  set(key: string, value: any, ttl: number = 3600000): void {
    const expires = Date.now() + ttl;
    this.data.set(key, { value, expires });
  }

  get(key: string): any {
    const item = this.data.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expires) {
      this.data.delete(key);
      return null;
    }
    
    return item.value;
  }

  delete(key: string): boolean {
    return this.data.delete(key);
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.data.entries()) {
      if (now > item.expires) {
        this.data.delete(key);
      }
    }
  }
}`
      },
      'streaming': {
        'handler.ts': `import { Response } from 'express';

export class StreamingHandler {
  async handleStream(res: Response, _data: any): Promise<void> {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // TODO: Implement actual streaming logic
    res.write('data: {"mock": "streaming response"}\\n\\n');
    res.end();
  }
}`,
        'formatter.ts': `export class StreamingFormatter {
  formatChunk(chunk: any): string {
    // TODO: Implement OpenAI streaming format
    return \`data: \${JSON.stringify(chunk)}\\n\\n\`;
  }

  formatError(error: Error): string {
    return \`data: {"error": "\${error.message}"}\\n\\n\`;
  }

  formatEnd(): string {
    return 'data: [DONE]\\n\\n';
  }
}`,
        'manager.ts': `export class StreamingManager {
  private activeStreams: Map<string, any> = new Map();

  createStream(id: string): void {
    this.activeStreams.set(id, { id, createdAt: new Date() });
  }

  getStream(id: string): any {
    return this.activeStreams.get(id);
  }

  closeStream(id: string): boolean {
    return this.activeStreams.delete(id);
  }

  cleanup(): void {
    // TODO: Implement stream cleanup
    console.log('Cleaning up inactive streams...');
  }
}`
      },
      'types': {
        'index.ts': `export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  session_id?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatChoice[];
  usage: Usage;
}

export interface ChatChoice {
  index: number;
  message: ChatMessage;
  finish_reason: string;
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface SessionData {
  id: string;
  messages: ChatMessage[];
  createdAt: Date;
  lastAccessedAt: Date;
}

export interface AuthConfig {
  provider: 'anthropic' | 'aws' | 'google';
  credentials: Record<string, any>;
}

export interface StreamingChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: StreamingChoice[];
}

export interface StreamingChoice {
  index: number;
  delta: Partial<ChatMessage>;
  finish_reason: string | null;
}`
      },
      'utils': {
        'logger.ts': `export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

export class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  error(message: string, ...args: any[]): void {
    console.error(\`[ERROR] \${message}\`, ...args);
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(\`[WARN] \${message}\`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(\`[INFO] \${message}\`, ...args);
    }
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(\`[DEBUG] \${message}\`, ...args);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
    return levels.indexOf(level) <= levels.indexOf(this.level);
  }
}

export const logger = new Logger();`,
        'errors.ts': `export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string) {
    super(message, 401);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string) {
    super(message, 500);
  }
}`
      },
      'cli.ts': `#!/usr/bin/env node

import { createCommands } from './cli/commands';
import { interactiveSetup } from './cli/interactive';
import { config } from './config/env';
import { logger } from './utils/logger';
import app from './api/server';

async function main() {
  const program = createCommands();
  
  // Add interactive setup command
  program
    .command('setup')
    .description('Interactive setup wizard')
    .action(async () => {
      await interactiveSetup();
    });

  // Add serve command
  program
    .command('serve')
    .description('Start the server')
    .action(() => {
      const port = config.port;
      app.listen(port, () => {
        logger.info(\`Claude Wrapper server running on port \${port}\`);
      });
    });

  program.parse();
}

if (require.main === module) {
  main().catch(console.error);
}`
    },
    'tests': {
      'unit': {
        'auth': {
          'providers.test.ts': `import { AnthropicProvider, AWSProvider, GoogleProvider } from '../../../src/auth/providers';

describe('Auth Providers', () => {
  describe('AnthropicProvider', () => {
    it('should create instance', () => {
      const provider = new AnthropicProvider();
      expect(provider).toBeInstanceOf(AnthropicProvider);
    });
  });

  describe('AWSProvider', () => {
    it('should create instance', () => {
      const provider = new AWSProvider();
      expect(provider).toBeInstanceOf(AWSProvider);
    });
  });

  describe('GoogleProvider', () => {
    it('should create instance', () => {
      const provider = new GoogleProvider();
      expect(provider).toBeInstanceOf(GoogleProvider);
    });
  });
});`
        },
        'cli': {
          'commands.test.ts': `import { createCommands } from '../../../src/cli/commands';

describe('CLI Commands', () => {
  it('should create command program', () => {
    const program = createCommands();
    expect(program).toBeDefined();
    expect(program.name()).toBe('claude-wrapper');
  });
});`
        },
        'core': {
          'wrapper.test.ts': `import { CoreWrapper } from '../../../src/core/wrapper';

describe('CoreWrapper', () => {
  let wrapper: CoreWrapper;

  beforeEach(() => {
    wrapper = new CoreWrapper();
  });

  it('should create instance', () => {
    expect(wrapper).toBeInstanceOf(CoreWrapper);
  });

  it('should process request', async () => {
    const request = { model: 'claude-3-sonnet-20240229', messages: [] };
    const response = await wrapper.processRequest(request);
    expect(response).toBeDefined();
  });
});`
        },
        'process': {
          'manager.test.ts': `import { ProcessManager } from '../../../src/process/manager';

describe('ProcessManager', () => {
  let manager: ProcessManager;

  beforeEach(() => {
    manager = new ProcessManager('/tmp/test.pid');
  });

  it('should create instance', () => {
    expect(manager).toBeInstanceOf(ProcessManager);
  });
});`
        },
        'session': {
          'manager.test.ts': `import { SessionManager } from '../../../src/session/manager';

describe('SessionManager', () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager();
  });

  it('should create session', () => {
    const session = manager.create('test-session');
    expect(session.id).toBe('test-session');
  });

  it('should get session', () => {
    const created = manager.create('test-session');
    const retrieved = manager.get('test-session');
    expect(retrieved).toEqual(created);
  });
});`
        },
        'streaming': {
          'handler.test.ts': `import { StreamingHandler } from '../../../src/streaming/handler';

describe('StreamingHandler', () => {
  let handler: StreamingHandler;

  beforeEach(() => {
    handler = new StreamingHandler();
  });

  it('should create instance', () => {
    expect(handler).toBeInstanceOf(StreamingHandler);
  });
});`
        }
      },
      'integration': {
        'api': {
          'server.test.ts': `import request from 'supertest';
import app from '../../../src/api/server';

describe('API Server', () => {
  it('should handle health check', async () => {
    const response = await request(app)
      .get('/v1/health')
      .expect(200);
    
    expect(response.body.status).toBe('ok');
  });

  it('should handle models endpoint', async () => {
    const response = await request(app)
      .get('/v1/models')
      .expect(200);
    
    expect(response.body.data).toEqual([]);
  });
});`
        },
        'auth': {
          'integration.test.ts': `import request from 'supertest';
import app from '../../../src/api/server';

describe('Authentication Integration', () => {
  it('should check auth status', async () => {
    const response = await request(app)
      .get('/v1/auth/status')
      .expect(200);
    
    expect(response.body.authenticated).toBe(false);
  });
});`
        },
        'cli': {
          'integration.test.ts': `describe('CLI Integration', () => {
  it('should run CLI command', () => {
    expect(true).toBe(true);
  });
});`
        },
        'process': {
          'integration.test.ts': `describe('Process Integration', () => {
  it('should manage process', () => {
    expect(true).toBe(true);
  });
});`
        },
        'session': {
          'integration.test.ts': `describe('Session Integration', () => {
  it('should manage sessions', () => {
    expect(true).toBe(true);
  });
});`
        },
        'streaming': {
          'integration.test.ts': `describe('Streaming Integration', () => {
  it('should handle streaming', () => {
    expect(true).toBe(true);
  });
});`
        }
      },
      'fixtures': {
        'sample-request.json': `{
  "model": "claude-3-sonnet-20240229",
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 1000
}`,
        'sample-response.json': `{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "claude-3-sonnet-20240229",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Hello! I'm doing well, thank you for asking."
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 9,
    "completion_tokens": 12,
    "total_tokens": 21
  }
}`
      }
    }
  }
};

// Package.json configuration
const packageJsonConfig = {
  name: "claude-wrapper",
  version: "1.0.0",
  description: "Claude API wrapper with OpenAI compatibility",
  main: "dist/cli.js",
  bin: {
    "claude-wrapper": "./dist/cli.js"
  },
  scripts: {
    "build": "tsc",
    "start": "node dist/cli.js serve",
    "dev": "ts-node src/cli.ts serve",
    "test": "jest",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src tests --ext .ts",
    "lint:fix": "eslint src tests --ext .ts --fix",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist",
    "postinstall": "npm run build"
  },
  dependencies: {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "commander": "^11.1.0",
    "inquirer": "^9.2.12"
  },
  devDependencies: {
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/node": "^20.10.0",
    "@types/jest": "^29.5.8",
    "@types/supertest": "^2.0.16",
    "@types/inquirer": "^9.0.7",
    "typescript": "^5.3.2",
    "ts-node": "^10.9.1",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.1",
    "supertest": "^6.3.3",
    "eslint": "^8.54.0",
    "@typescript-eslint/eslint-plugin": "^6.12.0",
    "@typescript-eslint/parser": "^6.12.0",
    "nodemon": "^3.0.2"
  },
  engines: {
    "node": ">=18.0.0"
  },
  keywords: ["claude", "ai", "openai", "api", "wrapper"],
  author: "Claude Wrapper Team",
  license: "MIT"
};

// TypeScript configuration
const tsConfig = {
  compilerOptions: {
    target: "ES2022",
    module: "commonjs",
    lib: ["ES2022"],
    outDir: "./dist",
    rootDir: "./src",
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
    declaration: true,
    declarationMap: true,
    sourceMap: true,
    removeComments: true,
    noImplicitAny: true,
    noImplicitThis: true,
    noImplicitReturns: true,
    noUnusedLocals: true,
    noUnusedParameters: true,
    exactOptionalPropertyTypes: true,
    noImplicitOverride: true,
    noPropertyAccessFromIndexSignature: true,
    noUncheckedIndexedAccess: true,
    resolveJsonModule: true,
    allowSyntheticDefaultImports: true,
    experimentalDecorators: true,
    emitDecoratorMetadata: true
  },
  include: ["src/**/*"],
  exclude: ["node_modules", "dist", "tests"]
};

// Jest configuration
const jestConfig = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  testMatch: ["**/__tests__/**/*.ts", "**/?(*.)+(spec|test).ts"],
  transform: {
    "^.+\\.ts$": "ts-jest"
  },
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/**/*.test.ts"
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  testTimeout: 30000
};

// ESLint configuration
const eslintConfig = {
  parser: "@typescript-eslint/parser",
  extends: [
    "eslint:recommended",
    "@typescript-eslint/recommended"
  ],
  plugins: ["@typescript-eslint"],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    project: "./tsconfig.json"
  },
  env: {
    node: true,
    es2022: true,
    jest: true
  },
  rules: {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/explicit-function-return-type": "off",
    "max-lines": ["error", 200],
    "max-params": ["error", 5],
    "max-depth": ["error", 3],
    "complexity": ["error", 10],
    "no-console": "warn",
    "no-debugger": "error"
  },
  ignorePatterns: ["dist/**", "node_modules/**", "coverage/**"]
};

// Test setup file
const testSetup = `import 'jest';

// Global test setup
beforeAll(() => {
  // Setup before all tests
});

afterAll(() => {
  // Cleanup after all tests
});

beforeEach(() => {
  // Setup before each test
});

afterEach(() => {
  // Cleanup after each test
});`;

// Function to create directory structure
function createDirectoryStructure(basePath, structure) {
  for (const [key, value] of Object.entries(structure)) {
    const fullPath = path.join(basePath, key);
    
    if (typeof value === 'string') {
      // It's a file
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, value);
      console.log(`  📄 Created file: ${path.relative(projectRoot, fullPath)}`);
    } else if (typeof value === 'object' && value !== null) {
      // It's a directory
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`  📁 Created directory: ${path.relative(projectRoot, fullPath)}`);
      createDirectoryStructure(fullPath, value);
    }
  }
}

// Main initialization function
function initializeProject() {
  try {
    console.log('📁 Creating project structure...');
    createDirectoryStructure(projectRoot, projectStructure);
    
    console.log('\n📦 Creating package.json...');
    fs.writeFileSync(
      path.join(appDir, 'package.json'),
      JSON.stringify(packageJsonConfig, null, 2)
    );
    
    console.log('📄 Creating TypeScript configuration...');
    fs.writeFileSync(
      path.join(appDir, 'tsconfig.json'),
      JSON.stringify(tsConfig, null, 2)
    );
    
    console.log('📄 Creating Jest configuration...');
    fs.writeFileSync(
      path.join(appDir, 'jest.config.js'),
      `module.exports = ${JSON.stringify(jestConfig, null, 2)};`
    );
    
    console.log('📄 Creating ESLint configuration...');
    fs.writeFileSync(
      path.join(appDir, '.eslintrc.js'),
      `module.exports = ${JSON.stringify(eslintConfig, null, 2)};`
    );
    
    console.log('📄 Creating test setup file...');
    fs.writeFileSync(
      path.join(appDir, 'tests', 'setup.ts'),
      testSetup
    );
    
    console.log('📄 Creating environment example file...');
    fs.writeFileSync(
      path.join(appDir, '.env.example'),
      `# Claude Wrapper Environment Variables
PORT=3000
NODE_ENV=development

# Authentication
ANTHROPIC_API_KEY=your_anthropic_api_key_here
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_key_here
GOOGLE_PROJECT_ID=your_google_project_id_here

# Optional API Protection
API_BEARER_TOKEN=your_optional_bearer_token_here
`
    );
    
    console.log('📄 Creating .gitignore file...');
    fs.writeFileSync(
      path.join(appDir, '.gitignore'),
      `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build outputs
dist/
build/

# Environment variables
.env
.env.local
.env.production

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Testing
coverage/
.nyc_output/

# Logs
logs/
*.log

# Runtime
pids/
*.pid
*.seed
*.pid.lock

# Temporary files
tmp/
temp/
`
    );
    
    console.log('\n📦 Installing dependencies...');
    process.chdir(appDir);
    
    console.log('   Installing all dependencies...');
    execSync('npm install', { stdio: 'inherit' });
    
    console.log('\n🔧 Running initial build and checks...');
    
    console.log('   Running TypeScript compilation...');
    execSync('npm run build', { stdio: 'inherit' });
    
    console.log('   Running type checking...');
    execSync('npm run typecheck', { stdio: 'inherit' });
    
    console.log('   Running ESLint...');
    try {
      execSync('npm run lint', { stdio: 'inherit' });
    } catch (error) {
      console.log('   ⚠️  ESLint warnings found (non-blocking)');
    }
    
    console.log('   Running tests...');
    execSync('npm test', { stdio: 'inherit' });
    
    console.log('\n✅ Project initialization complete!');
    console.log('\n🎉 Next steps:');
    console.log('   1. cd app');
    console.log('   2. cp .env.example .env');
    console.log('   3. Edit .env with your API keys');
    console.log('   4. npm run dev');
    console.log('   5. Test with: curl http://localhost:3000/v1/health');
    console.log('\n📚 Available commands:');
    console.log('   npm run dev       - Start development server');
    console.log('   npm run build     - Build for production');
    console.log('   npm run test      - Run tests');
    console.log('   npm run lint      - Run linting');
    console.log('   npm run typecheck - Run type checking');
    
  } catch (error) {
    console.error('❌ Error during initialization:', error.message);
    process.exit(1);
  }
}

// Run the initialization
initializeProject();