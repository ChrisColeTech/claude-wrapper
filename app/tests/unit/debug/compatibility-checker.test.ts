/**
 * Compatibility Checker Unit Tests
 * Phase 14A: Comprehensive testing for OpenAI compatibility verification
 * 
 * Tests the CompatibilityChecker class with 100% coverage following SOLID principles
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CompatibilityChecker } from '../../../src/debug/compatibility-checker';
import { createToolRegistry } from '../../../src/tools/registry';
import { getLogger } from '../../../src/utils/logger';
import {
  DEBUG_PERFORMANCE_LIMITS,
  DEBUG_MESSAGES,
  DEBUG_ERROR_CODES,
  OPENAI_COMPATIBILITY_VERIFICATION
} from '../../../src/tools/constants';

// Mock dependencies
jest.mock('../../../src/tools/registry');
jest.mock('../../../src/utils/logger', () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn()
  }))
}));

const mockLogger = {
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
};

const mockCreateToolRegistry = jest.fn();
const mockToolRegistry = {
  getAll: jest.fn() as jest.MockedFunction<any>,
  get: jest.fn() as jest.MockedFunction<any>,
  register: jest.fn() as jest.MockedFunction<any>,
  validateToolSpecification: jest.fn() as jest.MockedFunction<any>
};

describe('CompatibilityChecker', () => {
  let compatibilityChecker: CompatibilityChecker;

  const mockChatCompletionRequest = {
    model: 'claude-3-sonnet-20240229',
    messages: [
      { role: 'user', content: 'Hello' }
    ],
    tools: [
      {
        type: 'function' as const,
        function: {
          name: 'get_weather',
          description: 'Get weather information',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string' },
              unit: { type: 'string', enum: ['celsius', 'fahrenheit'] }
            },
            required: ['location']
          }
        }
      }
    ],
    tool_choice: 'auto',
    temperature: 0.7,
    max_tokens: 1000
  };

  const mockOpenAITool = {
    type: 'function' as const,
    function: {
      name: 'calculate_sum',
      description: 'Calculate the sum of two numbers',
      parameters: {
        type: 'object',
        properties: {
          a: { type: 'number' },
          b: { type: 'number' }
        },
        required: ['a', 'b']
      }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createToolRegistry as jest.Mock).mockReturnValue(mockToolRegistry);
    
    compatibilityChecker = new CompatibilityChecker();
  });

  describe('checkOpenAICompatibility', () => {
    beforeEach(() => {
      mockToolRegistry.getAll.mockResolvedValue([mockOpenAITool]);
    });

    it('should successfully check OpenAI compatibility', async () => {
      // Act
      const result = await compatibilityChecker.checkOpenAICompatibility(mockChatCompletionRequest);

      // Assert
      expect(result).toBeDefined();
      expect(result.overallCompatible).toBeDefined();
      expect(result.openaiComplianceScore).toBeGreaterThanOrEqual(0);
      expect(result.openaiComplianceScore).toBeLessThanOrEqual(100);
      expect(result.supportedFeatures).toBeInstanceOf(Array);
      expect(result.unsupportedFeatures).toBeInstanceOf(Array);
      expect(result.partiallySupported).toBeInstanceOf(Array);
      expect(result.recommendations).toBeInstanceOf(Array);
      expect(['full', 'high', 'medium', 'low', 'none']).toContain(result.compatibilityLevel);
      expect(result.checkTimestamp).toBeGreaterThan(0);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'OpenAI compatibility check completed',
        expect.objectContaining({
          overallCompatible: result.overallCompatible,
          complianceScore: result.openaiComplianceScore
        })
      );
    });

    it('should identify supported features correctly', async () => {
      // Act
      const result = await compatibilityChecker.checkOpenAICompatibility(mockChatCompletionRequest);

      // Assert
      expect(result.supportedFeatures).toContain('messages');
      expect(result.supportedFeatures).toContain('model');
      expect(result.supportedFeatures).toContain('tools');
    });

    it('should identify unsupported features', async () => {
      // Arrange
      const requestWithUnsupportedFeatures = {
        ...mockChatCompletionRequest,
        unsupported_param: 'value',
        another_unsupported: true
      };

      // Act
      const result = await compatibilityChecker.checkOpenAICompatibility(requestWithUnsupportedFeatures);

      // Assert
      expect(result.unsupportedFeatures.length).toBeGreaterThan(0);
    });

    it('should handle request without tools', async () => {
      // Arrange
      const requestWithoutTools = {
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: 'Hello' }]
      };

      // Act
      const result = await compatibilityChecker.checkOpenAICompatibility(requestWithoutTools);

      // Assert
      expect(result).toBeDefined();
      expect(result.supportedFeatures).toContain('messages');
      expect(result.supportedFeatures).toContain('model');
    });

    it('should calculate compliance score based on supported features', async () => {
      // Arrange
      const minimalRequest = {
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: 'Hello' }]
      };

      // Act
      const result = await compatibilityChecker.checkOpenAICompatibility(minimalRequest);

      // Assert
      expect(result.openaiComplianceScore).toBeGreaterThan(0);
      expect(result.compatibilityLevel).toBeDefined();
    });

    it('should determine overall compatibility based on score', async () => {
      // Act
      const result = await compatibilityChecker.checkOpenAICompatibility(mockChatCompletionRequest);

      // Assert
      const isHighCompliance = result.openaiComplianceScore >= OPENAI_COMPATIBILITY_VERIFICATION.MINIMUM_COMPLIANCE_SCORE;
      expect(result.overallCompatible).toBe(isHighCompliance);
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      const error = new Error('Registry error');
      mockToolRegistry.getAll.mockRejectedValue(error as any);

      // Act & Assert
      await expect(compatibilityChecker.checkOpenAICompatibility(mockChatCompletionRequest))
        .rejects
        .toThrow('Registry error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'OpenAI compatibility check failed',
        expect.objectContaining({
          error: 'Registry error'
        })
      );
    });

    it('should check performance requirement compliance', async () => {
      // Act
      const startTime = Date.now();
      await compatibilityChecker.checkOpenAICompatibility(mockChatCompletionRequest);
      const duration = Date.now() - startTime;

      // Assert - should complete within performance limits
      expect(duration).toBeLessThan(DEBUG_PERFORMANCE_LIMITS.COMPATIBILITY_CHECK_TIMEOUT_MS);
    });
  });

  describe('validateToolSpecification', () => {
    beforeEach(() => {
      mockToolRegistry.validateToolSpecification.mockResolvedValue({
        valid: true,
        errors: []
      });
    });

    it('should successfully validate tool specification', async () => {
      // Act
      const result = await compatibilityChecker.validateToolSpecification(mockOpenAITool);

      // Assert
      expect(result).toBeDefined();
      expect(result.toolName).toBe('calculate_sum');
      expect(result.isCompatible).toBeDefined();
      expect(result.complianceScore).toBeGreaterThanOrEqual(0);
      expect(result.complianceScore).toBeLessThanOrEqual(100);
      expect(result.supportedParameters).toBeInstanceOf(Array);
      expect(result.unsupportedParameters).toBeInstanceOf(Array);
      expect(result.schemaIssues).toBeInstanceOf(Array);
      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.openaiSpecVersion).toBe(OPENAI_COMPATIBILITY_VERIFICATION.CURRENT_VERSION);
      expect(result.checkTimestamp).toBeGreaterThan(0);

      expect(mockToolRegistry.validateToolSpecification).toHaveBeenCalledWith(mockOpenAITool);
    });

    it('should detect invalid tool type', async () => {
      // Arrange
      const invalidTool = {
        type: 'invalid_type' as any,
        function: mockOpenAITool.function
      };

      // Act
      const result = await compatibilityChecker.validateToolSpecification(invalidTool);

      // Assert
      expect(result.isCompatible).toBe(false);
      expect(result.schemaIssues.length).toBeGreaterThan(0);
    });

    it('should validate function name requirements', async () => {
      // Arrange
      const toolWithInvalidName = {
        ...mockOpenAITool,
        function: {
          ...mockOpenAITool.function,
          name: 'invalid-name-with-special-chars!'
        }
      };

      // Act
      const result = await compatibilityChecker.validateToolSpecification(toolWithInvalidName);

      // Assert
      expect(result.schemaIssues.length).toBeGreaterThan(0);
      const nameIssue = result.schemaIssues.find(issue => issue.field === 'function.name');
      expect(nameIssue).toBeDefined();
    });

    it('should validate parameter schema', async () => {
      // Arrange
      const toolWithInvalidParams = {
        ...mockOpenAITool,
        function: {
          ...mockOpenAITool.function,
          parameters: {
            type: 'invalid_type',
            properties: {}
          }
        }
      };

      // Act
      const result = await compatibilityChecker.validateToolSpecification(toolWithInvalidParams);

      // Assert
      expect(result.schemaIssues.length).toBeGreaterThan(0);
    });

    it('should handle missing function definition', async () => {
      // Arrange
      const toolWithoutFunction = {
        type: 'function' as const
        // Missing function property
      };

      // Act
      const result = await compatibilityChecker.validateToolSpecification(toolWithoutFunction as any);

      // Assert
      expect(result.isCompatible).toBe(false);
      expect(result.schemaIssues.length).toBeGreaterThan(0);
    });

    it('should determine compatibility based on compliance score', async () => {
      // Act
      const result = await compatibilityChecker.validateToolSpecification(mockOpenAITool);

      // Assert
      const isHighCompliance = result.complianceScore >= OPENAI_COMPATIBILITY_VERIFICATION.MINIMUM_TOOL_COMPLIANCE_SCORE;
      expect(result.isCompatible).toBe(isHighCompliance);
    });
  });

  describe('analyzeParameterSupport', () => {
    const mockParameters = {
      location: 'New York',
      unit: 'celsius',
      detailed: true,
      unsupported_param: 'value'
    };

    it('should analyze parameter support correctly', async () => {
      // Act
      const result = await compatibilityChecker.analyzeParameterSupport(mockParameters);

      // Assert
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      
      result.forEach(analysis => {
        expect(analysis.parameterName).toBeDefined();
        expect(['full', 'partial', 'none']).toContain(analysis.supportLevel);
        expect(analysis.isSupported).toBeDefined();
        expect(analysis.openaiType).toBeDefined();
        expect(analysis.actualType).toBeDefined();
        expect(analysis.limitations).toBeInstanceOf(Array);
        expect(analysis.alternatives).toBeInstanceOf(Array);
        expect(analysis.analysisTimestamp).toBeGreaterThan(0);
      });
    });

    it('should identify supported parameters', async () => {
      // Act
      const result = await compatibilityChecker.analyzeParameterSupport(mockParameters);

      // Assert
      const supportedParams = result.filter(p => p.isSupported);
      expect(supportedParams.length).toBeGreaterThan(0);
    });

    it('should identify unsupported parameters', async () => {
      // Act
      const result = await compatibilityChecker.analyzeParameterSupport(mockParameters);

      // Assert
      const unsupportedParams = result.filter(p => !p.isSupported);
      expect(unsupportedParams.length).toBeGreaterThan(0);
    });

    it('should handle empty parameters object', async () => {
      // Act
      const result = await compatibilityChecker.analyzeParameterSupport({});

      // Assert
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(0);
    });

    it('should provide alternatives for unsupported parameters', async () => {
      // Act
      const result = await compatibilityChecker.analyzeParameterSupport(mockParameters);

      // Assert
      const unsupportedWithAlternatives = result.filter(p => 
        !p.isSupported && p.alternatives.length > 0
      );
      expect(unsupportedWithAlternatives.length).toBeGreaterThan(0);
    });
  });

  describe('generateCompatibilityReport', () => {
    beforeEach(() => {
      mockToolRegistry.getAll.mockResolvedValue([mockOpenAITool]);
    });

    it('should generate comprehensive compatibility report', async () => {
      // Act
      const result = await compatibilityChecker.generateCompatibilityReport(mockChatCompletionRequest);

      // Assert
      expect(result).toBeDefined();
      expect(result.requestId).toBeDefined();
      expect(result.overallAssessment).toBeDefined();
      expect(result.toolCompatibility).toBeInstanceOf(Array);
      expect(result.parameterCompatibility).toBeInstanceOf(Array);
      expect(result.endpointCompliance).toBeDefined();
      expect(result.featureGaps).toBeInstanceOf(Array);
      expect(result.migrationGuidance).toBeDefined();
      expect(result.reportTimestamp).toBeGreaterThan(0);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Compatibility report generated',
        expect.objectContaining({
          requestId: result.requestId
        })
      );
    });

    it('should analyze all tools in request', async () => {
      // Act
      const result = await compatibilityChecker.generateCompatibilityReport(mockChatCompletionRequest);

      // Assert
      expect(result.toolCompatibility.length).toBe(mockChatCompletionRequest.tools?.length || 0);
    });

    it('should provide migration guidance', async () => {
      // Act
      const result = await compatibilityChecker.generateCompatibilityReport(mockChatCompletionRequest);

      // Assert
      expect(result.migrationGuidance.recommendedActions).toBeInstanceOf(Array);
      expect(result.migrationGuidance.codeExamples).toBeInstanceOf(Array);
      expect(result.migrationGuidance.breakingChanges).toBeInstanceOf(Array);
    });

    it('should identify feature gaps', async () => {
      // Act
      const result = await compatibilityChecker.generateCompatibilityReport(mockChatCompletionRequest);

      // Assert
      expect(result.featureGaps).toBeInstanceOf(Array);
      result.featureGaps.forEach(gap => {
        expect(gap.featureName).toBeDefined();
        expect(gap.description).toBeDefined();
        expect(['critical', 'important', 'minor']).toContain(gap.impact);
        expect(gap.workaround).toBeDefined();
      });
    });
  });

  describe('verifyEndpointCompliance', () => {
    it('should verify chat completions endpoint compliance', async () => {
      // Act
      const result = await compatibilityChecker.verifyEndpointCompliance('/v1/chat/completions');

      // Assert
      expect(result).toBeDefined();
      expect(result.endpoint).toBe('/v1/chat/completions');
      expect(result.isCompliant).toBeDefined();
      expect(result.complianceScore).toBeGreaterThanOrEqual(0);
      expect(result.complianceScore).toBeLessThanOrEqual(100);
      expect(result.supportedFeatures).toBeInstanceOf(Array);
      expect(result.unsupportedFeatures).toBeInstanceOf(Array);
      expect(result.limitations).toBeInstanceOf(Array);
      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.verificationTimestamp).toBeGreaterThan(0);
    });

    it('should handle unknown endpoints', async () => {
      // Act
      const result = await compatibilityChecker.verifyEndpointCompliance('/v1/unknown/endpoint');

      // Assert
      expect(result.isCompliant).toBe(false);
      expect(result.complianceScore).toBe(0);
      expect(result.limitations).toContain('Endpoint not recognized or supported');
    });

    it('should verify models endpoint compliance', async () => {
      // Act
      const result = await compatibilityChecker.verifyEndpointCompliance('/v1/models');

      // Assert
      expect(result.endpoint).toBe('/v1/models');
      expect(result.supportedFeatures).toContain('model listing');
    });

    it('should provide specific recommendations per endpoint', async () => {
      // Act
      const result = await compatibilityChecker.verifyEndpointCompliance('/v1/chat/completions');

      // Assert
      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and Error Handling', () => {
    it('should complete compatibility check within timeout', async () => {
      // Act
      const startTime = Date.now();
      await compatibilityChecker.checkOpenAICompatibility(mockChatCompletionRequest);
      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(DEBUG_PERFORMANCE_LIMITS.COMPATIBILITY_CHECK_TIMEOUT_MS);
    });

    it('should handle registry errors gracefully', async () => {
      // Arrange
      const error = new Error('Tool registry unavailable');
      mockToolRegistry.getAll.mockRejectedValue(error as any);

      // Act & Assert
      await expect(compatibilityChecker.checkOpenAICompatibility(mockChatCompletionRequest))
        .rejects
        .toThrow('Tool registry unavailable');
    });

    it('should handle malformed requests gracefully', async () => {
      // Arrange
      const malformedRequest = {
        invalid: 'structure'
      };

      // Act
      const result = await compatibilityChecker.checkOpenAICompatibility(malformedRequest as any);

      // Assert
      expect(result.overallCompatible).toBe(false);
      expect(result.openaiComplianceScore).toBe(0);
    });

    it('should validate input parameters', async () => {
      // Act & Assert
      await expect(compatibilityChecker.validateToolSpecification(null as any))
        .rejects
        .toThrow();
    });

    it('should handle null/undefined parameters gracefully', async () => {
      // Act
      const result = await compatibilityChecker.analyzeParameterSupport(null as any);

      // Assert
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(0);
    });
  });

  describe('Compliance scoring algorithm', () => {
    it('should calculate consistent scores', async () => {
      // Act
      const result1 = await compatibilityChecker.checkOpenAICompatibility(mockChatCompletionRequest);
      const result2 = await compatibilityChecker.checkOpenAICompatibility(mockChatCompletionRequest);

      // Assert
      expect(result1.openaiComplianceScore).toBe(result2.openaiComplianceScore);
    });

    it('should assign higher scores for more compatible requests', async () => {
      // Arrange
      const basicRequest = {
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: 'Hello' }]
      };

      const fullRequest = mockChatCompletionRequest;

      // Act
      const basicResult = await compatibilityChecker.checkOpenAICompatibility(basicRequest);
      const fullResult = await compatibilityChecker.checkOpenAICompatibility(fullRequest);

      // Assert
      expect(fullResult.openaiComplianceScore).toBeGreaterThanOrEqual(basicResult.openaiComplianceScore);
    });

    it('should penalize unsupported features appropriately', async () => {
      // Arrange
      const requestWithUnsupported = {
        ...mockChatCompletionRequest,
        many_unsupported_params: 'value1',
        another_unsupported: 'value2',
        yet_another: 'value3'
      };

      // Act
      const cleanResult = await compatibilityChecker.checkOpenAICompatibility(mockChatCompletionRequest);
      const unsupportedResult = await compatibilityChecker.checkOpenAICompatibility(requestWithUnsupported);

      // Assert
      expect(cleanResult.openaiComplianceScore).toBeGreaterThan(unsupportedResult.openaiComplianceScore);
    });
  });
});