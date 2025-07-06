# Code Examples - Python to TypeScript Conversion

This document provides high-level conversion patterns and strategic examples for porting the Python Claude Code OpenAI Wrapper to TypeScript, focusing on architectural patterns and key implementation strategies.

## 🎯 Conversion Philosophy

These examples demonstrate the strategic approach to porting Python patterns to TypeScript, emphasizing:
- **Framework Translation**: FastAPI → Express.js patterns
- **Type System Migration**: Pydantic → Zod validation
- **Async Pattern Adaptation**: Python asyncio → Node.js async/await
- **Architecture Preservation**: Maintaining identical functionality with TypeScript idioms

## 📊 High-Level Framework Translation

### 1. Web Framework Pattern: FastAPI → Express.js

**Python Pattern** (Declarative with decorators):
```python
from fastapi import FastAPI, HTTPException, Request, Depends

app = FastAPI(title="Claude Code OpenAI API Wrapper")

@app.post("/v1/chat/completions")
async def chat_completions(
    request_body: ChatCompletionRequest,
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
):
    # Auto-validation, dependency injection, error handling
    return await process_chat_request(request_body)
```

**TypeScript Pattern** (Imperative with middleware):
```typescript
import express from 'express';
import { validateRequest } from '../middleware/validation.js';
import { authenticate } from '../middleware/auth.js';

const app = express();

app.post('/v1/chat/completions', 
  authenticate,
  validateRequest(ChatCompletionRequestSchema),
  async (req, res, next) => {
    try {
      const result = await processChatRequest(req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);
```

**Key Translation Concepts**:
- **Dependency Injection** → Middleware chain
- **Auto-validation** → Explicit validation middleware
- **Exception handling** → Error middleware + try/catch

### 2. Validation Pattern: Pydantic → Zod

**Python Pattern** (Class-based with decorators):
```python
from pydantic import BaseModel, Field, field_validator

class ChatCompletionRequest(BaseModel):
    model: str
    messages: List[Message]
    temperature: Optional[float] = Field(default=1.0, ge=0, le=2)
    
    @field_validator('messages')
    @classmethod
    def validate_messages(cls, v):
        if len(v) == 0:
            raise ValueError("Messages array cannot be empty")
        return v
```

**TypeScript Pattern** (Schema-based with transforms):
```typescript
import { z } from 'zod';

export const ChatCompletionRequestSchema = z.object({
  model: z.string(),
  messages: z.array(MessageSchema).min(1, "Messages array cannot be empty"),
  temperature: z.number().min(0).max(2).default(1.0)
}).transform((data) => {
  // Custom validation logic here
  return data;
});

export type ChatCompletionRequest = z.infer<typeof ChatCompletionRequestSchema>;
```

**Key Translation Concepts**:
- **Class inheritance** → Schema composition
- **Decorators** → Method chaining
- **Field validators** → Schema transforms
- **Type inference** → `z.infer<typeof Schema>`

### 3. Authentication Pattern: Class-based → Strategy Pattern

**Python Pattern** (Monolithic class):
```python
class ClaudeCodeAuthManager:
    def __init__(self):
        self.auth_method = self._detect_auth_method()
        self.auth_status = self._validate_auth_method()
    
    def _validate_auth_method(self):
        if self.auth_method == "anthropic":
            return self._validate_anthropic_auth()
        elif self.auth_method == "bedrock":
            return self._validate_bedrock_auth()
        # ... more conditions
```

**TypeScript Pattern** (Strategy with polymorphism):
```typescript
abstract class AuthProvider {
  abstract validate(): Promise<AuthResult>;
  abstract getEnvVars(): Record<string, string>;
}

class AuthProviderFactory {
  static create(method: string): AuthProvider {
    switch (method) {
      case 'anthropic': return new AnthropicAuthProvider();
      case 'bedrock': return new BedrockAuthProvider();
      default: throw new Error(`Unknown auth method: ${method}`);
    }
  }
}

class ClaudeCodeAuthManager {
  private provider: AuthProvider;
  
  constructor() {
    const method = this.detectAuthMethod();
    this.provider = AuthProviderFactory.create(method);
  }
}
```

**Key Translation Concepts**:
- **If/else chains** → Factory pattern + Strategy pattern
- **Method organization** → Interface segregation
- **Validation logic** → Provider-specific classes

## 🔄 Async Pattern Translation

### 1. Python asyncio → Node.js async/await

