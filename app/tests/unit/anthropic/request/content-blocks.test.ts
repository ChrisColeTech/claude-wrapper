/**
 * What a message may carry (spec sections 4.2 and 4.3). Nothing is dropped silently: a `system`
 * message, a block upstream would drop or substitute, and a block the API rejects are each a 400
 * naming what was sent, at the client's own indices.
 */
import { SurfaceError } from '../../../../src/anthropic/surface-error';
import { invalidRequest, planDefault, rejectionOf } from '../../../mocks/anthropic/plan-context';

const VALID = { model: 'opus', max_tokens: 1024, messages: [{ role: 'user', content: 'Hello' }] };
const withMessages = (messages: unknown) => ({ ...VALID, messages });
const userBlocks = (...blocks: object[]) => withMessages([{ role: 'user', content: [{ type: 'text', text: 'Hi' }, ...blocks] }]);

describe('planTurn rejects a system message inside messages (spec section 4.2)', () => {
  it('names the message and points at the top-level system field', () => {
    const messages = [{ role: 'user', content: 'Hi' }, { role: 'system', content: 'Be terse.' }, { role: 'user', content: 'Hello' }];

    expect(rejectionOf(withMessages(messages))).toEqual(invalidRequest(
      'messages.1.role: "system" messages are not supported on this surface; use the top-level system field'
    ));
  });
});

const BASE64_IMAGE = { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgo=' } };
const PDF = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'JVBERi0=' } };
const notSupported = (path: string, what: string) => invalidRequest(`${path}: ${what} are not supported on this surface`);
const URL_REASON = ': upstream cannot download them; send the data as base64';
const FILE_REASON = ': there is no Files API';

/** The blocks pass: a plan, or a rejection naming no content block (the history stop-gap until conversation state). */
function expectBlocksAccepted(request: object): void {
  const result = planDefault(request);
  if (result instanceof SurfaceError) expect(result.message).not.toMatch(/^messages\.\d+\.content/);
}

describe('planTurn accepts the content blocks the surface serves (spec sections 4.2, 4.3)', () => {
  it('in a user message: text, base64 images, documents of every served source, and tool results', () => {
    const request = userBlocks(
      BASE64_IMAGE, PDF,
      { type: 'document', source: { type: 'text', media_type: 'text/plain', data: 'Plain' }, title: 'T', context: 'C',
        citations: { enabled: true } },
      { type: 'document', source: { type: 'content', content: [{ type: 'text', text: 'Part' }] } },
      { type: 'tool_result', tool_use_id: 'toolu_1', content: 'Sunny' },
      { type: 'tool_result', tool_use_id: 'toolu_2', content: [{ type: 'text', text: 'Rain' }, BASE64_IMAGE], is_error: false },
      { type: 'tool_result', tool_use_id: 'toolu_3' }
    );

    expect(planDefault(request)).not.toBeInstanceOf(SurfaceError);
  });

  it('in history: tool use, thinking and the server-tool and connector replay blocks, exactly as sent', () => {
    const assistant = [
      { type: 'thinking', thinking: '', signature: 'sig' }, { type: 'redacted_thinking', data: 'opaque' },
      { type: 'text', text: 'Looking.' }, { type: 'tool_use', id: 'toolu_1', name: 'get_weather', input: {} },
      { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'q' } },
      { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: [] },
      { type: 'web_fetch_tool_result', tool_use_id: 'srvtoolu_2', content: { type: 'web_fetch_tool_result_error' } },
      { type: 'mcp_tool_use', id: 'mcptoolu_1', name: 'echo', server_name: 'docs', input: {} },
      { type: 'mcp_tool_result', tool_use_id: 'mcptoolu_1', is_error: false, content: 'ok' }
    ];
    const messages = [
      { role: 'user', content: 'Hi' }, { role: 'assistant', content: assistant },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'Sunny' }] }
    ];

    expectBlocksAccepted(withMessages(messages));
  });
});

