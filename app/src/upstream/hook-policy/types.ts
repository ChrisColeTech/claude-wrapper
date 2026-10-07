/**
 * The hook policy's types (spec sections 8 and 16): which of upstream's built-in web tools a run
 * enables and the limits the wrapper's `PreToolUse` hook enforces on each, decided per request.
 */

/** Upstream's built-in web tools, by the names upstream calls them. */
export type WebTool = 'WebSearch' | 'WebFetch';

export const WEB_TOOLS: readonly WebTool[] = ['WebSearch', 'WebFetch'];

export const isWebTool = (name: unknown): name is WebTool => name === 'WebSearch' || name === 'WebFetch';

/** One tool's limits, as the client declared them; absent means unlimited. */
export interface WebToolLimits {
  /** Calls allowed per turn; the next one is denied with `max_uses_exceeded`. */
  maxUses?: number;
  /** Only these domains (a search's results, a fetch's URL); suffix match on the host, a path narrows it. */
  allowedDomains?: readonly string[];
  /** Never these domains. A tool declares at most one of the two lists. */
  blockedDomains?: readonly string[];
}

/** The enabled built-ins, each with its limits. */
export type HookPolicySpec = { readonly [tool in WebTool]?: WebToolLimits };

/** The error codes the hook denies a call with; the turn's result block carries the same code. */
export type DenialCode = 'max_uses_exceeded' | 'url_not_allowed' | 'invalid_tool_input' | 'unavailable';
