#!/usr/bin/env node

/**
 * JavaScript OpenAI SDK Integration Example
 * 
 * Demonstrates comprehensive OpenAI SDK integration with the Claude Wrapper server,
 * including authentication, session management, streaming, and error handling.
 * 
 * This example showcases JavaScript-specific patterns like async/await, destructuring,
 * and modern ES6+ features while maintaining compatibility with Node.js environments.
 */

const { OpenAI } = require('openai');
const { performance } = require('perf_hooks');
const fs = require('fs').promises;
const path = require('path');

// Color codes for console output
const colors = {
  info: '\x1b[34m',      // Blue
  success: '\x1b[32m',   // Green
  warning: '\x1b[33m',   // Yellow
  error: '\x1b[31m',     // Red
  response: '\x1b[36m',  // Cyan
  metric: '\x1b[35m',    // Magenta
  session: '\x1b[90m',   // Gray
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
  session: (msg) => console.log(`${colors.session}[SESSION]${colors.reset} ${msg}`),
};

// Configuration with environment variable support
const config = {
  baseUrl: process.env.CLAUDE_WRAPPER_URL || 'http://localhost:8000',
  apiKey: process.env.API_KEY,
  verbose: process.env.VERBOSE === 'true',
  timeout: parseInt(process.env.TIMEOUT || '30000', 10),
  maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
  showMetrics: process.env.SHOW_METRICS === 'true',
};

// Custom error class for Claude Wrapper specific errors
class ClaudeWrapperError extends Error {
  constructor(message, cause, statusCode) {
    super(message);
    this.name = 'ClaudeWrapperError';
    this.cause = cause;
    this.statusCode = statusCode;
  }
}

