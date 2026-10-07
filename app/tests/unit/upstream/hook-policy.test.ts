/**
 * The hook policy (spec section 8): what the wrapper's `PreToolUse` hook answers upstream for each
 * WebSearch and WebFetch call. The inputs are the hook probes' recorded stdin; the replies the
 * probes printed (verified upstream: `updatedInput` applies the list silently, a deny reaches the
 * model as an error result) are the oracle for the reply shape. A WebFetch may reach only public
 * addresses unless the operator turned that off; host names are resolved by a table here, never
 * by DNS.
 */
import { createHookPolicy, HookPolicy, ResolveHost } from '../../../src/upstream/hook-policy';
import { frameOf, resultFrame } from '../../mocks/anthropic/turn-frames';
import { recordedHookCalls } from '../../mocks/upstream/hook-recordings';

const searchCalls = recordedHookCalls('s-websearch-allowed-then-deny');
const blockedCalls = recordedHookCalls('s-websearch-blocked-allow');
const fetchCalls = recordedHookCalls('s-webfetch-hostlist');

const deny = (reason: string) => ({
  hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason }
});
const quietLogger = () => ({ debug: jest.fn(), error: jest.fn() });

const PUBLIC_ADDRESS = '93.184.215.14';
/** Resolves the names in `table`; any other name to a public address; `unresolvable.example` fails. */
const resolverOf = (table: Record<string, string[]> = {}) => jest.fn<Promise<string[]>, [string]>(async (host) => {
  if (host === 'unresolvable.example') throw new Error(`getaddrinfo ENOTFOUND ${host}`);
  return table[host] ?? [PUBLIC_ADDRESS];
});
const policyFor = (
  spec: Parameters<typeof createHookPolicy>[0], logger = quietLogger(), resolveHost: ResolveHost = resolverOf()
): HookPolicy => createHookPolicy(spec, { logger, webFetchReach: { publicOnly: true, resolveHost } });

describe('hook policy: WebSearch (spec section 8)', () => {
  it("injects the request's allowed_domains through updatedInput, in the reply upstream applied", async () => {
    const policy = policyFor({ WebSearch: { allowedDomains: ['github.com'] } });
    const [first] = searchCalls;

    expect(await policy.decide(first?.stdin)).toEqual(first?.reply);
  });

  it("injects blocked_domains the same way, keeping the model's input", async () => {
    const policy = policyFor({ WebSearch: { blockedDomains: ['github.com'] } });
    const [first] = blockedCalls;

    expect(await policy.decide(first?.stdin)).toEqual({ hookSpecificOutput: { hookEventName: 'PreToolUse',
      updatedInput: { ...first?.stdin.tool_input, blocked_domains: ['github.com'] } } });
  });

  it('has no decision to report for a search without lists or limits', async () => {
    expect(await policyFor({ WebSearch: {} }).decide(searchCalls[0]?.stdin)).toEqual({});
  });

  it('denies the call after max_uses with max_uses_exceeded, and remembers the denial by tool_use_id', async () => {
    const policy = policyFor({ WebSearch: { maxUses: 1, allowedDomains: ['github.com'] } });
    const [first, second] = searchCalls;

    await policy.decide(first?.stdin);
    const reply = await policy.decide(second?.stdin);

    expect(reply).toEqual(deny('max_uses_exceeded: WebSearch may be used at most 1 time in this request'));
    expect(policy.denialOf(String(second?.stdin.tool_use_id))).toBe('max_uses_exceeded');
    expect(policy.denialOf(String(first?.stdin.tool_use_id))).toBeUndefined();
  });

  it('counts uses per turn: a resuming turn may use the tool max_uses times again', async () => {
    const policy = policyFor({ WebSearch: { maxUses: 1 } });
    const [first, second] = searchCalls;

    await policy.decide(first?.stdin);
    policy.startTurn();

    expect(await policy.decide(second?.stdin)).toEqual({});
  });
});

