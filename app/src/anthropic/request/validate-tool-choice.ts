/**
 * `tool_choice` (spec sections 4.1 and 7). `auto` or absent is the default and `none` hides the
 * turn's tools (the client-tools ticket's). `any` and `tool` are a 400 with the real API's
 * message on every catalogue model, Haiku 4.5 included: upstream has no way to force a tool call.
 * `disable_parallel_tool_use` is accepted and ignored. `null` reads as absent.
 */
import { isObject } from '../../utils/json-object';
import { SurfaceError } from '../surface-error';
import { fieldInvalid, fieldRequired } from './field-errors';

const TYPES: readonly unknown[] = ['auto', 'any', 'tool', 'none'];

/** `tool_choice: none`: the turn's tools are hidden, though validated all the same. */
export const toolsHidden = (toolChoice: unknown): boolean => isObject(toolChoice) && toolChoice['type'] === 'none';

export function validateToolChoice(toolChoice: unknown): void {
  if (toolChoice === undefined || toolChoice === null) return;
  if (!isObject(toolChoice)) throw fieldInvalid('tool_choice', 'a valid dictionary');
  const type = toolChoice['type'];
  if (type === undefined) throw fieldRequired('tool_choice.type');
  if (!TYPES.includes(type)) throw fieldInvalid('tool_choice.type', "'auto', 'any', 'tool' or 'none'");
  if (type === 'any' || type === 'tool') {
    throw SurfaceError.invalidRequest('tool_choice: type "tool" and "any" are not supported for this model.');
  }
  const parallel = toolChoice['disable_parallel_tool_use'];
  if (parallel !== undefined && parallel !== null && typeof parallel !== 'boolean') {
    throw fieldInvalid('tool_choice.disable_parallel_tool_use', 'a valid boolean');
  }
}
