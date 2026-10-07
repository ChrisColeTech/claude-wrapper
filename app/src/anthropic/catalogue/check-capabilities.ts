/**
 * Checks an entry's `capabilities` against the `ModelCapabilities` shape: `null`, or every known
 * capability present as `{supported: boolean}` with its sub-keys. Later validations read these
 * flags, so a malformed file is refused at start rather than at the first request.
 */
import { fail, isObject, objectAt } from './checks';

const FLAGS = ['batch', 'citations', 'code_execution', 'image_input', 'pdf_input', 'structured_outputs'] as const;
const EFFORT_LEVELS = ['low', 'medium', 'high', 'max'] as const;
const CONTEXT_STRATEGIES = ['clear_thinking_20251015', 'clear_tool_uses_20250919', 'compact_20260112'] as const;

/** `{supported: boolean}` (extra keys allowed); returns the object for its sub-keys. */
function checkSupport(value: unknown, at: string): Record<string, unknown> {
  const support = objectAt(value, at);
  if (typeof support['supported'] !== 'boolean') fail(`${at}.supported`, 'a boolean');
  return support;
}

function checkSupportOrNull(value: unknown, at: string): void {
  if (value === null) return;
  if (!isObject(value)) fail(at, 'an object or null');
  checkSupport(value, at);
}

function checkEffort(value: unknown, at: string): void {
  const effort = checkSupport(value, at);
  EFFORT_LEVELS.forEach((level) => checkSupport(effort[level], `${at}.${level}`));
  checkSupportOrNull(effort['xhigh'], `${at}.xhigh`);
}

function checkThinking(value: unknown, at: string): void {
  const types = objectAt(checkSupport(value, at)['types'], `${at}.types`);
  checkSupport(types['adaptive'], `${at}.types.adaptive`);
  checkSupport(types['enabled'], `${at}.types.enabled`);
  if (types['disabled'] !== undefined) checkSupport(types['disabled'], `${at}.types.disabled`);
}

export function checkCapabilities(value: unknown, at: string): void {
  if (value === null) return;
  const capabilities = objectAt(value, at);
  FLAGS.forEach((flag) => checkSupport(capabilities[flag], `${at}.${flag}`));

  const contextAt = `${at}.context_management`;
  const contextManagement = checkSupport(capabilities['context_management'], contextAt);
  CONTEXT_STRATEGIES.forEach((key) => checkSupportOrNull(contextManagement[key], `${contextAt}.${key}`));

  checkEffort(capabilities['effort'], `${at}.effort`);
  checkThinking(capabilities['thinking'], `${at}.thinking`);
}
