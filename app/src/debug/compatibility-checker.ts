/**
 * OpenAI Compatibility Checker Service
 * Single Responsibility: OpenAI compatibility verification orchestration
 */

import { OpenAITool } from '../tools/types';
import { createToolRegistry } from '../tools/registry';
import { getLogger } from '../utils/logger';
import { DEBUG_PERFORMANCE_LIMITS, DEBUG_MESSAGES } from '../tools/constants';

// Import type definitions
import {
  ChatCompletionRequest,
  CompatibilityResult,
  ToolCompatibilityResult,
  ParameterSupportAnalysis,
  CompatibilityReport,
  EndpointComplianceResult,
  ICompatibilityChecker,
  PartialSupportInfo,
  RequiredChange,
  MigrationGuidance,
  RiskAssessment
} from './types';

// Import checker modules
import { checkModelCompatibility, determineCompatibilityLevel } from './model-checker';
import { checkMessageCompatibility } from './message-checker';
import { checkToolsCompatibility, validateToolStructure, analyzeToolParameters } from './tool-checker';

const logger = getLogger('CompatibilityChecker');

/**
 * Main compatibility checker class
 */
export class CompatibilityChecker implements ICompatibilityChecker {
  private toolRegistry = createToolRegistry();
  private readonly openaiSpecVersion = '2024-02-01';
  private readonly supportedFeatures = new Set([
    'chat_completions',
    'function_calling',
    'streaming',
    'tool_choice',
    'multiple_tools',
    'message_roles',
    'temperature_control',
    'max_tokens',
    'stop_sequences'
  ]);

