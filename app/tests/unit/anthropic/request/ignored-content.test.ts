/**
 * Content accepted and ignored (spec sections 4.2 and 5): `cache_control` anywhere in a message
 * never reaches upstream, so a client moving its cache breakpoint between turns sends the same
 * conversation; `thinking` and `redacted_thinking` in history are dropped, since a continued turn
 * never needs them and a replayed turn cannot carry their signatures.
 */
import { TurnPlan, withoutIgnoredContent } from '../../../../src/anthropic/request';
import { planDefault } from '../../../mocks/anthropic/plan-context';

const plan = (messages: unknown) => planDefault({ model: 'opus', max_tokens: 100, messages }) as TurnPlan;
const EPHEMERAL = { type: 'ephemeral', ttl: '5m' };
const IMAGE_SOURCE = { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgo=' };

describe('planTurn ignores cache_control anywhere in messages', () => {
  const sent = [
    { type: 'text', text: 'Look.', cache_control: EPHEMERAL },
    { type: 'image', source: IMAGE_SOURCE, cache_control: EPHEMERAL },
    { type: 'document', source: { type: 'content', content: [{ type: 'text', text: 'Part', cache_control: EPHEMERAL }] },
      title: 'Notes', cache_control: EPHEMERAL },
    { type: 'tool_result', tool_use_id: 'toolu_1', cache_control: EPHEMERAL,
      content: [{ type: 'text', text: 'Sunny', cache_control: EPHEMERAL }, { type: 'image', source: IMAGE_SOURCE }] }
  ];
  const received = [
    { type: 'text', text: 'Look.' },
    { type: 'image', source: IMAGE_SOURCE },
    { type: 'document', source: { type: 'content', content: [{ type: 'text', text: 'Part' }] }, title: 'Notes' },
    { type: 'tool_result', tool_use_id: 'toolu_1',
      content: [{ type: 'text', text: 'Sunny' }, { type: 'image', source: IMAGE_SOURCE }] }
  ];

  it('removes it from every block upstream receives, inside tool results and content documents too', () => {
    const result = plan([{ role: 'user', content: sent }]);

    expect(result.messages).toEqual([{ role: 'user', content: received }]);
    expect(result.continuation).toEqual({ replay: { role: 'user', content: received } });
  });

  it('plans the same turn with and without breakpoints', () => {
    expect(plan([{ role: 'user', content: sent }])).toEqual(plan([{ role: 'user', content: received }]));
  });

  it('leaves the client’s own blocks unchanged', () => {
    const block = { type: 'text', text: 'Look.', cache_control: EPHEMERAL };

    plan([{ role: 'user', content: [block] }]);

    expect(block).toEqual({ type: 'text', text: 'Look.', cache_control: EPHEMERAL });
  });
});

describe('thinking and redacted_thinking in history are dropped', () => {
  it('drops them from every message, keeping the other blocks in order', () => {
    const assistant = [
      { type: 'thinking', thinking: '', signature: 'EqQBCkYIBxgCKkA' }, { type: 'text', text: 'Calling.' },
      { type: 'redacted_thinking', data: 'EmwKAhgBEgy3va3pzix' }, { type: 'tool_use', id: 'toolu_1', name: 'f', input: {} }
    ];

    expect(withoutIgnoredContent([
      { role: 'user', content: 'Hi' }, { role: 'assistant', content: assistant }, { role: 'user', content: 'Go on.' }
    ])).toEqual([
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: [{ type: 'text', text: 'Calling.' }, { type: 'tool_use', id: 'toolu_1', name: 'f', input: {} }] },
      { role: 'user', content: 'Go on.' }
    ]);
  });

  it('removes an assistant message left empty, so the user messages around it merge', () => {
    const result = plan([
      { role: 'user', content: 'Think hard.' },
      { role: 'assistant', content: [{ type: 'thinking', thinking: '', signature: 'EqQBCkYIBxgCKkA' }] },
      { role: 'user', content: 'Now answer.' }
    ]);

    expect(result.messages).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'Think hard.' }, { type: 'text', text: 'Now answer.' }] }
    ]);
  });
});
