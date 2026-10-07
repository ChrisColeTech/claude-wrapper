/**
 * One run's hook policy (spec section 8): the wrapper's answer to each `PreToolUse` call upstream
 * makes on WebSearch or WebFetch, through the hook client and the control server's hook endpoint.
 * A search gets the request's domain list injected through `updatedInput` (upstream applies it
 * silently); a fetch's URL is checked against the list; the call after `max_uses` allowed ones is
 * denied with `max_uses_exceeded`, a URL outside the list with `url_not_allowed`, each reason
 * opening with the code, which the turn's result block carries. A fetch runs on the wrapper's
 * machine, so unless the operator turned it off a URL whose host is not public (an address, or a
 * name resolved as the call is decided) is denied with `url_not_allowed` too. Anything it cannot
 * read, or a built-in the request did not enable, is denied: the gate fails closed. Every decision
 * is kept by `tool_use_id`, for the translator's result blocks and the run's audit.
 */
import { isObject } from '../../utils/json-object';
import { withContext } from '../../utils/log-context';
import { logger as wrapperLogger, Logger } from '../../utils/logger';
import { Frame } from '../frames';
import { auditFrame, AuditState } from './audit';
import { onDomainList, parseUrl } from './domains';
import { nonPublicHost, resolveWithSystem, WebFetchReach } from './public-host';
import { DenialCode, HookPolicySpec, isWebTool, WebTool, WebToolLimits } from './types';

export interface HookPolicyOptions {
  /** Defaults to the wrapper's logger; never given a call's input. */
  logger?: Pick<Logger, 'debug' | 'error'>;
  /** Added to every line it logs (the run's id). */
  context?: object;
  /** Where a WebFetch may go; defaults to public hosts only, names resolved by the system resolver. */
  webFetchReach?: WebFetchReach;
}

/** What the hook client prints for upstream: no decision (`{}`), new input, or a denial. */
export type HookReply = Record<string, unknown>;

export interface HookPolicy {
  /** The hook endpoint's handler: upstream's hook input in, the hook's reply out. */
  decide(input: unknown): Promise<HookReply>;
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

function callOf(input: unknown): ToolCall | undefined {
  if (!isObject(input) || typeof input['tool_name'] !== 'string' || typeof input['tool_use_id'] !== 'string') return undefined;
  if (!isObject(input['tool_input'])) return undefined;
  return { tool: input['tool_name'] as WebTool, id: input['tool_use_id'], input: input['tool_input'] };
}

const deny = (code: DenialCode, detail: string): HookReply => ({
  hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: `${code}: ${detail}` }
});

/** A decision: the denial code (null when let through) and the reply. */
type Verdict = [DenialCode | null, HookReply];
type Refusal = [DenialCode, HookReply];

const INVALID_URL: Refusal = ['invalid_tool_input', deny('invalid_tool_input', 'the url is not a valid URL')];

class RunHookPolicy implements HookPolicy {
  private readonly uses = new Map<WebTool, number>();
  private readonly audit: AuditState = { decided: new Map(), webCalls: new Set() };

  constructor(
    private readonly spec: HookPolicySpec, private readonly reach: WebFetchReach, private readonly logger: Pick<Logger, 'debug' | 'error'>
  ) {}

  async decide(input: unknown): Promise<HookReply> {
    const call = callOf(input);
    if (!call) return deny('invalid_tool_input', 'the hook input is not a tool call');
    const limits = isWebTool(call.tool) ? this.spec[call.tool] : undefined;
    const [code, reply] = limits ? await this.judge(call, limits) : this.refuse(call);
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

  private refuse(call: ToolCall): Refusal {
    return ['unavailable', deny('unavailable', `${call.tool} is not enabled for this request`)];
  }

  private async judge(call: ToolCall, limits: WebToolLimits): Promise<Verdict> {
    const refusal = this.overMaxUses(call, limits) ?? await this.fetchRefusal(call, limits);
    // The fetch's host check awaited: a call decided meanwhile may have taken the last use.
    const verdict = refusal ?? this.overMaxUses(call, limits);
    if (verdict) return verdict;
    this.uses.set(call.tool, (this.uses.get(call.tool) ?? 0) + 1);
    return [null, call.tool === 'WebSearch' ? withDomainList(call, limits) : {}];
  }

  /** A fetch outside the request's lists, or off the operator's network. */
  private async fetchRefusal(call: ToolCall, limits: WebToolLimits): Promise<Refusal | undefined> {
    if (call.tool !== 'WebFetch') return undefined;
    return this.urlRefusal(call, limits) ?? this.reachRefusal(call);
  }

  private overMaxUses(call: ToolCall, { maxUses }: WebToolLimits): Refusal | undefined {
    if (maxUses === undefined || (this.uses.get(call.tool) ?? 0) < maxUses) return undefined;
    const times = maxUses === 1 ? 'time' : 'times';
    return ['max_uses_exceeded', deny('max_uses_exceeded', `${call.tool} may be used at most ${maxUses} ${times} in this request`)];
  }

  /** A fetch off the operator's network: a URL whose host is not public, unless the operator allowed any. */
  private async reachRefusal(call: ToolCall): Promise<Refusal | undefined> {
    if (!this.reach.publicOnly) return undefined;
    const url = parseUrl(call.input['url']);
    if (!url) return INVALID_URL;
    const reason = await nonPublicHost(url, this.reach.resolveHost);
    return reason === undefined ? undefined : ['url_not_allowed', deny('url_not_allowed', reason)];
  }

  private urlRefusal(call: ToolCall, { allowedDomains, blockedDomains }: WebToolLimits): Refusal | undefined {
    if (!allowedDomains && !blockedDomains) return undefined;
    const url = parseUrl(call.input['url']);
    if (!url) return INVALID_URL;
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
  const { logger = wrapperLogger, context = {}, webFetchReach = { publicOnly: true, resolveHost: resolveWithSystem } } = options;
  return new RunHookPolicy(spec, webFetchReach, withContext(logger, context));
}