describe('hook policy: WebFetch (spec section 8)', () => {
  const [allowed, outside] = fetchCalls;

  it('lets a URL on an allowed domain through with no decision', async () => {
    expect(await policyFor({ WebFetch: { allowedDomains: ['example.com'] } }).decide(allowed?.stdin)).toEqual({});
  });

  it('denies a URL outside allowed_domains with url_not_allowed', async () => {
    const policy = policyFor({ WebFetch: { allowedDomains: ['example.com'] } });

    expect(await policy.decide(outside?.stdin)).toEqual(deny('url_not_allowed: www.iana.org is not an allowed domain'));
    expect(policy.denialOf(String(outside?.stdin.tool_use_id))).toBe('url_not_allowed');
  });

  it('denies a URL on a blocked domain, subdomains included', async () => {
    const policy = policyFor({ WebFetch: { blockedDomains: ['iana.org'] } });

    expect(await policy.decide(outside?.stdin)).toEqual(deny('url_not_allowed: www.iana.org is a blocked domain'));
    expect(await policy.decide(allowed?.stdin)).toEqual({});
  });

  it.each([
    [['example.com'], 'https://example.com/', true],
    [['example.com'], 'https://docs.example.com/a', true],
    [['example.com'], 'https://notexample.com/', false],
    [['EXAMPLE.com'], 'https://Example.COM/x', true],
    [['example.com/docs'], 'https://example.com/docs/intro', true],
    [['example.com/docs'], 'https://example.com/blog', false],
    [['example.com/docs/*'], 'https://example.com/docs/a/b', true]
  ])('allowed_domains %p and %s: allowed %p', async (allowedDomains, url, passes) => {
    const policy = policyFor({ WebFetch: { allowedDomains } });
    const input = { ...allowed?.stdin, tool_input: { url, prompt: 'Summarise.' } };

    expect(await policy.decide(input)).toEqual(passes ? {} : expect.objectContaining({
      hookSpecificOutput: expect.objectContaining({ permissionDecision: 'deny' })
    }));
  });

  it('denies a URL it cannot read under a domain list with invalid_tool_input', async () => {
    const policy = policyFor({ WebFetch: { allowedDomains: ['example.com'] } });
    const input = { ...allowed?.stdin, tool_input: { url: 'not a url', prompt: 'x' } };

    expect(await policy.decide(input)).toEqual(deny('invalid_tool_input: the url is not a valid URL'));
  });

  it('counts max_uses only on calls it let through', async () => {
    const policy = policyFor({ WebFetch: { maxUses: 1, allowedDomains: ['example.com'] } });

    await policy.decide(outside?.stdin);

    expect(await policy.decide(allowed?.stdin)).toEqual({});
  });
});

