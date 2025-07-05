#!/usr/bin/env tsx

/**
 * Claude Wrapper - TypeScript Basic Usage Example
 * 
 * This example demonstrates how to use the OpenAI TypeScript SDK
 * with the Claude Wrapper server, showcasing all major features
 * with proper TypeScript types and error handling.
 * 
 * Based on Python openai_sdk.py with enhanced TypeScript features
 */

import OpenAI from 'openai';

// Configuration
const DEFAULT_BASE_URL = 'http://localhost:8000/v1';
const BASE_URL = process.env.CLAUDE_WRAPPER_URL?.replace(/\/$/, '') + '/v1' || DEFAULT_BASE_URL;

// Types for better development experience
interface AuthConfig {
  apiKeyRequired: boolean;
  provider: string;
  mode: string;
}

interface ServerInfo {
  server_info: AuthConfig;
}

interface ExampleConfig {
  baseUrl?: string;
  apiKey?: string;
  verbose?: boolean;
}

class ClaudeWrapperClient {
  private client: OpenAI;
  private verbose: boolean;

  constructor(config: ExampleConfig = {}) {
    this.verbose = config.verbose || false;
    
    const baseUrl = config.baseUrl || BASE_URL;
    const apiKey = config.apiKey || this.getApiKey(baseUrl);
    
    this.client = new OpenAI({
      baseURL: baseUrl,
      apiKey: apiKey || 'fallback-key',
    });

    if (this.verbose) {
      console.log(`🔧 Initialized client with base URL: ${baseUrl}`);
    }
  }

  /**
   * Auto-detect API key based on server configuration
   */
  private getApiKey(baseUrl: string): string {
    // Check environment first
    if (process.env.API_KEY) {
      if (this.verbose) {
        console.log('🔑 Using API key from environment variable');
      }
      return process.env.API_KEY;
    }

    // For this example, we'll use a fallback key
    // In a real application, you'd make an HTTP request to check auth status
    console.log('⚠️  No API_KEY environment variable found');
    console.log('   Set API_KEY if your server requires authentication');
    
    return 'no-auth-required';
  }

  /**
   * Check server authentication status
   */
  async checkAuthStatus(): Promise<AuthConfig> {
    try {
      const authUrl = BASE_URL.replace('/v1', '') + '/v1/auth/status';
      const response = await fetch(authUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data: ServerInfo = await response.json();
      return data.server_info;
    } catch (error) {
      console.warn('⚠️  Could not check server auth status:', error);
      return {
        apiKeyRequired: false,
        provider: 'unknown',
        mode: 'unknown'
      };
    }
  }

  /**
   * Basic chat completion example
   */
  async basicChatExample(): Promise<void> {
    console.log('\n=== Basic Chat Completion ===');
    
    try {
      const response = await this.client.chat.completions.create({
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          { role: 'user', content: 'What is the capital of France?' }
        ],
        max_tokens: 100,
      });

      console.log(`✅ Response: ${response.choices[0].message.content}`);
      console.log(`📊 Model: ${response.model}`);
      console.log(`📈 Usage:`, response.usage);
      
    } catch (error) {
      console.error('❌ Basic chat failed:', error);
      throw error;
    }
  }

