#!/usr/bin/env npx tsx

/**
 * Basic Usage TypeScript Example
 * Demonstrates OpenAI SDK integration with claude-wrapper
 * Based on Python OpenAI SDK examples with TypeScript enhancements
 */

import { OpenAI } from 'openai';
import * as fs from 'fs';
import * as path from 'path';

// Configuration with environment variable support
interface Config {
  baseUrl: string;
  apiKey?: string;
  verbose: boolean;
  timeout: number;
}

const config: Config = {
  baseUrl: process.env.CLAUDE_WRAPPER_URL || 'http://localhost:8000/v1',
  apiKey: process.env.API_KEY,
  verbose: process.env.VERBOSE === 'true',
  timeout: parseInt(process.env.TIMEOUT || '30000', 10),
};

// Color codes for console output
const colors = {
  info: '\x1b[34m',    // Blue
  success: '\x1b[32m', // Green
  warning: '\x1b[33m', // Yellow
  error: '\x1b[31m',   // Red
  response: '\x1b[36m', // Cyan
  reset: '\x1b[0m',    // Reset
};

// Utility functions for colored output
const print = {
  info: (msg: string) => console.log(`${colors.info}[INFO]${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.success}[SUCCESS]${colors.reset} ${msg}`),
  warning: (msg: string) => console.log(`${colors.warning}[WARNING]${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.error}[ERROR]${colors.reset} ${msg}`),
  response: (msg: string) => console.log(`${colors.response}${msg}${colors.reset}`),
};

// Enhanced error handling
class ClaudeWrapperError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'ClaudeWrapperError';
  }
}

// Authentication detection utility
async function detectAuthentication(baseUrl: string): Promise<{ required: boolean; method?: string }> {
  try {
    const authUrl = baseUrl.replace('/v1', '/v1/auth/status');
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
    };
  } catch (error) {
    print.warning(`Could not detect authentication requirements: ${error}`);
    return { required: false };
  }
}

// Auto-detect API key based on server requirements
async function getApiKey(baseUrl: string): Promise<string | undefined> {
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
async function createClient(): Promise<OpenAI> {
  try {
    const apiKey = await getApiKey(config.baseUrl);
    
    const client = new OpenAI({
      baseURL: config.baseUrl,
      apiKey: apiKey || 'no-auth-required',
      timeout: config.timeout,
      maxRetries: 3,
    });
    
    print.success('OpenAI client created successfully');
    return client;
  } catch (error) {
    throw new ClaudeWrapperError('Failed to create OpenAI client', error);
  }
}

// Test server connectivity
async function testServerConnection(baseUrl: string): Promise<void> {
  try {
    const healthUrl = baseUrl.replace('/v1', '/health');
    
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
  } catch (error) {
    print.error('Server connection failed');
    print.info('Please ensure the claude-wrapper server is running:');
    print.info('  cd claude-wrapper && npm start');
    throw new ClaudeWrapperError('Server connection failed', error);
  }
}

// List available models
async function listModels(client: OpenAI): Promise<void> {
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
      });
    } else {
      print.warning('No models found');
    }
  } catch (error) {
    throw new ClaudeWrapperError('Failed to list models', error);
  }
}

// Basic chat completion
async function basicCompletion(client: OpenAI): Promise<void> {
  try {
    print.info('Making basic chat completion request...');
    
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
    
    if (completion.choices && completion.choices.length > 0) {
      const message = completion.choices[0].message;
      
      print.success('Chat completion successful!');
      console.log('\n📝 Claude\'s Response:');
      console.log('----------------------------------------');
      print.response(message.content || 'No content received');
      console.log('----------------------------------------\n');
      
      // Display usage information if available
      if (completion.usage && config.verbose) {
        print.info('Token usage:');
        console.log(`  Prompt tokens: ${completion.usage.prompt_tokens}`);
        console.log(`  Completion tokens: ${completion.usage.completion_tokens}`);
        console.log(`  Total tokens: ${completion.usage.total_tokens}`);
      }
    } else {
      print.warning('No response choices received');
    }
  } catch (error) {
    throw new ClaudeWrapperError('Basic completion failed', error);
  }
}

// Advanced completion with system message and parameters
async function advancedCompletion(client: OpenAI): Promise<void> {
  try {
    print.info('Making advanced chat completion request...');
    
    const completion = await client.chat.completions.create({
      model: 'claude-3-5-sonnet-20241022',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful TypeScript expert who explains code concepts clearly and concisely.',
        },
        {
          role: 'user',
          content: 'What are the key benefits of using TypeScript over JavaScript for API integrations like this one?',
        },
      ],
      max_tokens: 250,
      temperature: 0.8,
      top_p: 0.9,
      frequency_penalty: 0.1,
      presence_penalty: 0.1,
    });
    
    if (completion.choices && completion.choices.length > 0) {
      const message = completion.choices[0].message;
      
      print.success('Advanced completion successful!');
      console.log('\n🎯 Expert TypeScript Advice:');
      console.log('----------------------------------------');
      print.response(message.content || 'No content received');
      console.log('----------------------------------------\n');
      
      // Show additional completion info
      if (config.verbose) {
        const choice = completion.choices[0];
        print.info(`Finish reason: ${choice.finish_reason}`);
        
        if (completion.usage) {
          print.info('Token usage:');
          console.log(JSON.stringify(completion.usage, null, 2));
        }
      }
    } else {
      print.warning('No response choices received');
    }
  } catch (error) {
    throw new ClaudeWrapperError('Advanced completion failed', error);
  }
}