describe("hook policy: WebFetch stays off the operator's network (spec section 8)", () => {
  const [allowed] = fetchCalls;
  const fetchOf = (url: string) => ({ ...allowed?.stdin, tool_input: { url, prompt: 'Summarise.' } });
  const notPublic = (detail: string) => deny(`url_not_allowed: ${detail}`);

  it.each([
    ['http://127.0.0.1:8080/admin', '127.0.0.1 is not a public address'],
    ['http://169.254.169.254/latest/meta-data/', '169.254.169.254 is not a public address'],
    ['http://10.1.2.3/', '10.1.2.3 is not a public address'],
    ['http://192.168.1.1/', '192.168.1.1 is not a public address'],
    ['http://0.0.0.0:3000/', '0.0.0.0 is not a public address'],
    ['http://2130706433/', '127.0.0.1 is not a public address'],
    ['http://0x7f.1/', '127.0.0.1 is not a public address'],
    ['http://[::1]:8000/', '::1 is not a public address'],
    ['http://[::ffff:127.0.0.1]/', '::ffff:7f00:1 is not a public address'],
    ['http://[fd00::5]/', 'fd00::5 is not a public address'],
    ['http://[fe80::1]/', 'fe80::1 is not a public address'],
    ['http://localhost:3000/', 'localhost is not a public address'],
    ['http://LOCALHOST./', 'localhost is not a public address'],
    ['https://app.localhost/', 'app.localhost is not a public address']
  ])('denies %s with url_not_allowed, without resolving anything', async (url, detail) => {
    const resolveHost = resolverOf();
    const policy = policyFor({ WebFetch: {} }, quietLogger(), resolveHost);

    expect(await policy.decide(fetchOf(url))).toEqual(notPublic(detail));
    expect(policy.denialOf(String(allowed?.stdin.tool_use_id))).toBe('url_not_allowed');
    expect(resolveHost).not.toHaveBeenCalled();
  });

  it.each([
    ['https://intranet.example/', ['10.0.0.5']],
    ['https://metadata.example/', ['169.254.169.254']],
    ['https://mixed.example/', [PUBLIC_ADDRESS, '192.168.0.10']],
    ['https://ula.example/', ['2606:4700::1111', 'fd12::1']],
    ['https://mapped.example/', ['::ffff:127.0.0.1']]
  ])('denies %s, a name that resolves to any non-public address', async (url, addresses) => {
    const host = new URL(url).hostname;
    const resolveHost = resolverOf({ [host]: addresses });
    const policy = policyFor({ WebFetch: {} }, quietLogger(), resolveHost);

    expect(await policy.decide(fetchOf(url))).toEqual(notPublic(`${host} resolves to an address that is not public`));
    expect(resolveHost).toHaveBeenCalledWith(host);
  });

  it('lets a name that resolves only to public addresses through with no decision', async () => {
    const resolveHost = resolverOf({ 'example.com': [PUBLIC_ADDRESS, '2606:2800:21f:cb07:6820:80da:af6b:8b2c'] });

    expect(await policyFor({ WebFetch: {} }, quietLogger(), resolveHost).decide(allowed?.stdin)).toEqual({});
    expect(resolveHost).toHaveBeenCalledWith('example.com');
  });

  it('denies a name it cannot resolve (fail closed)', async () => {
    expect(await policyFor({ WebFetch: {} }).decide(fetchOf('https://unresolvable.example/page')))
      .toEqual(notPublic('unresolvable.example could not be resolved to check that it is public'));
  });

  it.each([['file:///etc/passwd', 'file:'], ['ftp://ftp.example.com/x', 'ftp:']])(
    'denies %s: only http and https URLs are fetched', async (url, scheme) => {
      expect(await policyFor({ WebFetch: {} }).decide(fetchOf(url))).toEqual(notPublic(`${scheme} URLs are not fetched`));
    }
  );

  it('denies a URL it cannot read with invalid_tool_input, with no domain list', async () => {
    expect(await policyFor({ WebFetch: {} }).decide(fetchOf('not a url')))
      .toEqual(deny('invalid_tool_input: the url is not a valid URL'));
  });

  it('checks the domain lists first: a URL outside allowed_domains is never resolved', async () => {
    const resolveHost = resolverOf();
    const policy = policyFor({ WebFetch: { allowedDomains: ['example.com'] } }, quietLogger(), resolveHost);

    expect(await policy.decide(fetchOf('https://other.example/'))).toEqual(notPublic('other.example is not an allowed domain'));
    expect(resolveHost).not.toHaveBeenCalled();
  });

  it('does not count a fetch it denied towards max_uses', async () => {
    const policy = policyFor({ WebFetch: { maxUses: 1 } });

    await policy.decide(fetchOf('http://127.0.0.1/'));

    expect(await policy.decide(allowed?.stdin)).toEqual({});
  });

  it('allows max_uses calls in all when they are decided at once, each waiting on its resolution', async () => {
    let answer: (addresses: string[]) => void = () => undefined;
    const slow = new Promise<string[]>(resolve => { answer = resolve; });
    const policy = policyFor({ WebFetch: { maxUses: 1 } }, quietLogger(), () => slow);
    const call = (id: string) => ({ ...allowed?.stdin, tool_use_id: id });

    const replies = Promise.all([policy.decide(call('toolu_a')), policy.decide(call('toolu_b'))]);
    answer([PUBLIC_ADDRESS]);

    expect(await replies).toEqual([{}, deny('max_uses_exceeded: WebFetch may be used at most 1 time in this request')]);
  });

  it('never resolves for WebSearch, which runs at Anthropic', async () => {
    const resolveHost = resolverOf();

    expect(await policyFor({ WebSearch: {} }, quietLogger(), resolveHost).decide(searchCalls[0]?.stdin)).toEqual({});
    expect(resolveHost).not.toHaveBeenCalled();
  });

  it('lets a fetch reach any address when the operator turned the block off', async () => {
    const policy = createHookPolicy({ WebFetch: {} }, { logger: quietLogger(), webFetchReach: { publicOnly: false } });

    expect(await policy.decide(fetchOf('http://127.0.0.1:8080/admin'))).toEqual({});
    expect(await policy.decide(fetchOf('http://[::1]/'))).toEqual({});
  });
});

describe('hook policy: anything else is denied (fail closed)', () => {
  it('denies a built-in the request did not enable', async () => {
    expect(await policyFor({ WebSearch: {} }).decide(fetchCalls[0]?.stdin))
      .toEqual(deny('unavailable: WebFetch is not enabled for this request'));
  });

  it.each([[undefined], ['text'], [{ tool_name: 'WebSearch' }], [{ tool_name: 'WebSearch', tool_use_id: 'toolu_1' }]])(
    'denies an input it cannot read: %p', async (input) => {
      expect(await policyFor({ WebSearch: {} }).decide(input)).toEqual(deny('invalid_tool_input: the hook input is not a tool call'));
    }
  );
});

describe('hook policy: auditing the run (spec section 8)', () => {
  const deniedId = String(searchCalls[1]?.stdin.tool_use_id);
  const denial = { tool_name: 'WebSearch', tool_use_id: deniedId, tool_input: searchCalls[1]?.stdin.tool_input };

  it("logs nothing when result.permission_denials holds only the hook's own denials", async () => {
    const logger = quietLogger();
    const policy = policyFor({ WebSearch: { maxUses: 1 } }, logger);
    for (const call of searchCalls) await policy.decide(call.stdin);

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
