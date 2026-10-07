# Anthropic Messages API wire contract

Type: research
Status: resolved
Blocked by: none

## Question

What must the Anthropic surface accept and emit so that official Anthropic SDK clients work unmodified? Resolve from primary sources: the platform.claude.com API reference (Messages, streaming, errors, models, count_tokens, tool use, web search tool, extended thinking, structured outputs) and the type definitions in the `@anthropic-ai/sdk` npm package (install into the scratchpad and read `resources/messages/*.d.ts`). The bundled `claude-api` skill is a secondary summary; verify against the docs. Needed facts:

1. **Request schema** for `POST /v1/messages`: every field, which are required, types and constraints (`model`, `messages`, `max_tokens`, `system` string-or-blocks, `tools`, `tool_choice` including which types current models reject, `stream`, `temperature`, `top_p`, `top_k`, `stop_sequences`, `metadata`, `thinking`, `output_config`, `service_tier`, `mcp_servers`, `betas`, `cache_control`). Message content block types a client may send (text, image, document, tool_use, tool_result, thinking, server tool results on replay).
2. **Response schema**: `Message` object fields (`id` format, `type`, `role`, `model`, `content`, `stop_reason` values, `stop_sequence`, `stop_details`, `usage` fields including cache and server-tool counts, `container`). Content block types out: `text`, `tool_use`, `thinking`, `redacted_thinking`, `server_tool_use`, `web_search_tool_result` (result and error shapes), `web_fetch_tool_result`.
3. **Streaming protocol**: exact SSE event sequence and payloads (`message_start`, `content_block_start`, `content_block_delta` with `text_delta`/`input_json_delta`/`thinking_delta`/`signature_delta`/`citations_delta`, `content_block_stop`, `message_delta` with `stop_reason` and cumulative `usage`, `message_stop`, `ping`, `error`), event/data framing, and what the SDKs' `MessageStream` accumulators require in order not to throw.
4. **Errors**: envelope `{type:"error", error:{type, message}}` plus `request_id`, HTTP status per error type (`invalid_request_error` 400, `authentication_error` 401, `permission_error` 403, `not_found_error` 404, `rate_limit_error` 429, `api_error` 500, `overloaded_error` 529), how errors appear mid-stream, headers (`request-id`, `retry-after`).
5. **Headers**: `x-api-key`, `Authorization: Bearer`, `anthropic-version` (required? which values?), `anthropic-beta`, `anthropic-dangerous-direct-browser-access`; what the SDKs send by default.
6. **Companion endpoints**: `GET /v1/models` and `GET /v1/models/{id}` shapes (including `max_input_tokens`, `max_tokens`, `capabilities`), `POST /v1/messages/count_tokens`.
7. **Web search as a client sees it**: the `web_search_20260209` / `web_search_20250305` tool definitions, `max_uses`, domain filters, how results and citations appear, how `usage.server_tool_use.web_search_requests` is reported.
8. **Minimum viable response**: which fields the official TS and Python SDKs actually validate or depend on (for example for `stream.finalMessage()`), so the spec can separate must-emit from nice-to-emit.

Write findings to `.scratch/anthropic-compat-api/research/messages-api-wire-contract.md`, citing the doc URL or SDK file for each claim.

## Answer

Official SDK clients are strict about *shape and order*, lenient about *fields*. Resolved from platform.claude.com, `@anthropic-ai/sdk` 0.131.0 type definitions and accumulator source, and the Python SDK `main` source:

- Request: `model`, `messages`, `max_tokens` required; everything else optional. Client-sendable blocks are `text`, `image`, `document`, `search_result`, `thinking`, `redacted_thinking`, `tool_use`, `tool_result`, `server_tool_use`, `web_search_tool_result`, `web_fetch_tool_result` (plus code-exec/tool-search results). `tool_choice: any|tool` 400s on Opus 5.5 / Sonnet 5.5 / Fable 5.1 / Mythos 5.1; `temperature`/`top_p`/`top_k` non-defaults 400 on models after Opus 4.6; `mcp_servers`, `context_management`, `speed`, `fallbacks` are beta-only (`anthropic-beta` header, `client.beta`).
- Response `Message`: `id, type:"message", role:"assistant", model, content[], stop_reason (7 values), stop_sequence, stop_details (only for refusal), usage{input_tokens, output_tokens, cache_*, server_tool_use{web_search_requests, web_fetch_requests}, ...}, container, diagnostics`. Doc examples omit `container`/`diagnostics`/`stop_details`.
- Streaming: named SSE events `message_start` -> (`content_block_start`, `content_block_delta`*, `content_block_stop`)* -> `message_delta`+ -> `message_stop`, plus optional `ping` and `error`. Deltas: `text_delta`, `input_json_delta` (partial JSON strings; block starts with `input: {}`), `thinking_delta` then one `signature_delta`, `citations_delta`. `message_delta.usage` is cumulative. Server-tool result blocks arrive whole in `content_block_start`.
- Errors: `{type:"error", error:{type,message}, request_id}` with 400 invalid_request_error, 401 authentication_error, 403 permission_error, 404 not_found_error, 413 request_too_large, 429 rate_limit_error (+`retry-after`), 500 api_error, 529 overloaded_error; mid-stream as `event: error` (TS throws APIError, Python APIStatusError). `request-id` header on every response.
- Headers: `anthropic-version` is required by the API (`2023-06-01`, SDKs always send it); auth is `x-api-key` or `Authorization: Bearer` (either); `anthropic-beta` comma-separated; TS adds `anthropic-dangerous-direct-browser-access: true` only with `dangerouslyAllowBrowser`.
- Companions: `GET /v1/models` -> `{data: ModelInfo[], first_id, last_id, has_more}` with `max_input_tokens`, `max_tokens`, `capabilities`; `GET /v1/models/{id}` resolves aliases; `count_tokens` -> `{input_tokens}`.
- Web search: `web_search_20250305|20260209|20260318`, `max_uses`, `allowed_domains` xor `blocked_domains`, `user_location`; response is `server_tool_use` (`srvtoolu_`) + `web_search_tool_result` (`web_search_result{url,title,encrypted_content,page_age}` or an error object) + text blocks with `web_search_result_location` citations; `usage.server_tool_use.web_search_requests`; replay must echo `encrypted_content` unchanged.
- Minimum viable: non-streaming needs a 2xx `application/json` body with `content[]` (nothing is schema-validated; Python uses non-strict `construct_type`). Streaming needs `message_start` with `content: []` and `usage`, contiguous indices, `message_delta` with `delta` and `usage.output_tokens`, `message_stop` (TS requires it for `finalMessage()`), valid JSON per event, and a closed connection; Python parses tool-input JSON eagerly and raises on invalid partial JSON.

Full findings: .scratch/anthropic-compat-api/research/messages-api-wire-contract.md
