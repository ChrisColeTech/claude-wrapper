/**
 * The order of the normalised messages (spec section 4.2): the conversation opens with a user
 * message and ends with one. A trailing assistant message is a prefill, which the 4.6-and-later
 * models the catalogue serves reject with the real API's message.
 */
import { SurfaceError } from '../surface-error';
import { NormalisedMessage } from './turn-plan';

const PREFILL =
  'This model does not support assistant message prefill. The conversation must end with a user message.';

export function validateTurnOrder(messages: readonly NormalisedMessage[]): void {
  if (messages[0]?.role !== 'user') {
    throw SurfaceError.invalidRequest('messages: first message must use the "user" role');
  }
  if (messages[messages.length - 1]?.role === 'assistant') throw SurfaceError.invalidRequest(PREFILL);
}
