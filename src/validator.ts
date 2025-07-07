import { OpenAIResponse, ValidationResult } from './types';

export class ResponseValidator {
  /**
   * Validate if response matches OpenAI format
   */
  validate(response: string): ValidationResult {
    const errors: string[] = [];

    try {
      const parsed = JSON.parse(response);
      
      // Check required fields
      if (!parsed.id) errors.push('Missing required field: id');
      if (parsed.object !== 'chat.completion') errors.push('Invalid object type, must be "chat.completion"');
      if (!parsed.created) errors.push('Missing required field: created');
      if (!parsed.model) errors.push('Missing required field: model');
      if (!parsed.choices || !Array.isArray(parsed.choices)) errors.push('Missing or invalid choices array');
      if (!parsed.usage) errors.push('Missing usage object');

      // Validate choices
      if (parsed.choices && Array.isArray(parsed.choices)) {
        parsed.choices.forEach((choice: any, index: number) => {
          if (typeof choice.index !== 'number') errors.push(`Choice ${index}: missing index`);
          if (!choice.message) errors.push(`Choice ${index}: missing message`);
          if (choice.message && !choice.message.role) errors.push(`Choice ${index}: message missing role`);
          if (choice.message && choice.message.content === undefined) errors.push(`Choice ${index}: message missing content`);
          if (!choice.finish_reason) errors.push(`Choice ${index}: missing finish_reason`);
        });
      }

      // Validate usage
      if (parsed.usage) {
        if (typeof parsed.usage.prompt_tokens !== 'number') errors.push('Usage: prompt_tokens must be a number');
        if (typeof parsed.usage.completion_tokens !== 'number') errors.push('Usage: completion_tokens must be a number');
        if (typeof parsed.usage.total_tokens !== 'number') errors.push('Usage: total_tokens must be a number');
      }

      return {
        valid: errors.length === 0,
        errors
      };

    } catch (parseError) {
      return {
        valid: false,
        errors: [`Invalid JSON: ${parseError}`]
      };
    }
  }

  /**
   * Parse valid response
   */
  parse(response: string): OpenAIResponse {
    return JSON.parse(response);
  }
}