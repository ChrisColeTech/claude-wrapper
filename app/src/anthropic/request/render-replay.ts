/**
 * The replayed-turn message (spec section 5): the one stream-json user message a fresh run
 * receives. A conversation of one user message is sent as that message's blocks, verbatim.
 * Otherwise the message opens with the `<conversation_history>` block of `<turn>` children, one
 * per earlier message, with the one sentence that says the assistant turns are the model's own
 * (the system prompt stays exactly the client's), then the final user message's blocks verbatim.
 * The final message's `tool_result` blocks are rendered as their tags instead: a fresh run holds
 * no `tool_use` they answer, and the API rejects a result without its call.
 */
import { UserMessage } from '../../upstream/runner';
import { HistoryPart, historyParts } from './history-blocks';
import { ContentBlock, NormalisedMessage } from './turn-plan';

const OPENING = '<conversation_history>\n' +
  'These are the earlier turns of this conversation, and the assistant turns in it are your own replies.\n';
const CLOSING = '</conversation_history>';

/** Content blocks from parts: consecutive text joins into one text block, real blocks stay in place. */
class ContentBuilder {
  private readonly content: ContentBlock[] = [];
  private text = '';

  add(part: HistoryPart): void {
    if (typeof part === 'string') {
      this.text += part;
      return;
    }
    this.flush();
    this.content.push(part);
  }

  flush(): void {
    if (this.text !== '') this.content.push({ type: 'text', text: this.text });
    this.text = '';
  }

  blocks(): ContentBlock[] {
    this.flush();
    return this.content;
  }
}

function renderTurn(message: NormalisedMessage, builder: ContentBuilder): void {
  builder.add(`<turn role="${message.role}">\n`);
  for (const block of message.content) {
    const parts = historyParts(block);
    if (parts.length === 0) continue;
    parts.forEach(part => builder.add(part));
    builder.add('\n');
  }
  builder.add('</turn>\n');
}

/** `messages` has passed the turn-order checks: it opens and ends with a user message. */
export function renderReplay(messages: readonly NormalisedMessage[]): UserMessage {
  const final = messages[messages.length - 1];
  if (!final) throw new Error('renderReplay: no messages');
  if (messages.length === 1) return { role: 'user', content: final.content };

  const builder = new ContentBuilder();
  builder.add(OPENING);
  messages.slice(0, -1).forEach(message => renderTurn(message, builder));
  builder.add(CLOSING);
  builder.flush();
  for (const block of final.content) {
    if (block.type !== 'tool_result') {
      builder.add(block);
      continue;
    }
    historyParts(block).forEach(part => builder.add(part));
    builder.flush();
  }
  return { role: 'user', content: builder.blocks() };
}
