/**
 * Enhanced Response Generator for Mock Mode
 * Provides sophisticated response generation using template-based approach
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../utils/logger';

interface MockResponseTemplate {
  id: string;
  content: string | null;
  model: string;
  finishReason: 'stop' | 'length' | 'tool_calls';
  toolCalls?: any[];
  responseTime?: number;
  tokenUsage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  streamingChunks?: string[];
  triggers?: string[];
  shouldError?: boolean;
  errorType?: string;
  errorMessage?: string;
  httpStatus?: number;
  errorCode?: string;
}

interface ResponseCategory {
  category: string;
  description: string;
  templates: MockResponseTemplate[];
}

interface OpenAIRequest {
  messages: Array<{
    role: string;
    content: string;
    tool_calls?: any[];
  }>;
  model?: string;
  tools?: any[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

interface PromptAnalysis {
  category: string;
  complexity: 'simple' | 'medium' | 'complex';
  isToolRequest: boolean;
  isStreamingSuitable: boolean;
  keywords: string[];
  estimatedResponseLength: number;
  confidence: number;
}

export class EnhancedResponseGenerator {
  private static instance: EnhancedResponseGenerator;
  private templates: Map<string, ResponseCategory> = new Map();
  private responseHistory: Array<{
    prompt: string;
    response: string;
    timestamp: Date;
    category: string;
  }> = [];

  private constructor() {
    this.loadTemplates();
  }

  static getInstance(): EnhancedResponseGenerator {
    if (!this.instance) {
      this.instance = new EnhancedResponseGenerator();
    }
    return this.instance;
  }

  /**
   * Generate a contextually appropriate response for the given request
   */
  async generateResponse(request: OpenAIRequest, sessionId?: string): Promise<MockResponseTemplate> {
    const analysis = this.analyzeRequest(request);
    logger.debug(`🎭 Enhanced response generator: Category=${analysis.category}, Complexity=${analysis.complexity}`);

    // Check for error simulation (disabled in test environment)
    if (process.env['NODE_ENV'] !== 'test' && Math.random() < 0.05) { // 5% error rate for testing
      return this.generateErrorResponse(analysis);
    }

    // Find appropriate template
    const template = this.selectTemplate(analysis, sessionId);
    
    // Enhance template with contextual information
    const enhancedTemplate = this.enhanceTemplate(template, request, analysis);

    // Add to history
    this.addToHistory(request, enhancedTemplate, analysis.category);

    return enhancedTemplate;
  }

  /**
   * Generate a streaming response using enhanced templates
   */
  async generateStreamingResponse(request: OpenAIRequest, sessionId?: string): Promise<MockResponseTemplate> {
    const analysis = this.analyzeRequest(request);
    analysis.isStreamingSuitable = true;

    const template = this.selectTemplate(analysis, sessionId);
    const enhancedTemplate = this.enhanceTemplate(template, request, analysis);

    // Create streaming chunks if not already present
    if (!enhancedTemplate.streamingChunks && enhancedTemplate.content) {
      enhancedTemplate.streamingChunks = this.createStreamingChunks(enhancedTemplate.content);
    }

    return enhancedTemplate;
  }

  /**
   * Analyze the request to determine appropriate response category and characteristics
   */
  private analyzeRequest(request: OpenAIRequest): PromptAnalysis {
    const lastMessage = request.messages[request.messages.length - 1];
    const content = lastMessage?.content || 'default message';
    const lowerContent = content.toLowerCase();

    // Extract keywords
    const keywords = this.extractKeywords(content);

    // Determine category
    let category = 'simple-qa';
    let confidence = 0.5;

    // Check for tool usage
    if (request.tools && request.tools.length > 0) {
      category = 'tool-usage';
      confidence = 0.9;
    }
    // Check for programming content
    else if (this.containsProgrammingKeywords(lowerContent)) {
      category = 'code-generation';
      confidence = 0.8;
    }
    // Check for streaming-suitable content
    else if (this.isSuitableForStreaming(content)) {
      category = 'streaming';
      confidence = 0.7;
    }
    // Check for error triggers
    else if (this.containsErrorTriggers(lowerContent)) {
      category = 'errors';
      confidence = 0.6;
    }

    // Determine complexity
    const complexity = this.determineComplexity(content);

    return {
      category,
      complexity,
      isToolRequest: !!(request.tools && request.tools.length > 0),
      isStreamingSuitable: this.isSuitableForStreaming(content),
      keywords,
      estimatedResponseLength: this.estimateResponseLength(content),
      confidence
    };
  }

  /**
   * Select the most appropriate template based on analysis
   */
  private selectTemplate(analysis: PromptAnalysis, _sessionId?: string): MockResponseTemplate {
    const categoryTemplates = this.templates.get(analysis.category);
    
    if (!categoryTemplates || categoryTemplates.templates.length === 0) {
      // Fallback to simple-qa
      const fallbackCategory = this.templates.get('simple-qa');
      if (fallbackCategory && fallbackCategory.templates.length > 0) {
        return this.selectFromTemplates(fallbackCategory.templates, analysis.keywords);
      }
      return this.createFallbackTemplate();
    }

    return this.selectFromTemplates(categoryTemplates.templates, analysis.keywords);
  }

  /**
   * Select best template from a set based on keyword matching
   */
  private selectFromTemplates(templates: MockResponseTemplate[], keywords: string[]): MockResponseTemplate {
    if (templates.length === 0) {
      return this.createFallbackTemplate();
    }

    // Score templates based on keyword matching
    const scoredTemplates = templates.map(template => {
      let score = 0;
      if (template.triggers) {
        for (const trigger of template.triggers) {
          if (keywords.some(keyword => keyword.includes(trigger) || trigger.includes(keyword))) {
            score += 1;
          }
        }
      }
      return { template, score };
    });

    // Sort by score and select the best match
    scoredTemplates.sort((a, b) => b.score - a.score);
    
    // If no matches found, select randomly
    if (scoredTemplates.length === 0 || scoredTemplates[0]?.score === 0) {
      return templates[Math.floor(Math.random() * templates.length)] || this.createFallbackTemplate();
    }

    return scoredTemplates[0]?.template || this.createFallbackTemplate();
  }

  /**
   * Enhance template with contextual information
   */
  private enhanceTemplate(template: MockResponseTemplate, request: OpenAIRequest, analysis: PromptAnalysis): MockResponseTemplate {
    const enhanced = { ...template };

    // Generate unique ID
    enhanced.id = `chatcmpl-enhanced-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Ensure content is never null/undefined
    if (!enhanced.content) {
      enhanced.content = this.createDefaultContent(request, analysis);
    }

    // Update token usage based on actual content
    enhanced.tokenUsage = this.calculateTokenUsage(request, enhanced.content);

    // Add session context if available
    if (request.messages.length > 1) {
      enhanced.content = this.addConversationContext(enhanced.content, request.messages);
    }

    // Adjust response time based on complexity
    if (enhanced.responseTime) {
      enhanced.responseTime = this.adjustResponseTime(enhanced.responseTime, analysis.complexity);
    }

    return enhanced;
  }

  /**
   * Load templates from JSON files
   */
  private loadTemplates(): void {
    // Try multiple possible paths for template directory
    const possiblePaths = [
      path.join(__dirname, '../../../tests/mock-responses'),
      path.join(process.cwd(), 'tests/mock-responses'),
      path.join(process.cwd(), 'app/tests/mock-responses')
    ];
    
    let templatesDir: string | null = null;
    
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        templatesDir = possiblePath;
        break;
      }
    }
    
    if (!templatesDir) {
      logger.warn('Template directory not found, using fallback templates');
      this.loadFallbackTemplates();
      return;
    }
    
    try {
      const categories = ['basic', 'programming', 'tools', 'streaming', 'errors'];
      
      for (const category of categories) {
        const categoryDir = path.join(templatesDir, category);
        if (fs.existsSync(categoryDir)) {
          const files = fs.readdirSync(categoryDir).filter(file => file.endsWith('.json'));
          
          for (const file of files) {
            const filePath = path.join(categoryDir, file);
            try {
              const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as ResponseCategory;
              this.templates.set(data.category, data);
              logger.debug(`🎭 Loaded ${data.templates.length} templates for category: ${data.category}`);
            } catch (error) {
              logger.warn(`Failed to load template file: ${filePath}`, error);
            }
          }
        }
      }
      
      // If no templates were loaded, use fallbacks
      if (this.templates.size === 0) {
        this.loadFallbackTemplates();
      }
    } catch (error) {
      logger.warn('Failed to load template directory, using fallback templates', error);
      this.loadFallbackTemplates();
    }
  }

  /**
   * Load minimal fallback templates if file loading fails
   */
  private loadFallbackTemplates(): void {
    // Simple Q&A templates
    const simpleQACategory: ResponseCategory = {
      category: 'simple-qa',
      description: 'Fallback simple Q&A templates',
      templates: [
        {
          id: 'fallback-qa-1',
          content: 'I\'m operating in mock mode. This is a fallback response generated when template files are not available.',
          model: 'sonnet',
          finishReason: 'stop',
          responseTime: 200,
          tokenUsage: {
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30
          }
        }
      ]
    };

    // Programming templates
    const programmingCategory: ResponseCategory = {
      category: 'code-generation',
      description: 'Fallback programming templates',
      templates: [
        {
          id: 'fallback-code-1',
          content: 'Here\'s a fallback python function example:\n\n```python\ndef fallback_function():\n    """Fallback code example"""\n    return "This is a mock code response"\n```\n\nThis demonstrates basic code generation in mock mode.',
          model: 'sonnet',
          finishReason: 'stop',
          responseTime: 300,
          tokenUsage: {
            prompt_tokens: 15,
            completion_tokens: 35,
            total_tokens: 50
          }
        }
      ]
    };

    // Tool calling templates
    const toolCategory: ResponseCategory = {
      category: 'tool-usage',
      description: 'Fallback tool calling templates',
      templates: [
        {
          id: 'fallback-tool-1',
          content: null,
          model: 'sonnet',
          finishReason: 'tool_calls',
          toolCalls: [
            {
              id: 'call_fallback_001',
              type: 'function',
              function: {
                name: 'fallback_tool',
                arguments: '{"action": "fallback", "message": "Mock tool call"}'
              }
            }
          ],
          responseTime: 250,
          tokenUsage: {
            prompt_tokens: 20,
            completion_tokens: 15,
            total_tokens: 35
          }
        }
      ]
    };

    this.templates.set('simple-qa', simpleQACategory);
    this.templates.set('code-generation', programmingCategory);
    this.templates.set('tool-usage', toolCategory);
  }

  /**
   * Create a basic fallback template
   */
  private createFallbackTemplate(): MockResponseTemplate {
    return {
      id: `fallback-${Date.now()}`,
      content: 'Mock response generated by enhanced response generator (fallback mode)',
      model: 'sonnet',
      finishReason: 'stop',
      responseTime: 200,
      tokenUsage: {
        prompt_tokens: 10,
        completion_tokens: 15,
        total_tokens: 25
      }
    };
  }

  /**
   * Generate error response for testing
   */
  private generateErrorResponse(analysis: PromptAnalysis): MockResponseTemplate {
    const errorCategory = this.templates.get('errors');
    if (errorCategory && errorCategory.templates.length > 0) {
      return this.selectFromTemplates(errorCategory.templates, analysis.keywords);
    }

    return {
      id: `error-${Date.now()}`,
      content: null,
      model: 'sonnet',
      finishReason: 'stop',
      shouldError: true,
      errorType: 'system',
      errorMessage: 'Mock system error for testing',
      httpStatus: 500,
      errorCode: 'MOCK_ERROR'
    };
  }

  /**
   * Helper methods for analysis
   */
  private containsProgrammingKeywords(content: string): boolean {
    const programmingKeywords = [
      'function', 'class', 'method', 'variable', 'array', 'object',
      'javascript', 'python', 'typescript', 'react', 'api', 'database',
      'algorithm', 'code', 'programming', 'development', 'debug',
      'implement', 'create', 'build', 'develop'
    ];
    
    return programmingKeywords.some(keyword => content.includes(keyword));
  }

  private isSuitableForStreaming(content: string): boolean {
    const streamingIndicators = [
      'explain', 'describe', 'tutorial', 'guide', 'comprehensive',
      'detailed', 'step by step', 'complete', 'thorough', 'analysis',
      'essay', 'article', 'documentation', 'report'
    ];
    
    return streamingIndicators.some(indicator => content.toLowerCase().includes(indicator)) ||
           content.length > 200;
  }

  private containsErrorTriggers(content: string): boolean {
    const errorTriggers = [
      'error', 'fail', 'timeout', 'invalid', 'missing', 'broken',
      'unauthorized', 'forbidden', 'not found', 'server error'
    ];
    
    return errorTriggers.some(trigger => content.includes(trigger));
  }

  private extractKeywords(content: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
      'could', 'can', 'may', 'might', 'must', 'this', 'that', 'these', 'those'
    ]);

    return content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 10);
  }

  private determineComplexity(content: string): 'simple' | 'medium' | 'complex' {
    if (content.length < 100) return 'simple';
    if (content.length < 500) return 'medium';
    return 'complex';
  }

  private estimateResponseLength(content: string): number {
    const baseLength = content.length * 0.8;
    const variation = baseLength * 0.3;
    return Math.max(50, Math.floor(baseLength + (Math.random() - 0.5) * variation));
  }

  private calculateTokenUsage(request: OpenAIRequest, response: string): {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  } {
    const promptText = request.messages.map(m => m.content).join(' ');
    const promptTokens = Math.ceil(promptText.length / 4);
    const completionTokens = Math.ceil(response.length / 4);
    
    return {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens
    };
  }

  private adjustResponseTime(baseTime: number, complexity: 'simple' | 'medium' | 'complex'): number {
    const multipliers = { simple: 0.8, medium: 1.0, complex: 1.5 };
    return Math.floor(baseTime * multipliers[complexity]);
  }

  private createDefaultContent(request: OpenAIRequest, analysis: PromptAnalysis): string {
    const prompt = request.messages[request.messages.length - 1]?.content || 'default prompt';
    
    if (analysis.category === 'code-generation') {
      return `Here's a sample function demonstrating the mock code generation capability:

\`\`\`typescript
function processData(input: string): string {
  return \`Processed: \${input}\`;
}
\`\`\`

This mock code demonstrates proper syntax highlighting and formatting within the wrapper system.`;
    }
    
    if (analysis.category === 'simple-qa') {
      return `Thank you for your question! This mock response shows how the wrapper maintains conversation flow and provides contextually appropriate replies, even in simulation mode.`;
    }
    
    return `Mock response for: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`;
  }

  private addConversationContext(content: string, messages: Array<{role: string; content: string}>): string {
    const conversationLength = messages.length;
    if (conversationLength > 1) {
      const contextNote = `\n\n*[This is response #${conversationLength} in our conversation]*`;
      return content + contextNote;
    }
    return content;
  }

  private createStreamingChunks(content: string): string[] {
    const chunks: string[] = [];
    const sentences = content.split(/[.!?]+/).filter(s => s.trim());
    
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed) {
        chunks.push(trimmed + '.');
      }
    }
    
    return chunks;
  }

  private addToHistory(request: OpenAIRequest, template: MockResponseTemplate, category: string): void {
    const prompt = request.messages[request.messages.length - 1]?.content || '';
    this.responseHistory.push({
      prompt,
      response: template.content || '[Tool call or error response]',
      timestamp: new Date(),
      category
    });

    // Keep only last 100 entries
    if (this.responseHistory.length > 100) {
      this.responseHistory = this.responseHistory.slice(-100);
    }
  }

  /**
   * Get response generation statistics
   */
  getStats(): {
    totalResponses: number;
    categoryCounts: Record<string, number>;
    recentResponses: Array<{
      prompt: string;
      response: string;
      timestamp: Date;
      category: string;
    }>;
  } {
    const categoryCounts: Record<string, number> = {};
    
    for (const entry of this.responseHistory) {
      categoryCounts[entry.category] = (categoryCounts[entry.category] || 0) + 1;
    }

    return {
      totalResponses: this.responseHistory.length,
      categoryCounts,
      recentResponses: this.responseHistory.slice(-10)
    };
  }

  /**
   * Clear response history
   */
  clearHistory(): void {
    this.responseHistory = [];
  }
}