  /**
   * Check overall OpenAI compatibility of a request
   */
  async checkOpenAICompatibility(request: ChatCompletionRequest): Promise<CompatibilityResult> {
    const startTime = Date.now();
    
    try {
      // Check individual components
      const modelCheck = checkModelCompatibility(request.model);
      const messageCheck = checkMessageCompatibility(request.messages);
      const toolsCheck = await checkToolsCompatibility(request.tools);
      const parameterCheck = this.checkParameterCompatibility(request);

      // Calculate overall score
      const weights = { model: 0.25, messages: 0.35, tools: 0.25, parameters: 0.15 };
      const overallScore = Math.round(
        modelCheck.score * weights.model +
        messageCheck.score * weights.messages +
        toolsCheck.score * weights.tools +
        parameterCheck.score * weights.parameters
      );

      const compatibilityLevel = determineCompatibilityLevel(overallScore);
      const overallCompatible = overallScore >= 80;

      const result: CompatibilityResult = {
        overallCompatible,
        openaiComplianceScore: overallScore,
        supportedFeatures: this.identifySupportedFeatures(request),
        unsupportedFeatures: this.identifyUnsupportedFeatures(request),
        partiallySupported: this.identifyPartiallySupported(request),
        recommendations: this.generateCompatibilityRecommendations(
          [modelCheck, messageCheck, toolsCheck, parameterCheck],
          overallScore
        ),
        compatibilityLevel,
        checkTimestamp: Date.now()
      };

      const duration = Date.now() - startTime;
      logger.info('OpenAI compatibility check completed', {
        score: overallScore,
        level: compatibilityLevel,
        duration
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Compatibility check failed', { error: errorMessage });
      
      throw new Error(`Compatibility check failed: ${errorMessage}`);
    }
  }

  /**
   * Validate a specific tool's OpenAI compatibility
   */
  async validateToolSpecification(tool: OpenAITool): Promise<ToolCompatibilityResult> {
    const structureIssues = validateToolStructure(tool);
    const parameterAnalysis = analyzeToolParameters(tool.function?.parameters);
    
    // Calculate compliance score
    let complianceScore = 100;
    structureIssues.forEach(issue => {
      if (issue.severity === 'error') complianceScore -= 20;
      else if (issue.severity === 'warning') complianceScore -= 10;
      else complianceScore -= 5;
    });
    
    complianceScore = Math.max(0, complianceScore);
    const compatible = complianceScore >= 80 && structureIssues.filter(i => i.severity === 'error').length === 0;

    return {
      toolName: tool.function?.name || 'unnamed',
      compatible,
      complianceScore,
      issues: structureIssues,
      supportedParameters: parameterAnalysis.analysis.filter(p => p.supported).map(p => p.parameterName),
      unsupportedParameters: parameterAnalysis.analysis.filter(p => !p.supported).map(p => p.parameterName),
      parameterAnalysis: parameterAnalysis.analysis,
      migrationRequirements: structureIssues.map(i => i.suggestion || i.issue),
      recommendedChanges: structureIssues.map(issue => ({
        type: 'parameter' as const,
        description: issue.issue,
        priority: issue.severity === 'error' ? 'high' as const : 'medium' as const,
        effort: 'minimal' as const
      }))
    };
  }

  /**
   * Analyze parameter support
   */
  async analyzeParameterSupport(parameters: Record<string, any>): Promise<ParameterSupportAnalysis[]> {
    const analysis = analyzeToolParameters(parameters);
    return analysis.analysis;
  }

  /**
   * Generate comprehensive compatibility report
   */
  async generateCompatibilityReport(request: ChatCompletionRequest): Promise<CompatibilityReport> {
    const summary = await this.checkOpenAICompatibility(request);
    
    const detailedAnalysis: ToolCompatibilityResult[] = [];
    if (request.tools) {
      for (const tool of request.tools) {
        const toolResult = await this.validateToolSpecification(tool);
        detailedAnalysis.push(toolResult);
      }
    }

    const parameterSupport = await this.analyzeParameterSupport(request);
    const endpointCompliance = await this.verifyEndpointCompliance('/chat/completions');

    return {
      summary,
      detailedAnalysis,
      parameterSupport,
      endpointCompliance,
      migrationGuidance: this.generateMigrationGuidance(summary),
      riskAssessment: this.assessRisks(summary),
      generatedAt: Date.now()
    };
  }

  /**
   * Verify endpoint compliance
   */
  async verifyEndpointCompliance(endpoint: string): Promise<EndpointComplianceResult> {
    const supportedEndpoints = ['/chat/completions', '/completions'];
    const compliant = supportedEndpoints.includes(endpoint);
    
    return {
      endpoint,
      compliant,
      complianceScore: compliant ? 100 : 0,
      supportedMethods: ['POST'],
      unsupportedMethods: ['GET', 'PUT', 'DELETE'],
      headerCompatibility: {
        'Content-Type': true,
        'Authorization': true,
        'OpenAI-Organization': false
      },
      responseFormatCompatibility: true,
      authenticationCompatibility: true,
      issues: compliant ? [] : [{ 
        category: 'endpoint', 
        description: 'Endpoint not supported', 
        severity: 'critical' as const,
        impact: 'Request will fail'
      }],
      recommendations: compliant ? [] : ['Use /chat/completions endpoint']
    };
  }

  // Private helper methods
  private checkParameterCompatibility(request: ChatCompletionRequest): { score: number; issues: string[] } {
    const issues: string[] = [];
    let score = 100;

    const supportedParams = ['model', 'messages', 'tools', 'tool_choice', 'temperature', 'max_tokens', 'stream'];
    const providedParams = Object.keys(request);
    
    providedParams.forEach(param => {
      if (!supportedParams.includes(param)) {
        score -= 5;
        issues.push(`Parameter '${param}' may not be supported`);
      }
    });

    return { score: Math.max(0, score), issues };
  }

  private identifySupportedFeatures(request: ChatCompletionRequest): string[] {
    const features: string[] = [];
    
    if (request.messages) features.push('chat_completions');
    if (request.tools) features.push('function_calling', 'multiple_tools');
    if (request.tool_choice) features.push('tool_choice');
    if (request.stream) features.push('streaming');
    if (request.temperature !== undefined) features.push('temperature_control');
    if (request.max_tokens) features.push('max_tokens');

    return features;
  }

  private identifyUnsupportedFeatures(request: ChatCompletionRequest): string[] {
    const unsupported: string[] = [];
    
    // Check for known unsupported OpenAI features
    if ((request as any).logit_bias) unsupported.push('logit_bias');
    if ((request as any).presence_penalty) unsupported.push('presence_penalty');
    if ((request as any).frequency_penalty) unsupported.push('frequency_penalty');
    
    return unsupported;
  }

  private identifyPartiallySupported(request: ChatCompletionRequest): PartialSupportInfo[] {
    const partial: PartialSupportInfo[] = [];
    
    if (request.tools && request.tools.length > 10) {
      partial.push({
        feature: 'multiple_tools',
        supportLevel: 70,
        limitations: ['Performance may degrade with many tools'],
        workarounds: ['Use fewer tools per request', 'Batch tool calls']
      });
    }

    return partial;
  }

  private generateCompatibilityRecommendations(
    checks: Array<{ score: number; issues: string[] }>,
    overallScore: number
  ): string[] {
    const recommendations: string[] = [];

    if (overallScore < 60) {
      recommendations.push('Consider significant modifications for OpenAI compatibility');
    }

    checks.forEach(check => {
      if (check.score < 80) {
        recommendations.push(...check.issues.map(issue => `Address: ${issue}`));
      }
    });

    return [...new Set(recommendations)].slice(0, 10); // Limit to 10 recommendations
  }

  private generateMigrationGuidance(result: CompatibilityResult): MigrationGuidance {
    const difficulty = result.openaiComplianceScore >= 80 ? 'easy' : 
                     result.openaiComplianceScore >= 60 ? 'moderate' : 'complex';
    
    return {
      difficulty,
      estimatedEffort: result.openaiComplianceScore >= 80 ? '1-2 hours' : '1-3 days',
      requiredChanges: [],
      migrationSteps: [
        { step: 1, description: 'Review compatibility report', actions: ['Analyze issues'], validationCriteria: ['All issues identified'] },
        { step: 2, description: 'Implement changes', actions: ['Fix critical issues'], validationCriteria: ['Score > 80'] }
      ],
      testingRecommendations: ['Test with sample requests', 'Validate tool calls', 'Check streaming']
    };
  }

  private assessRisks(result: CompatibilityResult): RiskAssessment {
    const overallRisk = result.openaiComplianceScore >= 80 ? 'low' : 
                       result.openaiComplianceScore >= 60 ? 'medium' : 'high';

    return {
      overallRisk,
      risks: [
        {
          category: 'compatibility',
          description: 'Request may not work with OpenAI API',
          likelihood: overallRisk,
          impact: overallRisk,
          mitigation: 'Follow compatibility recommendations'
        }
      ],
      mitigationStrategies: ['Implement recommended changes', 'Test thoroughly']
    };
  }
}

// Export singleton instance
export const compatibilityChecker = new CompatibilityChecker();

// Re-export types for convenience
export * from './types';