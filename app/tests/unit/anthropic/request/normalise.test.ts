/**
 * Normalisation and the replayed-turn message (spec sections 4.2 and 5): string content becomes
 * one text block, consecutive same-role messages merge, and a single user message reaches
 * upstream as its blocks, verbatim.
 */
import { TurnPlan } from '../../../../src/anthropic/request';
import { normaliseMessages } from '../../../../src/anthropic/request/normalise';
import { planDefault } from '../../../mocks/anthropic/plan-context';

const plan = (messages: unknown) => planDefault({ model: 'opus', max_tokens: 100, messages }) as TurnPlan;

describe('planTurn: normalised messages and the replayed-turn message', () => {
  it('merges consecutive user messages into one, blocks in order, and replays them all', () => {
    const result = plan([
      { role: 'user', content: 'First.' },
      { role: 'user', content: [{ type: 'text', text: 'Second.' }, { type: 'text', text: 'Third.' }] }
    ]);

    const blocks = [{ type: 'text', text: 'First.' }, { type: 'text', text: 'Second.' }, { type: 'text', text: 'Third.' }];
    expect(result.messages).toEqual([{ role: 'user', content: blocks }]);
    expect(result.continuation).toEqual({ replay: { role: 'user', content: blocks } });
  });

  it('replays a single user message’s blocks verbatim, every field kept but cache_control (ignored-content.test.ts)', () => {
    const blocks = [
      { type: 'text', text: 'What is in this picture?' },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgo=' } },
      { type: 'text', text: '  spaced  ', citations: null }
    ];

    const result = plan([{ role: 'user', content: blocks }]);

    expect(result.messages).toEqual([{ role: 'user', content: blocks }]);
    expect(result.continuation).toEqual({ replay: { role: 'user', content: blocks } });
  });
});

describe('normaliseMessages', () => {
  it('turns string content into one text block and merges every run of same-role messages', () => {
    const normalised = normaliseMessages([
      { role: 'user', content: 'a' },
      { role: 'user', content: [{ type: 'text', text: 'b' }] },
      { role: 'assistant', content: 'c' },
      { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_1', name: 'f', input: {} }] },
      { role: 'user', content: 'e' }
    ]);

    expect(normalised).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'c' }, { type: 'tool_use', id: 'toolu_1', name: 'f', input: {} }] },
      { role: 'user', content: [{ type: 'text', text: 'e' }] }
    ]);
  });

  it('leaves the client’s own message objects unchanged', () => {
    const first = { role: 'user' as const, content: [{ type: 'text', text: 'a' }] };
    const second = { role: 'user' as const, content: [{ type: 'text', text: 'b' }] };

    normaliseMessages([first, second]);

    expect(first.content).toEqual([{ type: 'text', text: 'a' }]);
  });
});
