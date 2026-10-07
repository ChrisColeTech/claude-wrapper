/**
 * One run's hook policy (spec section 8): the wrapper's answer to each `PreToolUse` call upstream
 * makes on WebSearch or WebFetch, through the hook client and the control server's hook endpoint.
 * A search gets the request's domain list injected through `updatedInput` (upstream applies it
 * silently); a fetch's URL is checked against the list; the call after `max_uses` allowed ones is
 * denied with `max_uses_exceeded`, a URL outside the list with `url_not_allowed`, each reason
 * opening with the code, which the turn's result block carries. Anything it cannot read, or a
 * built-in the request did not enable, is denied: the gate fails closed. Every decision is kept
 * by `tool_use_id`, for the translator's result blocks and the run's audit.
 */
import { logger as wrapperLogger } from '../../utils/logger';
import { Frame } from '../frames';
import { auditFrame, AuditState } from './audit';
import { onDomainList, parseUrl } from './domains';
import { DenialCode, HookPolicySpec, isWebTool, WebTool, WebToolLimits } from './types';

export interface HookPolicyLogger {
  debug(message: string, context?: unknown): void;
  error(message: string, context?: unknown): void;
}

export interface HookPolicyOptions {
  /** Defaults to the wrapper's logger; never given a call's input. */
  logger?: HookPolicyLogger;
  /** Added to every line it logs (the run's id). */
  context?: object;
}

/** What the hook client prints for upstream: no decision (`{}`), new input, or a denial. */
export type HookReply = Record<string, unknown>;

export interface HookPolicy {
  /** The hook endpoint's handler: upstream's hook input in, the hook's reply out. */
  decide(input: unknown): HookReply;
  /** The code the hook denied this call with; undefined for a call it let through or never saw. */
  denialOf(toolUseId: string): DenialCode | undefined;
  /** A new turn of the run (a parked run resumed): `max_uses` counts afresh, as per request. */
  startTurn(): void;
  /** Sees every frame of the run: logs denials it did not issue, and web calls that bypassed it. */
  onFrame(frame: Frame): void;
}

interface ToolCall {
  tool: WebTool;
  id: string;
  input: Record<string, unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function callOf(input: unknown): ToolCall | undefined {
  if (!isRecord(input) || typeof input['tool_name'] !== 'string' || typeof input['tool_use_id'] !== 'string') return undefined;
  if (!isRecord(input['tool_input'])) return undefined;
  return { tool: input['tool_name'] as WebTool, id: input['tool_use_id'], input: input['tool_input'] };
}

const deny = (code: DenialCode, detail: string): HookReply => ({
  hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: `${code}: ${detail}` }
});

const DEFAULT_LOGGER: HookPolicyLogger = {
  debug: (message, context) => wrapperLogger.debug(message, context),
  error: (message, context) => wrapperLogger.error(message, undefined, context)
};

class RunHookPolicy implements HookPolicy {
  private readonly uses = new Map<WebTool, number>();
  private readonly audit: AuditState = { decided: new Map(), webCalls: new Set() };

  constructor(private readonly spec: HookPolicySpec, private readonly logger: HookPolicyLogger) {}

  decide(input: unknown): HookReply {
    const call = callOf(input);
    if (!call) return deny('invalid_tool_input', 'the hook input is not a tool call');
    const limits = isWebTool(call.tool) ? this.spec[call.tool] : undefined;
    const [code, reply] = limits ? this.judge(call, limits) : this.refuse(call);
    this.audit.decided.set(call.id, code);
    this.logger.debug('Web tool call decided by the hook', { tool: call.tool, toolUseId: call.id, denied: code ?? false });
    return reply;
  }

  denialOf(toolUseId: string): DenialCode | undefined {
    return this.audit.decided.get(toolUseId) ?? undefined;
  }

  startTurn(): void {
    this.uses.clear();
  }

  onFrame(frame: Frame): void {
    auditFrame(frame, this.audit, this.logger);
  }

  private refuse(call: ToolCall): [DenialCode, HookReply] {
    return ['unavailable', deny('unavailable', `${call.tool} is not enabled for this request`)];
  }

  private judge(call: ToolCall, limits: WebToolLimits): [DenialCode | null, HookReply] {
    const used = this.uses.get(call.tool) ?? 0;
    if (limits.maxUses !== undefined && used >= limits.maxUses) {
      const times = limits.maxUses === 1 ? 'time' : 'times';
      return ['max_uses_exceeded', deny('max_uses_exceeded', `${call.tool} may be used at most ${limits.maxUses} ${times} in this request`)];
    }
    const refusal = call.tool === 'WebFetch' ? this.urlRefusal(call, limits) : undefined;
    if (refusal) return refusal;
    this.uses.set(call.tool, used + 1);
    return [null, call.tool === 'WebSearch' ? withDomainList(call, limits) : {}];
  }

  private urlRefusal(call: ToolCall, { allowedDomains, blockedDomains }: WebToolLimits): [DenialCode, HookReply] | undefined {
    if (!allowedDomains && !blockedDomains) return undefined;
    const url = parseUrl(call.input['url']);
    if (!url) return ['invalid_tool_input', deny('invalid_tool_input', 'the url is not a valid URL')];
    if (allowedDomains && !onDomainList(url, allowedDomains)) {
      return ['url_not_allowed', deny('url_not_allowed', `${url.hostname} is not an allowed domain`)];
    }
    if (blockedDomains && onDomainList(url, blockedDomains)) {
      return ['url_not_allowed', deny('url_not_allowed', `${url.hostname} is a blocked domain`)];
    }
    return undefined;
  }
}

/** The model's input with the request's list added, or no decision when there is no list. */
function withDomainList(call: ToolCall, { allowedDomains, blockedDomains }: WebToolLimits): HookReply {
  if (!allowedDomains && !blockedDomains) return {};
  const list = allowedDomains ? { allowed_domains: allowedDomains } : { blocked_domains: blockedDomains };
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput: { ...call.input, ...list } } };
}

export function createHookPolicy(spec: HookPolicySpec, options: HookPolicyOptions = {}): HookPolicy {
  const { logger = DEFAULT_LOGGER, context = {} } = options;
  return new RunHookPolicy(spec, {
    debug: (message, extra) => logger.debug(message, { ...context, ...(extra as object) }),
    error: (message, extra) => logger.error(message, { ...context, ...(extra as object) })
  });
}