// Error handling demonstration
async function errorHandlingDemo(client: OpenAI): Promise<void> {
  try {
    print.info('Demonstrating error handling...');
    
    // This should trigger an error (invalid model)
    await client.chat.completions.create({
      model: 'non-existent-model',
      messages: [{ role: 'user', content: 'Test' }],
    });
    
    print.warning('Expected error did not occur');
  } catch (error) {
    print.success('Error handling working correctly');
    
    if (error instanceof OpenAI.APIError) {
      print.info(`API Error: ${error.message}`);
      if (config.verbose) {
        print.info(`Status: ${error.status}`);
        print.info(`Type: ${error.type}`);
      }
    } else {
      print.info(`Unexpected error: ${error}`);
    }
  }
}

// Display example information
function showExampleInfo(): void {
  console.log();
  print.info('🎯 TypeScript Basic Usage Example');
  console.log('This example demonstrates:');
  console.log('  • OpenAI SDK integration with claude-wrapper');
  console.log('  • Automatic authentication detection');
  console.log('  • Model listing and selection');
  console.log('  • Basic and advanced chat completions');
  console.log('  • Error handling and validation');
  console.log('  • TypeScript type safety and interfaces');
  console.log();
  print.info(`Server: ${config.baseUrl}`);
  print.info(`API Key provided: ${config.apiKey ? 'Yes' : 'No'}`);
  print.info(`Verbose mode: ${config.verbose}`);
  print.info(`Timeout: ${config.timeout}ms`);
  console.log();
}

// Main execution function
async function main(): Promise<void> {
  try {
    showExampleInfo();
    
    // Step 1: Test server connection
    await testServerConnection(config.baseUrl);
    console.log();
    
    // Step 2: Create OpenAI client
    const client = await createClient();
    console.log();
    
    // Step 3: List available models
    await listModels(client);
    console.log();
    
    // Step 4: Basic completion
    await basicCompletion(client);
    
    // Step 5: Advanced completion
    await advancedCompletion(client);
    
    // Step 6: Error handling demonstration
    await errorHandlingDemo(client);
    console.log();
    
    print.success('✅ TypeScript basic usage example completed successfully!');
    console.log();
    print.info('Key features demonstrated:');
    print.info('  • TypeScript type safety and error handling');
    print.info('  • OpenAI SDK integration patterns');
    print.info('  • Authentication auto-detection');
    print.info('  • Comprehensive request/response handling');
    console.log();
    print.info('Next steps:');
    print.info('  • Try streaming: ./scripts/examples/typescript/streaming-client.ts');
    print.info('  • Explore sessions: ./scripts/examples/typescript/session-continuity.ts');
    print.info('  • View JavaScript examples: ./scripts/examples/javascript/');
    print.info('  • Read setup guide: ./docs/examples/SETUP_GUIDE.md');
    
  } catch (error) {
    print.error('Example execution failed:');
    
    if (error instanceof ClaudeWrapperError) {
      console.error(`  ${error.message}`);
      if (config.verbose && error.cause) {
        console.error(`  Caused by: ${error.cause}`);
      }
    } else {
      console.error(`  ${error}`);
    }
    
    console.log();
    print.info('Troubleshooting:');
    print.info('  • Ensure the claude-wrapper server is running');
    print.info('  • Check your authentication configuration');
    print.info('  • Verify network connectivity');
    print.info('  • Review the setup guide: ./docs/examples/SETUP_GUIDE.md');
    
    process.exit(1);
  }
}

// Handle command line arguments
function handleArguments(): void {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: npx tsx basic-usage.ts [options]');
    console.log();
    console.log('Options:');
    console.log('  -h, --help     Show this help message');
    console.log('  -v, --verbose  Enable verbose output');
    console.log();
    console.log('Environment variables:');
    console.log('  CLAUDE_WRAPPER_URL  Server URL (default: http://localhost:8000/v1)');
    console.log('  API_KEY            API key for authentication (if required)');
    console.log('  VERBOSE           Enable verbose output (true/false)');
    console.log('  TIMEOUT           Request timeout in ms (default: 30000)');
    console.log();
    console.log('Examples:');
    console.log('  npx tsx basic-usage.ts                    # Basic usage');
    console.log('  npx tsx basic-usage.ts --verbose          # Verbose output');
    console.log('  API_KEY=your-key npx tsx basic-usage.ts   # With API key');
    console.log('  VERBOSE=true npx tsx basic-usage.ts       # Verbose via env');
    process.exit(0);
  }
  
  if (args.includes('--verbose') || args.includes('-v')) {
    config.verbose = true;
  }
}

// Script execution
if (require.main === module) {
  handleArguments();
  main().catch((error) => {
    print.error('Unhandled error:');
    console.error(error);
    process.exit(1);
  });
}

export { main, createClient, Config };