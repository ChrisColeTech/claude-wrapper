/**
 * `accumulate(events) → Message` (spec section 11): the non-streaming response is built from the
 * turn stream the way the official SDK's accumulator builds `finalMessage()`. The SDK's own
 * `MessageStream` is the oracle.
 */
import { MessageStream } from '@anthropic-ai/sdk/lib/MessageStream';
import { accumulate } from '../../../../src/anthropic/respond';
import { ApiEvent } from '../../../../src/anthropic/translate';
import { MESSAGE_START, translate } from '../../../mocks/anthropic/turn-frames';
import { recordedFrames } from '../../../mocks/upstream/recordings';

/**
 * What the official SDK's `messages.stream(...).finalMessage()` makes of these events, less
 * `parsed_output`, which its client-side `parse()` helper adds (never a wire field).
 */
async function sdkFinalMessage(events: ApiEvent[]): Promise<unknown> {
  const body = new TextEncoder().encode(events.map(event => JSON.stringify(event)).join('\n') + '\n');
  const stream = new ReadableStream({ start(controller) { controller.enqueue(body); controller.close(); } });
  const { parsed_output: _clientSide, ...message } = await MessageStream.fromReadableStream(stream).finalMessage();
  return message;
}

const turnOf = (fixture: string): ApiEvent[] => translate(recordedFrames(fixture)) as ApiEvent[];

const toolUseEvents = (chunks: string[]): ApiEvent[] => [
  MESSAGE_START,
  { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'toolu_1', name: 'get', input: {} } },
  ...chunks.map(partial_json => ({ type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json } })),
  { type: 'content_block_stop', index: 0 },
  { type: 'message_delta', delta: { stop_reason: 'tool_use', stop_sequence: null }, usage: { output_tokens: 9 } },
  { type: 'message_stop' }
] as ApiEvent[];

describe('accumulate', () => {
  it('builds the c-partial message', () => {
    expect(accumulate(turnOf('cli-probes/c-partial.jsonl'))).toEqual({
      model: 'claude-fable-5-1',
      id: 'msg_011Cfh1i9VPzG7sVkum196Gp',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: '391' }],
      container: null,
      stop_reason: 'end_turn',
      stop_sequence: null,
      stop_details: null,
      usage: {
        input_tokens: 2,
        cache_creation_input_tokens: 6332,
        cache_read_input_tokens: 13985,
        cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 6332 },
        output_tokens: 3,
        service_tier: 'standard',
        inference_geo: 'not_available',
        output_tokens_details: { thinking_tokens: 0 }
      },
      diagnostics: null
    });
  });

  it.each(['c-partial', 'p1-empty-system-prompt', 't4-haiku-baseline', 't5-haiku-disable-thinking'])(
    "equals the official SDK's final message for %s",
    async (name) => {
      const events = turnOf(`cli-probes/${name}.jsonl`);

      expect(accumulate(events)).toEqual(await sdkFinalMessage(events));
    }
  );

  it("parses a tool_use block's input from its input_json_delta chunks, as the SDK does", async () => {
    const events = toolUseEvents(['', '{"city": "Par', 'is"}']);

    const message = accumulate(events);

    expect(message.content).toEqual([{ type: 'tool_use', id: 'toolu_1', name: 'get', input: { city: 'Paris' } }]);
    expect(message).toEqual(await sdkFinalMessage(events));
  });

  it('gives a tool_use block with no input chunks an empty input', () => {
    expect(accumulate(toolUseEvents([])).content).toEqual([{ type: 'tool_use', id: 'toolu_1', name: 'get', input: {} }]);
  });

  it('appends citations and keeps counters a message_delta leaves null', async () => {
    const citation = { type: 'char_location', cited_text: 'x', document_index: 0, start_char_index: 0, end_char_index: 1 };
    const events = [
      MESSAGE_START,
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '', citations: null } },
      { type: 'content_block_delta', index: 0, delta: { type: 'citations_delta', citation } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'x' } },
      { type: 'content_block_stop', index: 0 },
      { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null },
        usage: { output_tokens: 4, input_tokens: null } },
      { type: 'message_stop' }
    ] as ApiEvent[];

    const message = accumulate(events);

    expect(message.content).toEqual([{ type: 'text', text: 'x', citations: [citation] }]);
    expect(message.usage).toEqual({ input_tokens: 5, output_tokens: 4 });
    expect(message).toEqual(await sdkFinalMessage(events));
  });
});
