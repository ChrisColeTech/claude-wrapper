/**
 * Response Validator Mock for externalized test mocking
 * Externalized mock following clean architecture principles
 * 
 * Single Responsibility: Mock response validation
 */

import { ValidationResult, OpenAIResponse } from '../../../src/types';

export interface ValidatorMockConfig {
  shouldValidateAsValid?: boolean;
  validationErrors?: string[];
  shouldFailParsing?: boolean;
  defaultValidationResult?: ValidationResult;
  customParseResult?: OpenAIResponse;
}

export interface MockValidator {
  validate: jest.MockedFunction<(response: string) => ValidationResult>;
  parse: jest.MockedFunction<(response: string) => OpenAIResponse>;
}

/**
 * Response validator mock utility for externalized test mocking
 */
export class ValidatorMock {
  private static mockInstance: MockValidator | null = null;
  private static config: ValidatorMockConfig = {};

  /**
   * Setup response validator mock with configuration
   */
  static setup(config: ValidatorMockConfig = {}): MockValidator {
    this.config = { ...this.config, ...config };

    // Create mock validate function
    const mockValidate = jest.fn((_response: string): ValidationResult => {
      if (this.config.defaultValidationResult) {
        return this.config.defaultValidationResult;
      }
      
      if (this.config.shouldValidateAsValid) {
        return { valid: true, errors: [] };
      }
      
      return {
        valid: false,
        errors: this.config.validationErrors || ['Invalid response']
      };
    });

    // Create mock parse function
    const mockParse = jest.fn((response: string): OpenAIResponse => {
      if (this.config.shouldFailParsing) {
        throw new Error('Parsing failed');
      }
      
      if (this.config.customParseResult) {
        return this.config.customParseResult;
      }
      
      // Default parsed response
      return {
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: Date.now(),
        model: 'sonnet',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: response
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15
        }
      };
    });

    this.mockInstance = {
      validate: mockValidate,
      parse: mockParse
    };

    return this.mockInstance;
  }

  /**
   * Set validation as valid
   */
  static setValidationAsValid(isValid: boolean = true): void {
    this.config.shouldValidateAsValid = isValid;
  }

  /**
   * Set validation errors
   */
  static setValidationErrors(errors: string[]): void {
    this.config.validationErrors = errors;
  }

  /**
   * Set parsing failure
   */
  static setParsingFailure(shouldFail: boolean = true): void {
    this.config.shouldFailParsing = shouldFail;
  }

  /**
   * Set custom validation result
   */
  static setValidationResult(result: ValidationResult): void {
    this.config.defaultValidationResult = result;
  }

  /**
   * Set custom parse result
   */
  static setParseResult(result: OpenAIResponse): void {
    this.config.customParseResult = result;
  }

  /**
   * Reset all mock configurations
   */
  static reset(): void {
    this.config = {};
    this.mockInstance = null;
  }

  /**
   * Get current mock instance
   */
  static getMockInstance(): MockValidator | null {
    return this.mockInstance;
  }

  /**
   * Update configuration
   */
  static updateConfig(updates: Partial<ValidatorMockConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}