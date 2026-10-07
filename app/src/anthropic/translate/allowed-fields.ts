/**
 * The field allowlist as data (spec section 11, ADR 0003): per event, block and delta type, the
 * fields the Messages API schema defines (the official SDK's `RawMessage*Event`, `Message`,
 * `Usage`, `MessageDeltaUsage`, content block and delta types). Everything else upstream sends
 * (`caller`, `iterations`, `estimated_tokens`, `context_management`, `safeguard_results`, ...) is
 * dropped by the allowlist pass. This must grow when the API grows.
 */

/** `true` keeps the value as is; `fields` filters an object; `byType` filters by its `type`. */
export type FieldRule = true | { readonly fields: Fields } | { readonly byType: { readonly [type: string]: Fields } };

export interface Fields {
  readonly [name: string]: FieldRule;
}

const KEEP: true = true;

const CACHE_CREATION = { fields: { ephemeral_5m_input_tokens: KEEP, ephemeral_1h_input_tokens: KEEP } };
const SERVER_TOOL_USE = { fields: { web_search_requests: KEEP, web_fetch_requests: KEEP } };
const OUTPUT_TOKENS_DETAILS = { fields: { thinking_tokens: KEEP } };

const USAGE = {
  fields: {
    input_tokens: KEEP,
    output_tokens: KEEP,
    cache_creation_input_tokens: KEEP,
    cache_read_input_tokens: KEEP,
    cache_creation: CACHE_CREATION,
    server_tool_use: SERVER_TOOL_USE,
    service_tier: KEEP,
    inference_geo: KEEP,
    output_tokens_details: OUTPUT_TOKENS_DETAILS
  }
};

const MESSAGE_DELTA_USAGE = {
  fields: {
    input_tokens: KEEP,
    output_tokens: KEEP,
    cache_creation_input_tokens: KEEP,
    cache_read_input_tokens: KEEP,
    server_tool_use: SERVER_TOOL_USE,
    output_tokens_details: OUTPUT_TOKENS_DETAILS
  }
};

const MESSAGE = {
  fields: {
    id: KEEP,
    type: KEEP,
    role: KEEP,
    model: KEEP,
    content: KEEP,
    stop_reason: KEEP,
    stop_sequence: KEEP,
    stop_details: KEEP,
    usage: USAGE,
    container: KEEP,
    diagnostics: KEEP
  }
};

/** A block type not listed keeps only its `type`. `caller` on `tool_use` is dropped (spec section 11). */
const CONTENT_BLOCK = {
  byType: {
    text: { type: KEEP, text: KEEP, citations: KEEP },
    thinking: { type: KEEP, thinking: KEEP, signature: KEEP },
    redacted_thinking: { type: KEEP, data: KEEP },
    tool_use: { type: KEEP, id: KEEP, name: KEEP, input: KEEP }
  }
};

const DELTA = {
  byType: {
    text_delta: { type: KEEP, text: KEEP },
    input_json_delta: { type: KEEP, partial_json: KEEP },
    citations_delta: { type: KEEP, citation: KEEP },
    thinking_delta: { type: KEEP, thinking: KEEP },
    signature_delta: { type: KEEP, signature: KEEP }
  }
};

const MESSAGE_DELTA_DELTA = {
  fields: { stop_reason: KEEP, stop_sequence: KEEP, stop_details: KEEP, container: KEEP }
};

/** Per event type; an event type not listed is dropped whole. */
export const ALLOWED_EVENT_FIELDS: { readonly [eventType: string]: Fields } = {
  message_start: { type: KEEP, message: MESSAGE },
  content_block_start: { type: KEEP, index: KEEP, content_block: CONTENT_BLOCK },
  content_block_delta: { type: KEEP, index: KEEP, delta: DELTA },
  content_block_stop: { type: KEEP, index: KEEP },
  message_delta: { type: KEEP, delta: MESSAGE_DELTA_DELTA, usage: MESSAGE_DELTA_USAGE },
  message_stop: { type: KEEP }
};
