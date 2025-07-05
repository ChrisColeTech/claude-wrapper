#!/usr/bin/env npx tsx

/**
 * TypeScript Session Continuity Example
 * 
 * Demonstrates advanced session management with the Claude Wrapper server,
 * including session persistence, context management, and comprehensive session API usage.
 * 
 * Enhanced with TypeScript-specific features like strong typing, async/await patterns,
 * and comprehensive error handling with custom session management utilities.
 */

import { OpenAI } from 'openai';
import { performance } from 'perf_hooks';

// Configuration interface
interface SessionConfig {
  baseUrl?: string;
  apiKey?: string;
  verbose?: boolean;
  showMetrics?: boolean;
  sessionTimeout?: number;
}

// Session information interface
interface SessionInfo {
  session_id: string;
  created_at: string;
  last_activity: string;
  expires_at: string;
  message_count: number;
  total_tokens?: number;
  model_used?: string;
  status: 'active' | 'expired' | 'deleted';
}

// Session statistics interface
interface SessionStats {
  active_sessions: number;
  total_messages: number;
  total_tokens: number;
  cleanup_interval_minutes: number;
  server_uptime_minutes: number;
}

// Session management response interfaces
interface SessionListResponse {
  sessions: SessionInfo[];
  total: number;
  page: number;
  per_page: number;
}

interface SessionStatsResponse {
  session_stats: SessionStats;
  cleanup_interval_minutes: number;
  server_info: {
    version: string;
    uptime_minutes: number;
  };
}

// Session message interface
interface SessionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  tokens?: number;
}

// Session conversation interface
interface SessionConversation {
  session_id: string;
  messages: SessionMessage[];
  total_messages: number;
  created_at: string;
  last_activity: string;
}

// Default configuration
const DEFAULT_CONFIG: Required<SessionConfig> = {
  baseUrl: process.env.CLAUDE_WRAPPER_URL?.replace(/\/$/, '') || 'http://localhost:8000',
  apiKey: process.env.API_KEY || '',
  verbose: process.env.VERBOSE === 'true',
  showMetrics: process.env.SHOW_METRICS === 'true',
  sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '3600', 10) // 1 hour default
};

class SessionManager {
  private client: OpenAI;
  private config: Required<SessionConfig>;
  private baseUrl: string;

  constructor(config: SessionConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.baseUrl = this.config.baseUrl;
    
    // Initialize OpenAI client
    this.client = new OpenAI({
      baseURL: `${this.baseUrl}/v1`,
      apiKey: this.config.apiKey || 'fallback-key',
      timeout: 30000,
      maxRetries: 3,
    });

    if (this.config.verbose) {
      console.log(`🔧 Session manager initialized with base URL: ${this.baseUrl}`);
      console.log(`⏰ Session timeout: ${this.config.sessionTimeout}s`);
    }
  }

  /**
   * Generate a unique session ID
   */
  generateSessionId(prefix: string = 'session'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Send a message in a session context
   */
  async sendMessage(
    sessionId: string,
    content: string,
    systemMessage?: string,
    options: Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams> = {}
  ): Promise<{ response: string; usage?: OpenAI.Completions.CompletionUsage }> {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    
    if (systemMessage) {
      messages.push({ role: 'system', content: systemMessage });
    }
    
    messages.push({ role: 'user', content });

    try {
      const completion = await this.client.chat.completions.create({
        model: 'claude-3-5-sonnet-20241022',
        messages,
        max_tokens: 500,
        temperature: 0.7,
        ...options,
        // @ts-ignore - session_id is supported by our wrapper but not in OpenAI types
        session_id: sessionId,
      });

      const response = completion.choices[0]?.message?.content || '';
      const usage = completion.usage;

      if (this.config.verbose) {
        console.log(`📤 Sent message in session ${sessionId}`);
        console.log(`📥 Received response: ${response.substring(0, 100)}...`);
        if (usage) {
          console.log(`📊 Tokens used: ${usage.total_tokens} (${usage.prompt_tokens} prompt + ${usage.completion_tokens} completion)`);
        }
      }

      return { response, usage };
    } catch (error) {
      if (this.config.verbose) {
        console.error(`❌ Error sending message in session ${sessionId}:`, error);
      }
      throw error;
    }
  }

  /**
   * Get session information
   */
  async getSessionInfo(sessionId: string): Promise<SessionInfo | null> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/sessions/${sessionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const sessionInfo = await response.json() as SessionInfo;
      
      if (this.config.verbose) {
        console.log(`📋 Session ${sessionId} info retrieved:`, sessionInfo);
      }
      
      return sessionInfo;
    } catch (error) {
      if (this.config.verbose) {
        console.error(`❌ Error getting session info for ${sessionId}:`, error);
      }
      throw error;
    }
  }

