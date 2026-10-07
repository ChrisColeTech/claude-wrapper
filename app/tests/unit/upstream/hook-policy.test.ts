/**
 * The hook policy (spec section 8): what the wrapper's `PreToolUse` hook answers upstream for each
 * WebSearch and WebFetch call. The inputs are the hook probes' recorded stdin; the replies the
 * probes printed (verified upstream: `updatedInput` applies the list silently, a deny reaches the
 * model as an error result) are the oracle for the reply shape.
 */
import { createHookPolicy, HookPolicy } from '../../../src/upstream/hook-policy';
import { frameOf, resultFrame } from '../../mocks/anthropic/turn-frames';
import { recordedHookCalls } from '../../mocks/upstream/hook-recordings';

const searchCalls = recordedHookCalls('s-websearch-allowed-then-deny');
const blockedCalls = recordedHookCalls('s-websearch-blocked-allow');
const fetchCalls = recordedHookCalls('s-webfetch-hostlist');

const deny = (reason: string) => ({
  hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason }
});
const quietLogger = () => ({ debug: jest.fn(), error: jest.fn() });
const policyFor = (spec: Parameters<typeof createHookPolicy>[0], logger = quietLogger()): HookPolicy =>
  createHookPolicy(spec, { logger });

describe('hook policy: WebSearch (spec section 8)', () => {
  it("injects the request's allowed_domains through updatedInput, in the reply upstream applied", () => {
    const policy = policyFor({ WebSearch: { allowedDomains: ['github.com'] } });
    const [first] = searchCalls;

    expect(policy.decide(first?.stdin)).toEqual(first?.reply);
  });

  it("injects blocked_domains the same way, keeping the model's input", () => {
    const policy = policyFor({ WebSearch: { blockedDomains: ['github.com'] } });
    const [first] = blockedCalls;

    expect(policy.decide(first?.stdin)).toEqual({ hookSpecificOutput: { hookEventName: 'PreToolUse',
      updatedInput: { ...first?.stdin.tool_input, blocked_domains: ['github.com'] } } });
  });

  it('has no decision to report for a search without lists or limits', () => {
    expect(policyFor({ WebSearch: {} }).decide(searchCalls[0]?.stdin)).toEqual({});
  });

  it('denies the call after max_uses with max_uses_exceeded, and remembers the denial by tool_use_id', () => {
    const policy = policyFor({ WebSearch: { maxUses: 1, allowedDomains: ['github.com'] } });
    const [first, second] = searchCalls;

    policy.decide(first?.stdin);
    const reply = policy.decide(second?.stdin);

    expect(reply).toEqual(deny('max_uses_exceeded: WebSearch may be used at most 1 time in this request'));
    expect(policy.denialOf(String(second?.stdin.tool_use_id))).toBe('max_uses_exceeded');
    expect(policy.denialOf(String(first?.stdin.tool_use_id))).toBeUndefined();
  });

  it('counts uses per turn: a resuming turn may use the tool max_uses times again', () => {
    const policy = policyFor({ WebSearch: { maxUses: 1 } });
    const [first, second] = searchCalls;

    policy.decide(first?.stdin);
    policy.startTurn();

    expect(policy.decide(second?.stdin)).toEqual({});
  });
});

