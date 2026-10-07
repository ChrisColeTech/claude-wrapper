/**
 * The official SDK as an oracle for the turn stream: what `messages.stream(...).finalMessage()`
 * makes of a list of API events, less `parsed_output`, which its client-side `parse()` helper adds.
 */
import { MessageStream } from '@anthropic-ai/sdk/lib/MessageStream';
import { ApiEvent } from '../../../src/anthropic/translate';

export async function sdkFinalMessage(events: ApiEvent[]): Promise<Record<string, unknown>> {
  const body = new TextEncoder().encode(events.map(event => JSON.stringify(event)).join('\n') + '\n');
  const stream = new ReadableStream({ start(controller) { controller.enqueue(body); controller.close(); } });
  const { parsed_output: _clientSide, ...message } = await MessageStream.fromReadableStream(stream).finalMessage();
  return message as unknown as Record<string, unknown>;
}
