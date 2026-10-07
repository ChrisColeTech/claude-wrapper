/**
 * The shape of `messages` (spec section 4.2): a non-empty list of `user` and `assistant`
 * messages, each with string content or a list of typed content blocks, none of them empty.
 * Paths name the client's own indices, before any merging. What each block kind may carry beyond
 * its `type` is other concerns' (a text block's `text` is checked here).
 */
import { SurfaceError } from '../surface-error';
import { Body, fieldInvalid, fieldRequired, isObject } from './field-errors';
import { ContentBlock } from './turn-plan';

/** A message as the client sent it, its shape checked. */
export interface ClientMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

const EMPTY_CONTENT = 'all messages must have non-empty content except for the optional final assistant message';

function validateBlock(block: unknown, path: string): ContentBlock {
  if (!isObject(block)) throw fieldInvalid(path, 'a valid dictionary');
  if (block['type'] === undefined) throw fieldRequired(`${path}.type`);
  if (typeof block['type'] !== 'string') throw fieldInvalid(`${path}.type`, 'a valid string');
  if (block['type'] === 'text') validateText(block, path);
  return block as ContentBlock;
}

function validateText(block: Body, path: string): void {
  if (block['text'] === undefined) throw fieldRequired(`${path}.text`);
  if (typeof block['text'] !== 'string') throw fieldInvalid(`${path}.text`, 'a valid string');
  if (block['text'] === '') throw SurfaceError.invalidRequest('messages: text content blocks must be non-empty');
}

function validateContent(content: unknown, path: string): string | ContentBlock[] {
  if (content === undefined) throw fieldRequired(`${path}.content`);
  if (typeof content !== 'string' && !Array.isArray(content)) {
    throw fieldInvalid(`${path}.content`, 'a valid string or a list of content blocks');
  }
  if (content.length === 0) throw SurfaceError.invalidRequest(`${path}: ${EMPTY_CONTENT}`);
  if (typeof content === 'string') return content;
  return content.map((block: unknown, index) => validateBlock(block, `${path}.content.${index}`));
}

function validateMessage(message: unknown, index: number): ClientMessage {
  const path = `messages.${index}`;
  if (!isObject(message)) throw fieldInvalid(path, 'a valid dictionary');
  const role = message['role'];
  if (role === undefined) throw fieldRequired(`${path}.role`);
  if (role === 'system') {
    // The real API's mid-conversation system message is model-gated and has no upstream path.
    throw SurfaceError.invalidRequest(
      `${path}.role: "system" messages are not supported on this surface; use the top-level system field`
    );
  }
  if (role !== 'user' && role !== 'assistant') throw fieldInvalid(`${path}.role`, "'user' or 'assistant'");
  return { role, content: validateContent(message['content'], path) };
}

export function validateMessages(messages: unknown): ClientMessage[] {
  if (messages === undefined) throw fieldRequired('messages');
  if (!Array.isArray(messages)) throw fieldInvalid('messages', 'a valid list');
  if (messages.length === 0) throw SurfaceError.invalidRequest('messages: at least one message is required');
  return messages.map(validateMessage);
}
