/**
 * Debug and compatibility checking type definitions
 */

import { OpenAITool } from '../tools/types';

/**
 * Chat completion request interface (simplified for compatibility checking)
 */
export interface ChatCompletionRequest {
  model: string;
  messages: any[];
  tools?: OpenAITool[];
  tool_choice?: string | { type: string; function: { name: string } };
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  [key: string]: any;
}

/**
 * Compatibility result interface
 */
export interface CompatibilityResult {
  overallCompatible: boolean;
  openaiComplianceScore: number;
  supportedFeatures: string[];
  unsupportedFeatures: string[];
  partiallySupported: PartialSupportInfo[];
  recommendations: string[];
  compatibilityLevel: 'full' | 'high' | 'medium' | 'low' | 'none';
  checkTimestamp: number;
}

/**
 * Tool compatibility result interface
 */
export interface ToolCompatibilityResult {
  toolName: string;
  compatible: boolean;
  complianceScore: number;
  issues: SchemaIssue[];
  supportedParameters: string[];
  unsupportedParameters: string[];
  parameterAnalysis: ParameterSupportAnalysis[];
  migrationRequirements: string[];
  recommendedChanges: RequiredChange[];
}

/**
 * Parameter support analysis interface
 */
export interface ParameterSupportAnalysis {
  parameterName: string;
  supported: boolean;
  supportLevel: 'full' | 'partial' | 'none';
  issues: string[];
  recommendations: string[];
  mappingInfo?: {
    claudeEquivalent: string;
    transformationRequired: boolean;
  };
}

/**
 * Comprehensive compatibility report interface
 */
export interface CompatibilityReport {
  summary: CompatibilityResult;
  detailedAnalysis: ToolCompatibilityResult[];
  parameterSupport: ParameterSupportAnalysis[];
  endpointCompliance: EndpointComplianceResult;
  migrationGuidance: MigrationGuidance;
  riskAssessment: RiskAssessment;
  generatedAt: number;
}

/**
 * Endpoint compliance result interface
 */
export interface EndpointComplianceResult {
  endpoint: string;
  compliant: boolean;
  isCompliant?: boolean; // Alias for compliant for test compatibility
  complianceScore: number;
  supportedMethods: string[];
  unsupportedMethods: string[];
  supportedFeatures: string[]; // Added for test compatibility
  unsupportedFeatures: string[]; // Added for test compatibility
  limitations: string[]; // Added for test compatibility
  headerCompatibility: Record<string, boolean>;
  responseFormatCompatibility: boolean;
  authenticationCompatibility: boolean;
  issues: ComplianceIssue[];
  recommendations: string[];
  verificationTimestamp: number; // Added for test compatibility
}

/**
 * Partial support information interface
 */
export interface PartialSupportInfo {
  feature: string;
  supportLevel: number; // 0-100%
  limitations: string[];
  workarounds: string[];
}

/**
 * Schema issue interface
 */
export interface SchemaIssue {
  field: string;
  issue: string;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
}

/**
 * Compatibility assessment interface
 */
export interface CompatibilityAssessment {
  overallScore: number;
  featureGaps: FeatureGap[];
  recommendations: string[];
  migrationEffort: 'low' | 'medium' | 'high';
}

/**
 * Feature gap interface
 */
export interface FeatureGap {
  feature: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  workaround?: string;
}

/**
 * Migration guidance interface
 */
export interface MigrationGuidance {
  difficulty: 'easy' | 'moderate' | 'complex';
  estimatedEffort: string;
  requiredChanges: RequiredChange[];
  migrationSteps: MigrationStep[];
  testingRecommendations: string[];
}

/**
 * Compliance issue interface
 */
export interface ComplianceIssue {
  category: string;
  description: string;
  severity: 'critical' | 'major' | 'minor';
  impact: string;
  solution?: string;
}

/**
 * Required change interface
 */
export interface RequiredChange {
  type: 'parameter' | 'format' | 'endpoint' | 'behavior';
  description: string;
  priority: 'high' | 'medium' | 'low';
  effort: 'minimal' | 'moderate' | 'significant';
}

/**
 * Migration step interface
 */
export interface MigrationStep {
  step: number;
  description: string;
  actions: string[];
  validationCriteria: string[];
}

/**
 * Risk assessment interface
 */
export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high';
  risks: Risk[];
  mitigationStrategies: string[];
}

/**
 * Risk interface
 */
export interface Risk {
  category: 'compatibility' | 'performance' | 'functionality' | 'security';
  description: string;
  likelihood: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation: string;
}

/**
 * Compatibility checker interface
 */
export interface ICompatibilityChecker {
  checkOpenAICompatibility(request: ChatCompletionRequest): Promise<CompatibilityResult>;
  validateToolSpecification(tool: OpenAITool): Promise<ToolCompatibilityResult>;
  analyzeParameterSupport(parameters: Record<string, any>): Promise<ParameterSupportAnalysis[]>;
  generateCompatibilityReport(request: ChatCompletionRequest): Promise<CompatibilityReport>;
  verifyEndpointCompliance(endpoint: string): Promise<EndpointComplianceResult>;
}