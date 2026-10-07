/**
 * The official SDK as an oracle for the turn stream: what `messages.stream(...).finalMessage()`
 * makes of a list of API events, less `parsed_output`, which its client-side `parse()` helper adds.
 */
import { BetaMessageStream } from '@anthropic-ai/sdk/lib/BetaMessageStream';
import { MessageStream } from '@anthropic-ai/sdk/lib/MessageStream';
import { ApiEvent } from '../../../src/anthropic/translate';

const asStream = (events: ApiEvent[]): ReadableStream => {
  const body = new TextEncoder().encode(events.map(event => JSON.stringify(event)).join('\n') + '\n');
  return new ReadableStream({ start(controller) { controller.enqueue(body); controller.close(); } });
};

export async function sdkFinalMessage(events: ApiEvent[]): Promise<Record<string, unknown>> {
  const { parsed_output: _clientSide, ...message } = await MessageStream.fromReadableStream(asStream(events)).finalMessage();
  return message as unknown as Record<string, unknown>;
}

/** The same through `client.beta.messages.stream(...)`'s accumulator, which also reads the beta blocks (`mcp_tool_use`). */
export async function sdkBetaFinalMessage(events: ApiEvent[]): Promise<Record<string, unknown>> {
  const { parsed_output: _clientSide, ...message } = await BetaMessageStream.fromReadableStream(asStream(events)).finalMessage();
  return message as unknown as Record<string, unknown>;
}
