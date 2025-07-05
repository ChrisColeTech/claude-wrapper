#!/usr/bin/env tsx

/**
 * Claude Wrapper - TypeScript Streaming Client Example
 * 
 * This example demonstrates advanced streaming capabilities with the OpenAI TypeScript SDK
 * and Claude Wrapper server, including real-time processing, error handling, and
 * performance monitoring.
 * 
 * Enhanced with TypeScript-specific features like async generators, typed event handlers,
 * and comprehensive error boundaries.
 */

import OpenAI from 'openai';
import { performance } from 'perf_hooks';

// Configuration
const DEFAULT_BASE_URL = 'http://localhost:8000/v1';
const BASE_URL = process.env.CLAUDE_WRAPPER_URL?.replace(/\/$/, '') + '/v1' || DEFAULT_BASE_URL;

// Types for streaming functionality
interface StreamConfig {
  baseUrl?: string;
  apiKey?: string;
  verbose?: boolean;
  showMetrics?: boolean;
}

interface StreamMetrics {
  startTime: number;
  endTime?: number;
  totalChunks: number;
  totalCharacters: number;
  firstChunkTime?: number;
  averageChunkSize: number;
  duration?: number;
  charactersPerSecond?: number;
}

interface StreamEvent {
  type: 'start' | 'chunk' | 'end' | 'error';
  data?: string;
  timestamp: number;
  metrics?: Partial<StreamMetrics>;
}

type StreamEventHandler = (event: StreamEvent) => void;

class StreamingClient {
  private client: OpenAI;
  private verbose: boolean;
  private showMetrics: boolean;

  constructor(config: StreamConfig = {}) {
    this.verbose = config.verbose || false;
    this.showMetrics = config.showMetrics || false;
    
    const baseUrl = config.baseUrl || BASE_URL;
    const apiKey = config.apiKey || process.env.API_KEY || 'fallback-key';
    
    this.client = new OpenAI({
      baseURL: baseUrl,
      apiKey: apiKey,
    });

    if (this.verbose) {
      console.log(`🔧 Streaming client initialized with base URL: ${baseUrl}`);
    }
  }

  /**
   * Create a streaming chat completion with comprehensive metrics
   */
  async createStreamingCompletion(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    options: Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams> = {},
    eventHandler?: StreamEventHandler
  ): Promise<{ response: string; metrics: StreamMetrics }> {
    const metrics: StreamMetrics = {
      startTime: performance.now(),
      totalChunks: 0,
      totalCharacters: 0,
      averageChunkSize: 0,
    };

    let fullResponse = '';

    try {
      // Fire start event
      eventHandler?.({
        type: 'start',
        timestamp: Date.now(),
        metrics: { startTime: metrics.startTime }
      });

      const stream = await this.client.chat.completions.create({
        model: 'claude-3-5-sonnet-20241022',
        messages,
        stream: true,
        ...options,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        
        if (content) {
          // Record first chunk timing
          if (metrics.totalChunks === 0) {
            metrics.firstChunkTime = performance.now() - metrics.startTime;
          }

          metrics.totalChunks++;
          metrics.totalCharacters += content.length;
          fullResponse += content;

          // Fire chunk event
          eventHandler?.({
            type: 'chunk',
            data: content,
            timestamp: Date.now(),
            metrics: {
              totalChunks: metrics.totalChunks,
              totalCharacters: metrics.totalCharacters
            }
          });
        }
      }

      // Calculate final metrics
      metrics.endTime = performance.now();
      metrics.duration = metrics.endTime - metrics.startTime;
      metrics.averageChunkSize = metrics.totalCharacters / Math.max(metrics.totalChunks, 1);
      metrics.charactersPerSecond = metrics.totalCharacters / (metrics.duration / 1000);

      // Fire end event
      eventHandler?.({
        type: 'end',
        timestamp: Date.now(),
        metrics
      });

      return { response: fullResponse, metrics };

    } catch (error) {
      // Fire error event
      eventHandler?.({
        type: 'error',
        data: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      });
      
      throw error;
    }
  }

  /**
   * Basic streaming example with visual output
   */
  async basicStreamingExample(): Promise<void> {
    console.log('\n=== Basic Streaming Example ===');
    
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'user', content: 'Count from 1 to 10, putting each number on a new line with a short comment about that number.' }
    ];