// Authentication detection utility
async function detectAuthentication(baseUrl) {
  try {
    const authUrl = baseUrl.replace(/\/v1$/, '') + '/v1/auth/status';
    const response = await fetch(authUrl, { 
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (config.verbose) {
      print.info('Authentication status response:');
      console.log(JSON.stringify(data, null, 2));
    }
    
    return {
      required: data.server_info?.api_key_required || false,
      method: data.server_info?.auth_method || 'unknown',
      claudeConfigured: data.claude_auth?.configured || false,
      providers: {
        anthropic: data.claude_auth?.anthropic_api_key_configured || false,
        bedrock: data.claude_auth?.bedrock_configured || false,
        vertex: data.claude_auth?.vertex_configured || false,
        claudeCli: data.claude_auth?.claude_cli_available || false,
      }
    };
  } catch (error) {
    print.warning(`Could not detect authentication requirements: ${error.message}`);
    return { required: false, method: 'unknown', claudeConfigured: false, providers: {} };
  }
}

// Auto-detect API key based on server requirements
async function getApiKey(baseUrl) {
  const authInfo = await detectAuthentication(baseUrl);
  
  if (!authInfo.required) {
    print.info('No authentication required');
    return undefined;
  }
  
  if (config.apiKey) {
    print.info('Using provided API key');
    return config.apiKey;
  }
  
  // In a real implementation, you might prompt for the API key here
  print.warning('API key required but not provided');
  print.info('Set the API_KEY environment variable:');
  print.info('  export API_KEY=your-api-key-here');
  
  throw new ClaudeWrapperError('Authentication required but no API key provided');
}

// Create OpenAI client with auto-detection
async function createClient() {
  try {
    const baseUrl = config.baseUrl;
    const v1Url = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;
    const apiKey = await getApiKey(v1Url);
    
    const client = new OpenAI({
      baseURL: v1Url,
      apiKey: apiKey || 'no-auth-required',
      timeout: config.timeout,
      maxRetries: config.maxRetries,
    });
    
    print.success('OpenAI client created successfully');
    return client;
  } catch (error) {
    throw new ClaudeWrapperError('Failed to create OpenAI client', error);
  }
}

// Test server connectivity
async function testServerConnection(baseUrl) {
  try {
    const healthUrl = baseUrl.replace(/\/v1$/, '') + '/health';
    
    print.info(`Testing server connection to ${healthUrl}...`);
    
    const response = await fetch(healthUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const healthData = await response.json();
    
    if (config.verbose) {
      print.info('Server health response:');
      console.log(JSON.stringify(healthData, null, 2));
    }
    
    print.success('Server is running and accessible');
    return healthData;
  } catch (error) {
    print.error('Server connection failed');
    print.info('Please ensure the claude-wrapper server is running:');
    print.info('  cd claude-wrapper && npm start');
    throw new ClaudeWrapperError('Server connection failed', error);
  }
}

// List available models
async function listModels(client) {
  try {
    print.info('Fetching available models...');
    
    const response = await client.models.list();
    
    if (response.data && response.data.length > 0) {
      print.success(`Found ${response.data.length} available models:`);
      
      response.data.forEach((model, index) => {
        console.log(`  ${index + 1}. ${model.id}`);
        if (config.verbose && model.owned_by) {
          console.log(`     Owner: ${model.owned_by}`);
        }
        if (config.verbose && model.created) {
          console.log(`     Created: ${new Date(model.created * 1000).toISOString()}`);
        }
      });
      
      return response.data;
    } else {
      print.warning('No models found');
      return [];
    }
  } catch (error) {
    throw new ClaudeWrapperError('Failed to list models', error);
  }
}

// Basic chat completion with metrics
async function basicCompletion(client) {
  try {
    print.info('Making basic chat completion request...');
    
    const startTime = performance.now();
    
    const completion = await client.chat.completions.create({
      model: 'claude-3-5-sonnet-20241022',
      messages: [
        {
          role: 'user',
          content: 'Hello! Can you explain what the Claude Wrapper is and how it works? Please keep your response concise but informative.',
        },
      ],
      max_tokens: 200,
      temperature: 0.7,
    });
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    if (completion.choices && completion.choices.length > 0) {
      const message = completion.choices[0].message;
      
      print.success('Chat completion successful!');
      console.log('\n📝 Claude\'s Response:');
      console.log('----------------------------------------');
      print.response(message.content || 'No content received');
      console.log('----------------------------------------\n');
      
      // Display usage and performance information
      if (config.showMetrics) {
        print.metric(`Request duration: ${duration.toFixed(0)}ms`);
        
        if (completion.usage) {
          print.metric('Token usage:');
          console.log(`  Prompt tokens: ${completion.usage.prompt_tokens}`);
          console.log(`  Completion tokens: ${completion.usage.completion_tokens}`);
          console.log(`  Total tokens: ${completion.usage.total_tokens}`);
          
          const tokensPerSecond = completion.usage.total_tokens / (duration / 1000);
          print.metric(`Processing rate: ${tokensPerSecond.toFixed(1)} tokens/second`);
        }
      }
      
      return { response: message.content, usage: completion.usage, duration };
    } else {
      print.warning('No response choices received');
      return null;
    }
  } catch (error) {
    throw new ClaudeWrapperError('Basic completion failed', error);
  }
}

// Advanced completion with system message and parameters
async function advancedCompletion(client) {
  try {
    print.info('Making advanced chat completion request...');
    
    const startTime = performance.now();
    
    const completion = await client.chat.completions.create({
      model: 'claude-3-5-sonnet-20241022',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful JavaScript expert who explains code concepts clearly and provides practical examples.',
        },
        {
          role: 'user',
          content: 'What are the key benefits of using async/await over callbacks in JavaScript? Please provide a brief code example.',
        },
      ],
      max_tokens: 300,
      temperature: 0.8,
      top_p: 0.9,
      frequency_penalty: 0.1,
      presence_penalty: 0.1,
    });
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    if (completion.choices && completion.choices.length > 0) {
      const message = completion.choices[0].message;
      
      print.success('Advanced completion successful!');
      console.log('\n🎯 JavaScript Expert Advice:');
      console.log('----------------------------------------');
      print.response(message.content || 'No content received');
      console.log('----------------------------------------\n');
      
      // Show additional completion info
      if (config.verbose) {
        const choice = completion.choices[0];
        print.info(`Finish reason: ${choice.finish_reason}`);
        print.metric(`Response time: ${duration.toFixed(0)}ms`);
        
        if (completion.usage) {
          print.info('Token usage:');
          console.log(JSON.stringify(completion.usage, null, 2));
        }
      }
      
      return { response: message.content, usage: completion.usage, duration };
    } else {
      print.warning('No response choices received');
      return null;
    }
  } catch (error) {
    throw new ClaudeWrapperError('Advanced completion failed', error);
  }
}

// Streaming completion with progress tracking
async function streamingCompletion(client) {
  try {
    print.info('Making streaming chat completion request...');
    
    const startTime = performance.now();
    let firstChunkTime = null;
    let totalChunks = 0;
    let totalCharacters = 0;
    let fullResponse = '';
    
    const stream = await client.chat.completions.create({
      model: 'claude-3-5-sonnet-20241022',
      messages: [
        {
          role: 'user',
          content: 'Write a JavaScript function that demonstrates the use of Promises and async/await. Include comments explaining each part.',
        },
      ],
      stream: true,
      max_tokens: 400,
      temperature: 0.7,
    });
    
    print.info('Streaming response:');
    console.log('╭─────────────────────────────────────────────────────────╮');
    process.stdout.write('│ ');
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      
      if (content) {
        if (firstChunkTime === null) {
          firstChunkTime = performance.now() - startTime;
        }
        
        totalChunks++;
        totalCharacters += content.length;
        fullResponse += content;
        
        process.stdout.write(content);
      }
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log('\n╰─────────────────────────────────────────────────────────╯');
    
    print.success('Streaming completion successful!');
    
    if (config.showMetrics) {
      print.metric('Streaming metrics:');
      console.log(`  Total duration: ${duration.toFixed(0)}ms`);
      console.log(`  First chunk time: ${firstChunkTime?.toFixed(0)}ms`);
      console.log(`  Total chunks: ${totalChunks}`);
      console.log(`  Total characters: ${totalCharacters}`);
      console.log(`  Average chunk size: ${(totalCharacters / totalChunks).toFixed(1)} chars`);
      console.log(`  Streaming rate: ${(totalCharacters / (duration / 1000)).toFixed(0)} chars/sec`);
    }
    
    return { 
      response: fullResponse, 
      metrics: { 
        duration, 
        firstChunkTime, 
        totalChunks, 
        totalCharacters,
        averageChunkSize: totalCharacters / totalChunks,
        streamingRate: totalCharacters / (duration / 1000)
      } 
    };
  } catch (error) {
    throw new ClaudeWrapperError('Streaming completion failed', error);
  }
}

// Session-based conversation example
async function sessionConversation(client) {
  try {
    print.info('Demonstrating session-based conversation...');
    
    const sessionId = `js-demo-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    print.session(`Using session ID: ${sessionId}`);
    
    const conversationSteps = [
      {
        message: 'Hello! I am a JavaScript developer working on a Node.js project. My name is Sarah.',
        context: 'Initial introduction'
      },
      {
        message: 'What is my name and what technology am I working with?',
        context: 'Testing memory'
      },
      {
        message: 'Can you help me understand how to handle errors in async functions?',
        context: 'Building on context'
      }
    ];
    
    const responses = [];
    
    for (let i = 0; i < conversationSteps.length; i++) {
      const step = conversationSteps[i];
      console.log(`\n📝 Step ${i + 1}: ${step.context}`);
      console.log(`User: ${step.message}`);
      
      const startTime = performance.now();
      
      const completion = await client.chat.completions.create({
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          {
            role: 'user',
            content: step.message,
          },
        ],
        max_tokens: 250,
        temperature: 0.7,
        // Use extra_body to pass session_id (OpenAI SDK specific)
        extra_body: {
          session_id: sessionId
        }
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      if (completion.choices && completion.choices.length > 0) {
        const response = completion.choices[0].message.content;
        responses.push({ step: i + 1, response, duration });
        
        console.log(`Claude: ${response}`);
        
        if (config.showMetrics) {
          print.metric(`Response time: ${duration.toFixed(0)}ms`);
        }
      }
      
      // Small delay between steps
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    print.success('Session-based conversation completed!');
    print.session(`Session ID: ${sessionId}`);
    
    return { sessionId, responses };
  } catch (error) {
    throw new ClaudeWrapperError('Session conversation failed', error);
  }
}

// Batch processing example
async function batchProcessing(client) {
  try {
    print.info('Demonstrating batch processing with concurrent requests...');
    
    const prompts = [
      'Explain JavaScript closures in one sentence.',
      'What is the difference between let, const, and var?',
      'How do you handle exceptions in JavaScript?',
      'What are JavaScript Promises used for?',
      'Explain the concept of hoisting in JavaScript.'
    ];
    
    const startTime = performance.now();
    
    const batchPromises = prompts.map(async (prompt, index) => {
      const requestStartTime = performance.now();
      
      try {
        const completion = await client.chat.completions.create({
          model: 'claude-3-5-sonnet-20241022',
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: 150,
          temperature: 0.5,
        });
        
        const requestEndTime = performance.now();
        const requestDuration = requestEndTime - requestStartTime;
        
        return {
          index,
          prompt,
          response: completion.choices[0]?.message?.content || 'No response',
          duration: requestDuration,
          usage: completion.usage,
          success: true
        };
      } catch (error) {
        const requestEndTime = performance.now();
        const requestDuration = requestEndTime - requestStartTime;
        
        return {
          index,
          prompt,
          error: error.message,
          duration: requestDuration,
          success: false
        };
      }
    });
    
    const results = await Promise.all(batchPromises);
    const endTime = performance.now();
    const totalDuration = endTime - startTime;
    
    print.success('Batch processing completed!');
    
    console.log('\n📊 Batch Results:');
    results.forEach((result, index) => {
      if (result.success) {
        console.log(`  ${index + 1}. ✅ ${result.duration.toFixed(0)}ms`);
        console.log(`     Q: ${result.prompt}`);
        console.log(`     A: ${result.response.substring(0, 100)}...`);
      } else {
        console.log(`  ${index + 1}. ❌ ${result.duration.toFixed(0)}ms - ${result.error}`);
      }
    });
    
    if (config.showMetrics) {
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      
      print.metric('Batch processing metrics:');
      console.log(`  Total time: ${totalDuration.toFixed(0)}ms`);
      console.log(`  Successful requests: ${successful.length}/${results.length}`);
      console.log(`  Failed requests: ${failed.length}/${results.length}`);
      console.log(`  Average response time: ${(successful.reduce((sum, r) => sum + r.duration, 0) / successful.length).toFixed(0)}ms`);
      
      if (successful.length > 0) {
        const totalTokens = successful.reduce((sum, r) => sum + (r.usage?.total_tokens || 0), 0);
        console.log(`  Total tokens used: ${totalTokens}`);
      }
    }
    
    return { results, totalDuration };
  } catch (error) {
    throw new ClaudeWrapperError('Batch processing failed', error);
  }
}

// Error handling demonstration
async function errorHandlingDemo(client) {
  try {
    print.info('Demonstrating error handling...');
    
    const errorScenarios = [
      {
        name: 'Invalid model',
        params: {
          model: 'non-existent-model',
          messages: [{ role: 'user', content: 'Test' }],
        }
      },
      {
        name: 'Empty messages array',
        params: {
          model: 'claude-3-5-sonnet-20241022',
          messages: [],
        }
      },
      {
        name: 'Excessive max_tokens',
        params: {
          model: 'claude-3-5-sonnet-20241022',
          messages: [{ role: 'user', content: 'Test' }],
          max_tokens: 999999,
        }
      },
      {
        name: 'Invalid temperature',
        params: {
          model: 'claude-3-5-sonnet-20241022',
          messages: [{ role: 'user', content: 'Test' }],
          temperature: 3.0,
        }
      }
    ];
    
    for (const scenario of errorScenarios) {
      console.log(`\n🧪 Testing: ${scenario.name}`);
      
      try {
        await client.chat.completions.create(scenario.params);
        print.warning('Unexpected success - expected an error');
      } catch (error) {
        if (error.status) {
          print.success(`Expected error caught: ${error.status} - ${error.message}`);
        } else {
          print.success(`Expected error caught: ${error.message}`);
        }
        
        if (config.verbose) {
          console.log(`  Error type: ${error.constructor.name}`);
          console.log(`  Error code: ${error.code || 'N/A'}`);
          console.log(`  Status code: ${error.status || 'N/A'}`);
        }
      }
    }
    
    print.success('Error handling demonstration completed!');
  } catch (error) {
    throw new ClaudeWrapperError('Error handling demo failed', error);
  }
}

// Display example information
function showExampleInfo() {
  console.log();
  print.info('🎯 JavaScript OpenAI SDK Integration Example');
  console.log('This example demonstrates:');
  console.log('  • OpenAI SDK integration with Claude Wrapper');
  console.log('  • Automatic authentication detection');
  console.log('  • Model listing and selection');
  console.log('  • Basic and advanced chat completions');
  console.log('  • Streaming responses with progress tracking');
  console.log('  • Session-based conversations');
  console.log('  • Batch processing with concurrent requests');
  console.log('  • Comprehensive error handling');
  console.log('  • Performance metrics and monitoring');
  console.log();
  print.info(`Server: ${config.baseUrl}`);
  print.info(`API Key provided: ${config.apiKey ? 'Yes' : 'No'}`);
  print.info(`Verbose mode: ${config.verbose}`);
  print.info(`Show metrics: ${config.showMetrics}`);
  print.info(`Timeout: ${config.timeout}ms`);
  print.info(`Max retries: ${config.maxRetries}`);
  console.log();
}

// Main execution function
async function main() {
  try {
    showExampleInfo();
    
    // Step 1: Test server connection
    const healthData = await testServerConnection(config.baseUrl);
    console.log();
    
    // Step 2: Create OpenAI client
    const client = await createClient();
    console.log();
    
    // Step 3: List available models
    const models = await listModels(client);
    console.log();
    
    // Step 4: Basic completion
    const basicResult = await basicCompletion(client);
    console.log();
    
    // Step 5: Advanced completion
    const advancedResult = await advancedCompletion(client);
    console.log();
    
    // Step 6: Streaming completion
    const streamingResult = await streamingCompletion(client);
    console.log();
    
    // Step 7: Session-based conversation
    const sessionResult = await sessionConversation(client);
    console.log();
    
    // Step 8: Batch processing
    const batchResult = await batchProcessing(client);
    console.log();
    
    // Step 9: Error handling demonstration
    await errorHandlingDemo(client);
    console.log();
    
    print.success('✅ JavaScript OpenAI SDK integration example completed successfully!');
    console.log();
    print.info('Key features demonstrated:');
    print.info('  • JavaScript modern async/await patterns');
    print.info('  • OpenAI SDK integration and configuration');
    print.info('  • Authentication auto-detection and setup');
    print.info('  • Comprehensive request/response handling');
    print.info('  • Session management and context persistence');
    print.info('  • Streaming responses with real-time metrics');
    print.info('  • Concurrent request processing');
    print.info('  • Robust error handling and recovery');
    console.log();
    print.info('Next steps:');
    print.info('  • Try TypeScript examples: ./scripts/examples/typescript/');
    print.info('  • Explore fetch client: ./scripts/examples/javascript/fetch-client.js');
    print.info('  • View cURL examples: ./scripts/examples/curl/');
    print.info('  • Read setup guide: ./scripts/examples/README.md');
    
  } catch (error) {
    print.error('Example execution failed:');
    
    if (error instanceof ClaudeWrapperError) {
      console.error(`  ${error.message}`);
      if (config.verbose && error.cause) {
        console.error(`  Caused by: ${error.cause.message || error.cause}`);
      }
      if (error.statusCode) {
        console.error(`  Status code: ${error.statusCode}`);
      }
    } else {
      console.error(`  ${error.message || error}`);
    }
    
    console.log();
    print.info('Troubleshooting:');
    print.info('  • Ensure the claude-wrapper server is running');
    print.info('  • Check your authentication configuration');
    print.info('  • Verify network connectivity');
    print.info('  • Review the setup guide: ./scripts/examples/README.md');
    print.info('  • Check server logs for detailed error information');
    
    process.exit(1);
  }
}

// Handle command line arguments
function handleArguments() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node openai-sdk-integration.js [options]');
    console.log();
    console.log('Options:');
    console.log('  -h, --help     Show this help message');
    console.log('  -v, --verbose  Enable verbose output');
    console.log('  -m, --metrics  Show detailed metrics');
    console.log();
    console.log('Environment variables:');
    console.log('  CLAUDE_WRAPPER_URL  Server URL (default: http://localhost:8000)');
    console.log('  API_KEY            API key for authentication (if required)');
    console.log('  VERBOSE           Enable verbose output (true/false)');
    console.log('  SHOW_METRICS      Show detailed metrics (true/false)');
    console.log('  TIMEOUT           Request timeout in ms (default: 30000)');
    console.log('  MAX_RETRIES       Maximum retry attempts (default: 3)');
    console.log();
    console.log('Examples:');
    console.log('  node openai-sdk-integration.js                    # Basic usage');
    console.log('  node openai-sdk-integration.js --verbose          # Verbose output');
    console.log('  node openai-sdk-integration.js --metrics          # Show metrics');
    console.log('  API_KEY=your-key node openai-sdk-integration.js   # With API key');
    console.log('  VERBOSE=true SHOW_METRICS=true node openai-sdk-integration.js  # Via env');
    process.exit(0);
  }
  
  if (args.includes('--verbose') || args.includes('-v')) {
    config.verbose = true;
  }
  
  if (args.includes('--metrics') || args.includes('-m')) {
    config.showMetrics = true;
  }
}

// Check Node.js version compatibility
function checkNodeVersion() {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  if (majorVersion < 14) {
    print.error(`Node.js version ${nodeVersion} is not supported`);
    print.info('Please upgrade to Node.js 14 or higher');
    process.exit(1);
  }
  
  if (config.verbose) {
    print.info(`Node.js version: ${nodeVersion}`);
  }
}

// Script execution
if (require.main === module) {
  checkNodeVersion();
  handleArguments();
  
  main().catch((error) => {
    print.error('Unhandled error:');
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  createClient,
  testServerConnection,
  listModels,
  basicCompletion,
  advancedCompletion,
  streamingCompletion,
  sessionConversation,
  batchProcessing,
  errorHandlingDemo,
  ClaudeWrapperError,
  config,
};