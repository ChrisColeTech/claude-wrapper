/**
 * The connector blocks in a replayed turn's history (spec sections 5 and 9): `mcp_tool_use` as
 * `<mcp_tool_use server="…" name="…">{input JSON}</mcp_tool_use>`, `mcp_tool_result` as
 * `<mcp_tool_result tool_use_id="…" is_error="…">…</mcp_tool_result>` holding its text. Replayed
 * blocks are taken exactly as sent. The expected text is written out by hand from the spec.
 */
import { NormalisedMessage } from '../../../../src/anthropic/request';
import { renderReplay } from '../../../../src/anthropic/request/render-replay';

const text = (value: string) => ({ type: 'text', text: value });
const user = (...content: object[]) => ({ role: 'user', content }) as NormalisedMessage;
const assistant = (...content: object[]) => ({ role: 'assistant', content }) as NormalisedMessage;

const OPENING = '<conversation_history>\n' +
  'These are the earlier turns of this conversation, and the assistant turns in it are your own replies.\n';

const historyOf = (...blocks: object[]): unknown => {
  const rendered = renderReplay([user(text('Check the docs.')), assistant(...blocks), user(text('And?'))]);
  return (rendered.content[0] as { text?: string }).text;
};
const assistantTurn = (body: string) =>
  `${OPENING}<turn role="user">\nCheck the docs.\n</turn>\n<turn role="assistant">\n${body}</turn>\n</conversation_history>`;

describe('renderReplay: connector calls in earlier turns (spec sections 5, 9)', () => {
  it('renders a call with its server and input, its result text, and the answer', () => {
    const rendered = historyOf(
      { type: 'mcp_tool_use', id: 'toolu_1', name: 'search', server_name: 'docs "v2"', input: { q: 'a & b' } },
      { type: 'mcp_tool_result', tool_use_id: 'toolu_1', is_error: false, content: [text('first hit'), text('second hit')] },
      text('Found two.')
    );

    expect(rendered).toBe(assistantTurn(
      '<mcp_tool_use server="docs &quot;v2&quot;" name="search">{"q":"a & b"}</mcp_tool_use>\n' +
      '<mcp_tool_result tool_use_id="toolu_1" is_error="false">first hit\nsecond hit</mcp_tool_result>\n' +
      'Found two.\n'
    ));
  });

  it('renders a string result, an error, and fields the client left out', () => {
    const rendered = historyOf(
      { type: 'mcp_tool_use', id: 'toolu_1', name: 'fetch', server_name: 'docs' },
      { type: 'mcp_tool_result', tool_use_id: 'toolu_1', is_error: true, content: 'timed out' },
      { type: 'mcp_tool_result', tool_use_id: 'toolu_2' }
    );

    expect(rendered).toBe(assistantTurn(
      '<mcp_tool_use server="docs" name="fetch">{}</mcp_tool_use>\n' +
      '<mcp_tool_result tool_use_id="toolu_1" is_error="true">timed out</mcp_tool_result>\n' +
      '<mcp_tool_result tool_use_id="toolu_2" is_error="false"></mcp_tool_result>\n'
    ));
  });
});
