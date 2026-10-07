/**
 * The request contract through the official SDK (spec sections 4.1 to 4.4, 7, 8, 12, 13): a
 * sample of each class of rejection arrives as `BadRequestError` with the surface's message and
 * `x-should-retry: false`, before any run is spawned; the fields accepted and ignored plan a
 * normal turn whose response relays upstream's service tier and geography with `diagnostics: null`.
 */
import Anthropic from '@anthropic-ai/sdk';
import { createReplayRunner, ReplayRunner } from '../../../src/upstream/runner';
import { STATE } from '../../mocks/anthropic/plan-context';
import { envelopeOf, rejectionOf, SurfaceHarness, startSurface } from '../../mocks/anthropic/surface-harness';
import { loadRecording } from '../../mocks/upstream/recordings';

const P1 = 'cli-probes/p1-empty-system-prompt.jsonl';
const P6 = 'cli-probes/p6-resume-snapshot-off.jsonl';
const MODEL = 'claude-fable-5-1';
const BASE = { model: MODEL, max_tokens: 1024, messages: [{ role: 'user' as const, content: 'Who are you?' }] };
const userBlocks = (...blocks: object[]) =>
  ({ ...BASE, messages: [{ role: 'user', content: [{ type: 'text', text: 'Look.' }, ...blocks] }] }) as never;

