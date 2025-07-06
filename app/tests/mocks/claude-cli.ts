/**
 * Claude CLI Mock
 * Mocks the @anthropic-ai/claude-code module and CLI execution
 */

import { ClaudeCodeMessage } from '../../src/claude/client';

// Mock the official Claude Code SDK module
export const mockClaudeSDK = {
  version: '1.0.0',
  
  // Main query function that Claude SDK provides
  query: jest.fn().mockImplementation(async function*(prompt: string, options: any = {}) {
    // Simulate Claude Code CLI message stream
    yield {
      role: 'system',
      content: '',
      type: 'system',
      subtype: 'init',
      data: { 
        session_id: 'mock-session-123',
        model: options.model || 'claude-3-5-sonnet-20241022'
      }
    };
    
    // Simulate assistant response
    yield {
      role: 'assistant',
      content: `Mock response to: ${prompt}`,
      type: 'assistant'
    };
    
    // Simulate completion metadata
    yield {
      role: 'system',
      content: '',
      type: 'result',
      subtype: 'success',
      total_cost_usd: 0.001,
      duration_ms: 1000,
      num_turns: 1,
      session_id: 'mock-session-123'
    };
  }),
  
  // Mock other SDK methods as needed
  authenticate: jest.fn().mockResolvedValue(true),
  isAuthenticated: jest.fn().mockReturnValue(true),
};

// Mock child_process for CLI execution
export const mockChildProcess = {
  exec: jest.fn(),
  spawn: jest.fn(),
  execSync: jest.fn().mockReturnValue('mock cli output'),
};

// Mock successful CLI execution
export const mockSuccessfulCLIExecution = () => {
  mockChildProcess.exec.mockImplementation((command, options, callback) => {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    
    // Simulate successful CLI response
    const mockStdout = JSON.stringify([
      {
        role: 'system',
        content: '',
        type: 'system',
        subtype: 'init',
        data: { session_id: 'cli-session-456', model: 'claude-3-5-sonnet-20241022' }
      },
      {
        role: 'assistant',
        content: 'Mock CLI response',
        type: 'assistant'
      },
      {
        role: 'system',
        content: '',
        type: 'result',
        subtype: 'success',
        total_cost_usd: 0.002,
        duration_ms: 1500,
        num_turns: 1
      }
    ]);
    
    callback(null, mockStdout, '');
  });
};

// Mock failed CLI execution
export const mockFailedCLIExecution = (errorMessage: string = 'CLI Error') => {
  mockChildProcess.exec.mockImplementation((command, options, callback) => {
    if (typeof options === 'function') {
      callback = options;
    }
    
    const error = new Error(errorMessage);
    callback(error, '', errorMessage);
  });
};

// Helper to generate realistic Claude message streams
export const generateMockMessageStream = (
  prompt: string, 
  options: { includeThinking?: boolean; chunks?: number } = {}
): ClaudeCodeMessage[] => {
  const messages: ClaudeCodeMessage[] = [];
  const sessionId = `session-${Date.now()}`;
  
  // Init message
  messages.push({
    role: 'system',
    content: '',
    type: 'system',
    subtype: 'init',
    data: {
      session_id: sessionId,
      model: 'claude-3-5-sonnet-20241022',
      prompt: prompt
    }
  });
  
  // Thinking (if enabled)
  if (options.includeThinking) {
    messages.push({
      role: 'assistant',
      content: '',
      type: 'thinking',
      data: { content: 'Let me think about this...' }
    });
  }
  
  // Assistant response (in chunks if specified)
  const responseContent = `Mock response to: ${prompt}`;
  const chunks = options.chunks || 1;
  
  if (chunks === 1) {
    messages.push({
      role: 'assistant',
      content: responseContent,
      type: 'assistant'
    });
  } else {
    const chunkSize = Math.ceil(responseContent.length / chunks);
    for (let i = 0; i < chunks; i++) {
      const chunkContent = responseContent.slice(i * chunkSize, (i + 1) * chunkSize);
      messages.push({
        role: 'assistant',
        content: chunkContent,
        type: 'assistant'
      });
    }
  }
  
  // Result message
  messages.push({
    role: 'system',
    content: '',
    type: 'result',
    subtype: 'success',
    total_cost_usd: 0.001 * prompt.length / 1000,
    duration_ms: 800 + Math.random() * 400,
    num_turns: 1,
    session_id: sessionId
  });
  
  return messages;
};