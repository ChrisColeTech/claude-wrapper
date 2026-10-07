/**
 * The stream translator (spec section 11): a run's frames in, the turn stream out. This file
 * covers a plain turn and thinking on recorded frames; `translator-edges.test.ts` covers what is
 * not relayed and `result`; `plain-goldens.test.ts` runs every plain fixture.
 */
import { recordedFrames } from '../../../mocks/upstream/recordings';
import { translate } from '../../../mocks/anthropic/turn-frames';

describe('translator: a plain turn', () => {
  it('turns the c-partial recording into the API event sequence with only API fields', () => {
    expect(translate(recordedFrames('cli-probes/c-partial.jsonl'))).toEqual([
      {
        type: 'message_start',
        message: {
          model: 'claude-fable-5-1',
          id: 'msg_011Cfh1i9VPzG7sVkum196Gp',
          type: 'message',
          role: 'assistant',
          content: [],
          container: null,
          stop_reason: null,
          stop_sequence: null,
          stop_details: null,
          usage: {
            input_tokens: 2,
            cache_creation_input_tokens: 6332,
            cache_read_input_tokens: 13985,
            cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 6332 },
            output_tokens: 1,
            service_tier: 'standard',
            inference_geo: 'not_available'
          },
          diagnostics: null
        }
      },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '391' } },
      { type: 'content_block_stop', index: 0 },
      {
        type: 'message_delta',
        delta: { stop_reason: 'end_turn', stop_sequence: null, stop_details: null, container: null },
        usage: {
          input_tokens: 2,
          cache_creation_input_tokens: 6332,
          cache_read_input_tokens: 13985,
          output_tokens: 3,
          output_tokens_details: { thinking_tokens: 0 }
        }
      },
      { type: 'message_stop' }
    ]);
  });

  it('logs each dropped field name at debug, once per turn', () => {
    const debug = jest.fn();

    translate(recordedFrames('cli-probes/c-partial.jsonl'), debug);

    const dropped = debug.mock.calls.map(([, context]) => (context as { field: string }).field).sort();
    expect(dropped).toEqual([
      'message_delta.context_management',
      'message_delta.delta.safeguard_results',
      'message_delta.usage.iterations',
      'message_start.message.context_management',
      'message_start.message.input_transformations'
    ]);
  });
});

describe('translator: thinking', () => {
  const events = translate(recordedFrames('cli-probes/p1-empty-system-prompt.jsonl'));
  const thinking = events.filter(event => 'index' in event && event.index === 0);
  const deltas = thinking.filter(event => event.type === 'content_block_delta');

  it('opens the block with empty thinking and signature', () => {
    expect(thinking[0]).toEqual({
      type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' }
    });
    expect(thinking[thinking.length - 1]).toEqual({ type: 'content_block_stop', index: 0 });
  });

  it('relays empty thinking deltas without estimated_tokens, then exactly one signature delta', () => {
    const emptyThinking = { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: '' } };

    expect(deltas.slice(0, -1)).toEqual(deltas.slice(0, -1).map(() => emptyThinking));
    expect(deltas[deltas.length - 1]).toEqual({
      type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: expect.stringMatching(/^CAQS/) }
    });
  });

  it('drops the system/thinking_tokens frames and keeps thinking_tokens in the usage details', () => {
    expect(events.map(event => event.type)).not.toContain('system');
    expect(events.find(event => event.type === 'message_delta')).toEqual(expect.objectContaining({
      usage: expect.objectContaining({ output_tokens: 149, output_tokens_details: { thinking_tokens: 79 } })
    }));
  });
});
