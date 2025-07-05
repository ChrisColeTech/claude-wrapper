#!/usr/bin/env node

/**
 * JavaScript Fetch API Client Example
 * 
 * Demonstrates comprehensive Claude Wrapper integration using the native fetch API
 * without external dependencies. Shows raw HTTP communication patterns, streaming,
 * session management, and authentication handling.
 * 
 * This example is useful for understanding the underlying HTTP API and for
 * environments where you want to minimize dependencies or use native web APIs.
 */

const { performance } = require('perf_hooks');
const { Transform } = require('stream');
const { pipeline } = require('stream/promises');

// Polyfill fetch for older Node.js versions
if (!globalThis.fetch) {
  globalThis.fetch = require('node-fetch');
}

// Color codes for console output
const colors = {
  info: '\x1b[34m',      // Blue
  success: '\x1b[32m',   // Green
  warning: '\x1b[33m',   // Yellow
  error: '\x1b[31m',     // Red
  response: '\x1b[36m',  // Cyan
  metric: '\x1b[35m',    // Magenta
  request: '\x1b[90m',   // Gray
  stream: '\x1b[96m',    // Bright cyan
  reset: '\x1b[0m',      // Reset
};

// Utility functions for colored output
const print = {
  info: (msg) => console.log(`${colors.info}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.success}[SUCCESS]${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.warning}[WARNING]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.error}[ERROR]${colors.reset} ${msg}`),
  response: (msg) => console.log(`${colors.response}${msg}${colors.reset}`),
  metric: (msg) => console.log(`${colors.metric}[METRIC]${colors.reset} ${msg}`),
  request: (msg) => console.log(`${colors.request}[REQUEST]${colors.reset} ${msg}`),
  stream: (msg) => console.log(`${colors.stream}[STREAM]${colors.reset} ${msg}`),
};

// Configuration with environment variable support
const config = {
  baseUrl: process.env.CLAUDE_WRAPPER_URL || 'http://localhost:8000',
  apiKey: process.env.API_KEY,
  verbose: process.env.VERBOSE === 'true',
  timeout: parseInt(process.env.TIMEOUT || '30000', 10),
  showMetrics: process.env.SHOW_METRICS === 'true',
  showRequests: process.env.SHOW_REQUESTS === 'true',
};

// Custom error class for fetch-specific errors
class FetchClientError extends Error {
  constructor(message, response, request) {
    super(message);
    this.name = 'FetchClientError';
    this.response = response;
    this.request = request;
    this.status = response?.status;
    this.statusText = response?.statusText;
  }
}

