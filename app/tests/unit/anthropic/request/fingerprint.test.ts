/**
 * The fingerprint (spec section 5, ADR 0002): a conversation's normalised transcript, hashed.
 * Two histories the real API reads alike have one fingerprint (same-role merge, string content,
 * thinking dropped, `cache_control` ignored, a `null` field the same as an absent one, key order);
 * any change to what was said gives another.
 */
import { fingerprint, NormalisedMessage } from '../../../../src/anthropic/request';

const text = (value: string) => ({ type: 'text', text: value });
const user = (...content: object[]) => ({ role: 'user', content }) as NormalisedMessage;
const assistant = (...content: object[]) => ({ role: 'assistant', content }) as NormalisedMessage;

const CONVERSATION: NormalisedMessage[] = [
  user(text('What is the capital of France?')),
  assistant(text('Paris.')),
  user(text('And of Spain?')),
  assistant(text('Madrid.'))
];

describe('fingerprint', () => {
  it('is a SHA-256 hex digest, the same for the same transcript every time', () => {
    const first = fingerprint(CONVERSATION);

    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(fingerprint(structuredClone(CONVERSATION))).toBe(first);
  });

  it('is the same for what the real API reads alike', () => {
    const variants: NormalisedMessage[][] = [
      // thinking and redacted thinking dropped, as the returned message carries them and the client may not
      [CONVERSATION[0]!, assistant({ type: 'thinking', thinking: 'Easy.', signature: 'c2ln' }, text('Paris.')),
        CONVERSATION[2]!, assistant({ type: 'redacted_thinking', data: 'ZGF0YQ==' }, text('Madrid.'))],
      // cache_control anywhere ignored
      [user({ ...text('What is the capital of France?'), cache_control: { type: 'ephemeral' } }),
        ...CONVERSATION.slice(1)],
      // a null field is the absent field (the SDK's TextBlock carries citations: null)
      [CONVERSATION[0]!, assistant({ type: 'text', text: 'Paris.', citations: null }), ...CONVERSATION.slice(2)],
      // key order is not meaning
      [CONVERSATION[0]!, assistant({ text: 'Paris.', type: 'text' }), ...CONVERSATION.slice(2)]
    ];

    for (const variant of variants) expect(fingerprint(variant)).toBe(fingerprint(CONVERSATION));
  });

  it('merges same-role neighbours left after dropping thinking', () => {
    const split = [user(text('a')), user(text('b')), assistant(text('c'))];
    const merged = [user(text('a'), text('b')), assistant(text('c'))];

    expect(fingerprint(split)).toBe(fingerprint(merged));
  });

  it('differs when anything said differs', () => {
    const base = fingerprint(CONVERSATION);
    const changes: NormalisedMessage[][] = [
      [user(text('What is the capital of Italy?')), ...CONVERSATION.slice(1)],
      [CONVERSATION[0]!, assistant(text('Paris')), ...CONVERSATION.slice(2)],
      CONVERSATION.slice(0, 2),
      [...CONVERSATION, user(text('Thanks.'))],
      [CONVERSATION[0]!, assistant(text('Paris.'), text('Madrid.'))],
      [user(text('What is the capital of France?'), text('Paris.')), ...CONVERSATION.slice(2)]
    ];

    for (const change of changes) expect(fingerprint(change)).not.toBe(base);
  });

  it('keeps tool calls, their inputs and their results in the key', () => {
    const toolUse = (input: object) => ({ type: 'tool_use', id: 'toolu_1', name: 'get_weather', input });
    const toolResult = (content: string, isError = false) =>
      ({ type: 'tool_result', tool_use_id: 'toolu_1', content, is_error: isError });
    const withTool = (input: object, result: object) =>
      [user(text('Weather?')), assistant(toolUse(input)), user(result), assistant(text('Sunny.'))];

    const base = fingerprint(withTool({ city: 'Paris' }, toolResult('sunny')));

    expect(fingerprint(withTool({ city: 'Lyon' }, toolResult('sunny')))).not.toBe(base);
    expect(fingerprint(withTool({ city: 'Paris' }, toolResult('rain')))).not.toBe(base);
    expect(fingerprint(withTool({ city: 'Paris' }, toolResult('sunny', true)))).not.toBe(base);
    expect(fingerprint(withTool({ city: 'Paris' }, { ...toolResult('sunny'), cache_control: { type: 'ephemeral' } })))
      .toBe(base);
  });

  it('keeps a null inside a tool input, which is part of what the model sent', () => {
    const call = (input: object) =>
      [user(text('Go.')), assistant({ type: 'tool_use', id: 'toolu_1', name: 'f', input })];

    expect(fingerprint(call({ a: null }))).not.toBe(fingerprint(call({})));
  });

  it('is never the fingerprint of an empty history', () => {
    expect(fingerprint([user(text('Hi'))])).not.toBe(fingerprint([]));
  });
});
