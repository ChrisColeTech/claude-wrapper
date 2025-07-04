/**
 * Unit tests for ChoiceEnforcementUtils
 * Phase 5A: Complete test coverage for choice enforcement utilities
 * 
 * Tests utility functions for choice enforcement:
 * - Result validation and analysis
 * - Modification detection
 * - Violation filtering by severity
 * - Performance validation
 * - Utility helper functions
 */

import {
  ChoiceEnforcementUtils,
  ChoiceEnforcementResult,
  ChoiceViolation
} from '../../../src/tools/choice-enforcer';
import {
  TOOL_CHOICE_PROCESSING_LIMITS
} from '../../../src/tools/constants';

describe('ChoiceEnforcementUtils', () => {
  describe('result validation', () => {
    it('should identify successful enforcement', () => {
      const result: ChoiceEnforcementResult = {
        success: true,
        enforcementAction: {
          type: 'none',
          description: 'No action needed',
          modifications: [],
          wasRequired: false
        },
        violations: [],
        errors: []
      };

      expect(ChoiceEnforcementUtils.wasSuccessful(result)).toBe(true);
    });

    it('should identify failed enforcement', () => {
      const result: ChoiceEnforcementResult = {
        success: false,
        enforcementAction: {
          type: 'reject_response',
          description: 'Response rejected',
          modifications: [],
          wasRequired: true
        },
        violations: [],
        errors: ['Enforcement failed']
      };

      expect(ChoiceEnforcementUtils.wasSuccessful(result)).toBe(false);
    });

    it('should identify successful enforcement with warnings', () => {
      const result: ChoiceEnforcementResult = {
        success: true,
        enforcementAction: {
          type: 'filter_tools',
          description: 'Filtered tools',
          modifications: ['Filtered unexpected tool calls'],
          wasRequired: false
        },
        violations: [{
          type: 'unexpected_tool_calls',
          description: 'Warning violation',
          severity: 'warning',
          expectedBehavior: 'Expected',
          actualBehavior: 'Actual'
        }],
        errors: []
      };

      expect(ChoiceEnforcementUtils.wasSuccessful(result)).toBe(true);
    });
  });

  describe('modification checks', () => {
    it('should detect when response was modified', () => {
      const result: ChoiceEnforcementResult = {
        success: true,
        enforcementAction: {
          type: 'force_text_only',
          description: 'Modified response',
          modifications: ['Removed tool calls'],
          wasRequired: true
        },
        modifiedResponse: {
          content: 'Modified content',
          finish_reason: 'stop'
        },
        violations: [],
        errors: []
      };

      expect(ChoiceEnforcementUtils.wasModified(result)).toBe(true);
    });

    it('should detect when response was not modified', () => {
      const result: ChoiceEnforcementResult = {
        success: true,
        enforcementAction: {
          type: 'none',
          description: 'No modification needed',
          modifications: [],
          wasRequired: false
        },
        violations: [],
        errors: []
      };

      expect(ChoiceEnforcementUtils.wasModified(result)).toBe(false);
    });

    it('should detect when response was rejected', () => {
      const result: ChoiceEnforcementResult = {
        success: false,
        enforcementAction: {
          type: 'reject_response',
          description: 'Response rejected',
          modifications: [],
          wasRequired: true
        },
        violations: [],
        errors: []
      };

      expect(ChoiceEnforcementUtils.wasRejected(result)).toBe(true);
    });

    it('should not detect rejection for other action types', () => {
      const result: ChoiceEnforcementResult = {
        success: true,
        enforcementAction: {
          type: 'force_text_only',
          description: 'Modified response',
          modifications: ['Removed tool calls'],
          wasRequired: true
        },
        violations: [],
        errors: []
      };

      expect(ChoiceEnforcementUtils.wasRejected(result)).toBe(false);
    });
  });

  describe('violation filtering', () => {
    it('should filter error violations', () => {
      const result: ChoiceEnforcementResult = {
        success: false,
        enforcementAction: {
          type: 'reject_response',
          description: 'Violations detected',
          modifications: [],
          wasRequired: true
        },
        violations: [
          {
            type: 'unexpected_tool_calls',
            description: 'Error violation',
            severity: 'error',
            expectedBehavior: 'Expected',
            actualBehavior: 'Actual'
          },
          {
            type: 'unexpected_tool_calls',
            description: 'Warning violation',
            severity: 'warning',
            expectedBehavior: 'Expected',
            actualBehavior: 'Actual'
          }
        ],
        errors: []
      };

      const errorViolations = ChoiceEnforcementUtils.getErrorViolations(result);
      const warningViolations = ChoiceEnforcementUtils.getWarningViolations(result);

      expect(errorViolations).toHaveLength(1);
      expect(errorViolations[0].severity).toBe('error');
      expect(warningViolations).toHaveLength(1);
      expect(warningViolations[0].severity).toBe('warning');
    });

    it('should handle empty violations array', () => {
      const result: ChoiceEnforcementResult = {
        success: true,
        enforcementAction: {
          type: 'none',
          description: 'No violations',
          modifications: [],
          wasRequired: false
        },
        violations: [],
        errors: []
      };

      const errorViolations = ChoiceEnforcementUtils.getErrorViolations(result);
      const warningViolations = ChoiceEnforcementUtils.getWarningViolations(result);

      expect(errorViolations).toHaveLength(0);
      expect(warningViolations).toHaveLength(0);
    });

    it('should handle mixed violation severities', () => {
      const violations: ChoiceViolation[] = [
        {
          type: 'missing_forced_function',
          description: 'Missing function',
          severity: 'error',
          expectedBehavior: 'Must call function',
          actualBehavior: 'No function called'
        },
        {
          type: 'unexpected_tool_calls',
          description: 'Extra tools',
          severity: 'warning',
          expectedBehavior: 'Only specific tools',
          actualBehavior: 'Additional tools called'
        },
        {
          type: 'wrong_function_called',
          description: 'Wrong function',
          severity: 'error',
          expectedBehavior: 'Correct function',
          actualBehavior: 'Wrong function'
        }
      ];

      const result: ChoiceEnforcementResult = {
        success: false,
        enforcementAction: {
          type: 'force_function',
          description: 'Multiple violations',
          modifications: [],
          wasRequired: true
        },
        violations,
        errors: []
      };

      const errorViolations = ChoiceEnforcementUtils.getErrorViolations(result);
      const warningViolations = ChoiceEnforcementUtils.getWarningViolations(result);

      expect(errorViolations).toHaveLength(2);
      expect(warningViolations).toHaveLength(1);
    });
  });

  describe('performance validation', () => {
    it('should validate performance for fast enforcement', () => {
      const result: ChoiceEnforcementResult = {
        success: true,
        enforcementAction: {
          type: 'none',
          description: 'Fast enforcement',
          modifications: [],
          wasRequired: false
        },
        violations: [],
        errors: [],
        enforcementTimeMs: 2
      };

      expect(ChoiceEnforcementUtils.meetsPerformanceRequirements(result)).toBe(true);
    });

    it('should reject performance for slow enforcement', () => {
      const result: ChoiceEnforcementResult = {
        success: true,
        enforcementAction: {
          type: 'none',
          description: 'Slow enforcement',
          modifications: [],
          wasRequired: false
        },
        violations: [],
        errors: [],
        enforcementTimeMs: 10
      };

      expect(ChoiceEnforcementUtils.meetsPerformanceRequirements(result)).toBe(false);
    });

    it('should handle undefined enforcement time', () => {
      const result: ChoiceEnforcementResult = {
        success: true,
        enforcementAction: {
          type: 'none',
          description: 'No timing info',
          modifications: [],
          wasRequired: false
        },
        violations: [],
        errors: []
      };

      expect(ChoiceEnforcementUtils.meetsPerformanceRequirements(result)).toBe(true);
    });

    it('should validate against performance limit', () => {
      const exactLimit: ChoiceEnforcementResult = {
        success: true,
        enforcementAction: { type: 'none', description: 'Exact limit', modifications: [], wasRequired: false },
        violations: [],
        errors: [],
        enforcementTimeMs: TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS
      };

      const overLimit: ChoiceEnforcementResult = {
        success: true,
        enforcementAction: { type: 'none', description: 'Over limit', modifications: [], wasRequired: false },
        violations: [],
        errors: [],
        enforcementTimeMs: TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS + 1
      };

      expect(ChoiceEnforcementUtils.meetsPerformanceRequirements(exactLimit)).toBe(true);
      expect(ChoiceEnforcementUtils.meetsPerformanceRequirements(overLimit)).toBe(false);
    });
  });

  describe('utility functions', () => {
    it('should create default options', () => {
      const options = ChoiceEnforcementUtils.createDefaultOptions();

      expect(options).toEqual({
        strictEnforcement: true,
        allowPartialCompliance: false,
        enforceTimeout: true,
        timeoutMs: TOOL_CHOICE_PROCESSING_LIMITS.CHOICE_PROCESSING_TIMEOUT_MS,
        logViolations: true
      });
    });

    it('should create error result', () => {
      const errors = ['Error 1', 'Error 2'];
      const enforcementTime = 5;

      const result = ChoiceEnforcementUtils.createErrorResult(errors, enforcementTime);

      expect(result).toEqual({
        success: false,
        enforcementAction: {
          type: 'reject_response',
          description: 'Enforcement failed with errors',
          modifications: [],
          wasRequired: true
        },
        violations: [],
        errors,
        enforcementTimeMs: enforcementTime
      });
    });

    it('should create error result without timing info', () => {
      const errors = ['Single error'];

      const result = ChoiceEnforcementUtils.createErrorResult(errors);

      expect(result.success).toBe(false);
      expect(result.enforcementAction.type).toBe('reject_response');
      expect(result.errors).toEqual(errors);
      expect(result.enforcementTimeMs).toBeUndefined();
    });

    it('should handle empty errors array', () => {
      const errors: string[] = [];

      const result = ChoiceEnforcementUtils.createErrorResult(errors);

      expect(result.success).toBe(false);
      expect(result.errors).toEqual([]);
    });
  });

  describe('analysis helpers', () => {
    it('should count total violations', () => {
      const result: ChoiceEnforcementResult = {
        success: false,
        enforcementAction: {
          type: 'force_text_only',
          description: 'Multiple violations',
          modifications: [],
          wasRequired: true
        },
        violations: [
          { type: 'unexpected_tool_calls', description: 'Error 1', severity: 'error', expectedBehavior: 'A', actualBehavior: 'B' },
          { type: 'unexpected_tool_calls', description: 'Warning 1', severity: 'warning', expectedBehavior: 'C', actualBehavior: 'D' },
          { type: 'missing_forced_function', description: 'Error 2', severity: 'error', expectedBehavior: 'E', actualBehavior: 'F' }
        ],
        errors: []
      };

      expect(ChoiceEnforcementUtils.getErrorViolations(result)).toHaveLength(2);
      expect(ChoiceEnforcementUtils.getWarningViolations(result)).toHaveLength(1);
      expect(result.violations).toHaveLength(3);
    });

    it('should check if enforcement was required', () => {
      const requiredResult: ChoiceEnforcementResult = {
        success: true,
        enforcementAction: {
          type: 'force_text_only',
          description: 'Required enforcement',
          modifications: ['Removed tools'],
          wasRequired: true
        },
        violations: [],
        errors: []
      };

      const notRequiredResult: ChoiceEnforcementResult = {
        success: true,
        enforcementAction: {
          type: 'none',
          description: 'No enforcement needed',
          modifications: [],
          wasRequired: false
        },
        violations: [],
        errors: []
      };

      expect(requiredResult.enforcementAction.wasRequired).toBe(true);
      expect(notRequiredResult.enforcementAction.wasRequired).toBe(false);
    });
  });
});