  /**
   * List all active sessions
   */
  async listSessions(page: number = 1, perPage: number = 50): Promise<SessionListResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/sessions?page=${page}&per_page=${perPage}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const sessionList = await response.json() as SessionListResponse;
      
      if (this.config.verbose) {
        console.log(`📋 Retrieved ${sessionList.total} sessions (page ${page})`);
      }
      
      return sessionList;
    } catch (error) {
      if (this.config.verbose) {
        console.error(`❌ Error listing sessions:`, error);
      }
      throw error;
    }
  }

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<SessionStatsResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/sessions/stats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const stats = await response.json() as SessionStatsResponse;
      
      if (this.config.verbose) {
        console.log(`📊 Session statistics retrieved:`, stats);
      }
      
      return stats;
    } catch (error) {
      if (this.config.verbose) {
        console.error(`❌ Error getting session stats:`, error);
      }
      throw error;
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (this.config.verbose) {
        console.log(`🗑️  Session ${sessionId} deleted successfully`);
      }
      
      return result.success || true;
    } catch (error) {
      if (this.config.verbose) {
        console.error(`❌ Error deleting session ${sessionId}:`, error);
      }
      throw error;
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<{ deleted: number; remaining: number }> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/sessions/cleanup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (this.config.verbose) {
        console.log(`🧹 Cleanup completed: ${result.deleted} deleted, ${result.remaining} remaining`);
      }
      
      return result;
    } catch (error) {
      if (this.config.verbose) {
        console.error(`❌ Error cleaning up sessions:`, error);
      }
      throw error;
    }
  }
}

/**
 * Demo 1: Basic session continuity
 */
async function basicSessionContinuityDemo(sessionManager: SessionManager): Promise<void> {
  console.log('\n=== Basic Session Continuity Demo ===');
  
  const sessionId = sessionManager.generateSessionId('basic-demo');
  console.log(`🔗 Using session ID: ${sessionId}`);

  try {
    // First interaction - establish context
    console.log('\n📝 Step 1: Establishing context...');
    const response1 = await sessionManager.sendMessage(
      sessionId,
      'Hello! I am working on a TypeScript project that integrates with the Claude API. My name is Alex and I am a senior software developer.',
      'You are a helpful TypeScript and API integration expert.'
    );
    
    console.log('🤖 Claude:', response1.response);
    
    // Second interaction - test memory
    console.log('\n📝 Step 2: Testing memory...');
    const response2 = await sessionManager.sendMessage(
      sessionId,
      'What\'s my name and what am I working on?'
    );
    
    console.log('🤖 Claude:', response2.response);
    
    // Third interaction - build on context
    console.log('\n📝 Step 3: Building on context...');
    const response3 = await sessionManager.sendMessage(
      sessionId,
      'Can you help me implement proper error handling for API calls in TypeScript?'
    );
    
    console.log('🤖 Claude:', response3.response);
    
    // Get session info
    const sessionInfo = await sessionManager.getSessionInfo(sessionId);
    if (sessionInfo) {
      console.log(`\n📊 Session Info: ${sessionInfo.message_count} messages, created at ${sessionInfo.created_at}`);
    }
    
    console.log('\n✅ Basic session continuity demo completed!');
    
  } catch (error) {
    console.error('❌ Basic session continuity demo failed:', error);
    throw error;
  }
}

/**
 * Demo 2: Multi-session conversation management
 */
