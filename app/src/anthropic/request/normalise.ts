/**
 * Normalisation (spec section 4.2), applied after validation and before rendering: string
 * content becomes one `text` block, and consecutive same-role messages merge into one, as the
 * real API reads them. Blocks are kept exactly as sent.
 */
import { NormalisedMessage } from './turn-plan';
import { ClientMessage } from './validate-messages';

function blocksOf(message: ClientMessage): NormalisedMessage['content'] {
  return typeof message.content === 'string' ? [{ type: 'text', text: message.content }] : message.content;
}

export function normaliseMessages(messages: readonly ClientMessage[]): NormalisedMessage[] {
  const normalised: NormalisedMessage[] = [];
  for (const message of messages) {
    const previous = normalised[normalised.length - 1];
    if (previous && previous.role === message.role) {
      previous.content = [...previous.content, ...blocksOf(message)];
    } else {
      normalised.push({ role: message.role, content: blocksOf(message) });
    }
  }
  return normalised;
}