**Python Pattern** (asyncio with context managers):
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Verifying Claude Code authentication...")
    auth_valid, auth_info = validate_claude_code_auth()
    session_manager.start_cleanup_task()
    
    yield
    
    # Shutdown
    logger.info("Shutting down session manager...")
    session_manager.shutdown()

app = FastAPI(lifespan=lifespan)
```

**TypeScript Pattern** (Event-based lifecycle):
```typescript
class Application {
  private server: Server | null = null;
  
  async start(): Promise<void> {
    // Startup sequence
    await this.validateAuthentication();
    this.sessionManager.startCleanupTask();
    
    this.server = app.listen(port, () => {
      logger.info('Server started');
    });
    
    // Graceful shutdown handlers
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }
  
  private async shutdown(): Promise<void> {
    logger.info('Shutting down...');
    
    if (this.server) {
      this.server.close();
    }
    
    this.sessionManager.shutdown();
    process.exit(0);
  }
}
```

**Key Translation Concepts**:
- **Context managers** → Class-based lifecycle management
- **FastAPI lifespan** → Process signal handlers
- **Async generators** → Event emitters or async iterators

### 2. Session Management: Python Threading → Node.js Single-threaded

**Python Pattern** (Thread locks):
```python
from threading import Lock

class SessionManager:
    def __init__(self):
        self.sessions: Dict[str, Session] = {}
        self.lock = Lock()
    
    def get_session(self, session_id: str):
        with self.lock:
            return self.sessions.get(session_id)
```

**TypeScript Pattern** (Atomic operations):
```typescript
// Node.js is single-threaded, but we can use async/await for atomicity
class SessionManager {
  private sessions = new Map<string, Session>();
  private mutex = new Mutex(); // from 'async-mutex' package
  
  async getSession(sessionId: string): Promise<Session | null> {
    return await this.mutex.runExclusive(() => {
      return this.sessions.get(sessionId) || null;
    });
  }
}
```

**Key Translation Concepts**:
- **Threading locks** → Async mutex or atomic operations
- **Dict/Map operations** → Similar but with async wrappers
- **Shared state** → Still needs protection even in single-threaded Node.js

## 🎛️ Configuration and Environment

### Environment Variable Management

**Python Pattern**:
```python
from dotenv import load_dotenv
import os

load_dotenv()

DEBUG_MODE = os.getenv('DEBUG_MODE', 'false').lower() in ('true', '1', 'yes', 'on')
PORT = int(os.getenv('PORT', '8000'))
```

**TypeScript Pattern**:
```typescript
import dotenv from 'dotenv';
dotenv.config();

interface Config {
  DEBUG_MODE: boolean;
  VERBOSE: boolean;
  PORT: number;
  CORS_ORIGINS: string;
  MAX_TIMEOUT: number;
}

export const config: Config = {
  DEBUG_MODE: ['true', '1', 'yes', 'on'].includes(process.env.DEBUG_MODE?.toLowerCase() || 'false'),
  VERBOSE: ['true', '1', 'yes', 'on'].includes(process.env.VERBOSE?.toLowerCase() || 'false'),
  PORT: parseInt(process.env.PORT || '8000', 10),
  CORS_ORIGINS: process.env.CORS_ORIGINS || '["*"]',
  MAX_TIMEOUT: parseInt(process.env.MAX_TIMEOUT || '600000', 10)
};
```

**Key Translation Concepts**:
- **Environment parsing** → Type-safe configuration objects
- **Default values** → Explicit fallbacks with type safety
- **Boolean parsing** → Consistent string-to-boolean conversion

## 📨 Message Processing Patterns

### Content Filtering Strategy

**Python Pattern** (Static methods with regex):
```python
class MessageAdapter:
    @staticmethod
    def filter_content(content: str) -> str:
        # Multiple regex patterns applied sequentially
        content = re.sub(r'<thinking>.*?</thinking>', '', content, flags=re.DOTALL)
        content = re.sub(r'<tool_use>.*?</tool_use>', '', content, flags=re.DOTALL)
        return content.strip()
```

**TypeScript Pattern** (Class with strategy pattern):
```typescript
interface ContentFilter {
  filter(content: string): string;
}

class ThinkingBlockFilter implements ContentFilter {
  filter(content: string): string {
    return content.replace(/<thinking>.*?<\/thinking>/gs, '');
  }
}

class ToolUsageFilter implements ContentFilter {
  filter(content: string): string {
    return content.replace(/<tool_use>.*?<\/tool_use>/gs, '');
  }
}

