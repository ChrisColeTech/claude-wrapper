/**
 * Renderer goldens (spec section 5): a replayed turn is one user message that opens with the
 * `<conversation_history>` block of `<turn>` children (text verbatim, `tool_use` and
 * `tool_result` as their tags, thinking dropped, images inside a tool result as real blocks),
 * carrying the one sentence that says whose turns they are, then the final user message's blocks
 * verbatim, except its `tool_result` blocks: upstream holds no call they answer (a fresh run has
 * no `tool_use` of its own) and the API rejects an orphan result, so they are rendered as their
 * tags. The expected messages are written out by hand from the spec's description.
 */
import { SurfaceError } from '../../../../src/anthropic/http/surface-error';
import { NormalisedMessage } from '../../../../src/anthropic/request';
import { renderReplay } from '../../../../src/anthropic/request/render-replay';

const text = (value: string) => ({ type: 'text', text: value });
const user = (...content: object[]) => ({ role: 'user', content }) as NormalisedMessage;
const assistant = (...content: object[]) => ({ role: 'assistant', content }) as NormalisedMessage;

const OPENING = '<conversation_history>\n' +
  'These are the earlier turns of this conversation, and the assistant turns in it are your own replies.\n';
const IMAGE = { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgo=' } };

describe('renderReplay', () => {
  it("sends a lone user message's blocks verbatim, with no history block", () => {
    const blocks = [{ ...text('Hi'), cache_control: { type: 'ephemeral' } }, IMAGE];

    expect(renderReplay([user(...blocks)])).toEqual({ role: 'user', content: blocks });
  });

  it('renders a text conversation, then the final message verbatim', () => {
    const rendered = renderReplay([
      user(text('My name is Sam.')),
      assistant(text('Nice to meet you, Sam.')),
      user(text('What is my name?'))
    ]);

    expect(rendered).toEqual({
      role: 'user',
      content: [
        {
          type: 'text',
          text: OPENING +
            '<turn role="user">\nMy name is Sam.\n</turn>\n' +
            '<turn role="assistant">\nNice to meet you, Sam.\n</turn>\n' +
            '</conversation_history>'
        },
        { type: 'text', text: 'What is my name?' }
      ]
    });
  });

  it('puts each block of a turn on its own line, text verbatim, and drops thinking', () => {
    const rendered = renderReplay([
      user(text('Two lines:\n  one\n  two'), text('<b>raw & as sent</b>')),
      assistant({ type: 'thinking', thinking: 'Hmm.', signature: 'c2ln' }, text('Noted.'),
        { type: 'redacted_thinking', data: 'ZGF0YQ==' }),
      user(text('Go on.'))
    ]);

    expect(rendered.content[0]).toEqual({
      type: 'text',
      text: OPENING +
        '<turn role="user">\nTwo lines:\n  one\n  two\n<b>raw & as sent</b>\n</turn>\n' +
        '<turn role="assistant">\nNoted.\n</turn>\n' +
        '</conversation_history>'
    });
  });

  it('renders tool calls and their results as tags, input as JSON', () => {
    const rendered = renderReplay([
      user(text('Weather in Paris?')),
      assistant(text('Let me check.'),
        { type: 'tool_use', id: 'toolu_01', name: 'get_weather', input: { city: 'Paris', units: ['c'] } }),
      user({ type: 'tool_result', tool_use_id: 'toolu_01', content: '18 degrees, sunny' }),
      assistant(text('It is 18 degrees and sunny.')),
      user({ type: 'tool_result', tool_use_id: 'toolu_02', is_error: true, content: [text('city not found')] },
        text('Try Lyon.'))
    ]);

    expect(rendered).toEqual({
      role: 'user',
      content: [
        {
          type: 'text',
          text: OPENING +
            '<turn role="user">\nWeather in Paris?\n</turn>\n' +
            '<turn role="assistant">\nLet me check.\n' +
            '<tool_use id="toolu_01" name="get_weather">{"city":"Paris","units":["c"]}</tool_use>\n</turn>\n' +
            '<turn role="user">\n<tool_result tool_use_id="toolu_01" is_error="false">18 degrees, sunny</tool_result>\n' +
            '</turn>\n' +
            '<turn role="assistant">\nIt is 18 degrees and sunny.\n</turn>\n' +
            '</conversation_history>'
        },
        { type: 'text', text: '<tool_result tool_use_id="toolu_02" is_error="true">city not found</tool_result>' },
        { type: 'text', text: 'Try Lyon.' }
      ]
    });
  });

  it("renders the final message's tool results as tags too, since upstream holds no call they answer", () => {
    const rendered = renderReplay([
      user(text('Screenshot?')),
      assistant({ type: 'tool_use', id: 'toolu_01', name: 'screenshot', input: {} }),
      user({ type: 'tool_result', tool_use_id: 'toolu_01', content: [text('Here:'), IMAGE] },
        { ...text('Describe it.'), cache_control: { type: 'ephemeral' } })
    ]);

    expect(rendered.content.slice(1)).toEqual([
      { type: 'text', text: '<tool_result tool_use_id="toolu_01" is_error="false">Here:\n' },
      IMAGE,
      { type: 'text', text: '</tool_result>' },
      { ...text('Describe it.'), cache_control: { type: 'ephemeral' } }
    ]);
  });

  it("renders a tool result's text blocks line by line and its images as real blocks in place", () => {
    const rendered = renderReplay([
      user(text('Screenshot?')),
      assistant({ type: 'tool_use', id: 'toolu_01', name: 'screenshot', input: {} }),
      user({ type: 'tool_result', tool_use_id: 'toolu_01', is_error: false,
        content: [text('Here it is:'), text('(800x600)'), IMAGE, text('Done.')] }),
      assistant(text('A login page.')),
      user(text('Thanks.'))
    ]);

    expect(rendered.content).toEqual([
      {
        type: 'text',
        text: OPENING +
          '<turn role="user">\nScreenshot?\n</turn>\n' +
          '<turn role="assistant">\n<tool_use id="toolu_01" name="screenshot">{}</tool_use>\n</turn>\n' +
          '<turn role="user">\n<tool_result tool_use_id="toolu_01" is_error="false">Here it is:\n(800x600)\n'
      },
      IMAGE,
      {
        type: 'text',
        text: '\nDone.</tool_result>\n</turn>\n' +
          '<turn role="assistant">\nA login page.\n</turn>\n' +
          '</conversation_history>'
      },
      { type: 'text', text: 'Thanks.' }
    ]);
  });

  it('renders a tool result without content as an empty tag', () => {
    const rendered = renderReplay([
      user(text('Ping it.')),
      assistant({ type: 'tool_use', id: 'toolu_01', name: 'ping', input: {} }),
      user({ type: 'tool_result', tool_use_id: 'toolu_01' }),
      assistant(text('Pinged.')),
      user(text('Did it work?'))
    ]);

    expect((rendered.content[0] as { text: string }).text).toContain(
      '<turn role="user">\n<tool_result tool_use_id="toolu_01" is_error="false"></tool_result>\n</turn>\n');
  });

  it('escapes attribute values, never the text', () => {
    const rendered = renderReplay([
      user(text('a "quoted" <tag> & more')),
      assistant({ type: 'tool_use', id: 'toolu_"1"', name: 'f<&>', input: { q: '"x"' } }),
      user(text('Next.'))
    ]);

    expect((rendered.content[0] as { text: string }).text).toContain(
      '<turn role="user">\na "quoted" <tag> & more\n</turn>\n' +
      '<turn role="assistant">\n<tool_use id="toolu_&quot;1&quot;" name="f&lt;&amp;&gt;">{"q":"\\"x\\""}</tool_use>\n</turn>\n');
  });

  it('answers 400 naming a block kind the history cannot render yet, rather than dropping it', () => {
    const render = () => renderReplay([
      user(text('Search for it.')),
      assistant({ type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'x' } }),
      user(text('And?'))
    ]);

    expect(render).toThrow(SurfaceError);
    expect(render).toThrow('messages: server_tool_use blocks in earlier turns are not supported yet');
  });

  it('answers 400 naming a block kind inside a tool result the rendering cannot carry', () => {
    const render = () => renderReplay([
      user(text('Read it.')),
      assistant({ type: 'tool_use', id: 'toolu_1', name: 'read', input: {} }),
      user({ type: 'tool_result', tool_use_id: 'toolu_1', content: [{ type: 'search_result', source: 'x' }] }),
      assistant(text('Read.')),
      user(text('So?'))
    ]);

    expect(render).toThrow('messages: search_result blocks in a tool_result are not supported');
  });
});