  /**
   * System message example with role-based conversation
   */
  async systemMessageExample(): Promise<void> {
    console.log('\n=== Chat with System Message ===');
    
    try {
      const response = await this.client.chat.completions.create({
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          { 
            role: 'system', 
            content: 'You are a helpful TypeScript coding assistant. Be concise and provide practical examples.' 
          },
          { 
            role: 'user', 
            content: 'How do I define an interface in TypeScript?' 
          }
        ],
        temperature: 0.3,
      });

      console.log(`✅ Response: ${response.choices[0].message.content}`);
      
    } catch (error) {
      console.error('❌ System message example failed:', error);
      throw error;
    }
  }

  /**
   * Multi-turn conversation example
   */
  async conversationExample(): Promise<void> {
    console.log('\n=== Multi-turn Conversation ===');
    
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'user', content: 'My name is Alice and I work with TypeScript.' },
      { 
        role: 'assistant', 
        content: 'Nice to meet you, Alice! TypeScript is a great language. How can I help you with your TypeScript work today?' 
      },
      { role: 'user', content: 'What\'s my name and what language do I work with?' }
    ];

    try {
      const response = await this.client.chat.completions.create({
        model: 'claude-3-5-sonnet-20241022',
        messages,
        temperature: 0.7,
      });

      console.log(`✅ Response: ${response.choices[0].message.content}`);
      
    } catch (error) {
      console.error('❌ Conversation example failed:', error);
      throw error;
    }
  }

  /**
   * Streaming response example with real-time processing
   */
  async streamingExample(): Promise<void> {
    console.log('\n=== Streaming Response ===');
    
    try {
      const stream = await this.client.chat.completions.create({
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          { role: 'user', content: 'Write a TypeScript function that calculates the factorial of a number' }
        ],
        stream: true,
        temperature: 0.3,
      });

      console.log('📡 Streaming response:');
      console.log('╭─────────────────────────────────────────────────────────╮');
      process.stdout.write('│ ');

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          process.stdout.write(content);
        }
      }

      console.log('\n╰─────────────────────────────────────────────────────────╯');
      console.log('✅ Streaming completed');
      
    } catch (error) {
      console.error('❌ Streaming example failed:', error);
      throw error;
    }
  }

  /**
   * Session-based conversation example
   */
  async sessionExample(): Promise<void> {
    console.log('\n=== Session-based Conversation ===');
    
    const sessionId = `typescript-demo-${Date.now()}`;
    console.log(`🔗 Session ID: ${sessionId}`);

    try {
      // First message in session
      console.log('\n📝 Message 1: Setting up context');
      const response1 = await this.client.chat.completions.create({
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          { role: 'user', content: 'I am building a REST API with Express.js and TypeScript. My name is Bob.' }
        ],
        // @ts-ignore - session_id is not in OpenAI types but our wrapper supports it
        session_id: sessionId,
      });

      console.log(`Claude: ${response1.choices[0].message.content}`);

      // Second message - test memory
      console.log('\n📝 Message 2: Testing session memory');
      const response2 = await this.client.chat.completions.create({
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          { role: 'user', content: 'What\'s my name and what am I building?' }
        ],
        // @ts-ignore - session_id is not in OpenAI types but our wrapper supports it
        session_id: sessionId,
      });

      console.log(`Claude: ${response2.choices[0].message.content}`);

      console.log(`✅ Session example completed with ID: ${sessionId}`);
      
    } catch (error) {
      console.error('❌ Session example failed:', error);
      throw error;
    }
  }

  /**
   * Error handling example
   */
  async errorHandlingExample(): Promise<void> {
    console.log('\n=== Error Handling Example ===');
    
    try {
      // Try to use an invalid model
      await this.client.chat.completions.create({
        model: 'invalid-model-name',
        messages: [
          { role: 'user', content: 'This should fail' }
        ],
      });
      
      console.log('⚠️  Unexpected success - error handling may not be working');
      
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        console.log(`✅ Expected API error caught:`);
        console.log(`   Status: ${error.status}`);
        console.log(`   Message: ${error.message}`);
        console.log(`   Type: ${error.type || 'unknown'}`);
      } else {
        console.log(`✅ Expected error caught: ${error}`);
      }
    }
  }

  /**
   * List available models
   */
  async listModelsExample(): Promise<void> {
    console.log('\n=== Available Models ===');
    
    try {
      const models = await this.client.models.list();
      
      console.log('Available models:');
      for (const model of models.data) {
        console.log(`  • ${model.id} (owned by: ${model.owned_by})`);
      }
      
    } catch (error) {
      console.error('❌ List models failed:', error);
      throw error;
    }
  }

  /**
   * Performance and parameter examples
   */
  async parameterExamples(): Promise<void> {
    console.log('\n=== Parameter Customization Examples ===');
    
    const examples = [
      {
        name: 'Creative Writing (high temperature)',
        config: { temperature: 0.9, max_tokens: 150 },
        prompt: 'Write a creative short story about a time-traveling developer'
      },
      {
        name: 'Technical Documentation (low temperature)',
        config: { temperature: 0.1, max_tokens: 200 },
        prompt: 'Explain how TypeScript interfaces work'
      },
      {
        name: 'Balanced Response',
        config: { temperature: 0.5, max_tokens: 100, top_p: 0.9 },
        prompt: 'Give me pros and cons of using TypeScript vs JavaScript'
      }
    ];

    for (const example of examples) {
      console.log(`\n📊 ${example.name}:`);
      console.log(`   Config: ${JSON.stringify(example.config)}`);
      
      try {
        const response = await this.client.chat.completions.create({
          model: 'claude-3-5-sonnet-20241022',
          messages: [
            { role: 'user', content: example.prompt }
          ],
          ...example.config,
        });

        const content = response.choices[0].message.content;
        const preview = content!.substring(0, 100) + (content!.length > 100 ? '...' : '');
        console.log(`   Response: ${preview}`);
        
      } catch (error) {
        console.error(`   ❌ Failed: ${error}`);
      }
    }
  }
}

