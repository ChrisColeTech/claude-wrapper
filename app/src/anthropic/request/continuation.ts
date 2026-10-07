/**
 * The continuation choice (spec section 5, ADR 0002): a request continues upstream session S
 * when its normalised `messages[0..n-1]` has S's recorded fingerprint and its tail, the one user
 * message after it, carries no `tool_result` block. A continued turn sends that message's blocks
 * verbatim; everything else is a replayed turn. Only the messages are in the key: `system`,
 * `model`, `tools` and `mcp_servers` are passed afresh on every run.
 */
import { UserMessage } from '../../upstream/runner';
import { Sessions } from '../sessions';
import { fingerprint } from './fingerprint';
import { renderReplay } from './render-replay';
import { Continuation, NormalisedMessage } from './turn-plan';

function continuedSession(messages: readonly NormalisedMessage[], sessions: Sessions): string | null {
  const history = messages.slice(0, -1);
  const tail = messages[messages.length - 1];
  if (history.length === 0 || !tail || tail.content.some(block => block.type === 'tool_result')) return null;
  return sessions.lookup(fingerprint(history));
}

/** `messages` has passed the turn-order checks: it opens and ends with a user message. */
export function chooseContinuation(messages: readonly NormalisedMessage[], sessions: Sessions): Continuation {
  const sessionId = continuedSession(messages, sessions);
  const tail = messages[messages.length - 1];
  if (sessionId === null || !tail) return { replay: renderReplay(messages) };
  return { resume: sessionId, message: { role: 'user', content: tail.content } };
}

/** The upstream session a continuation resumes, if any. */
export function resumedSession(continuation: Continuation): string | undefined {
  return 'resume' in continuation ? continuation.resume : undefined;
}

/** The one user message the run receives. */
export function messageToSend(continuation: Continuation): UserMessage {
  return 'resume' in continuation ? continuation.message : continuation.replay;
}