    console.log('📡 Streaming response:');
    console.log('╭─────────────────────────────────────────────────────────╮');
    process.stdout.write('│ ');

    try {
      const { response, metrics } = await this.createStreamingCompletion(
        messages,
        { temperature: 0.3 },
        (event) => {
          if (event.type === 'chunk' && event.data) {
            process.stdout.write(event.data);
          }
        }
      );

      console.log('\n╰─────────────────────────────────────────────────────────╯');
      
      if (this.showMetrics) {
        this.displayMetrics(metrics);
      }

    } catch (error) {
      console.log('\n❌ Streaming failed:', error);
      throw error;
    }
  }

  /**
   * Advanced streaming with session continuity
   */
  async sessionStreamingExample(): Promise<void> {
    console.log('\n=== Session-based Streaming ===');
    
    const sessionId = `streaming-session-${Date.now()}`;
    console.log(`🔗 Session ID: ${sessionId}`);

    const conversationSteps = [
      'I am working on a TypeScript project. Start explaining async/await.',
      'Continue explaining with a practical example.',
      'Now explain how to handle errors in async functions.'
    ];

    for (let i = 0; i < conversationSteps.length; i++) {
      console.log(`\n📝 Step ${i + 1}: ${conversationSteps[i]}`);
      console.log('╭─────────────────────────────────────────────────────────╮');
      process.stdout.write('│ ');

      try {
        const { metrics } = await this.createStreamingCompletion(
          [{ role: 'user', content: conversationSteps[i] }],
          { 
            temperature: 0.4,
            max_tokens: 200,
            // @ts-ignore - session_id is not in OpenAI types but our wrapper supports it
            session_id: sessionId
          },
          (event) => {
            if (event.type === 'chunk' && event.data) {
              process.stdout.write(event.data);
            }
          }
        );

        console.log('\n╰─────────────────────────────────────────────────────────╯');
        
        if (this.verbose) {
          console.log(`⏱️  Step ${i + 1} completed in ${metrics.duration?.toFixed(0)}ms`);
        }

      } catch (error) {
        console.log('\n❌ Session streaming step failed:', error);
        break;
      }

      // Brief pause between steps
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  /**
   * Code generation streaming with syntax highlighting simulation
   */
  async codeGenerationStreamingExample(): Promise<void> {
    console.log('\n=== Code Generation Streaming ===');
    
    const prompt = `
Write a TypeScript function that:
1. Accepts an array of numbers
2. Filters out negative numbers
3. Sorts the remaining numbers
4. Returns the sum of the largest 3 numbers
5. Include proper type annotations and JSDoc comments
`;

    console.log('🔧 Generating TypeScript code...');
    console.log('╭─────────────────────────────────────────────────────────╮');
    
    let codeBuffer = '';
    let inCodeBlock = false;

    try {
      const { response, metrics } = await this.createStreamingCompletion(
        [{ role: 'user', content: prompt }],
        { temperature: 0.2, max_tokens: 400 },
        (event) => {
          if (event.type === 'chunk' && event.data) {
            codeBuffer += event.data;
            
            // Simple syntax highlighting simulation
            const lines = codeBuffer.split('\n');
            const lastLine = lines[lines.length - 1];
            
            // Clear current line and rewrite with "highlighting"
            if (lastLine.includes('function') || lastLine.includes('interface')) {
              process.stdout.write(`\x1b[36m${event.data}\x1b[0m`); // Cyan for keywords
            } else if (lastLine.includes('//') || lastLine.includes('/*')) {
              process.stdout.write(`\x1b[32m${event.data}\x1b[0m`); // Green for comments
            } else if (lastLine.includes('string') || lastLine.includes('number') || lastLine.includes('boolean')) {
              process.stdout.write(`\x1b[33m${event.data}\x1b[0m`); // Yellow for types
            } else {
              process.stdout.write(event.data);
            }
          }
        }
      );

      console.log('\n╰─────────────────────────────────────────────────────────╯');
      console.log('✅ Code generation completed');
      
      if (this.showMetrics) {
        this.displayMetrics(metrics);
      }

    } catch (error) {
      console.log('\n❌ Code generation streaming failed:', error);
      throw error;
    }
  }

  /**
   * Performance comparison: streaming vs non-streaming
   */
  async performanceComparisonExample(): Promise<void> {
    console.log('\n=== Performance Comparison: Streaming vs Non-Streaming ===');
    
    const testPrompt = 'Explain the concept of dependency injection in TypeScript with examples.';
    
    // Non-streaming request
    console.log('\n🔄 Non-streaming request:');
    const nonStreamingStart = performance.now();
    
    try {
      const nonStreamingResponse = await this.client.chat.completions.create({
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: testPrompt }],
        stream: false,
        max_tokens: 300,
      });
      
      const nonStreamingEnd = performance.now();
      const nonStreamingDuration = nonStreamingEnd - nonStreamingStart;
      
      console.log(`⏱️  Total time: ${nonStreamingDuration.toFixed(0)}ms`);
      console.log(`📝 Response length: ${nonStreamingResponse.choices[0].message.content?.length} characters`);
      console.log(`🎯 User experience: Wait ${nonStreamingDuration.toFixed(0)}ms, then see full response`);
      
    } catch (error) {
      console.log('❌ Non-streaming request failed:', error);
    }

    // Streaming request
    console.log('\n📡 Streaming request:');
    
    try {
      let firstChunkReceived = false;
      const { response, metrics } = await this.createStreamingCompletion(
        [{ role: 'user', content: testPrompt }],
        { max_tokens: 300 },
        (event) => {
          if (event.type === 'chunk' && !firstChunkReceived) {
            firstChunkReceived = true;
            console.log(`⚡ First chunk received in: ${metrics.firstChunkTime?.toFixed(0)}ms`);
          }
        }
      );

      console.log(`⏱️  Total time: ${metrics.duration?.toFixed(0)}ms`);
      console.log(`📝 Response length: ${response.length} characters`);
      console.log(`🎯 User experience: Start seeing response after ${metrics.firstChunkTime?.toFixed(0)}ms`);
      console.log(`📊 Streaming rate: ${metrics.charactersPerSecond?.toFixed(0)} chars/sec`);
      
    } catch (error) {
      console.log('❌ Streaming request failed:', error);
    }
  }

  /**
   * Error handling and recovery in streaming
   */
  async errorHandlingExample(): Promise<void> {
    console.log('\n=== Streaming Error Handling ===');
    
    const errorScenarios = [
      {
        name: 'Invalid model',
        request: {
          model: 'invalid-model-name',
          messages: [{ role: 'user' as const, content: 'This should fail' }]
        }
      },
      {
        name: 'Empty messages',
        request: {
          model: 'claude-3-5-sonnet-20241022',
          messages: []
        }
      },
      {
        name: 'Excessive max_tokens',
        request: {
          model: 'claude-3-5-sonnet-20241022',
          messages: [{ role: 'user' as const, content: 'Test' }],
          max_tokens: 999999
        }
      }
    ];

    for (const scenario of errorScenarios) {
      console.log(`\n🧪 Testing: ${scenario.name}`);
      
      try {
        await this.createStreamingCompletion(
          scenario.request.messages,
          scenario.request,
          (event) => {
            if (event.type === 'error') {
              console.log(`❌ Stream error: ${event.data}`);
            } else if (event.type === 'chunk') {
              console.log('⚠️  Unexpected success - received chunk');
            }
          }
        );
        
        console.log('⚠️  Unexpected success');
        
      } catch (error) {
        if (error instanceof OpenAI.APIError) {
          console.log(`✅ Expected error caught: ${error.status} - ${error.message}`);
        } else {
          console.log(`✅ Expected error caught: ${error}`);
        }
      }
    }
  }

  /**
   * Multiple concurrent streams example
   */
  async concurrentStreamsExample(): Promise<void> {
    console.log('\n=== Concurrent Streaming Examples ===');
    
    const prompts = [
      'Explain TypeScript generics in one paragraph',
      'What are the benefits of using interfaces in TypeScript?',
      'How does TypeScript handle null safety?'
    ];

    console.log('🚀 Starting 3 concurrent streams...');
    
    const streamPromises = prompts.map(async (prompt, index) => {
      const startTime = performance.now();
      
      try {
        const { response, metrics } = await this.createStreamingCompletion(
          [{ role: 'user', content: prompt }],
          { max_tokens: 150, temperature: 0.3 }
        );

        return {
          index,
          prompt,
          response: response.substring(0, 100) + '...',
          duration: metrics.duration,
          success: true
        };
        
      } catch (error) {
        return {
          index,
          prompt,
          error: error instanceof Error ? error.message : String(error),
          success: false
        };
      }
    });

    const results = await Promise.all(streamPromises);
    
    console.log('\n📊 Concurrent streaming results:');
    for (const result of results) {
      if (result.success) {
        console.log(`  ✅ Stream ${result.index + 1}: ${result.duration?.toFixed(0)}ms`);
        console.log(`     "${result.response}"`);
      } else {
        console.log(`  ❌ Stream ${result.index + 1}: Failed - ${result.error}`);
      }
    }
  }

  /**
   * Display detailed metrics
   */
  private displayMetrics(metrics: StreamMetrics): void {
    console.log('\n📊 Streaming Metrics:');
    console.log('┌─────────────────────────────────────────┐');
    console.log(`│ Duration: ${metrics.duration?.toFixed(0)}ms`.padEnd(40) + '│');
    console.log(`│ First chunk: ${metrics.firstChunkTime?.toFixed(0)}ms`.padEnd(40) + '│');
    console.log(`│ Total chunks: ${metrics.totalChunks}`.padEnd(40) + '│');
    console.log(`│ Total characters: ${metrics.totalCharacters}`.padEnd(40) + '│');
    console.log(`│ Avg chunk size: ${metrics.averageChunkSize.toFixed(1)} chars`.padEnd(40) + '│');
    console.log(`│ Streaming rate: ${metrics.charactersPerSecond?.toFixed(0)} chars/sec`.padEnd(40) + '│');
    console.log('└─────────────────────────────────────────┘');
  }
}