class ContentFilterPipeline {
  private filters: ContentFilter[] = [
    new ThinkingBlockFilter(),
    new ToolUsageFilter(),
    // ... more filters
  ];
  
  filter(content: string): string {
    return this.filters.reduce((acc, filter) => filter.filter(acc), content);
  }
}
```

**Key Translation Concepts**:
- **Static methods** → Strategy pattern for extensibility
- **Sequential processing** → Pipeline pattern
- **Regex operations** → Encapsulated in specific filter classes

## 🌐 API Response Patterns

### Streaming Response Translation

**Python Pattern** (FastAPI streaming):
```python
async def generate_streaming_response():
    async for chunk in claude_cli.run_completion():
        stream_chunk = ChatCompletionStreamResponse(...)
        yield f"data: {stream_chunk.model_dump_json()}\n\n"
    yield "data: [DONE]\n\n"

@app.post("/v1/chat/completions")
async def chat_completions():
    if request_body.stream:
        return StreamingResponse(
            generate_streaming_response(),
            media_type="text/event-stream"
        )
```

**TypeScript Pattern** (Express SSE):
```typescript
async function generateStreamingResponse(res: Response): Promise<void> {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  
  try {
    for await (const chunk of claudeClient.runCompletion()) {
      const streamChunk = new ChatCompletionStreamResponse(...);
      res.write(`data: ${JSON.stringify(streamChunk)}\n\n`);
    }
    res.write('data: [DONE]\n\n');
  } finally {
    res.end();
  }
}
```

**Key Translation Concepts**:
- **FastAPI StreamingResponse** → Express manual SSE headers
- **Async generators** → Async iterators with for-await-of
- **Automatic serialization** → Manual JSON.stringify

## 🔧 Error Handling Translation

### Exception Handling Patterns

**Python Pattern** (FastAPI exception handlers):
```python
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"error": {"message": "Validation failed", "details": exc.errors()}}
    )

@app.post("/endpoint")
async def endpoint():
    try:
        return await process_request()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

**TypeScript Pattern** (Express error middleware):
```typescript
// Error handling middleware
function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  if (err instanceof ValidationError) {
    res.status(422).json({
      error: {
        message: "Validation failed",
        details: err.details
      }
    });
    return;
  }
  
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: { message: 'Internal server error' }
  });
}

// Route handler
app.post('/endpoint', async (req, res, next) => {
  try {
    const result = await processRequest();
    res.json(result);
  } catch (error) {
    next(error); // Passes to error middleware
  }
});
```

**Key Translation Concepts**:
- **Exception handlers** → Error middleware
- **HTTPException** → Status codes + JSON responses
- **Centralized error handling** → Middleware pattern

## 📋 Implementation Strategy Summary

### Phase-by-Phase Translation Approach

1. **Foundation Phase** (Phases 1-6):
   - **Focus**: Basic server setup, environment, logging, security
   - **Pattern**: Direct translation with Node.js equivalents
   - **Key Changes**: FastAPI → Express, Python logging → Winston

2. **Data Modeling Phase** (Phases 7-13):
   - **Focus**: All data structures and validation
   - **Pattern**: Pydantic → Zod with type inference
   - **Key Changes**: Class-based models → Schema-based validation

3. **Authentication Phase** (Phases 14-18):
   - **Focus**: Multi-provider authentication system
   - **Pattern**: Monolithic class → Strategy pattern
   - **Key Changes**: Method switching → Provider classes

4. **Core Logic Phase** (Phases 19-24):
   - **Focus**: Message processing and session management
   - **Pattern**: Static methods → Service classes
   - **Key Changes**: Threading → Async mutex

5. **Integration Phase** (Phases 25-26):
   - **Focus**: Claude SDK and parameter validation
   - **Pattern**: Direct translation with async adaptation
   - **Key Changes**: Python SDK calls → Node.js SDK calls

6. **API Phase** (Phase 27):
   - **Focus**: All HTTP endpoints
   - **Pattern**: FastAPI decorators → Express middleware
   - **Key Changes**: Auto-validation → Explicit middleware chain

### Critical Translation Principles

- **Preserve Behavior**: Every Python function must have identical TypeScript behavior
- **Improve Architecture**: Use TypeScript's type system and design patterns for better structure
- **Maintain Compatibility**: All OpenAI API contracts must remain identical
- **Follow Conventions**: Use Node.js/TypeScript idioms while preserving Python logic

This high-level approach focuses on architectural patterns and translation strategies rather than detailed line-by-line conversion, making it easier to understand the overall porting approach.