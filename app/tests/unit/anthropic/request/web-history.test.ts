/**
 * The web tools' blocks in a replayed turn's history (spec section 5): `server_tool_use` as
 * `<web_search query="…"/>` or `<web_fetch url="…"/>`, `web_search_tool_result` as
 * `<web_search_results>` with one `title: url` line per result or `<web_search_error code="…"/>`,
 * `web_fetch_tool_result` as `<web_fetch_result>` holding the document text. Replayed blocks are
 * taken exactly as sent: `encrypted_content` is never read, missing fields never fail the turn.
 * The expected messages are written out by hand from the spec's description.
 */
import { SurfaceError } from '../../../../src/anthropic/http/surface-error';
import { NormalisedMessage, TurnPlan } from '../../../../src/anthropic/request';
import { renderReplay } from '../../../../src/anthropic/request/render-replay';
import { planDefault } from '../../../mocks/anthropic/plan-context';

const text = (value: string) => ({ type: 'text', text: value });
const user = (...content: object[]) => ({ role: 'user', content }) as NormalisedMessage;
const assistant = (...content: object[]) => ({ role: 'assistant', content }) as NormalisedMessage;

const OPENING = '<conversation_history>\n' +
  'These are the earlier turns of this conversation, and the assistant turns in it are your own replies.\n';

const historyOf = (...blocks: object[]): unknown => {
  const rendered = renderReplay([user(text('Look it up.')), assistant(...blocks), user(text('And?'))]);
  return (rendered.content[0] as { text?: string }).text;
};
const assistantTurn = (body: string) =>
  `${OPENING}<turn role="user">\nLook it up.\n</turn>\n<turn role="assistant">\n${body}</turn>\n</conversation_history>`;

describe('renderReplay: the web tools in earlier turns (spec sections 5, 8)', () => {
  it('renders a search, its results one title: url line each, and the answer', () => {
    const rendered = historyOf(
      { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'oslo "weather" & wind' } },
      { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: [
        { type: 'web_search_result', url: 'https://yr.no/oslo', title: 'Oslo <forecast>', encrypted_content: 'opaque', page_age: null },
        { type: 'web_search_result', url: 'https://met.no/', title: 'MET Norway', encrypted_content: 'tampered!' }
      ] },
      text('It is windy.')
    );

    expect(rendered).toBe(assistantTurn(
      '<web_search query="oslo &quot;weather&quot; &amp; wind"/>\n' +
      '<web_search_results>\nOslo <forecast>: https://yr.no/oslo\nMET Norway: https://met.no/\n</web_search_results>\n' +
      'It is windy.\n'
    ));
  });

  it('renders a search error and an empty result list', () => {
    const rendered = historyOf(
      { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'a' } },
      { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: { type: 'web_search_tool_result_error', error_code: 'max_uses_exceeded' } },
      { type: 'server_tool_use', id: 'srvtoolu_2', name: 'web_search', input: { query: 'b' } },
      { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_2', content: [] }
    );

    expect(rendered).toBe(assistantTurn(
      '<web_search query="a"/>\n<web_search_error code="max_uses_exceeded"/>\n' +
      '<web_search query="b"/>\n<web_search_results>\n</web_search_results>\n'
    ));
  });

  it('renders a fetch with the document text it returned, and a fetch error', () => {
    const rendered = historyOf(
      { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_fetch', input: { url: 'https://example.com/?a=1&b=2' } },
      { type: 'web_fetch_tool_result', tool_use_id: 'srvtoolu_1', content: {
        type: 'web_fetch_result', url: 'https://example.com/', retrieved_at: '2026-10-07T12:00:00Z',
        content: { type: 'document', source: { type: 'text', media_type: 'text/plain', data: 'Example Domain <h1>' }, title: null }
      } },
      { type: 'server_tool_use', id: 'srvtoolu_2', name: 'web_fetch', input: { url: 'https://iana.org/' } },
      { type: 'web_fetch_tool_result', tool_use_id: 'srvtoolu_2', content: { type: 'web_fetch_tool_result_error', error_code: 'url_not_allowed' } }
    );

    expect(rendered).toBe(assistantTurn(
      '<web_fetch url="https://example.com/?a=1&amp;b=2"/>\n<web_fetch_result>\nExample Domain <h1>\n</web_fetch_result>\n' +
      '<web_fetch url="https://iana.org/"/>\n<web_fetch_error code="url_not_allowed"/>\n'
    ));
  });

  it('places a fetched PDF as a real document block inside the result', () => {
    const pdf = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'JVBERi0xLjQ=' }, title: null };
    const rendered = renderReplay([
      user(text('Fetch it.')),
      assistant({ type: 'web_fetch_tool_result', tool_use_id: 'srvtoolu_1',
        content: { type: 'web_fetch_result', url: 'https://example.com/a.pdf', content: pdf } }),
      user(text('Summarise.'))
    ]);

    expect(rendered.content).toEqual([
      text(`${OPENING}<turn role="user">\nFetch it.\n</turn>\n<turn role="assistant">\n<web_fetch_result>\n`),
      pdf,
      text('\n</web_fetch_result>\n</turn>\n</conversation_history>'),
      text('Summarise.')
    ]);
  });

  it('takes replayed blocks as sent, missing fields included', () => {
    const rendered = historyOf(
      { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search' },
      { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: [{ type: 'web_search_result' }] },
      { type: 'web_fetch_tool_result', tool_use_id: 'srvtoolu_2', content: { type: 'web_fetch_tool_result_error' } }
    );

    expect(rendered).toBe(assistantTurn(
      '<web_search query=""/>\n<web_search_results>\n: \n</web_search_results>\n<web_fetch_error code=""/>\n'
    ));
  });

  it('answers 400 for a server tool the surface does not serve, rather than dropping it', () => {
    const render = () => historyOf({ type: 'server_tool_use', id: 'srvtoolu_1', name: 'code_execution', input: { code: 'x' } });

    expect(render).toThrow(SurfaceError);
    expect(render).toThrow('messages: server_tool_use blocks named "code_execution" in earlier turns are not supported');
  });

  it('plans a replayed turn whose history holds the blocks a web search turn returned', () => {
    const plan = planDefault({ model: 'opus', max_tokens: 64, tools: [{ type: 'web_search_20250305', name: 'web_search' }], messages: [
      { role: 'user', content: 'Search.' },
      { role: 'assistant', content: [
        { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'q' } },
        { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: [] }, text('None found.')
      ] },
      { role: 'user', content: 'Try again.' }
    ] }) as TurnPlan;

    expect(plan.continuation).toEqual({ replay: { role: 'user', content: [
      text(assistantTurn('<web_search query="q"/>\n<web_search_results>\n</web_search_results>\nNone found.\n')
        .replace('Look it up.', 'Search.')),
      text('Try again.')
    ] } });
  });
});