/**
 * Main example runner
 */
async function main(): Promise<void> {
  console.log('🚀 Claude Wrapper TypeScript Streaming Examples');
  console.log('===============================================');

  // Parse command line arguments
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose') || args.includes('-v');
  const showMetrics = args.includes('--metrics') || args.includes('-m');
  const customUrl = args.find(arg => arg.startsWith('--url='))?.split('=')[1];

  const config: StreamConfig = {
    verbose,
    showMetrics,
    baseUrl: customUrl,
  };

  const client = new StreamingClient(config);

  try {
    // Check if server is accessible
    console.log(`🔍 Testing connection to: ${BASE_URL.replace('/v1', '')}`);
    
    if (!process.env.API_KEY) {
      console.log('⚠️  No API_KEY environment variable set');
      console.log('   If your server requires authentication, set:');
      console.log('   export API_KEY=your-server-key');
    }

    // Run streaming examples
    await client.basicStreamingExample();
    await client.sessionStreamingExample();
    await client.codeGenerationStreamingExample();
    await client.performanceComparisonExample();
    await client.errorHandlingExample();
    await client.concurrentStreamsExample();

    console.log('\n🎉 All TypeScript streaming examples completed successfully!');
    console.log('\n💡 Streaming Benefits:');
    console.log('   • Immediate response feedback');
    console.log('   • Better perceived performance');
    console.log('   • Real-time user experience');
    console.log('   • Progressive content rendering');
    console.log('   • Lower time-to-first-byte');

  } catch (error) {
    console.error('\n❌ Streaming examples failed:', error);
    console.log('\n🔧 Troubleshooting:');
    console.log('   • Verify claude-wrapper server is running');
    console.log('   • Check network connectivity');
    console.log('   • Ensure proper authentication setup');
    console.log('   • Review server logs for errors');
    process.exit(1);
  }
}

/**
 * Show usage information
 */
function showUsage(): void {
  console.log('Usage: tsx streaming-client.ts [options]');
  console.log('');
  console.log('Options:');
  console.log('  -h, --help         Show this help message');
  console.log('  -v, --verbose      Enable verbose logging');
  console.log('  -m, --metrics      Show detailed streaming metrics');
  console.log('  --url=URL          Custom server URL (default: http://localhost:8000/v1)');
  console.log('');
  console.log('Environment variables:');
  console.log('  API_KEY              API key for authentication (if required)');
  console.log('  CLAUDE_WRAPPER_URL   Base URL for the server');
  console.log('');
  console.log('Examples:');
  console.log('  tsx streaming-client.ts                           # Basic streaming examples');
  console.log('  tsx streaming-client.ts --verbose --metrics       # With detailed output');
  console.log('  tsx streaming-client.ts --url=http://localhost:3000/v1  # Custom URL');
  console.log('  API_KEY=abc123 tsx streaming-client.ts            # With authentication');
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

export { StreamingClient, type StreamConfig, type StreamMetrics, type StreamEvent };