async function multiSessionDemo(sessionManager: SessionManager): Promise<void> {
  console.log('\n=== Multi-Session Management Demo ===');
  
  const sessions = [
    {
      id: sessionManager.generateSessionId('frontend'),
      topic: 'Frontend Development',
      systemMessage: 'You are a React and TypeScript expert focused on frontend development.'
    },
    {
      id: sessionManager.generateSessionId('backend'),
      topic: 'Backend Development',
      systemMessage: 'You are a Node.js and API development expert focused on backend systems.'
    },
    {
      id: sessionManager.generateSessionId('devops'),
      topic: 'DevOps and Deployment',
      systemMessage: 'You are a DevOps expert focused on deployment and infrastructure.'
    }
  ];

  console.log(`🔗 Created ${sessions.length} sessions for different topics`);

  try {
    // Send messages to different sessions
    for (const session of sessions) {
      console.log(`\n📝 ${session.topic} Session (${session.id}):`);
      
      const response = await sessionManager.sendMessage(
        session.id,
        `I need help with ${session.topic.toLowerCase()} for a TypeScript project. What are the key best practices?`,
        session.systemMessage,
        { max_tokens: 300 }
      );
      
      console.log(`🤖 Expert Response: ${response.response.substring(0, 200)}...`);
    }
    
    // List all sessions
    console.log('\n📋 Session Overview:');
    const sessionList = await sessionManager.listSessions();
    
    for (const sessionInfo of sessionList.sessions) {
      if (sessions.find(s => s.id === sessionInfo.session_id)) {
        console.log(`  • ${sessionInfo.session_id}: ${sessionInfo.message_count} messages`);
      }
    }
    
    console.log('\n✅ Multi-session demo completed!');
    
  } catch (error) {
    console.error('❌ Multi-session demo failed:', error);
    throw error;
  }
}

/**
 * Demo 3: Session persistence and recovery
 */
