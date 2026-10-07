/**
 * The hook policy (spec sections 8 and 16): the limits the wrapper's `PreToolUse` hook enforces
 * on upstream's built-in web tools, kept in the wrapper beside the bridge, never in the hook script.
 */
export { createHookPolicy } from './hook-policy';
export type { HookPolicy, HookPolicyLogger, HookPolicyOptions, HookReply } from './hook-policy';
export { isWebTool, WEB_TOOLS } from './types';
export type { DenialCode, HookPolicySpec, WebTool, WebToolLimits } from './types';