// Fetch client class with comprehensive functionality
class ClaudeFetchClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || config.baseUrl;
    this.apiKey = options.apiKey || config.apiKey;
    this.timeout = options.timeout || config.timeout;
    this.verbose = options.verbose !== undefined ? options.verbose : config.verbose;
    this.showMetrics = options.showMetrics !== undefined ? options.showMetrics : config.showMetrics;
    this.showRequests = options.showRequests !== undefined ? options.showRequests : config.showRequests;
    
    // Ensure base URL doesn't end with slash
    this.baseUrl = this.baseUrl.replace(/\/$/, '');
    
    if (this.verbose) {
      print.info(`Fetch client initialized with base URL: ${this.baseUrl}`);
    }
  }

  /**
   * Get authentication headers
   */
  getAuthHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'claude-wrapper-fetch-client/1.0.0',
    };
    
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    
    return headers;
  }

  /**
   * Make a raw HTTP request with error handling
   */
  async makeRequest(method, endpoint, body = null, customHeaders = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = { ...this.getAuthHeaders(), ...customHeaders };
    
    const requestOptions = {
      method,
      headers,
      signal: AbortSignal.timeout(this.timeout),
    };
    
    if (body) {
      requestOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }
    
    if (this.showRequests) {
      print.request(`${method} ${url}`);
      if (this.verbose && body) {
        console.log('Request body:', JSON.stringify(body, null, 2));
      }
    }
    
    try {
      const response = await fetch(url, requestOptions);
      
      if (this.showRequests) {
        print.request(`Response: ${response.status} ${response.statusText}`);
      }
      
      return response;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new FetchClientError(`Request timeout after ${this.timeout}ms`, null, requestOptions);
      }
      throw new FetchClientError(`Network error: ${error.message}`, null, requestOptions);
    }
  }

  /**
   * Check server health
   */
  async checkHealth() {
    try {
      print.info('Checking server health...');
      
      const response = await this.makeRequest('GET', '/health');
      
      if (!response.ok) {
        throw new FetchClientError('Health check failed', response);
      }
      
      const healthData = await response.json();
      
      print.success('Server is healthy');
      
      if (this.verbose) {
        print.info('Health response:');
        console.log(JSON.stringify(healthData, null, 2));
      }
      
      return healthData;
    } catch (error) {
      print.error('Health check failed');
      throw error;
    }
  }

  /**
   * Get authentication status
   */
  async getAuthStatus() {
    try {
      print.info('Getting authentication status...');
      
      const response = await this.makeRequest('GET', '/v1/auth/status');
      
      if (!response.ok) {
        throw new FetchClientError('Failed to get auth status', response);
      }
      
      const authData = await response.json();
      
      if (this.verbose) {
        print.info('Authentication status:');
        console.log(JSON.stringify(authData, null, 2));
      }
      
      return {
        apiKeyRequired: authData.server_info?.api_key_required || false,
        authMethod: authData.server_info?.auth_method || 'unknown',
        claudeConfigured: authData.claude_auth?.configured || false,
        providers: {
          anthropic: authData.claude_auth?.anthropic_api_key_configured || false,
          bedrock: authData.claude_auth?.bedrock_configured || false,
          vertex: authData.claude_auth?.vertex_configured || false,
          claudeCli: authData.claude_auth?.claude_cli_available || false,
        }
      };
    } catch (error) {
      print.warning('Could not get authentication status');
      return { apiKeyRequired: false, authMethod: 'unknown' };
    }
  }

  /**
   * List available models
   */
  async listModels() {
    try {
      print.info('Fetching available models...');
      
      const response = await this.makeRequest('GET', '/v1/models');
      
      if (!response.ok) {
        throw new FetchClientError('Failed to list models', response);
      }
      
      const modelsData = await response.json();
      
      if (modelsData.data && modelsData.data.length > 0) {
        print.success(`Found ${modelsData.data.length} available models:`);
        
        modelsData.data.forEach((model, index) => {
          console.log(`  ${index + 1}. ${model.id}`);
          if (this.verbose) {
            console.log(`     Owner: ${model.owned_by || 'unknown'}`);
            if (model.created) {
              console.log(`     Created: ${new Date(model.created * 1000).toISOString()}`);
            }
          }
        });
        
        return modelsData.data;
      } else {
        print.warning('No models found');
        return [];
      }
    } catch (error) {
      throw new FetchClientError('Failed to list models', error.response, error.request);
    }
  }

  /**
   * Create a chat completion
   */
  async createChatCompletion(messages, options = {}) {
    const requestBody = {
      model: options.model || 'claude-3-5-sonnet-20241022',
      messages: messages,
      max_tokens: options.maxTokens || 500,
      temperature: options.temperature || 0.7,
      top_p: options.topP,
      frequency_penalty: options.frequencyPenalty,
      presence_penalty: options.presencePenalty,
      stream: options.stream || false,
      ...options.extra
    };
    
    try {
      const startTime = performance.now();
      
      if (this.verbose) {
        print.info('Creating chat completion...');
        console.log('Request parameters:', JSON.stringify(requestBody, null, 2));
      }
      
      const response = await this.makeRequest('POST', '/v1/chat/completions', requestBody);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new FetchClientError(
          `Chat completion failed: ${response.status} ${response.statusText} - ${errorData.error?.message || errorData.error}`,
          response,
          requestBody
        );
      }
      
      const completionData = await response.json();
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      if (this.showMetrics) {
        print.metric(`Request completed in ${duration.toFixed(0)}ms`);
        
        if (completionData.usage) {
          print.metric('Token usage:');
          console.log(`  Prompt tokens: ${completionData.usage.prompt_tokens}`);
          console.log(`  Completion tokens: ${completionData.usage.completion_tokens}`);
          console.log(`  Total tokens: ${completionData.usage.total_tokens}`);
        }
      }
      
      return {
        ...completionData,
        _metadata: {
          duration,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      if (error instanceof FetchClientError) {
        throw error;
      }
      throw new FetchClientError('Chat completion request failed', null, requestBody);
    }
  }

  /**
   * Create a streaming chat completion
   */
  async createStreamingChatCompletion(messages, options = {}, onChunk = null) {
    const requestBody = {
      model: options.model || 'claude-3-5-sonnet-20241022',
      messages: messages,
      max_tokens: options.maxTokens || 500,
      temperature: options.temperature || 0.7,
      stream: true,
      ...options.extra
    };
    
    try {
      const startTime = performance.now();
      let firstChunkTime = null;
      let totalChunks = 0;
      let totalCharacters = 0;
      let fullResponse = '';
      
      if (this.verbose) {
        print.stream('Creating streaming chat completion...');
      }
      
      const response = await this.makeRequest('POST', '/v1/chat/completions', requestBody);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new FetchClientError(
          `Streaming chat completion failed: ${response.status} ${response.statusText} - ${errorData.error?.message || errorData.error}`,
          response,
          requestBody
        );
      }
      
      if (!response.body) {
        throw new FetchClientError('No response body for streaming', response, requestBody);
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      try {
        let buffer = '';
        
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            break;
          }
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer
          
          for (const line of lines) {
            if (line.trim() === '') continue;
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              if (data === '[DONE]') {
                break;
              }
              
              try {
                const chunk = JSON.parse(data);
                const content = chunk.choices?.[0]?.delta?.content;
                
                if (content) {
                  if (firstChunkTime === null) {
                    firstChunkTime = performance.now() - startTime;
                  }
                  
                  totalChunks++;
                  totalCharacters += content.length;
                  fullResponse += content;
                  
                  if (onChunk) {
                    onChunk(content, {
                      chunkIndex: totalChunks,
                      totalCharacters,
                      elapsedTime: performance.now() - startTime
                    });
                  }
                }
              } catch (parseError) {
                if (this.verbose) {
                  print.warning(`Failed to parse chunk: ${data}`);
                }
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      if (this.showMetrics) {
        print.metric('Streaming metrics:');
        console.log(`  Total duration: ${duration.toFixed(0)}ms`);
        console.log(`  First chunk time: ${firstChunkTime?.toFixed(0) || 'N/A'}ms`);
        console.log(`  Total chunks: ${totalChunks}`);
        console.log(`  Total characters: ${totalCharacters}`);
        
        if (totalChunks > 0) {
          console.log(`  Average chunk size: ${(totalCharacters / totalChunks).toFixed(1)} chars`);
          console.log(`  Streaming rate: ${(totalCharacters / (duration / 1000)).toFixed(0)} chars/sec`);
        }
      }
      
      return {
        response: fullResponse,
        metrics: {
          duration,
          firstChunkTime,
          totalChunks,
          totalCharacters,
          averageChunkSize: totalChunks > 0 ? totalCharacters / totalChunks : 0,
          streamingRate: totalCharacters / (duration / 1000)
        }
      };
    } catch (error) {
      if (error instanceof FetchClientError) {
        throw error;
      }
      throw new FetchClientError('Streaming chat completion request failed', null, requestBody);
    }
  }

  /**
   * Session management methods
   */
  async listSessions() {
    try {
      const response = await this.makeRequest('GET', '/v1/sessions');
      
      if (!response.ok) {
        throw new FetchClientError('Failed to list sessions', response);
      }
      
      return await response.json();
    } catch (error) {
      throw new FetchClientError('Failed to list sessions', error.response);
    }
  }

  async getSession(sessionId) {
    try {
      const response = await this.makeRequest('GET', `/v1/sessions/${sessionId}`);
      
      if (response.status === 404) {
        return null;
      }
      
      if (!response.ok) {
        throw new FetchClientError('Failed to get session', response);
      }
      
      return await response.json();
    } catch (error) {
      throw new FetchClientError('Failed to get session', error.response);
    }
  }

  async deleteSession(sessionId) {
    try {
      const response = await this.makeRequest('DELETE', `/v1/sessions/${sessionId}`);
      
      if (!response.ok) {
        throw new FetchClientError('Failed to delete session', response);
      }
      
      return await response.json();
    } catch (error) {
      throw new FetchClientError('Failed to delete session', error.response);
    }
  }

  async getSessionStats() {
    try {
      const response = await this.makeRequest('GET', '/v1/sessions/stats');
      
      if (!response.ok) {
        throw new FetchClientError('Failed to get session stats', response);
      }
      
      return await response.json();
    } catch (error) {
      throw new FetchClientError('Failed to get session stats', error.response);
    }
  }
}

/**
 * Demo 1: Basic fetch client functionality
 */
async function basicFetchDemo() {
  console.log('\n=== Basic Fetch Client Demo ===');
  
  const client = new ClaudeFetchClient();
  
  try {
    // Check server health
    await client.checkHealth();
    console.log();
    
    // Get authentication status
    const authStatus = await client.getAuthStatus();
    print.info(`Authentication required: ${authStatus.apiKeyRequired}`);
    print.info(`Claude configured: ${authStatus.claudeConfigured}`);
    console.log();
    
    // List models
    const models = await client.listModels();
    console.log();
    
    // Basic chat completion
    print.info('Making basic chat completion...');
    const completion = await client.createChatCompletion([
      {
        role: 'user',
        content: 'Hello! Explain what a fetch API is in JavaScript in a concise way.'
      }
    ], {
      maxTokens: 200,
      temperature: 0.7
    });
    
    if (completion.choices && completion.choices.length > 0) {
      print.success('Chat completion successful!');
      console.log('\n📝 Claude\'s Response:');
      console.log('----------------------------------------');
      print.response(completion.choices[0].message.content);
      console.log('----------------------------------------\n');
    }
    
    print.success('Basic fetch demo completed!');
    
  } catch (error) {
    print.error(`Basic fetch demo failed: ${error.message}`);
    throw error;
  }
}

/**
 * Demo 2: Streaming functionality
 */
async function streamingFetchDemo() {
  console.log('\n=== Streaming Fetch Demo ===');
  
  const client = new ClaudeFetchClient();
  
  try {
    print.info('Creating streaming completion...');
    
    console.log('\n📡 Streaming response:');
    console.log('╭─────────────────────────────────────────────────────────╮');
    process.stdout.write('│ ');
    
    const result = await client.createStreamingChatCompletion([
      {
        role: 'user',
        content: 'Write a JavaScript function that demonstrates the fetch API with error handling. Include comments.'
      }
    ], {
      maxTokens: 400,
      temperature: 0.7
    }, (chunk, metadata) => {
      process.stdout.write(chunk);
    });
    
    console.log('\n╰─────────────────────────────────────────────────────────╯');
    
    print.success('Streaming demo completed!');
    
    if (config.showMetrics) {
      print.metric('Streaming performance:');
      console.log(`  Duration: ${result.metrics.duration.toFixed(0)}ms`);
      console.log(`  Chunks: ${result.metrics.totalChunks}`);
      console.log(`  Characters: ${result.metrics.totalCharacters}`);
      console.log(`  Rate: ${result.metrics.streamingRate.toFixed(0)} chars/sec`);
    }
    
  } catch (error) {
    print.error(`Streaming demo failed: ${error.message}`);
    throw error;
  }
}

/**
 * Demo 3: Session management with fetch
 */
async function sessionFetchDemo() {
  console.log('\n=== Session Management Fetch Demo ===');
  
  const client = new ClaudeFetchClient();
  
  try {
    const sessionId = `fetch-demo-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    print.info(`Using session ID: ${sessionId}`);
    
    // Create conversation with session
    const messages = [
      'Hello! I am learning about the fetch API. My name is Jordan.',
      'What is my name and what am I learning about?',
      'Can you show me how to handle fetch errors properly?'
    ];
    
    for (let i = 0; i < messages.length; i++) {
      console.log(`\n📝 Message ${i + 1}: ${messages[i]}`);
      
      const completion = await client.createChatCompletion([
        {
          role: 'user',
          content: messages[i]
        }
      ], {
        maxTokens: 250,
        temperature: 0.7,
        extra: {
          session_id: sessionId
        }
      });
      
      if (completion.choices && completion.choices.length > 0) {
        console.log(`🤖 Claude: ${completion.choices[0].message.content}`);
      }
      
      // Small delay between messages
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Get session info
    const sessionInfo = await client.getSession(sessionId);
    if (sessionInfo) {
      print.info(`Session has ${sessionInfo.message_count} messages`);
    }
    
    // Clean up session
    await client.deleteSession(sessionId);
    print.info('Session cleaned up');
    
    print.success('Session management demo completed!');
    
  } catch (error) {
    print.error(`Session demo failed: ${error.message}`);
    throw error;
  }
}

/**
 * Demo 4: Concurrent requests with fetch
 */
async function concurrentFetchDemo() {
  console.log('\n=== Concurrent Requests Fetch Demo ===');
  
  const client = new ClaudeFetchClient();
  
  try {
    const prompts = [
      'Explain JavaScript Promises in one sentence.',
      'What is async/await in JavaScript?',
      'How does the fetch API handle errors?',
      'What are the benefits of using fetch over XMLHttpRequest?'
    ];
    
    print.info(`Starting ${prompts.length} concurrent requests...`);
    
    const startTime = performance.now();
    
    const requestPromises = prompts.map(async (prompt, index) => {
      try {
        const completion = await client.createChatCompletion([
          {
            role: 'user',
            content: prompt
          }
        ], {
          maxTokens: 150,
          temperature: 0.5
        });
        
        return {
          index,
          prompt,
          response: completion.choices[0]?.message?.content || 'No response',
          success: true,
          usage: completion.usage
        };
      } catch (error) {
        return {
          index,
          prompt,
          error: error.message,
          success: false
        };
      }
    });
    
    const results = await Promise.all(requestPromises);
    const endTime = performance.now();
    const totalDuration = endTime - startTime;
    
    print.success('Concurrent requests completed!');
    
    console.log('\n📊 Results:');
    results.forEach((result) => {
      if (result.success) {
        console.log(`  ✅ Request ${result.index + 1}: Success`);
        console.log(`     Q: ${result.prompt}`);
        console.log(`     A: ${result.response.substring(0, 100)}...`);
      } else {
        console.log(`  ❌ Request ${result.index + 1}: Failed - ${result.error}`);
      }
    });
    
    if (config.showMetrics) {
      const successful = results.filter(r => r.success);
      print.metric(`Total time: ${totalDuration.toFixed(0)}ms`);
      print.metric(`Success rate: ${successful.length}/${results.length}`);
      
      if (successful.length > 0) {
        const totalTokens = successful.reduce((sum, r) => sum + (r.usage?.total_tokens || 0), 0);
        print.metric(`Total tokens: ${totalTokens}`);
      }
    }
    
  } catch (error) {
    print.error(`Concurrent demo failed: ${error.message}`);
    throw error;
  }
}

/**
 * Demo 5: Error handling showcase
 */
async function errorHandlingFetchDemo() {
  console.log('\n=== Error Handling Fetch Demo ===');
  
  const client = new ClaudeFetchClient();
  
  const errorScenarios = [
    {
      name: 'Invalid endpoint',
      request: () => client.makeRequest('GET', '/v1/invalid-endpoint')
    },
    {
      name: 'Invalid model',
      request: () => client.createChatCompletion([
        { role: 'user', content: 'Test' }
      ], { model: 'invalid-model' })
    },
    {
      name: 'Empty messages',
      request: () => client.createChatCompletion([], { model: 'claude-3-5-sonnet-20241022' })
    },
    {
      name: 'Malformed request',
      request: () => client.makeRequest('POST', '/v1/chat/completions', 'invalid-json')
    }
  ];
  
  for (const scenario of errorScenarios) {
    console.log(`\n🧪 Testing: ${scenario.name}`);
    
    try {
      await scenario.request();
      print.warning('Unexpected success - expected an error');
    } catch (error) {
      if (error instanceof FetchClientError) {
        print.success(`Expected error caught: ${error.status || 'N/A'} - ${error.message}`);
        
        if (config.verbose) {
          console.log(`  Error type: ${error.name}`);
          console.log(`  Status: ${error.status || 'N/A'}`);
          console.log(`  Status text: ${error.statusText || 'N/A'}`);
        }
      } else {
        print.success(`Expected error caught: ${error.message}`);
      }
    }
  }
  
  print.success('Error handling demo completed!');
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Claude Wrapper JavaScript Fetch Client Examples');
  console.log('===================================================');
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  
  if (args.includes('--verbose') || args.includes('-v')) {
    config.verbose = true;
  }
  
  if (args.includes('--metrics') || args.includes('-m')) {
    config.showMetrics = true;
  }
  
  if (args.includes('--show-requests')) {
    config.showRequests = true;
  }
  
  console.log();
  print.info('Configuration:');
  print.info(`  Base URL: ${config.baseUrl}`);
  print.info(`  API Key: ${config.apiKey ? 'Provided' : 'Not provided'}`);
  print.info(`  Verbose: ${config.verbose}`);
  print.info(`  Show metrics: ${config.showMetrics}`);
  print.info(`  Show requests: ${config.showRequests}`);
  print.info(`  Timeout: ${config.timeout}ms`);
  
  try {
    // Run all demos
    await basicFetchDemo();
    await streamingFetchDemo();
    await sessionFetchDemo();
    await concurrentFetchDemo();
    await errorHandlingFetchDemo();
    
    console.log('\n🎉 All fetch client examples completed successfully!');
    console.log('\n💡 Fetch API Benefits:');
    console.log('   • Native JavaScript API - no external dependencies');
    console.log('   • Promise-based for modern async patterns');
    console.log('   • Streaming support with readable streams');
    console.log('   • Fine-grained request/response control');
    console.log('   • Built-in timeout and abort signal support');
    console.log('   • Wide browser and Node.js compatibility');
    
  } catch (error) {
    print.error('Fetch client examples failed:');
    
    if (error instanceof FetchClientError) {
      console.error(`  ${error.message}`);
      if (config.verbose) {
        console.error(`  Status: ${error.status || 'N/A'}`);
        console.error(`  Status text: ${error.statusText || 'N/A'}`);
      }
    } else {
      console.error(`  ${error.message}`);
    }
    
    console.log();
    print.info('Troubleshooting:');
    print.info('  • Verify claude-wrapper server is running');
    print.info('  • Check network connectivity and firewall settings');
    print.info('  • Ensure proper authentication configuration');
    print.info('  • Review server logs for detailed error information');
    process.exit(1);
  }
}

/**
 * Show usage information
 */
function showUsage() {
  console.log('Usage: node fetch-client.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  -h, --help           Show this help message');
  console.log('  -v, --verbose        Enable verbose logging');
  console.log('  -m, --metrics        Show detailed performance metrics');
  console.log('  --show-requests      Show HTTP request/response details');
  console.log('');
  console.log('Environment variables:');
  console.log('  CLAUDE_WRAPPER_URL   Base URL for the server (default: http://localhost:8000)');
  console.log('  API_KEY              API key for authentication (if required)');
  console.log('  VERBOSE              Enable verbose output (true/false)');
  console.log('  SHOW_METRICS         Show performance metrics (true/false)');
  console.log('  SHOW_REQUESTS        Show HTTP request details (true/false)');
  console.log('  TIMEOUT              Request timeout in ms (default: 30000)');
  console.log('');
  console.log('Examples:');
  console.log('  node fetch-client.js                                   # Basic usage');
  console.log('  node fetch-client.js --verbose --metrics               # Detailed output');
  console.log('  node fetch-client.js --show-requests                   # Show HTTP details');
  console.log('  API_KEY=your-key node fetch-client.js                  # With authentication');
  console.log('  CLAUDE_WRAPPER_URL=http://remote:8000 node fetch-client.js  # Remote server');
  console.log('');
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showUsage();
  process.exit(0);
}

// Check Node.js version compatibility
function checkNodeVersion() {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  if (majorVersion < 14) {
    print.error(`Node.js version ${nodeVersion} is not supported`);
    print.info('Please upgrade to Node.js 14 or higher for fetch API support');
    process.exit(1);
  }
  
  // For Node.js < 18, suggest using node-fetch
  if (majorVersion < 18 && !globalThis.fetch) {
    print.warning('Node.js < 18 detected - install node-fetch for compatibility:');
    print.info('  npm install node-fetch');
  }
}

// Script execution
if (require.main === module) {
  checkNodeVersion();
  
  main().catch((error) => {
    print.error('Unhandled error:');
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  ClaudeFetchClient,
  FetchClientError,
  config,
};