async function sessionPersistenceDemo(sessionManager: SessionManager): Promise<void> {
  console.log('\n=== Session Persistence and Recovery Demo ===');
  
  const sessionId = sessionManager.generateSessionId('persistence');
  console.log(`🔗 Using session ID: ${sessionId}`);

  try {
    // Create a conversation
    console.log('\n📝 Creating conversation...');
    await sessionManager.sendMessage(
      sessionId,
      'I am building a chat application with TypeScript. Can you help me design the message structure?',
      'You are a software architect specializing in chat applications.'
    );
    
    await sessionManager.sendMessage(
      sessionId,
      'Should I use WebSockets or Server-Sent Events for real-time updates?'
    );
    
    // Simulate session recovery after some time
    console.log('\n⏳ Simulating session recovery...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Continue the conversation
    console.log('\n📝 Continuing conversation after recovery...');
    const response = await sessionManager.sendMessage(
      sessionId,
      'What was the last question I asked you?'
    );
    
    console.log('🤖 Claude:', response.response);
    
    // Get detailed session info
    const sessionInfo = await sessionManager.getSessionInfo(sessionId);
    if (sessionInfo) {
      console.log(`\n📊 Session persisted: ${sessionInfo.message_count} messages, active since ${sessionInfo.created_at}`);
      console.log(`⏰ Expires at: ${sessionInfo.expires_at}`);
    }
    
    console.log('\n✅ Session persistence demo completed!');
    
  } catch (error) {
    console.error('❌ Session persistence demo failed:', error);
    throw error;
  }
}

/**
 * Demo 4: Session statistics and monitoring
 */
async function sessionStatisticsDemo(sessionManager: SessionManager): Promise<void> {
  console.log('\n=== Session Statistics and Monitoring Demo ===');
  
  try {
    // Get current statistics
    const stats = await sessionManager.getSessionStats();
    
    console.log('\n📊 Current Session Statistics:');
    console.log(`  • Active sessions: ${stats.session_stats.active_sessions}`);
    console.log(`  • Total messages: ${stats.session_stats.total_messages}`);
    console.log(`  • Total tokens: ${stats.session_stats.total_tokens}`);
    console.log(`  • Cleanup interval: ${stats.cleanup_interval_minutes} minutes`);
    console.log(`  • Server uptime: ${stats.server_info.uptime_minutes} minutes`);
    
    // List all sessions with details
    console.log('\n📋 Active Sessions:');
    const sessionList = await sessionManager.listSessions();
    
    if (sessionList.sessions.length > 0) {
      for (const session of sessionList.sessions) {
        console.log(`  • ${session.session_id}:`);
        console.log(`    - Messages: ${session.message_count}`);
        console.log(`    - Created: ${session.created_at}`);
        console.log(`    - Last activity: ${session.last_activity}`);
        console.log(`    - Status: ${session.status}`);
      }
    } else {
      console.log('  No active sessions found');
    }
    
    console.log('\n✅ Session statistics demo completed!');
    
  } catch (error) {
    console.error('❌ Session statistics demo failed:', error);
    throw error;
  }
}

/**
 * Demo 5: Session cleanup and lifecycle management
 */
async function sessionCleanupDemo(sessionManager: SessionManager): Promise<void> {
  console.log('\n=== Session Cleanup and Lifecycle Demo ===');
  
  try {
    // Create some test sessions
    const testSessions = [];
    for (let i = 0; i < 3; i++) {
      const sessionId = sessionManager.generateSessionId(`cleanup-test-${i}`);
      testSessions.push(sessionId);
      
      await sessionManager.sendMessage(
        sessionId,
        `Test message ${i + 1}`,
        'You are a test assistant.'
      );
    }
    
    console.log(`\n🧪 Created ${testSessions.length} test sessions`);
    
    // Show sessions before cleanup
    const beforeCleanup = await sessionManager.listSessions();
    console.log(`📊 Sessions before cleanup: ${beforeCleanup.total}`);
    
    // Manually delete first test session
    console.log(`\n🗑️  Manually deleting session: ${testSessions[0]}`);
    await sessionManager.deleteSession(testSessions[0]);
    
    // Trigger cleanup of expired sessions
    console.log('\n🧹 Triggering cleanup of expired sessions...');
    const cleanupResult = await sessionManager.cleanupExpiredSessions();
    console.log(`   Deleted: ${cleanupResult.deleted}, Remaining: ${cleanupResult.remaining}`);
    
    // Show sessions after cleanup
    const afterCleanup = await sessionManager.listSessions();
    console.log(`📊 Sessions after cleanup: ${afterCleanup.total}`);
    
    // Clean up remaining test sessions
    console.log('\n🧹 Cleaning up remaining test sessions...');
    for (let i = 1; i < testSessions.length; i++) {
      try {
        await sessionManager.deleteSession(testSessions[i]);
        console.log(`  ✅ Deleted ${testSessions[i]}`);
      } catch (error) {
        console.log(`  ⚠️  Could not delete ${testSessions[i]}: ${error}`);
      }
    }
    
    console.log('\n✅ Session cleanup demo completed!');
    
  } catch (error) {
    console.error('❌ Session cleanup demo failed:', error);
    throw error;
  }
}

/**
 * Demo 6: Error handling and edge cases
 */
async function errorHandlingDemo(sessionManager: SessionManager): Promise<void> {
  console.log('\n=== Error Handling and Edge Cases Demo ===');
  
  try {
    // Test with non-existent session
    console.log('\n🧪 Testing non-existent session info...');
    const nonExistentSession = await sessionManager.getSessionInfo('non-existent-session');
    console.log(`   Result: ${nonExistentSession ? 'Found' : 'Not found (expected)'}`);
    
    // Test with invalid session ID
    console.log('\n🧪 Testing invalid session deletion...');
    try {
      await sessionManager.deleteSession('invalid-session-id');
      console.log('   ⚠️  Unexpected success');
    } catch (error) {
      console.log(`   ✅ Expected error caught: ${error instanceof Error ? error.message : error}`);
    }
    
    // Test message with very long content
    console.log('\n🧪 Testing message with long content...');
    const longSessionId = sessionManager.generateSessionId('long-content');
    const longContent = 'This is a very long message. '.repeat(100);
    
    try {
      const response = await sessionManager.sendMessage(
        longSessionId,
        longContent,
        undefined,
        { max_tokens: 100 }
      );
      console.log(`   ✅ Long message handled successfully: ${response.response.substring(0, 100)}...`);
    } catch (error) {
      console.log(`   ⚠️  Long message failed: ${error}`);
    }
    
    // Test concurrent sessions
    console.log('\n🧪 Testing concurrent session operations...');
    const concurrentSessions = Array.from({ length: 5 }, (_, i) => 
      sessionManager.generateSessionId(`concurrent-${i}`)
    );
    
    const concurrentPromises = concurrentSessions.map(sessionId =>
      sessionManager.sendMessage(sessionId, `Hello from concurrent session ${sessionId}`)
    );
    
    try {
      await Promise.all(concurrentPromises);
      console.log('   ✅ Concurrent operations completed successfully');
    } catch (error) {
      console.log(`   ⚠️  Concurrent operations failed: ${error}`);
    }
    
    // Clean up concurrent sessions
    for (const sessionId of concurrentSessions) {
      try {
        await sessionManager.deleteSession(sessionId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    console.log('\n✅ Error handling demo completed!');
    
  } catch (error) {
    console.error('❌ Error handling demo failed:', error);
    throw error;
  }
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  console.log('🚀 Claude Wrapper TypeScript Session Continuity Examples');
  console.log('=======================================================');

  // Parse command line arguments
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose') || args.includes('-v');
  const showMetrics = args.includes('--metrics') || args.includes('-m');
  const customUrl = args.find(arg => arg.startsWith('--url='))?.split('=')[1];
  const customApiKey = args.find(arg => arg.startsWith('--api-key='))?.split('=')[1];

  const config: SessionConfig = {
    verbose,
    showMetrics,
    baseUrl: customUrl,
    apiKey: customApiKey,
  };

  const sessionManager = new SessionManager(config);

  try {
    // Test server connection
    console.log(`🔍 Testing connection to: ${config.baseUrl || DEFAULT_CONFIG.baseUrl}`);
    
    // Run all demos
    await basicSessionContinuityDemo(sessionManager);
    await multiSessionDemo(sessionManager);
    await sessionPersistenceDemo(sessionManager);
    await sessionStatisticsDemo(sessionManager);
    await sessionCleanupDemo(sessionManager);
    await errorHandlingDemo(sessionManager);

    console.log('\n🎉 All TypeScript session continuity examples completed successfully!');
    console.log('\n💡 Session Management Benefits:');
    console.log('   • Persistent conversation context');
    console.log('   • Multi-session organization');
    console.log('   • Automatic session lifecycle management');
    console.log('   • Comprehensive session analytics');
    console.log('   • Robust error handling and recovery');
    console.log('   • TypeScript type safety and interfaces');

  } catch (error) {
    console.error('\n❌ Session continuity examples failed:', error);
    console.log('\n🔧 Troubleshooting:');
    console.log('   • Verify claude-wrapper server is running');
    console.log('   • Check network connectivity');
    console.log('   • Ensure proper authentication setup');
    console.log('   • Review server logs for errors');
    console.log('   • Verify session management endpoints are available');
    process.exit(1);
  }
}

/**
 * Show usage information
 */
function showUsage(): void {
  console.log('Usage: npx tsx session-continuity.ts [options]');
  console.log('');
  console.log('Options:');
  console.log('  -h, --help            Show this help message');
  console.log('  -v, --verbose         Enable verbose logging');
  console.log('  -m, --metrics         Show detailed session metrics');
  console.log('  --url=URL             Custom server URL (default: http://localhost:8000)');
  console.log('  --api-key=KEY         Custom API key for authentication');
  console.log('');
  console.log('Environment variables:');
  console.log('  CLAUDE_WRAPPER_URL    Base URL for the server');
  console.log('  API_KEY               API key for authentication (if required)');
  console.log('  VERBOSE               Enable verbose output (true/false)');
  console.log('  SHOW_METRICS          Show session metrics (true/false)');
  console.log('  SESSION_TIMEOUT       Session timeout in seconds (default: 3600)');
  console.log('');
  console.log('Examples:');
  console.log('  npx tsx session-continuity.ts                           # Basic session examples');
  console.log('  npx tsx session-continuity.ts --verbose --metrics       # With detailed output');
  console.log('  npx tsx session-continuity.ts --url=http://localhost:3000  # Custom URL');
  console.log('  API_KEY=abc123 npx tsx session-continuity.ts            # With authentication');
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

export { SessionManager, type SessionConfig, type SessionInfo, type SessionStats };