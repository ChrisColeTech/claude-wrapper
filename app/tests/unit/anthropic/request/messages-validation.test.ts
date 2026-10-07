/**
 * The rejections of `messages` (spec section 4.2): their shape, checked against the client's own
 * indices, and their order once merged. Exact status, type and message, before anything spawns.
 */
import { SurfaceError } from '../../../../src/anthropic/surface-error';
import { invalidRequest, planDefault, rejectionOf } from '../../../mocks/anthropic/plan-context';

const VALID = { model: 'claude-sonnet-5-5', max_tokens: 1024, messages: [{ role: 'user', content: 'Hello' }] };
const withMessages = (messages: unknown) => ({ ...VALID, messages });
const user = (content: unknown) => ({ role: 'user', content });

describe('planTurn validates the shape of messages (spec section 4.2)', () => {
  it('requires them', () => {
    const { messages: _messages, ...request } = VALID;

    expect(rejectionOf(request)).toEqual(invalidRequest('messages: Field required'));
  });

  it.each([['Hello'], [{ role: 'user', content: 'Hello' }], [null]])('requires a list: %p', (messages) => {
    expect(rejectionOf(withMessages(messages))).toEqual(invalidRequest('messages: Input should be a valid list'));
  });

  it('requires at least one message', () => {
    expect(rejectionOf(withMessages([]))).toEqual(invalidRequest('messages: at least one message is required'));
  });

  it.each([['Hello'], [null], [[user('Hello')]]])('requires each message to be an object: %p', (message) => {
    expect(rejectionOf(withMessages([user('Hi'), message]))).toEqual(
      invalidRequest('messages.1: Input should be a valid dictionary')
    );
  });

  it('requires a role', () => {
    expect(rejectionOf(withMessages([{ content: 'Hello' }]))).toEqual(invalidRequest('messages.0.role: Field required'));
  });

  it.each([['tool'], ['User'], [7]])('accepts only the user and assistant roles: %p', (role) => {
    expect(rejectionOf(withMessages([user('Hi'), { role, content: 'Hello' }]))).toEqual(
      invalidRequest("messages.1.role: Input should be 'user' or 'assistant'")
    );
  });

  it('requires content', () => {
    expect(rejectionOf(withMessages([{ role: 'user' }]))).toEqual(invalidRequest('messages.0.content: Field required'));
  });

  it.each([[7], [null], [{ type: 'text', text: 'Hello' }]])('requires content to be a string or a list: %p', (content) => {
    expect(rejectionOf(withMessages([user(content)]))).toEqual(
      invalidRequest('messages.0.content: Input should be a valid string or a list of content blocks')
    );
  });

  it.each([['Hello'], [null], [['text']]])('requires each content block to be an object: %p', (block) => {
    expect(rejectionOf(withMessages([user([{ type: 'text', text: 'Hi' }, block])]))).toEqual(
      invalidRequest('messages.0.content.1: Input should be a valid dictionary')
    );
  });

  it('requires each content block to name its type', () => {
    expect(rejectionOf(withMessages([user([{ text: 'Hi' }])]))).toEqual(
      invalidRequest('messages.0.content.0.type: Field required')
    );
    expect(rejectionOf(withMessages([user([{ type: 7 }])]))).toEqual(
      invalidRequest('messages.0.content.0.type: Input should be a valid string')
    );
  });

  it('requires a text block’s text to be a string', () => {
    expect(rejectionOf(withMessages([user([{ type: 'text' }])]))).toEqual(
      invalidRequest('messages.0.content.0.text: Field required')
    );
    expect(rejectionOf(withMessages([user([{ type: 'text', text: ['Hi'] }])]))).toEqual(
      invalidRequest('messages.0.content.0.text: Input should be a valid string')
    );
  });

  it.each([[''], [[]]])('rejects empty content %p with the real API’s message', (content) => {
    expect(rejectionOf(withMessages([user('Hi'), { role: 'assistant', content: 'Hello' }, user(content)]))).toEqual(
      invalidRequest('messages.2: all messages must have non-empty content except for the optional final assistant message')
    );
  });

  it('accepts text that is only whitespace: only empty text is rejected', () => {
    expect(planDefault(withMessages([user(' ')]))).not.toBeInstanceOf(SurfaceError);
  });

  it('rejects an empty text block with the real API’s message', () => {
    expect(rejectionOf(withMessages([user([{ type: 'text', text: 'Hi' }, { type: 'text', text: '' }])]))).toEqual(
      invalidRequest('messages: text content blocks must be non-empty')
    );
  });
});

describe('planTurn validates the order of messages (spec section 4.2)', () => {
  const message = (role: string, content: string) => ({ role, content });
  const PREFILL =
    'This model does not support assistant message prefill. The conversation must end with a user message.';

  it('requires the first message to be a user message', () => {
    expect(rejectionOf(withMessages([message('assistant', 'Hi'), message('user', 'Hello')]))).toEqual(
      invalidRequest('messages: first message must use the "user" role')
    );
  });

  it.each([
    [[message('user', 'Hi'), message('assistant', 'Hello')]],
    [[message('user', 'Hi'), message('assistant', 'Hel'), message('assistant', 'lo')]]
  ])('rejects a conversation ending with an assistant message (prefill) with the real API’s message', (messages) => {
    expect(rejectionOf(withMessages(messages))).toEqual(invalidRequest(PREFILL));
  });
});
