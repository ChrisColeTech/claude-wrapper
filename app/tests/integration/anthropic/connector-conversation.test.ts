/**
 * Connector turns in a conversation (spec sections 5 and 9). The answer the client got, its
 * `mcp_tool_use` and `mcp_tool_result` blocks included, echoed back with one new user message is
 * a continued turn: the next run resumes upstream's session and receives only the new message,
 * with the connectors mounted again (`mcp_servers` is run-bound, passed on every run). A history
 * the surface did not serve is a replayed turn, the connector blocks rendered into it.
 */
import Anthropic from '@anthropic-ai/sdk';
import { createReplayRunner, ReplayRunner } from '../../../src/upstream/runner';
import { connectorRequest, MCP_BETA, RECORDED_MODEL, ROUND_TRIP } from '../../mocks/anthropic/connector-recordings';
import { STATE } from '../../mocks/anthropic/plan-context';
import { memorySessions, TestSessions } from '../../mocks/anthropic/sessions';
import { SurfaceHarness, startSurface } from '../../mocks/anthropic/surface-harness';
import { loadRecording, recordedStdout } from '../../mocks/upstream/recordings';
import { waitFor } from '../../mocks/shared/wait-for';

const HOSTS = 'CLAUDE_WRAPPER_CONNECTOR_HOSTS';
const SESSION = (recordedStdout(ROUND_TRIP) as { type: string; session_id?: string }[]).find(frame => frame.type === 'result')?.session_id;

type BetaParams = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;
type Messages = BetaParams['messages'];

const params = (messages: Messages): BetaParams =>
  ({ model: RECORDED_MODEL, max_tokens: 1024, betas: [MCP_BETA], messages, ...connectorRequest('deepwiki') }) as unknown as BetaParams;

const flagValue = (flags: readonly string[], flag: string) => flags[flags.indexOf(flag) + 1];

describe('Anthropic surface: connector turns in a conversation', () => {
  let surface: SurfaceHarness;
  let runner: ReplayRunner;
  let state: TestSessions;

  beforeEach(async () => {
    process.env[HOSTS] = '*';
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    runner = createReplayRunner([loadRecording(ROUND_TRIP), loadRecording(ROUND_TRIP)], { timeScale: 0 });
    state = memorySessions();
    surface = await startSurface({ runner, sessions: state.sessions, stateDirectory: STATE });
  });

  afterEach(async () => {
    delete process.env[HOSTS];
    await surface.close();
  });

  const opening: Messages = [{ role: 'user', content: 'What does the wiki of the MCP TypeScript SDK cover?' }];

  it('continues the session after an answer carrying the MCP blocks, the connector mounted again', async () => {
    const first = await surface.client().beta.messages.create(params(opening));
    await waitFor(() => state.recorded.length === 1);
    await surface.client().beta.messages.create(params([
      ...opening, { role: 'assistant', content: first.content as Anthropic.Beta.Messages.BetaContentBlockParam[] },
      { role: 'user', content: 'Thanks. And the Python SDK?' }
    ]));
    const { spec, input } = runner.started[1]!;

    expect(first.content.map(block => block.type)).toEqual(['text', 'mcp_tool_use', 'mcp_tool_result', 'text']);
    expect(flagValue(spec.flags, '--resume')).toBe(SESSION);
    expect(JSON.parse(spec.runDir?.files['mcp-config.json'] ?? '{}').mcpServers).toHaveProperty('deepwiki');
    expect(input[0]).toEqual(expect.objectContaining({
      message: { role: 'user', content: [{ type: 'text', text: 'Thanks. And the Python SDK?' }] }
    }));
  });

  it('replays a history it did not serve with the connector blocks rendered into it', async () => {
    await surface.client().beta.messages.create(params([
      ...opening,
      { role: 'assistant', content: [
        { type: 'mcp_tool_use', id: 'toolu_x', name: 'read_wiki_structure', server_name: 'deepwiki', input: { repoName: 'acme/sdk' } },
        { type: 'mcp_tool_result', tool_use_id: 'toolu_x', is_error: false, content: [{ type: 'text', text: 'Overview; Transports' }] },
        { type: 'text', text: 'It covers the overview and the transports.' }
      ] },
      { role: 'user', content: 'And the Python SDK?' }
    ]));
    const { spec, input } = runner.started[0]!;
    const sent = (input[0] as { message: { content: { text?: string }[] } }).message.content[0]?.text ?? '';

    expect(spec.flags).not.toContain('--resume');
    expect(sent).toContain('<mcp_tool_use server="deepwiki" name="read_wiki_structure">{"repoName":"acme/sdk"}</mcp_tool_use>');
    expect(sent).toContain('<mcp_tool_result tool_use_id="toolu_x" is_error="false">Overview; Transports</mcp_tool_result>');
  });
});