/**
 * Main example runner
 */
async function main(): Promise<void> {
  console.log('🚀 Claude Wrapper TypeScript Examples');
  console.log('======================================');

  // Parse command line arguments
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose') || args.includes('-v');
  const customUrl = args.find(arg => arg.startsWith('--url='))?.split('=')[1];

  const config: ExampleConfig = {
    verbose,
    baseUrl: customUrl,
  };

  const client = new ClaudeWrapperClient(config);

  try {
    // Check authentication status
    const authStatus = await client.checkAuthStatus();
    console.log('\n🔍 Server Configuration:');
    console.log(`   API Key Required: ${authStatus.apiKeyRequired}`);
    console.log(`   Provider: ${authStatus.provider}`);
    console.log(`   Mode: ${authStatus.mode}`);

    if (authStatus.apiKeyRequired && !process.env.API_KEY) {
      console.log('\n⚠️  Server requires API key but none provided');
      console.log('   Set API_KEY environment variable:');
      console.log('   export API_KEY=your-server-key');
      console.log('   npm run ts-example');
      process.exit(1);
    }

    // Run all examples
    await client.basicChatExample();
    await client.systemMessageExample();
    await client.conversationExample();
    await client.streamingExample();
    await client.sessionExample();
    await client.parameterExamples();
    await client.listModelsExample();
    await client.errorHandlingExample();

    console.log('\n🎉 All TypeScript examples completed successfully!');
    console.log('\n💡 Key TypeScript Benefits:');
    console.log('   • Strong typing prevents runtime errors');
    console.log('   • Excellent IDE support with autocomplete');
    console.log('   • Better refactoring capabilities');
    console.log('   • Enhanced error detection at compile time');
    console.log('   • Improved code documentation through types');

  } catch (error) {
    console.error('\n❌ Examples failed:', error);
    console.log('\n🔧 Troubleshooting:');
    console.log('   • Make sure the claude-wrapper server is running');
    console.log('   • Check if API_KEY environment variable is set correctly');
    console.log('   • Verify the server URL is accessible');
    console.log('   • Check server logs for additional error details');
    process.exit(1);
  }
}

/**
 * Show usage information
 */
function showUsage(): void {
  console.log('Usage: tsx basic-usage.ts [options]');
  console.log('');
  console.log('Options:');
  console.log('  -h, --help         Show this help message');
  console.log('  -v, --verbose      Enable verbose logging');
  console.log('  --url=URL          Custom server URL (default: http://localhost:8000/v1)');
  console.log('');
  console.log('Environment variables:');
  console.log('  API_KEY              API key for authentication (if required)');
  console.log('  CLAUDE_WRAPPER_URL   Base URL for the server');
  console.log('');
  console.log('Examples:');
  console.log('  tsx basic-usage.ts                    # Run with default settings');
  console.log('  tsx basic-usage.ts --verbose          # Enable verbose output');
  console.log('  tsx basic-usage.ts --url=http://localhost:3000/v1  # Custom URL');
  console.log('  API_KEY=abc123 tsx basic-usage.ts     # With API key');
  console.log('');
  console.log('Installation:');
  console.log('  npm install -g tsx                    # Install tsx globally');
  console.log('  npm install openai                    # Install OpenAI SDK');
  console.log('');
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showUsage();
  process.exit(0);
}

// Run the examples
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { ClaudeWrapperClient, type ExampleConfig, type AuthConfig };