describe('hook policy: WebFetch (spec section 8)', () => {
  const [allowed, outside] = fetchCalls;

  it('lets a URL on an allowed domain through with no decision', () => {
    expect(policyFor({ WebFetch: { allowedDomains: ['example.com'] } }).decide(allowed?.stdin)).toEqual({});
  });

  it('denies a URL outside allowed_domains with url_not_allowed', () => {
    const policy = policyFor({ WebFetch: { allowedDomains: ['example.com'] } });

    expect(policy.decide(outside?.stdin)).toEqual(deny('url_not_allowed: www.iana.org is not an allowed domain'));
    expect(policy.denialOf(String(outside?.stdin.tool_use_id))).toBe('url_not_allowed');
  });

  it('denies a URL on a blocked domain, subdomains included', () => {
    const policy = policyFor({ WebFetch: { blockedDomains: ['iana.org'] } });

    expect(policy.decide(outside?.stdin)).toEqual(deny('url_not_allowed: www.iana.org is a blocked domain'));
    expect(policy.decide(allowed?.stdin)).toEqual({});
  });

  it.each([
    [['example.com'], 'https://example.com/', true],
    [['example.com'], 'https://docs.example.com/a', true],
    [['example.com'], 'https://notexample.com/', false],
    [['EXAMPLE.com'], 'https://Example.COM/x', true],
    [['example.com/docs'], 'https://example.com/docs/intro', true],
    [['example.com/docs'], 'https://example.com/blog', false],
    [['example.com/docs/*'], 'https://example.com/docs/a/b', true]
  ])('allowed_domains %p and %s: allowed %p', (allowedDomains, url, passes) => {
    const policy = policyFor({ WebFetch: { allowedDomains } });
    const input = { ...allowed?.stdin, tool_input: { url, prompt: 'Summarise.' } };

    expect(policy.decide(input)).toEqual(passes ? {} : expect.objectContaining({
      hookSpecificOutput: expect.objectContaining({ permissionDecision: 'deny' })
    }));
  });

  it('denies a URL it cannot read under a domain list with invalid_tool_input', () => {
    const policy = policyFor({ WebFetch: { allowedDomains: ['example.com'] } });
    const input = { ...allowed?.stdin, tool_input: { url: 'not a url', prompt: 'x' } };

    expect(policy.decide(input)).toEqual(deny('invalid_tool_input: the url is not a valid URL'));
  });

  it('counts max_uses only on calls it let through', () => {
    const policy = policyFor({ WebFetch: { maxUses: 1, allowedDomains: ['example.com'] } });

    policy.decide(outside?.stdin);

    expect(policy.decide(allowed?.stdin)).toEqual({});
  });
});

describe('hook policy: anything else is denied (fail closed)', () => {
  it('denies a built-in the request did not enable', () => {
    expect(policyFor({ WebSearch: {} }).decide(fetchCalls[0]?.stdin))
      .toEqual(deny('unavailable: WebFetch is not enabled for this request'));
  });

  it.each([[undefined], ['text'], [{ tool_name: 'WebSearch' }], [{ tool_name: 'WebSearch', tool_use_id: 'toolu_1' }]])(
    'denies an input it cannot read: %p', (input) => {
      expect(policyFor({ WebSearch: {} }).decide(input)).toEqual(deny('invalid_tool_input: the hook input is not a tool call'));
    }
  );
});

describe('hook policy: auditing the run (spec section 8)', () => {
  const deniedId = String(searchCalls[1]?.stdin.tool_use_id);
  const denial = { tool_name: 'WebSearch', tool_use_id: deniedId, tool_input: searchCalls[1]?.stdin.tool_input };

  it("logs nothing when result.permission_denials holds only the hook's own denials", () => {
    const logger = quietLogger();
    const policy = policyFor({ WebSearch: { maxUses: 1 } }, logger);
    searchCalls.forEach(call => policy.decide(call.stdin));

    policy.onFrame(resultFrame({ permission_denials: [denial] }));

    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs a denial the hook did not issue as a misconfiguration, without its input', () => {
    const logger = quietLogger();
    const policy = policyFor({ WebSearch: {} }, logger);

    policy.onFrame(resultFrame({ permission_denials: [denial] }));

    expect(logger.error).toHaveBeenCalledWith(
      "Upstream denied a tool call the wrapper's hook did not: the run is misconfigured", undefined,
      { toolName: 'WebSearch', toolUseId: deniedId }
    );
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('version number');
  });

  it("does not log the denial of a connector tool the request did not allow (spec section 9's own permission rule)", () => {
    const logger = quietLogger();
    const policy = policyFor({ WebSearch: {} }, logger);

    policy.onFrame(resultFrame({ permission_denials: [{ tool_name: 'mcp__docs__delete_page', tool_use_id: 'toolu_x', tool_input: {} }] }));

    expect(logger.error).not.toHaveBeenCalled();
  });

  it("logs a web tool call whose result arrived without the hook's decision", () => {
    const logger = quietLogger();
    const policy = policyFor({ WebSearch: {} }, logger);
    const call = { type: 'tool_use', id: 'toolu_unhooked', name: 'WebSearch', input: { query: 'q' } };

    policy.onFrame(frameOf({ type: 'assistant', parent_tool_use_id: null,
      message: { id: 'msg_1', model: 'claude-fable-5-1', content: [call] } }));
    policy.onFrame(frameOf({ type: 'user', parent_tool_use_id: null,
      message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_unhooked', content: 'results' }] } }));

    expect(logger.error).toHaveBeenCalledWith(
      "A web tool call ran without the wrapper's hook: its limits were not enforced", undefined, { toolUseId: 'toolu_unhooked' }
    );
  });
});
