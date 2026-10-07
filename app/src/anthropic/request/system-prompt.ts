/**
 * `system` (spec section 6): the upstream system prompt is exactly the client's, a string as is
 * or its text blocks joined with a blank line, and the empty string when absent (or `null`).
 * It travels as one argument, so it cannot carry a NUL character.
 */
import { SurfaceError } from '../surface-error';
import { fieldInvalid, fieldRequired, isObject } from './field-errors';

function blockText(block: unknown, index: number): string {
  const path = `system.${index}`;
  if (!isObject(block)) throw fieldInvalid(path, 'a valid dictionary');
  if (block['type'] !== 'text') throw fieldInvalid(`${path}.type`, "'text'");
  const text = block['text'];
  if (text === undefined) throw fieldRequired(`${path}.text`);
  if (typeof text !== 'string') throw fieldInvalid(`${path}.text`, 'a valid string');
  if (text === '') throw SurfaceError.invalidRequest('system: text content blocks must be non-empty');
  return text;
}

function joined(system: unknown): string {
  if (system === undefined || system === null) return '';
  if (typeof system === 'string') return system;
  if (!Array.isArray(system)) throw fieldInvalid('system', 'a valid string or a list of text blocks');
  return system.map(blockText).join('\n\n');
}

export function systemPrompt(system: unknown): string {
  const prompt = joined(system);
  if (prompt.includes('\u0000')) {
    throw SurfaceError.invalidRequest('system: must not contain the NUL character, which cannot be passed to upstream');
  }
  return prompt;
}
