/**
 * Golden request to plan (spec sections 4, 6, 10, 16): a text-only request becomes the resolved
 * model, the normalised messages, the system prompt, a run spec carrying the whole spawn contract,
 * the replayed-turn message and the startup checks. The expected plans are written out from the
 * spec's tables, never derived from the planner.
 */
import { planTurn, TurnPlan } from '../../../../src/anthropic/request';
import { loadAnthropicSettings } from '../../../../src/config/anthropic-settings';
import { NO_SESSIONS, planDefault as plan, runContext, shippedCatalogue } from '../../../mocks/anthropic/plan-context';

const HELLO = [{ type: 'text', text: 'Hello' }];

/**
 * The plan for `{model, max_tokens: 1024, messages: [{role: 'user', content: 'Hello'}]}`. Haiku
 * 4.5 thinks by default upstream where the real API does not, so its run switches thinking off.
 */
function goldenPlan(canonicalId: string): TurnPlan {
  const thinking = canonicalId === 'claude-haiku-4-5-20251001' ? { CLAUDE_CODE_DISABLE_THINKING: '1' } : {};
  return {
    model: expect.objectContaining({ id: canonicalId, type: 'model' }),
    messages: [{ role: 'user', content: HELLO }],
    system: '',
    runSpec: {
      flags: [
        '-p',
        '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
        '--system-prompt', '',
        '--system-prompt-snapshot', 'off',
        '--setting-sources=', '--strict-mcp-config',
        '--model', canonicalId,
        '--tools', '',
        '--allowedTools', '',
        '--permission-mode', 'default', '--permission-prompts', 'none',
        '--max-turns', '25'
      ],
      env: {
        HOME: '/home/operator',
        PATH: '/usr/local/bin:/usr/bin',
        LANG: 'en_US.UTF-8',
        CLAUDE_CODE_MAX_OUTPUT_TOKENS: '1024',
        CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT: '660000',
        MCP_TOOL_TIMEOUT: '660000',
        MCP_CONNECT_TIMEOUT_MS: '5000',
        CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION: '200',
        ...thinking
      },
      cwd: '/var/lib/claude-wrapper/cwd',
      runDir: { path: '/var/lib/claude-wrapper/runs/run-0001', files: {} },
      timers: { startup: 20_000, stall: 90_000, lifetime: 1_800_000 }
    },
    continuation: { replay: { role: 'user', content: HELLO } },
    translatorConfig: { stopSequences: [], structuredOutput: false },
    startupChecks: { model: canonicalId, tools: [] }
  };
}

describe('planTurn: golden request to plan', () => {
  it.each([
    ['claude-fable-5-1', 'claude-fable-5-1'],
    ['fable', 'claude-fable-5-1'],
    ['claude-opus-5-5', 'claude-opus-5-5'],
    ['opus', 'claude-opus-5-5'],
    ['claude-sonnet-5-5', 'claude-sonnet-5-5'],
    ['sonnet', 'claude-sonnet-5-5'],
    ['claude-haiku-4-5-20251001', 'claude-haiku-4-5-20251001'],
    ['haiku', 'claude-haiku-4-5-20251001'],
    ['claude-haiku-4-5', 'claude-haiku-4-5-20251001']
  ])('plans a replayed text turn for %s as %s', (name, canonicalId) => {
    const request = { model: name, max_tokens: 1024, messages: [{ role: 'user', content: 'Hello' }] };

    expect(plan(request)).toEqual(goldenPlan(canonicalId));
  });

  it.each(['fable', 'opus', 'sonnet', 'haiku'])(
    'never passes the flags the spec rules out, nor the per-run files a text turn does not need (%s)',
    (model) => {
      const request = { model, max_tokens: 10, system: 'Be brief.', messages: [{ role: 'user', content: 'Hello' }] };

      const { runSpec } = plan(request) as TurnPlan;

      for (const flag of [
        '--fallback-model', '--max-budget-usd', '--append-system-prompt', '--bare', '--dangerously-skip-permissions',
        '--exclude-dynamic-system-prompt-sections', '--mcp-config', '--settings', '--resume', '--effort', '--json-schema',
        '--no-session-persistence', '--safe-mode', '--disable-slash-commands'
      ]) {
        expect(runSpec.flags).not.toContain(flag);
      }
      expect(runSpec).not.toHaveProperty('mcp');
      expect(runSpec).not.toHaveProperty('hooks');
      expect(runSpec.runDir?.files).toEqual({});
    }
  );
});

