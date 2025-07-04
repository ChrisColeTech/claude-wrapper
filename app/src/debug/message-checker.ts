/**
 * Message compatibility checking utilities
 */

/**
 * Check message compatibility with OpenAI standards
 */
export function checkMessageCompatibility(messages: any[]): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 100;

  if (!Array.isArray(messages)) {
    score = 0;
    issues.push('Messages must be an array');
    return { score, issues };
  }

  if (messages.length === 0) {
    score -= 50;
    issues.push('Messages array cannot be empty');
  }

  const validRoles = ['system', 'user', 'assistant', 'tool'];
  
  messages.forEach((message, index) => {
    if (!message.role) {
      score -= 10;
      issues.push(`Message ${index}: Missing required 'role' field`);
    } else if (!validRoles.includes(message.role)) {
      score -= 15;
      issues.push(`Message ${index}: Invalid role '${message.role}'. Must be one of: ${validRoles.join(', ')}`);
    }

    if (!message.content && message.role !== 'tool') {
      score -= 10;
      issues.push(`Message ${index}: Missing required 'content' field`);
    }

    // Tool message specific checks
    if (message.role === 'tool') {
      if (!message.tool_call_id) {
        score -= 15;
        issues.push(`Message ${index}: Tool messages must have 'tool_call_id' field`);
      }
      if (!message.content) {
        score -= 10;
        issues.push(`Message ${index}: Tool messages must have 'content' field`);
      }
    }

    // Assistant message with tool calls checks
    if (message.role === 'assistant' && message.tool_calls) {
      if (!Array.isArray(message.tool_calls)) {
        score -= 15;
        issues.push(`Message ${index}: tool_calls must be an array`);
      } else {
        message.tool_calls.forEach((toolCall: any, tcIndex: number) => {
          if (!toolCall.id) {
            score -= 10;
            issues.push(`Message ${index}, tool_call ${tcIndex}: Missing 'id' field`);
          }
          if (!toolCall.type || toolCall.type !== 'function') {
            score -= 10;
            issues.push(`Message ${index}, tool_call ${tcIndex}: Invalid or missing 'type' field (must be 'function')`);
          }
          if (!toolCall.function || !toolCall.function.name) {
            score -= 10;
            issues.push(`Message ${index}, tool_call ${tcIndex}: Missing function name`);
          }
        });
      }
    }
  });

  return { score: Math.max(0, score), issues };
}