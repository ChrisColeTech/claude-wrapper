/**
 * Parameter Validator Tests for Phase 3B
 * Tests for src/validation/validator.ts ParameterValidator class
 * Validates Python compatibility and comprehensive validation behavior
 */

import { ParameterValidator, ValidationResult } from '../../../src/validation/validator';
import { ChatCompletionRequest } from '../../../src/models/chat';
import { Message } from '../../../src/models/message';

describe('Phase 3B: Parameter Validator Tests', () => {
  describe('ParameterValidator.validateRequest', () => {
    it('should validate minimal valid request', () => {
      const request: ChatCompletionRequest = {
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 1.0,
        top_p: 1.0,
        n: 1,
        stream: false,
        presence_penalty: 0,
        frequency_penalty: 0,
        enable_tools: false
      };

      const result = ParameterValidator.validateRequest(request);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should validate request with all parameters', () => {
      const request: ChatCompletionRequest = {
        model: 'claude-opus-4-20250514',
        messages: [
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'Hello' }
        ],
        temperature: 0.7,
        top_p: 0.9,
        n: 1,
        stream: false,
        max_tokens: 100,
        presence_penalty: 0.5,
        frequency_penalty: -0.5,
        stop: ['\\n'],
        logit_bias: { '123': 0.5 },
        user: 'test-user',
        session_id: 'session-123',
        enable_tools: false
      };

      const result = ParameterValidator.validateRequest(request);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      // Should have warnings for unsupported parameters
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should reject request with n > 1 (Claude Code limitation)', () => {
      const request: ChatCompletionRequest = {
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 1.0,
        top_p: 1.0,
        n: 2, // Invalid for Claude Code
        stream: false,
        presence_penalty: 0,
        frequency_penalty: 0,
        enable_tools: false
      };

      const result = ParameterValidator.validateRequest(request);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Claude Code SDK does not support multiple choices (n > 1). Only single response generation is supported.');
    });

    it('should reject invalid temperature range', () => {
      const request: ChatCompletionRequest = {
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 3.0, // Invalid range
        top_p: 1.0,
        n: 1,
        stream: false,
        presence_penalty: 0,
        frequency_penalty: 0,
        enable_tools: false
      };

      const result = ParameterValidator.validateRequest(request);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('temperature must be between 0 and 2, got 3');
    });

    it('should reject invalid top_p range', () => {
      const request: ChatCompletionRequest = {
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 1.0,
        top_p: 1.5, // Invalid range
        n: 1,
        stream: false,
        presence_penalty: 0,
        frequency_penalty: 0,
        enable_tools: false
      };

      const result = ParameterValidator.validateRequest(request);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('top_p must be between 0 and 1, got 1.5');
    });

    it('should reject invalid penalty ranges', () => {
      const request: ChatCompletionRequest = {
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 1.0,
        top_p: 1.0,
        n: 1,
        stream: false,
        presence_penalty: 3.0, // Invalid range
        frequency_penalty: -3.0, // Invalid range
        enable_tools: false
      };

      const result = ParameterValidator.validateRequest(request);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('presence_penalty must be between -2 and 2, got 3');
      expect(result.errors).toContain('frequency_penalty must be between -2 and 2, got -3');
    });

    it('should allow max_tokens = 0 (Python compatibility)', () => {
      const request: ChatCompletionRequest = {
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 1.0,
        top_p: 1.0,
        n: 1,
        stream: false,
        max_tokens: 0, // Should be allowed per Python compatibility
        presence_penalty: 0,
        frequency_penalty: 0,
        enable_tools: false
      };

      const result = ParameterValidator.validateRequest(request);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject negative max_tokens', () => {
      const request: ChatCompletionRequest = {
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 1.0,
        top_p: 1.0,
        n: 1,
        stream: false,
        max_tokens: -1, // Invalid
        presence_penalty: 0,
        frequency_penalty: 0,
        enable_tools: false
      };

      const result = ParameterValidator.validateRequest(request);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('max_tokens must be non-negative, got -1');
    });

    it('should generate warnings for unsupported parameters', () => {
      const request: ChatCompletionRequest = {
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.5, // Non-default
        top_p: 0.8, // Non-default
        n: 1,
        stream: true, // Has warning
        max_tokens: 100, // Non-default
        presence_penalty: 1.0, // Non-default
        frequency_penalty: -1.0, // Non-default
        stop: ['\\n'], // Not supported
        logit_bias: { '123': 0.5 }, // Not supported
        enable_tools: false
      };

      const result = ParameterValidator.validateRequest(request);

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('temperature=0.5'))).toBe(true);
      expect(result.warnings.some(w => w.includes('top_p=0.8'))).toBe(true);
      expect(result.warnings.some(w => w.includes('max_tokens=100'))).toBe(true);
      expect(result.warnings.some(w => w.includes('presence_penalty=1'))).toBe(true);
      expect(result.warnings.some(w => w.includes('frequency_penalty=-1'))).toBe(true);
      expect(result.warnings.some(w => w.includes('stop sequences'))).toBe(true);
      expect(result.warnings.some(w => w.includes('logit_bias'))).toBe(true);
      expect(result.warnings.some(w => w.includes('Streaming responses'))).toBe(true);
    });
  });

  describe('ParameterValidator.validateModel', () => {
    it('should validate supported models', () => {
      const supportedModels = [
        'claude-sonnet-4-20250514',
        'claude-opus-4-20250514',
        'claude-3-7-sonnet-20250219',
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022'
      ];

      for (const model of supportedModels) {
        const result = ParameterValidator.validateModel(model);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
      }
    });

    it('should warn about unsupported models', () => {
      const result = ParameterValidator.validateModel('gpt-4');

      expect(result.valid).toBe(true); // Valid but with warning
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain("Model 'gpt-4' is not officially supported");
    });

    it('should reject empty model', () => {
      const result = ParameterValidator.validateModel('');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Model parameter is required and must be a string');
    });

    it('should reject non-string model', () => {
      const result = ParameterValidator.validateModel(null as any);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Model parameter is required and must be a string');
    });
  });

  describe('ParameterValidator.validateMessages', () => {
    it('should validate valid messages array', () => {
      const messages: Message[] = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' }
      ];

      const result = ParameterValidator.validateMessages(messages);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should reject empty messages array', () => {
      const result = ParameterValidator.validateMessages([]);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Messages array cannot be empty');
    });

    it('should reject non-array messages', () => {
      const result = ParameterValidator.validateMessages(null as any);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Messages parameter is required and must be an array');
    });

    it('should reject messages with missing role', () => {
      const messages = [
        { content: 'Hello' } // Missing role
      ] as unknown as Message[];

      const result = ParameterValidator.validateMessages(messages);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Message at index 0 is missing required 'role' field");
    });

    it('should reject messages with invalid role', () => {
      const messages = [
        { role: 'invalid', content: 'Hello' }
      ] as unknown as Message[];

      const result = ParameterValidator.validateMessages(messages);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Message at index 0 has invalid role 'invalid'. Must be 'system', 'user', or 'assistant'");
    });

    it('should reject messages with missing content', () => {
      const messages = [
        { role: 'user' } // Missing content
      ] as unknown as Message[];

      const result = ParameterValidator.validateMessages(messages);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Message at index 0 is missing required 'content' field");
    });

    it('should warn when conversation does not end with user message', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' } // Ends with assistant
      ];

      const result = ParameterValidator.validateMessages(messages);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toContain('Conversation should typically end with a user message for optimal Claude Code SDK performance');
    });

    it('should not warn when conversation ends with user message', () => {
      const messages: Message[] = [
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'Hello' } // Ends with user
      ];

      const result = ParameterValidator.validateMessages(messages);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('ParameterValidator utility methods', () => {
    it('should check if model is supported', () => {
      expect(ParameterValidator.isSupportedModel('claude-sonnet-4-20250514')).toBe(true);
      expect(ParameterValidator.isSupportedModel('gpt-4')).toBe(false);
      expect(ParameterValidator.isSupportedModel('')).toBe(false);
    });

    it('should return list of supported models', () => {
      const models = ParameterValidator.getSupportedModels();
      
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
      expect(models).toContain('claude-sonnet-4-20250514');
      expect(models).toContain('claude-opus-4-20250514');
    });
  });

  describe('Integration with chat models', () => {
    it('should work with ChatCompletionRequest schema validation', () => {
      const request = {
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 1.0,
        top_p: 1.0,
        n: 1,
        stream: false,
        presence_penalty: 0,
        frequency_penalty: 0,
        enable_tools: false
      };

      // Should pass both schema validation and parameter validation
      const result = ParameterValidator.validateRequest(request as ChatCompletionRequest);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect validation differences between schema and parameter validation', () => {
      const request = {
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 5.0, // Invalid range
        top_p: 1.0,
        n: 1,
        stream: false,
        presence_penalty: 0,
        frequency_penalty: 0,
        enable_tools: false
      };

      // Parameter validator should catch the temperature issue
      const result = ParameterValidator.validateRequest(request as ChatCompletionRequest);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('temperature'))).toBe(true);
    });
  });

  describe('Python compatibility edge cases', () => {
    it('should handle boundary values correctly', () => {
      const request: ChatCompletionRequest = {
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0, // Boundary
        top_p: 0, // Boundary  
        n: 1,
        stream: false,
        max_tokens: 0, // Boundary - should be allowed
        presence_penalty: -2, // Boundary
        frequency_penalty: 2, // Boundary
        enable_tools: false
      };

      const result = ParameterValidator.validateRequest(request);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle edge boundary values correctly', () => {
      const request: ChatCompletionRequest = {
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 2, // Upper boundary
        top_p: 1, // Upper boundary
        n: 1,
        stream: false,
        presence_penalty: 2, // Upper boundary
        frequency_penalty: -2, // Lower boundary
        enable_tools: false
      };

      const result = ParameterValidator.validateRequest(request);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('ParameterValidator.validatePermissionMode', () => {
    it('should validate supported permission modes', () => {
      expect(ParameterValidator.validatePermissionMode('default')).toBe(true);
      expect(ParameterValidator.validatePermissionMode('acceptEdits')).toBe(true);
      expect(ParameterValidator.validatePermissionMode('bypassPermissions')).toBe(true);
    });

    it('should reject invalid permission modes', () => {
      expect(ParameterValidator.validatePermissionMode('invalid')).toBe(false);
      expect(ParameterValidator.validatePermissionMode('')).toBe(false);
    });
  });

  describe('ParameterValidator.validateTools', () => {
    it('should validate array of valid tool names', () => {
      expect(ParameterValidator.validateTools(['tool1', 'tool2', 'tool3'])).toBe(true);
      expect(ParameterValidator.validateTools(['Read', 'Write', 'Bash'])).toBe(true);
      expect(ParameterValidator.validateTools([])).toBe(true); // Empty array is valid
    });

    it('should reject tools with empty strings', () => {
      expect(ParameterValidator.validateTools(['tool1', '', 'tool3'])).toBe(false);
      expect(ParameterValidator.validateTools(['', ''])).toBe(false);
    });

    it('should reject tools with whitespace-only strings', () => {
      expect(ParameterValidator.validateTools(['tool1', '   ', 'tool3'])).toBe(false);
      expect(ParameterValidator.validateTools(['\t', '\n'])).toBe(false);
    });

    it('should reject non-string values', () => {
      expect(ParameterValidator.validateTools(['tool1', 123, 'tool3'] as any)).toBe(false);
      expect(ParameterValidator.validateTools([null, undefined] as any)).toBe(false);
    });
  });

  describe('ParameterValidator.createEnhancedOptions', () => {
    const baseRequest: ChatCompletionRequest = {
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: 'Hello' }],
      temperature: 1.0,
      top_p: 1.0,
      n: 1,
      stream: false,
      presence_penalty: 0,
      frequency_penalty: 0,
      enable_tools: false
    };

    it('should create basic options from request', () => {
      const options = ParameterValidator.createEnhancedOptions(baseRequest);

      expect(options).toEqual({
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false,
        user: undefined
      });
    });

    it('should add max_turns when provided', () => {
      const options = ParameterValidator.createEnhancedOptions(baseRequest, 5);

      expect(options.max_turns).toBe(5);
    });

    it('should add allowed_tools when provided', () => {
      const tools = ['Read', 'Write', 'Bash'];
      const options = ParameterValidator.createEnhancedOptions(baseRequest, undefined, tools);

      expect(options.allowed_tools).toEqual(tools);
    });

    it('should add disallowed_tools when provided', () => {
      const tools = ['Bash', 'Edit'];
      const options = ParameterValidator.createEnhancedOptions(baseRequest, undefined, undefined, tools);

      expect(options.disallowed_tools).toEqual(tools);
    });

    it('should add permission_mode when provided', () => {
      const options = ParameterValidator.createEnhancedOptions(baseRequest, undefined, undefined, undefined, 'acceptEdits');

      expect(options.permission_mode).toBe('acceptEdits');
    });

    it('should add max_thinking_tokens when provided', () => {
      const options = ParameterValidator.createEnhancedOptions(baseRequest, undefined, undefined, undefined, undefined, 1000);

      expect(options.max_thinking_tokens).toBe(1000);
    });

    it('should include all enhanced options when provided', () => {
      const allowedTools = ['Read', 'Write'];
      const disallowedTools = ['Bash'];
      
      const options = ParameterValidator.createEnhancedOptions(
        baseRequest,
        10, // maxTurns
        allowedTools,
        disallowedTools,
        'bypassPermissions',
        5000 // maxThinkingTokens
      );

      expect(options).toEqual({
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false,
        user: undefined,
        max_turns: 10,
        allowed_tools: allowedTools,
        disallowed_tools: disallowedTools,
        permission_mode: 'bypassPermissions',
        max_thinking_tokens: 5000
      });
    });

    it('should handle boundary values for max_turns', () => {
      // Lower boundary - should work but warn
      const options1 = ParameterValidator.createEnhancedOptions(baseRequest, 1);
      expect(options1.max_turns).toBe(1);

      // Upper boundary - should work but warn
      const options2 = ParameterValidator.createEnhancedOptions(baseRequest, 100);
      expect(options2.max_turns).toBe(100);

      // Outside range - should still be added but logged
      const options3 = ParameterValidator.createEnhancedOptions(baseRequest, 150);
      expect(options3.max_turns).toBe(150);
    });

    it('should handle boundary values for max_thinking_tokens', () => {
      // Lower boundary
      const options1 = ParameterValidator.createEnhancedOptions(baseRequest, undefined, undefined, undefined, undefined, 0);
      expect(options1.max_thinking_tokens).toBe(0);

      // Upper boundary
      const options2 = ParameterValidator.createEnhancedOptions(baseRequest, undefined, undefined, undefined, undefined, 50000);
      expect(options2.max_thinking_tokens).toBe(50000);

      // Outside range - should still be added but logged
      const options3 = ParameterValidator.createEnhancedOptions(baseRequest, undefined, undefined, undefined, undefined, 60000);
      expect(options3.max_thinking_tokens).toBe(60000);
    });

    it('should not add invalid tools', () => {
      const invalidTools = ['', '  ', 'valid-tool'];
      
      const options = ParameterValidator.createEnhancedOptions(baseRequest, undefined, invalidTools);

      // Should not include allowed_tools since validation failed
      expect(options.allowed_tools).toBeUndefined();
    });

    it('should not add invalid permission mode', () => {
      const options = ParameterValidator.createEnhancedOptions(baseRequest, undefined, undefined, undefined, 'invalidMode');

      // Should not include permission_mode since validation failed
      expect(options.permission_mode).toBeUndefined();
    });
  });
});