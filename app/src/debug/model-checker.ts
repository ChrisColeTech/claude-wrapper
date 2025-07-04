/**
 * Model compatibility checking utilities
 */

/**
 * Check model compatibility with OpenAI standards
 */
export function checkModelCompatibility(model: string): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 100;

  // Check for supported models
  const supportedModels = [
    'gpt-4', 'gpt-4-32k', 'gpt-4-turbo', 'gpt-4-vision-preview',
    'gpt-3.5-turbo', 'gpt-3.5-turbo-16k', 'gpt-3.5-turbo-instruct'
  ];

  if (!supportedModels.includes(model)) {
    score -= 30;
    issues.push(`Model '${model}' is not in the standard OpenAI model list`);
  }

  // Check for deprecated models
  const deprecatedModels = ['text-davinci-003', 'text-curie-001', 'text-babbage-001'];
  if (deprecatedModels.includes(model)) {
    score -= 20;
    issues.push(`Model '${model}' is deprecated in OpenAI API`);
  }

  // Check for function calling support
  const functionCallingModels = ['gpt-4', 'gpt-4-32k', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-3.5-turbo-16k'];
  if (!functionCallingModels.includes(model)) {
    score -= 25;
    issues.push(`Model '${model}' may not support function calling`);
  }

  return { score: Math.max(0, score), issues };
}

/**
 * Determine compatibility level based on score
 */
export function determineCompatibilityLevel(score: number): 'full' | 'high' | 'medium' | 'low' | 'none' {
  if (score >= 95) return 'full';
  if (score >= 80) return 'high';
  if (score >= 60) return 'medium';
  if (score >= 30) return 'low';
  return 'none';
}