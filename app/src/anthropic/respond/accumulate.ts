/**
 * `accumulate(events) → Message` (spec sections 11 and 16): the non-streaming response built
 * from the turn stream exactly as the official SDK's `MessageStream` accumulator builds
 * `finalMessage()`, so the two response modes cannot disagree (ADR 0003).
 */
import { JsonObject } from '../../upstream/frames';
import { ApiEvent } from '../translate';

/** A Messages API `Message`; fields are upstream's, filtered by the translator's allowlist. */
export type Message = JsonObject & { content: JsonObject[]; usage: JsonObject };

/** Counters a `message_delta` overwrites only when present and not null (the SDK's rule). */
const OPTIONAL_COUNTERS = ['input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens',
  'server_tool_use', 'output_tokens_details'];

const TOOL_INPUT_BLOCKS = new Set(['tool_use', 'server_tool_use', 'mcp_tool_use']);

type Delta = Extract<ApiEvent, { type: 'message_delta' }>;
type BlockDelta = Extract<ApiEvent, { type: 'content_block_delta' }>;

function applyMessageDelta(message: Message, { delta, usage }: Delta): void {
  message['stop_reason'] = delta['stop_reason'];
  message['stop_sequence'] = delta['stop_sequence'];
  message['stop_details'] = delta['stop_details'];
  message.usage['output_tokens'] = usage['output_tokens'];
  if (delta['container'] != null) message['container'] = delta['container'];
  for (const counter of OPTIONAL_COUNTERS) {
    if (usage[counter] != null) message.usage[counter] = usage[counter];
  }
}

function applyBlockDelta(block: JsonObject, delta: JsonObject, inputs: Map<JsonObject, string>): void {
  switch (delta['type']) {
    case 'text_delta':
      if (block['type'] === 'text') block['text'] = String(block['text'] ?? '') + String(delta['text']);
      break;
    case 'citations_delta':
      if (block['type'] === 'text') block['citations'] = [...((block['citations'] as unknown[]) ?? []), delta['citation']];
      break;
    case 'thinking_delta':
      if (block['type'] === 'thinking') block['thinking'] = String(block['thinking']) + String(delta['thinking']);
      break;
    case 'signature_delta':
      if (block['type'] === 'thinking') block['signature'] = delta['signature'];
      break;
    case 'input_json_delta':
      if (TOOL_INPUT_BLOCKS.has(String(block['type']))) inputs.set(block, (inputs.get(block) ?? '') + String(delta['partial_json']));
      break;
  }
}

/** The SDK parses the buffered JSON at `content_block_stop`; an empty buffer is `{}`. */
function closeBlock(block: JsonObject | undefined, inputs: Map<JsonObject, string>): void {
  const json = block ? inputs.get(block) : undefined;
  if (block && json !== undefined) block['input'] = json === '' ? {} : JSON.parse(json);
}

/** `events` must open with `message_start` (the translator guarantees it). */
export function accumulate(events: readonly ApiEvent[]): Message {
  let message: Message | undefined;
  const inputs = new Map<JsonObject, string>();
  for (const event of events) {
    if (event.type === 'message_start') {
      message = structuredClone(event.message) as Message;
      continue;
    }
    if (!message) throw new Error(`accumulate: ${event.type} before message_start`);
    if (event.type === 'message_delta') applyMessageDelta(message, event);
    if (event.type === 'content_block_start') message.content.push({ ...event.content_block });
    if (event.type === 'content_block_delta') applyBlockDelta(blockAt(message, event), event.delta, inputs);
    if (event.type === 'content_block_stop') closeBlock(message.content[event.index], inputs);
  }
  if (!message) throw new Error('accumulate: no message_start');
  return message;
}

function blockAt(message: Message, event: BlockDelta): JsonObject {
  return message.content[event.index] ?? {};
}