describe('planTurn: system prompt (spec section 6)', () => {
  const request = (system?: unknown) => ({
    model: 'opus',
    max_tokens: 1024,
    messages: [{ role: 'user', content: 'Hello' }],
    ...(system === undefined ? {} : { system })
  });
  const systemFlag = (result: unknown) => {
    const { flags } = (result as TurnPlan).runSpec;
    return flags[flags.indexOf('--system-prompt') + 1];
  };

  it('passes a string system exactly as the system prompt, with no preamble', () => {
    const system = 'You are terse.\n\n  Keep "quotes" and $VARS; -- and leading dashes too.';

    const result = plan(request(system));

    expect(result).toEqual(expect.objectContaining({ system }));
    expect(systemFlag(result)).toBe(system);
  });

  it('joins system text blocks with a blank line', () => {
    const result = plan(request([
      { type: 'text', text: 'First rule.' },
      { type: 'text', text: 'Second rule.', cache_control: { type: 'ephemeral' } }
    ]));

    expect(result).toEqual(expect.objectContaining({ system: 'First rule.\n\nSecond rule.' }));
    expect(systemFlag(result)).toBe('First rule.\n\nSecond rule.');
  });

  it('passes the empty string when system is absent, null or an empty list', () => {
    expect(systemFlag(plan(request()))).toBe('');
    expect(systemFlag(plan(request(null)))).toBe('');
    expect(systemFlag(plan(request([])))).toBe('');
  });
});

describe('planTurn: operator settings and the state directory (spec sections 10, 14, 15)', () => {
  it('takes --max-turns, the timers and the park TTL behind the MCP timeouts from the settings', () => {
    const settings = loadAnthropicSettings({
      CLAUDE_WRAPPER_MAX_TURNS: '7',
      CLAUDE_WRAPPER_PARK_TTL_MS: '120000',
      CLAUDE_WRAPPER_STARTUP_TIMEOUT_MS: '1000',
      CLAUDE_WRAPPER_STALL_TIMEOUT_MS: '2000',
      CLAUDE_WRAPPER_RUN_LIFETIME_MS: '3000'
    });
    const request = { model: 'haiku', max_tokens: 64, messages: [{ role: 'user', content: 'Hello' }] };

    const { runSpec } = planTurn(request, shippedCatalogue, NO_SESSIONS, runContext({ settings })) as TurnPlan;

    expect(runSpec.flags.slice(-2)).toEqual(['--max-turns', '7']);
    expect(runSpec.timers).toEqual({ startup: 1000, stall: 2000, lifetime: 3000 });
    expect(runSpec.env).toEqual(expect.objectContaining({
      CLAUDE_CODE_MAX_OUTPUT_TOKENS: '64', CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT: '180000', MCP_TOOL_TIMEOUT: '180000'
    }));
  });

  it('runs in the fixed working directory, with its own directory under the state directory', () => {
    const state = { cwd: '/srv/state/cwd', runs: '/srv/state/runs' };
    const request = { model: 'sonnet', max_tokens: 10, messages: [{ role: 'user', content: 'Hello' }] };

    const context = runContext({ state, runId: 'b7e1' });

    const { runSpec } = planTurn(request, shippedCatalogue, NO_SESSIONS, context) as TurnPlan;

    expect(runSpec.cwd).toBe('/srv/state/cwd');
    expect(runSpec.runDir).toEqual({ path: '/srv/state/runs/b7e1', files: {} });
  });
});
