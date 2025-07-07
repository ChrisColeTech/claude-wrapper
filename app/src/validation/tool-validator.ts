/**
 * Tool Validation Module
 * Extracted from validator.ts to comply with ESLint max-lines rule
 * Handles OpenAI Tools API validation for Phase 4 implementation
 */

/**
 * Phase 4: Validate tools array
 */
export function validateTools(tools: any[]): string[] {
  const errors: string[] = [];

  if (!Array.isArray(tools)) {
    errors.push('tools must be an array');
    return errors;
  }

  if (tools.length === 0) {
    errors.push('tools array cannot be empty');
    return errors;
  }

  for (let i = 0; i < tools.length; i++) {
    const tool = tools[i];
    const prefix = `tools[${i}]`;

    if (!tool || typeof tool !== 'object') {
      errors.push(`${prefix} must be an object`);
      continue;
    }

    if (tool.type !== 'function') {
      errors.push(`${prefix}.type must be 'function'`);
    }

    if (!tool.function || typeof tool.function !== 'object') {
      errors.push(`${prefix}.function must be an object`);
      continue;
    }

    const func = tool.function;

    if (!func.name || typeof func.name !== 'string') {
      errors.push(`${prefix}.function.name is required and must be a string`);
    } else if (!/^[a-zA-Z0-9_-]+$/.test(func.name)) {
      errors.push(`${prefix}.function.name must contain only alphanumeric characters, underscores, and hyphens`);
    }

    if (func.description && typeof func.description !== 'string') {
      errors.push(`${prefix}.function.description must be a string if provided`);
    }

    if (func.parameters && typeof func.parameters !== 'object') {
      errors.push(`${prefix}.function.parameters must be an object if provided`);
    }
  }

  return errors;
}

/**
 * Phase 4: Validate tool_choice
 */
export function validateToolChoice(toolChoice: any, tools: any[]): string[] {
  const errors: string[] = [];

  if (typeof toolChoice === 'string') {
    const validChoices = ['auto', 'none'];
    if (!validChoices.includes(toolChoice)) {
      // Check if it's a specific tool name
      const toolNames = tools.map(t => t.function?.name).filter(Boolean);
      if (!toolNames.includes(toolChoice)) {
        errors.push(`tool_choice must be 'auto', 'none', or a valid tool name. Available tools: ${toolNames.join(', ')}`);
      }
    }
  } else if (typeof toolChoice === 'object' && toolChoice !== null) {
    if (toolChoice.type !== 'function') {
      errors.push('tool_choice.type must be "function" when tool_choice is an object');
    }

    if (!toolChoice.function || typeof toolChoice.function !== 'object') {
      errors.push('tool_choice.function must be an object when tool_choice is an object');
    } else if (!toolChoice.function.name || typeof toolChoice.function.name !== 'string') {
      errors.push('tool_choice.function.name is required and must be a string');
    } else {
      // Validate the tool name exists
      const toolNames = tools.map(t => t.function?.name).filter(Boolean);
      if (!toolNames.includes(toolChoice.function.name)) {
        errors.push(`tool_choice.function.name '${toolChoice.function.name}' does not match any provided tool. Available tools: ${toolNames.join(', ')}`);
      }
    }
  } else {
    errors.push('tool_choice must be a string or object');
  }

  return errors;
}