describe('Anthropic surface: request validation through the SDK', () => {
  let surface: SurfaceHarness;
  let runner: ReplayRunner;

  async function serve(...fixtures: string[]): Promise<Anthropic> {
    runner = createReplayRunner(fixtures.map(loadRecording), { timeScale: 0 });
    surface = await startSurface({ runner, stateDirectory: STATE });
    return surface.client();
  }

  /** The request fails with `BadRequestError`, this message and no retry, and nothing is spawned. */
  async function expectBadRequest(request: Promise<unknown>, message: string): Promise<void> {
    const error = await rejectionOf(request);
    expect(error).toBeInstanceOf(Anthropic.BadRequestError);
    expect(envelopeOf(error).error).toEqual({ type: 'invalid_request_error', message });
    expect(error.headers?.get('x-should-retry')).toBe('false');
    expect(runner.started).toHaveLength(0);
  }

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await surface.close();
  });

  describe('body fields', () => {
    it.each([
      [{ temperature: 0 }, 'temperature: only 1.0 is supported on this surface; leave it out or send 1.0'],
      [{ top_p: 0.9 }, 'top_p: only values of 0.99 or more are supported on this surface; leave it out or send at least 0.99'],
      [{ top_k: 40 }, 'top_k: not supported on this surface; leave it out'],
      [{ container: 'container_011' }, 'container: containers are not supported on this surface'],
      [{ stop_sequences: [] }, 'stop_sequences: List should have at least 1 item after validation, not 0'],
      [{ stop_sequences: ['END'] }, 'stop_sequences: not supported on this surface yet'],
      [{ service_tier: 'priority' }, "service_tier: Input should be 'auto' or 'standard_only'"],
      [{ session_id: 'abc' }, 'session_id: Extra inputs are not permitted']
    ])('rejects %p', async (fields, message) => {
      const client = await serve(P1);

      await expectBadRequest(client.messages.create({ ...BASE, ...fields } as never), message);
    });

    it.each([
      [{ context_management: { edits: [{ type: 'clear_tool_uses_20250919' }] } }, 'context_management'],
      [{ speed: 'fast' }, 'speed'],
      [{ output_config: { task_budget: { type: 'tokens', total: 20000 } } }, 'output_config.task_budget']
    ])('rejects the beta client’s beta-only field %p with "Extra inputs are not permitted"', async (fields, path) => {
      const client = await serve(P1);

      await expectBadRequest(client.beta.messages.create({ ...BASE, ...fields } as never),
        `${path}: Extra inputs are not permitted`);
    });
  });

  describe('messages and content blocks', () => {
    it('rejects a system message inside messages', async () => {
      const client = await serve(P1);
      const messages = [{ role: 'user', content: 'Hi' }, { role: 'system', content: 'Be terse.' }];

      await expectBadRequest(client.messages.create({ ...BASE, messages } as never),
        'messages.1.role: "system" messages are not supported on this surface; use the top-level system field');
    });

    it.each([
      [{ type: 'image', source: { type: 'url', url: 'https://example.com/cat.png' } },
        '"image" blocks with a "url" source: upstream cannot download them; send the data as base64'],
      [{ type: 'document', source: { type: 'file', file_id: 'file_011' } },
        '"document" blocks with a "file" source: there is no Files API'],
      [{ type: 'search_result', source: 'https://example.com', title: 'T', content: [{ type: 'text', text: 'x' }] },
        '"search_result" blocks'],
      [{ type: 'mcp_tool_listing' }, '"mcp_tool_listing" blocks'],
      [{ type: 'tool_addition' }, '"tool_addition" blocks']
    ])('rejects %p naming the block', async (block, what) => {
      const client = await serve(P1);

      await expectBadRequest(client.messages.create(userBlocks(block)),
        `messages.0.content.1: ${what} are not supported on this surface`);
    });
  });

  describe('tools and tool_choice', () => {
    const TOOL = { name: 'get_weather', input_schema: { type: 'object' as const, properties: {} } };

    it.each([[{ type: 'any' as const }], [{ type: 'tool' as const, name: 'get_weather' }]])(
      'rejects tool_choice %p with the real API’s message',
      async (toolChoice) => {
        const client = await serve(P1);

        await expectBadRequest(client.messages.create({ ...BASE, tools: [TOOL], tool_choice: toolChoice }),
          'tool_choice: type "tool" and "any" are not supported for this model.');
      }
    );

    it('rejects a server tool the surface cannot serve, naming its type', async () => {
      const client = await serve(P1);
      const tools = [TOOL, { type: 'code_execution_20250825' as const, name: 'code_execution' as const }];

      await expectBadRequest(client.messages.create({ ...BASE, tools }),
        'tools.1: tool type "code_execution_20250825" is not supported on this surface');
    });

    it('rejects a web search tool carrying both domain lists', async () => {
      const client = await serve(P1);
      const search = { type: 'web_search_20250305' as const, name: 'web_search' as const,
        allowed_domains: ['example.com'], blocked_domains: ['example.org'] };

      await expectBadRequest(client.messages.create({ ...BASE, tools: [search] }),
        'tools.0: use either allowed_domains or blocked_domains, not both');
    });
  });

  describe('fields accepted and ignored', () => {
    it('plans a normal turn, without cache_control reaching upstream', async () => {
      const client = await serve(P1);

      const message = await client.messages.create({
        ...BASE,
        messages: [{ role: 'user', content: [{ type: 'text', text: 'Who are you?', cache_control: { type: 'ephemeral' } }] }],
        metadata: { user_id: 'user-7f3a' },
        service_tier: 'standard_only',
        inference_geo: 'eu',
        diagnostics: { previous_message_id: 'msg_013Uc6srznUEWyqAQcUdL59A' },
        cache_control: { type: 'ephemeral', ttl: '1h' },
        tool_choice: { type: 'auto', disable_parallel_tool_use: true },
        temperature: 1,
        top_p: 0.99
      });

      expect(message.stop_reason).toBe('end_turn');
      expect(runner.started[0]?.input[0]).toEqual(expect.objectContaining({
        message: { role: 'user', content: [{ type: 'text', text: 'Who are you?' }] }
      }));
      expect(JSON.stringify(runner.started[0]?.spec)).not.toContain('user-7f3a');
    });

    it('relays upstream’s service tier and inference geography, with diagnostics null', async () => {
      const client = await serve(P1);

      const message = await client.messages.create({ ...BASE, service_tier: 'auto', inference_geo: 'us' });

      expect(message.usage).toEqual(expect.objectContaining({ service_tier: 'standard', inference_geo: 'not_available' }));
      expect(message.diagnostics).toBeNull();
    });

    it('answers diagnostics null even where upstream reports its own cache diagnostics', async () => {
      const client = await serve(P6);

      const message = await client.messages.stream({
        ...BASE, diagnostics: { previous_message_id: 'msg_013Uc6srznUEWyqAQcUdL59A' }
      }).finalMessage();

      expect(message.diagnostics).toBeNull();
    });
  });
});
