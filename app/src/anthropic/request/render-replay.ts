/**
 * The replayed-turn message (spec section 5): the one stream-json user message a fresh run
 * receives. A conversation of one user message is sent as that message's blocks, verbatim.
 *
 * Earlier turns need the `<conversation_history>` rendering, which the conversation-state ticket
 * builds here. Until then they are an honest 400 rather than a silently dropped history.
 */
import { UserMessage } from '../../upstream/runner';
import { SurfaceError } from '../http/surface-error';
import { NormalisedMessage } from './turn-plan';

/** `messages` has passed the turn-order checks: it opens and ends with a user message. */
export function renderReplay(messages: readonly NormalisedMessage[]): UserMessage {
  const [only] = messages;
  if (messages.length !== 1 || !only) {
    throw SurfaceError.invalidRequest(
      'messages: earlier turns (an assistant message before the last user message) are not supported yet'
    );
  }
  return { role: 'user', content: only.content };
}