describe('planTurn rejects the content blocks the surface cannot serve, naming them (spec section 4.3)', () => {
  it.each([
    ['image', { type: 'url', url: 'https://example.com/a.png' }, `"image" blocks with a "url" source${URL_REASON}`],
    ['document', { type: 'url', url: 'https://example.com/a.pdf' }, `"document" blocks with a "url" source${URL_REASON}`],
    ['image', { type: 'file', file_id: 'file_011' }, `"image" blocks with a "file" source${FILE_REASON}`],
    ['document', { type: 'file', file_id: 'file_011' }, `"document" blocks with a "file" source${FILE_REASON}`],
    ['image', { type: 'bytes', data: 'x' }, '"image" blocks with a "bytes" source'],
    ['image', { type: 'text', media_type: 'text/plain', data: 'x' }, '"image" blocks with a "text" source']
  ])('%s with the source %p', (type, source, what) => {
    expect(rejectionOf(userBlocks({ type, source }))).toEqual(notSupported('messages.0.content.1', what));
  });

  it.each([
    ['search_result'], ['mcp_tool_listing'], ['tool_addition'], ['tool_removal'], ['container_upload'],
    ['code_execution_tool_result'], ['tool_search_tool_result'], ['compaction'], ['fallback'], ['input_audio']
  ])('%s blocks', (type) => {
    expect(rejectionOf(userBlocks({ type }))).toEqual(notSupported('messages.0.content.1', `"${type}" blocks`));
  });

  it('at the client’s own indices, before same-role messages merge', () => {
    const messages = [
      { role: 'user', content: 'Hi' }, { role: 'user', content: [{ type: 'text', text: 'a' }, { type: 'search_result' }] }
    ];

    expect(rejectionOf(withMessages(messages))).toEqual(notSupported('messages.1.content.1', '"search_result" blocks'));
  });

  it.each([['search_result'], ['document'], ['tool_reference'], ['browser_state'], ['input_audio']])(
    '%s blocks inside a tool_result',
    (type) => {
      const result = { type: 'tool_result', tool_use_id: 'toolu_1', content: [{ type: 'text', text: 'ok' }, { type }] };

      expect(rejectionOf(userBlocks(result))).toEqual(
        notSupported('messages.0.content.1.content.1', `"${type}" blocks inside a tool_result`)
      );
    }
  );

  it('url and file images inside a tool_result', () => {
    const image = (source: object) => ({ type: 'image', source });
    const result = (source: object) => ({ type: 'tool_result', tool_use_id: 'toolu_1', content: [image(source)] });

    expect(rejectionOf(userBlocks(result({ type: 'url', url: 'https://example.com/a.png' })))).toEqual(
      notSupported('messages.0.content.1.content.0', `"image" blocks with a "url" source${URL_REASON}`)
    );
    expect(rejectionOf(userBlocks(result({ type: 'file', file_id: 'file_011' })))).toEqual(
      notSupported('messages.0.content.1.content.0', `"image" blocks with a "file" source${FILE_REASON}`)
    );
  });

  it('checks the shape it reads: sources and tool_result content', () => {
    expect(rejectionOf(userBlocks({ type: 'image' }))).toEqual(invalidRequest('messages.0.content.1.source: Field required'));
    expect(rejectionOf(userBlocks({ type: 'document', source: 'https://example.com' }))).toEqual(
      invalidRequest('messages.0.content.1.source: Input should be a valid dictionary')
    );
    expect(rejectionOf(userBlocks({ type: 'image', source: {} }))).toEqual(
      invalidRequest('messages.0.content.1.source.type: Field required')
    );
    expect(rejectionOf(userBlocks({ type: 'tool_result', tool_use_id: 't', content: 7 }))).toEqual(
      invalidRequest('messages.0.content.1.content: Input should be a valid string or a list of content blocks')
    );
    expect(rejectionOf(userBlocks({ type: 'tool_result', tool_use_id: 't', content: ['ok'] }))).toEqual(
      invalidRequest('messages.0.content.1.content.0: Input should be a valid dictionary')
    );
    expect(rejectionOf(userBlocks({ type: 'tool_result', tool_use_id: 't', content: [{ text: 'ok' }] }))).toEqual(
      invalidRequest('messages.0.content.1.content.0.type: Field required')
    );
  });
});
