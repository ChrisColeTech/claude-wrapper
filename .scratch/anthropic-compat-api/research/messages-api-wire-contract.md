# Anthropic Messages API wire contract

Research for ticket `03-messages-api-wire-contract.md`. Written 2026-10-04. Every claim is followed by its source in square brackets.

## Sources and citation keys

Primary documentation (platform.claude.com, fetched 2026-10-04):

| Key | URL |
| --- | --- |
| [API-MSG] | https://platform.claude.com/docs/en/api/messages/create |
| [API-OVERVIEW] | https://platform.claude.com/docs/en/api/overview |
| [API-VERSIONING] | https://platform.claude.com/docs/en/api/versioning |
| [API-ERRORS] | https://platform.claude.com/docs/en/api/errors |
| [API-BETA] | https://platform.claude.com/docs/en/api/beta-headers |
| [API-RATELIMITS] | https://platform.claude.com/docs/en/api/rate-limits |
| [API-MODELS] | https://platform.claude.com/docs/en/api/models (list and retrieve) |
| [API-COUNT] | https://platform.claude.com/docs/en/api/messages/count_tokens |
| [DOC-STREAM] | https://platform.claude.com/docs/en/build-with-claude/streaming |
| [DOC-TOOLS] | https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview |
| [DOC-DEFINE] | https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools |
| [DOC-HANDLE] | https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls |
| [DOC-SERVER] | https://platform.claude.com/docs/en/agents-and-tools/tool-use/server-tools |
| [DOC-WEBSEARCH] | https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool |
| [DOC-WEBFETCH] | https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-fetch-tool |
| [DOC-THINKING] | https://platform.claude.com/docs/en/build-with-claude/thinking |
| [DOC-EXTTHINK] | https://platform.claude.com/docs/en/build-with-claude/extended-thinking |
| [DOC-STRUCT] | https://platform.claude.com/docs/en/build-with-claude/structured-outputs |
| [DOC-STOP] | https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons |
| [DOC-MCP] | https://platform.claude.com/docs/en/agents-and-tools/mcp-connector |
| [DOC-VISION] | https://platform.claude.com/docs/en/build-with-claude/vision |

Official TypeScript SDK `@anthropic-ai/sdk` **0.131.0**, installed with `npm install @anthropic-ai/sdk` into the session scratchpad (`.../scratchpad/sdk-types/node_modules/@anthropic-ai/sdk`, reproducible with `npm install @anthropic-ai/sdk@0.131.0`). Paths below are relative to that package; `:N` is a line number.

| Key | File |
| --- | --- |
| [TS-MSG] | `resources/messages/messages.d.ts` |
| [TS-BETA] | `resources/beta/messages/messages.d.ts` |
| [TS-MODELS] | `resources/models.d.ts` |
| [TS-STREAM] | `lib/MessageStream.js` (the `messages.stream()` accumulator) |
| [TS-SSE] | `core/streaming.js` (SSE decoder, `Stream.fromSSEResponse`) |
| [TS-ERR] | `core/error.js` |
| [TS-CLIENT] | `client.js` |
| [TS-PARSE] | `internal/parse.js`, `internal/message-stream-utils.js`, `_vendor/partial-json-parser/parser.js`, `lib/parser.js`, `internal/utils/values.js` |

Official Python SDK `anthropic-sdk-python`, `main` branch on GitHub, read via raw.githubusercontent.com on 2026-10-04 (not installed; quoted through a fetch summariser, so treat line-level detail as approximate):

| Key | File |
| --- | --- |
| [PY-STREAM] | `src/anthropic/lib/streaming/_messages.py` |
| [PY-SSE] | `src/anthropic/_streaming.py` |
| [PY-CLIENT] | `src/anthropic/_client.py` |
| [PY-BASE] | `src/anthropic/_base_client.py` |
| [PY-RESP] | `src/anthropic/_response.py` |
| [PY-EXC] | `src/anthropic/_exceptions.py` |

The bundled `claude-api` skill was used only as a map; everything below was checked against the sources above. The real API was not called.

---

## 1. Request schema: `POST /v1/messages`

### 1.1 Top-level body fields

| Field | Required | Type and constraints | Source |
| --- | --- | --- | --- |
| `model` | yes | string. SDK type is a union of known ids plus `(string & {})`, so any string passes the client. | [TS-MSG:2107, :3582]; [API-MSG] |
| `messages` | yes | `MessageParam[]`; each `{role: "user" \| "assistant" \| "system", content: string \| ContentBlockParam[]}`. A string is shorthand for one `text` block. Consecutive same-role turns are merged. Limit 100,000 messages per request. `role: "system"` inside `messages` is the model-gated "mid-conversation system message" feature; the SDK doc comment still says "there is no `system` role for input messages", so treat it as model-dependent. | [TS-MSG:2080-2083, :3508-3575]; [API-MSG] |
| `max_tokens` | yes | integer, minimum 0. `0` pre-warms the prompt cache without generating. Per-model maximum (see `GET /v1/models` `max_tokens`). | [TS-MSG:3493-3506]; [API-MSG] |
| `system` | no | `string \| TextBlockParam[]` (text blocks may carry `cache_control` and `citations`). | [TS-MSG:3651] |
| `tools` | no | `ToolUnion[]` (section 1.4). | [TS-MSG:2859, :3754] |
| `tool_choice` | no | `{type:"auto", disable_parallel_tool_use?}` \| `{type:"any", disable_parallel_tool_use?}` \| `{type:"tool", name, disable_parallel_tool_use?}` \| `{type:"none"}`. `auto` is the default when `tools` is present, `none` when it is not. `any`/`tool` return 400 `tool_choice: type "tool" and "any" are not supported for this model.` on Claude Opus 5.5, Sonnet 5.5, Fable 5.1 and Mythos 5.1 (also on `count_tokens`), and error on any model when `thinking.type` is `enabled`. | [TS-MSG:2618-2667]; [DOC-DEFINE "Forcing tool use"]; [API-ERRORS "Forced tool use not supported"]; [DOC-THINKING "Thinking with tool use"] |
| `stream` | no | boolean; `true` switches the response to SSE. | [TS-MSG:3643] |
| `temperature` | no | deprecated. "Models released after Claude Opus 4.6 do not support setting temperature. A value of 1.0 will be accepted for backwards compatibility, all other values will be rejected with a 400 error." | [TS-MSG:3653-3657]; [DOC-THINKING "Sampling parameters"] |
| `top_p` | no | deprecated. "A value >= 0.99 will be accepted ... all other values will be rejected with a 400 error." (same model set) | [TS-MSG:3761-3765] |
| `top_k` | no | deprecated. "Models released after Claude Opus 4.6 do not accept top_k; any value will be rejected with a 400 error." | [TS-MSG:3756-3759] |
| `stop_sequences` | no | `string[]`; a hit yields `stop_reason: "stop_sequence"` and `stop_sequence: <matched>`. | [TS-MSG:3622-3632] |
| `metadata` | no | `{user_id?: string \| null}`, max 512 chars, opaque id, no PII. | [TS-MSG:2091-2100]; [API-MSG] |
| `thinking` | no | `{type:"enabled", budget_tokens, display?}` (budget >= 1024 and < `max_tokens`) \| `{type:"disabled"}` \| `{type:"between_tools"}` \| `{type:"adaptive", display?}`; `display` is `"summarized" \| "omitted"` (`"updates"` under beta `thinking-display-updates-2026-08-18`). Model acceptance differs: `enabled` is rejected on 4.7+, `adaptive` on 4.5 and earlier, `disabled` on Fable 5.x/Mythos 5.x/Opus 5.5/Sonnet 5.5, `between_tools` everywhere except Sonnet 5.5; each with a distinct 400 message. | [TS-MSG:2465-2514]; [DOC-THINKING "Controlling thinking display"]; [API-ERRORS "Common validation errors"] |
| `output_config` | no | `{effort?: "low"\|"medium"\|"high"\|"xhigh"\|"max", format?: {type:"json_schema", schema: object}}`. | [TS-MSG:2108-2121, :1886-1894]; [DOC-STRUCT] |
| `service_tier` | no | `"auto" \| "standard_only"`. | [TS-MSG:3620] |
| `cache_control` | no (top level) | `{type:"ephemeral", ttl?: "5m"\|"1h"}`; "automatically applies a cache_control marker to the last cacheable block". The same object is accepted on individual blocks and tools. | [TS-MSG:3584-3587, :926-941] |
| `container` | no | `string \| {id?, skills?: [{type:"anthropic"\|"custom", skill_id, version?}]}` (max 20 skills). | [TS-MSG:3591, :2048, :1713-1722]; [API-MSG] |
| `inference_geo` | no | string region; defaults to the workspace's `default_inference_geo`. | [TS-MSG:3599-3602] |
| `diagnostics` | no | `{previous_message_id?: string \| null}` (max 256 chars). | [TS-MSG:3593-3597, :1783-1792]; [API-MSG] |
| `betas` | header, not body | SDK parameter on `client.beta.messages.*` that becomes the `anthropic-beta` header. Not a body field. | [TS-BETA:5469-5471]; [API-BETA] |
| `mcp_servers` | beta only | `[{type:"url", url (https), name, authorization_token?, tool_configuration?}]`; requires header `mcp-client-2025-11-20` and a matching `{type:"mcp_toolset", mcp_server_name}` entry in `tools`; every server must be referenced by exactly one toolset. Present only in the beta types. | [TS-BETA:5291, :3333-3339]; [DOC-MCP "MCP server configuration", "Validation rules"] |
| `context_management`, `speed`, `fallbacks`, `output_format` (deprecated), `output_config.task_budget` | beta only | Exist only in `resources/beta/messages/messages.d.ts`. | [TS-BETA:5247, :5322, :5282, :5308, :3100] |
| `user_profile_id`, `workspace_id` | header params | SDK params mapped to `anthropic-user-profile-id` (needs `user-profiles` beta) and `anthropic-workspace-id`. | [TS-MSG:3767-3780]; [API-COUNT "Headers"] |

Prefill: a trailing `assistant` message continues the response (documented in the `messages` field), but "Claude 4.6 and later models ... do not support prefilling assistant messages" and return 400 `This model does not support assistant message prefill. The conversation must end with a user message.` [TS-MSG:3520-3522]; [API-ERRORS "Prefill not supported"].

Request size limit: 32 MB for Messages and Token Counting; exceeding it returns 413 `request_too_large` [API-ERRORS "Request size limits"]; [API-OVERVIEW].

### 1.2 Content blocks a client may send (`ContentBlockParam`)

Union: `text | image | document | search_result | thinking | redacted_thinking | tool_use | tool_result | server_tool_use | web_search_tool_result | web_fetch_tool_result | code_execution_tool_result | bash_code_execution_tool_result | text_editor_code_execution_tool_result | tool_search_tool_result | container_upload` [TS-MSG:1760].

| Block | Shape | Source |
| --- | --- | --- |
| `text` | `{type:"text", text: string (minLength 1), cache_control?, citations?: TextCitationParam[] \| null}` | [TS-MSG:2350-2358]; [API-MSG] |
| `image` | `{type:"image", source: {type:"base64", media_type:"image/jpeg"\|"image/png"\|"image/gif"\|"image/webp", data} \| {type:"url", url} \| {type:"file", file_id}, cache_control?, transformations?: {oversized_image?: "downsize"\|"error"}}`. Limits: 10 MB base64 per image, 8000x8000 px, 100 images per request on 200k-context models else 600; stricter dimension limit above 20 images. | [TS-MSG:1850-1881, :95-99, :2886-2889, :1846-1849]; [DOC-VISION "Image limits and costs"] |
| `document` | `{type:"document", source: {type:"base64", media_type:"application/pdf", data} \| {type:"text", media_type:"text/plain", data} \| {type:"content", content: string \| (text\|image)[]} \| {type:"url", url} \| {type:"file", file_id}, title?, context?, citations?: {enabled?}, cache_control?}` | [TS-MSG:1811-1821, :100-104, :2135-2139, :1761-1765, :2890-2893, :1842-1845] |
| `search_result` | `{type:"search_result", source: string, title: string, content: TextBlockParam[], citations?, cache_control?}` | [TS-MSG:2261-2271] |
| `thinking` | `{type:"thinking", thinking: string, signature: string}`; "must be passed back unmodified and in their original order; a modified block results in a 400 `invalid_request_error`". Text placed in the `thinking` field of a `display: "omitted"` block is ignored rather than rejected. | [TS-MSG:2450-2464]; [DOC-THINKING "Preserving thinking blocks"]; [API-ERRORS "Thinking blocks cannot be modified"] |
| `redacted_thinking` | `{type:"redacted_thinking", data: string}` (opaque; pass back unchanged). | [TS-MSG:2219-2226]; [DOC-THINKING "Redacted thinking blocks"] |
| `tool_use` (replay of an assistant turn) | `{type:"tool_use", id, name, input: object, cache_control?, caller?, toolset_name?}` | [TS-MSG:2871-2885] |
| `tool_result` | `{type:"tool_result", tool_use_id, content?: string \| (text\|image\|search_result\|document\|tool_reference\|browser_state)[], is_error?: boolean, cache_control?, toolset_name?}`. Placement rules: the `tool_result` blocks must come first in the next `user` message, one per `tool_use` id, with nothing between the assistant `tool_use` message and the user `tool_result` message; text after the results is allowed only when no server tool is left unresolved. Violations return 400 `` `tool_use` ids were found without `tool_result` blocks immediately after: ... ``. | [TS-MSG:2683-2696]; [DOC-HANDLE "Important formatting requirements"]; [DOC-SERVER "Mixing server tools and client tools in one turn"] |
| `server_tool_use` (replay) | `{type:"server_tool_use", id, name: "web_search"\|"web_fetch"\|"code_execution"\|"bash_code_execution"\|"text_editor_code_execution"\|"tool_search_tool_regex"\|"tool_search_tool_bm25", input, cache_control?, caller?}` | [TS-MSG:2300-2310] |
| `web_search_tool_result` (replay) | `{type:"web_search_tool_result", tool_use_id, content: [{type:"web_search_result", url, title, encrypted_content, page_age?}] \| {type:"web_search_tool_result_error", error_code}, cache_control?, caller?}`. "If `encrypted_content` is missing or modified, the request fails with a 400 validation error." | [TS-MSG:3467-3477, :3300-3306, :3456-3459]; [DOC-WEBSEARCH "Search results"] |
| `web_fetch_tool_result` (replay) | `{type:"web_fetch_tool_result", tool_use_id, content: {type:"web_fetch_result", url, content: DocumentBlockParam, retrieved_at?} \| {type:"web_fetch_tool_result_error", error_code}, cache_control?, caller?}` | [TS-MSG:3212-3221, :2970-2981, :3226-3229] |
| code-execution and tool-search result blocks, `container_upload` | See the `*ToolResultBlockParam` interfaces; out of scope for the surface. | [TS-MSG:132-140, :1304-1312, :2394-2402, :2748-2756, :1751-1758] |

### 1.3 Thinking replay rules

- Within a tool-use turn, every `thinking` and `redacted_thinking` block from the assistant message must be passed back complete and unmodified alongside its `tool_use` block ("Required: within a tool-use turn ... Recommended: across turns ... Allowed: outside tool use, omit prior turns' thinking") [DOC-THINKING "Preserving thinking blocks"].
- Filtering on `block.type == "thinking"` alone drops `redacted_thinking` blocks and breaks the protocol [DOC-THINKING "Redacted thinking blocks"].
- A toggled thinking configuration mid-turn does not error; the API silently disables thinking for that request [DOC-THINKING "Thinking with tool use"].
- The `signature` is opaque and "compatible across platforms"; with `display: "omitted"` the `thinking` field is `""` but the signature still carries the encrypted thinking [DOC-THINKING "Thinking encryption", "Controlling thinking display"].

### 1.4 Tool definitions (`tools[]`)

Client tool (`Tool`): `{name: string, input_schema: {type:"object", properties?, required?, ...}, description?, strict?: boolean, cache_control?, defer_loading?: boolean, input_examples?: object[], eager_input_streaming?: boolean \| null, allowed_callers?, type?: "custom" \| null}` [TS-MSG:2524-2587]. `name` must match `^[a-zA-Z0-9_-]{1,128}$` [DOC-DEFINE "Specifying client tools"]. `strict: true` guarantees schema-valid inputs; schemas have complexity limits (20 strict tools, 24 optional params, 16 union params) [DOC-STRUCT].

Full `ToolUnion`: `Tool | ToolBash20250124 | CodeExecutionTool20250522 | CodeExecutionTool20250825 | CodeExecutionTool20260120 | CodeExecutionTool20260521 | BrowserToolset20260801 | MemoryTool20250818 | ComputerToolset20260801 | ToolTextEditor20250124 | ToolTextEditor20250429 | ToolTextEditor20250728 | WebSearchTool20250305 | WebFetchTool20250910 | WebSearchTool20260209 | WebFetchTool20260209 | WebFetchTool20260309 | WebSearchTool20260318 | WebFetchTool20260318 | ToolSearchToolBm25_20251119 | ToolSearchToolRegex20251119` [TS-MSG:2859]. Web search and web fetch definitions are in section 7. Including `tools` makes the API prepend a tool-use system prompt whose token cost is tabulated per model [DOC-TOOLS "Pricing"].

### 1.5 Structured outputs

`output_config.format = {type:"json_schema", schema}`; the response's `text` block then contains the JSON string. The legacy `output_format` body param is deprecated and the `structured-outputs-2025-11-13` beta header is no longer required. Unsupported schema features (recursive schemas, numeric/string length constraints, `additionalProperties` other than `false`, external `$ref`, regex lookarounds) return 400. `stop_reason: "max_tokens"` or `"refusal"` can leave the text non-conformant [DOC-STRUCT]; [TS-MSG:1886-1894].

---

## 2. Response schema: the `Message` object

| Field | Type | Notes | Source |
| --- | --- | --- | --- |
| `id` | string | "Unique object identifier. The format and length of IDs may change over time." Every doc example uses the prefix `msg_` (for example `msg_013Uc6srznUEWyqAQcUdL59A`). | [TS-MSG:1922-1927]; [API-MSG example]; [DOC-STREAM transcripts] |
| `type` | `"message"` | always | [TS-MSG:2019-2024] |
| `role` | `"assistant"` | always | [TS-MSG:1981-1986] |
| `model` | string | the model that completed the prompt | [TS-MSG:1974-1980] |
| `content` | `ContentBlock[]` | see 2.2 | [TS-MSG:1934-1968, :1759] |
| `stop_reason` | `StopReason \| null` | `"end_turn" \| "max_tokens" \| "stop_sequence" \| "tool_use" \| "pause_turn" \| "refusal" \| "model_context_window_exceeded"`. "In non-streaming mode this value is always non-null. In streaming mode, it is null in the `message_start` event and non-null otherwise." | [TS-MSG:1987-2011, :2337]; [DOC-STOP] |
| `stop_sequence` | `string \| null` | the matched custom stop sequence | [TS-MSG:2012-2018] |
| `stop_details` | `RefusalStopDetails \| null` | `{type:"refusal", category: "cyber"\|"bio"\|"frontier_llm"\|"reasoning_extraction"\|"general_harms"\|null, explanation: string\|null}`; "only non-null for the `refusal` stop reason". | [TS-MSG:1987-1992, :2230-2260]; [DOC-STOP] |
| `usage` | `Usage` | see 2.1 | [TS-MSG:2025-2042] |
| `container` | `Container \| null` | `{id, expires_at, skills: [...] \| null}`; non-null only when a container tool ran. | [TS-MSG:1928-1933, :1696-1709] |
| `diagnostics` | `Diagnostics \| null` | `{cache_miss_reason: ... \| null}`; null unless the request supplied `diagnostics`. | [TS-MSG:1969-1973, :1770-1778] |

The reference example response contains only `id, type, role, model, content, stop_reason, stop_sequence, usage` (with the four token counters) [API-MSG example]; `container`, `diagnostics` and `stop_details` are absent from every documented example, so clients must tolerate their absence (confirmed in section 8).

Stop-reason semantics [DOC-STOP]; [TS-MSG:1994-2010]: `end_turn` natural stop; `max_tokens` cap hit (a `tool_use` block cut off mid-input is incomplete; retry with higher `max_tokens`); `stop_sequence`; `tool_use` ("the model invoked one or more tools"; a `server_tool_use` without a result block in the same response means that server call is pending); `pause_turn` (server-tool loop paused, default 10 iterations; resend the assistant content as-is with the same `tools`); `refusal` (classifier intervention, HTTP 200); `model_context_window_exceeded`.

### 2.1 `usage`

`{input_tokens: number, output_tokens: number, cache_creation_input_tokens: number|null, cache_read_input_tokens: number|null, cache_creation: {ephemeral_5m_input_tokens, ephemeral_1h_input_tokens}|null, server_tool_use: {web_search_requests: number, web_fetch_requests: number}|null, service_tier: "standard"|"priority"|"batch"|null, inference_geo: string|null, output_tokens_details: {thinking_tokens: number}|null}` [TS-MSG:2894-2936, :942-951, :2283-2292, :2122-2134]. "Total input tokens in a request is the summation of `input_tokens`, `cache_creation_input_tokens`, and `cache_read_input_tokens`"; "`output_tokens` will be non-zero, even for an empty string response" [TS-MSG:2036-2040]. `input_tokens` counts only tokens after the last cache breakpoint [API-RATELIMITS "Cache-aware ITPM"].

### 2.2 Content blocks out (`ContentBlock`)

Union: `TextBlock | ThinkingBlock | RedactedThinkingBlock | ToolUseBlock | ServerToolUseBlock | WebSearchToolResultBlock | WebFetchToolResultBlock | CodeExecutionToolResultBlock | BashCodeExecutionToolResultBlock | TextEditorCodeExecutionToolResultBlock | ToolSearchToolResultBlock | ContainerUploadBlock` [TS-MSG:1759].

| Block | Shape | Source |
| --- | --- | --- |
| `text` | `{type:"text", text: string, citations: TextCitation[] \| null}` | [TS-MSG:2338-2349] |
| `tool_use` | `{type:"tool_use", id: string, name: string, input: object, caller: {type:"direct"} \| {type:"code_execution_20250825", tool_id} \| {type:"code_execution_20260120", tool_id}, toolset_name?: string \| null}`. Doc examples use ids like `toolu_01A09q90qw90lq917835lq9` and omit `caller`. | [TS-MSG:2860-2870, :1796-1798]; [DOC-HANDLE]; [TS-MSG:3722-3730] |
| `thinking` | `{type:"thinking", thinking: string, signature: string}`; `thinking` is `""` under `display: "omitted"` (the default on Fable 5.x, Mythos 5.x, Opus 5.5/5/4.8/4.7, Sonnet 5.5/5). | [TS-MSG:2430-2449]; [DOC-THINKING "Controlling thinking display"] |
| `redacted_thinking` | `{type:"redacted_thinking", data: string}` | [TS-MSG:2203-2218] |
| `server_tool_use` | `{type:"server_tool_use", id: string ("srvtoolu_" prefix), name, input, caller}` | [TS-MSG:2293-2299]; [DOC-SERVER "The server_tool_use block"] |
| `web_search_tool_result` | `{type:"web_search_tool_result", tool_use_id, caller, content: WebSearchResultBlock[] \| {type:"web_search_tool_result_error", error_code}}`; `WebSearchResultBlock = {type:"web_search_result", url, title, encrypted_content, page_age: string\|null}`; `error_code` in `invalid_tool_input \| unavailable \| max_uses_exceeded \| too_many_requests \| query_too_long \| request_too_large`. A successful search with no hits returns an empty `content` list, not an error. | [TS-MSG:3460-3466, :3293-3299, :3478-3482]; [DOC-WEBSEARCH "Errors"] |
| `web_fetch_tool_result` | `{type:"web_fetch_tool_result", tool_use_id, caller, content: {type:"web_fetch_result", url, retrieved_at: string\|null, content: {type:"document", source: {type:"text",media_type:"text/plain",data} \| {type:"base64",media_type:"application/pdf",data}, title: string\|null, citations: {enabled}\|null}} \| {type:"web_fetch_tool_result_error", error_code}}`; `error_code` in `invalid_tool_input \| url_too_long \| url_not_allowed \| url_not_in_prior_context \| url_not_accessible \| unsupported_content_type \| too_many_requests \| max_uses_exceeded \| unavailable \| content_too_large`. | [TS-MSG:3206-3230, :2958-2969, :1799-1810]; [DOC-WEBFETCH "Response", "Errors"] |
| `mcp_tool_use` / `mcp_tool_result` (beta) | `{type:"mcp_tool_use", id ("mcptoolu_"), name, server_name, input}`, `{type:"mcp_tool_result", tool_use_id, is_error, content: [text...]}` | [DOC-MCP "Response content types"] |

Citations (`TextCitation`): `char_location {cited_text, document_index, document_title, start_char_index, end_char_index, file_id}`, `page_location {... start_page_number, end_page_number ...}`, `content_block_location {... start_block_index, end_block_index ...}`, `web_search_result_location {type, url, title: string|null, encrypted_index, cited_text}`, `search_result_location {...}` [TS-MSG:2359, :991-999, :1061-1069, :1008-1034, :1165-1171, :1130-1164]. Web search citation fields `cited_text`, `title`, `url` are not billed; `cited_text` is up to 150 characters [DOC-WEBSEARCH "Citations"].

---

## 3. Streaming protocol

### 3.1 Framing

- Server-Sent Events, each with a named event and a JSON `data` line whose `type` field equals the event name: `event: message_stop` / `data: {"type":"message_stop"}` [DOC-STREAM "Event types"].
- API version `2023-06-01` defines this format: incremental completions, all events are named events (not data-only), and the `data: [DONE]` terminator was removed [API-VERSIONING "Version history"].
- Decoder behaviour in both SDKs: lines are split on `\n` (a trailing `\r` is stripped), `event:` sets the name, `data:` lines accumulate and are joined with `\n`, a leading space after the colon is stripped, lines starting with `:` are comments, and a blank line dispatches the event [TS-SSE `SSEDecoder.decode`]; Python additionally parses `id:` and `retry:` and dispatches on `\r\r`, `\n\n` or `\r\n\r\n` [PY-SSE].
- Neither SDK checks the response `Content-Type` before decoding a stream; the TS stream reads `response.body` directly [TS-SSE `_iterSSEMessages`], Python builds the stream from `self._is_sse_stream` without a header check [PY-RESP `_parse`].

### 3.2 Event sequence

1. `message_start` with a `Message` whose `content` is `[]` and whose `stop_reason` is `null`.
2. Zero or more content blocks, each `content_block_start` -> `content_block_delta`* -> `content_block_stop`, where `index` is the block's position in the final `content` array.
3. One or more `message_delta` events with top-level changes and **cumulative** `usage`.
4. A final `message_stop`.

`ping` events may appear anywhere; `error` events may appear anywhere; "new event types may be added, and your code should handle unknown event types gracefully" [DOC-STREAM "Event types", "Ping events", "Error events", "Other events"].

### 3.3 Event payloads

| Event | `data` shape | Source |
| --- | --- | --- |
| `message_start` | `{type:"message_start", message: Message}` | [TS-MSG:2195-2198] |
| `content_block_start` | `{type:"content_block_start", index: number, content_block: ContentBlock}`; for `tool_use`/`server_tool_use` the doc transcripts send `input: {}`; server tool *result* blocks arrive complete here with no deltas. | [TS-MSG:2146-2150]; [DOC-STREAM transcripts]; [DOC-SERVER "Streaming server-tool events"] |
| `content_block_delta` | `{type:"content_block_delta", index, delta}` with `delta` one of `{type:"text_delta", text}`, `{type:"input_json_delta", partial_json}`, `{type:"citations_delta", citation}`, `{type:"thinking_delta", thinking}`, `{type:"signature_delta", signature}`. | [TS-MSG:2140-2145, :2361-2364, :1882-1885, :1126-1129, :2515-2523, :2311-2319] |
| `content_block_stop` | `{type:"content_block_stop", index}` | [TS-MSG:2151-2154] |
| `message_delta` | `{type:"message_delta", delta: {stop_reason, stop_sequence, stop_details?, container?}, usage: {output_tokens: number, input_tokens?: number\|null, cache_creation_input_tokens?, cache_read_input_tokens?, server_tool_use?, output_tokens_details?}}`; all counters are "cumulative". Doc transcripts send `delta: {"stop_reason":"end_turn","stop_sequence":null}` and `usage: {"output_tokens": 15}`. | [TS-MSG:2155-2194, :2049-2079]; [DOC-STREAM warning and transcripts] |
| `message_stop` | `{type:"message_stop"}` | [TS-MSG:2199-2201] |
| `ping` | `{type:"ping"}` | [DOC-STREAM transcripts] |
| `error` | `{type:"error", error:{type, message}}` (same envelope as HTTP errors, minus `request_id` in the doc example) | [DOC-STREAM "Error events"] |

Delta rules:

- `input_json_delta.partial_json` strings concatenate to the JSON text of `tool_use.input`; the final `input` "is always an *object*". Current models emit one complete key/value at a time, chunked across several deltas; the first delta in the transcripts is an empty string [DOC-STREAM "Input JSON delta" and tool-use transcript].
- Thinking blocks stream `thinking_delta`* then exactly one `signature_delta` "just before the block's `content_block_stop`". With `display: "omitted"`: "The thinking block opens, receives a `thinking_delta` with an empty `thinking` string and then a single `signature_delta`, and closes." [DOC-STREAM "Thinking delta"]; [DOC-THINKING "Streaming thinking"].
- `citations_delta` appends one citation to the text block at `index` [TS-STREAM:497-505].

### 3.4 Transcript: text response (verbatim from [DOC-STREAM "Basic streaming request"])

```
event: message_start
data: {"type": "message_start", "message": {"id": "msg_1nZdL29xx5MUA1yADyHTEsnR8uuvGzszyY", "type": "message", "role": "assistant", "content": [], "model": "claude-opus-5-5", "stop_reason": null, "stop_sequence": null, "usage": {"input_tokens": 25, "output_tokens": 1}}}

event: content_block_start
data: {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}}

event: ping
data: {"type": "ping"}

event: content_block_delta
data: {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "Hello"}}

event: content_block_delta
data: {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "!"}}

event: content_block_stop
data: {"type": "content_block_stop", "index": 0}

event: message_delta
data: {"type": "message_delta", "delta": {"stop_reason": "end_turn", "stop_sequence":null}, "usage": {"output_tokens": 15}}

event: message_stop
data: {"type": "message_stop"}
```

### 3.5 Transcript: client tool_use response (verbatim from [DOC-STREAM "Streaming request with tool use"], text deltas abbreviated to two)

```
event: message_start
data: {"type":"message_start","message":{"id":"msg_014p7gG3wDgGV9EUtLvnow3U","type":"message","role":"assistant","model":"claude-opus-5","stop_sequence":null,"usage":{"input_tokens":472,"output_tokens":2},"content":[],"stop_reason":null}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

event: ping
data: {"type": "ping"}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Okay"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":", let's check the weather for San Francisco, CA:"}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: content_block_start
data: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_01T1x1fJ34qAmk2tNTrN7Up6","name":"get_weather","input":{}}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\"location\":"}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":" \"San"}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":" Francisc"}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"o,"}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":" CA\"}"}}

event: content_block_stop
data: {"type":"content_block_stop","index":1}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"tool_use","stop_sequence":null},"usage":{"output_tokens":89}}

event: message_stop
data: {"type":"message_stop"}
```

### 3.6 Transcript: web search response (verbatim from [DOC-STREAM "Streaming request with web search tool use"]; the doc itself elides blocks 3-17 with `...`)

```
event: message_start
data: {"type":"message_start","message":{"id":"msg_01G...","type":"message","role":"assistant","model":"claude-opus-5-5","content":[],"stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":2679,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"output_tokens":3}}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"I'll check"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" the current weather in New York City for you"}}

event: ping
data: {"type": "ping"}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"."}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: content_block_start
data: {"type":"content_block_start","index":1,"content_block":{"type":"server_tool_use","id":"srvtoolu_014hJH82Qum7Td6UV8gDXThB","name":"web_search","input":{}}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\"query"}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"\":"}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":" \"weather"}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":" NY"}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"C to"}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"day\"}"}}

event: content_block_stop
data: {"type":"content_block_stop","index":1 }

event: content_block_start
data: {"type":"content_block_start","index":2,"content_block":{"type":"web_search_tool_result","tool_use_id":"srvtoolu_014hJH82Qum7Td6UV8gDXThB","content":[{"type":"web_search_result","title":"Weather in New York City in May 2025 (New York) - detailed Weather Forecast for a month","url":"https://world-weather.info/forecast/usa/new_york/may-2025/","encrypted_content":"Ev0DCioIAxgCIiQ3NmU4ZmI4OC1k...","page_age":null},...]}}

event: content_block_stop
data: {"type":"content_block_stop","index":2}

event: content_block_start
data: {"type":"content_block_start","index":3,"content_block":{"type":"text","text":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":3,"delta":{"type":"text_delta","text":"Here's the current weather information for New York"}}

event: content_block_delta
data: {"type":"content_block_delta","index":3,"delta":{"type":"text_delta","text":" City:\n\n# Weather"}}

...

event: content_block_stop
data: {"type":"content_block_stop","index":17}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"input_tokens":10682,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"output_tokens":510,"server_tool_use":{"web_search_requests":1}}}

event: message_stop
data: {"type":"message_stop"}
```

Citations on the later text blocks stream as `citations_delta` events (the doc omits them in this transcript; the non-streaming web search example shows `web_search_result_location` citations on the cited text blocks) [DOC-WEBSEARCH "Response"]; [TS-MSG:1126-1129].

### 3.7 Mid-stream errors

Example from the docs: `event: error` / `data: {"type": "error", "error": {"type": "overloaded_error", "message": "Overloaded"}}`, "which would normally correspond to an HTTP 529 in a non-streaming context" [DOC-STREAM "Error events"]; [API-ERRORS]. SDK handling:

- TS `Stream.fromSSEResponse` throws `new APIError(undefined, body, undefined, response.headers, body.error.type)`, so the message is `body.error.message` and `status` is `undefined`; the `MessageStream` re-emits it as the `error` event and rejects `finalMessage()` [TS-SSE error branch]; [TS-ERR:12-37]; [TS-STREAM:40-59, :300-315].
- Python raises `self._client._make_status_error(err_msg, body=body, response=self.response)`; since the HTTP status is 200 no branch matches and the result is a generic `APIStatusError` with `body` set [PY-SSE error branch]; [PY-CLIENT `_make_status_error` final return].

### 3.8 Fine-grained tool streaming

`eager_input_streaming: true` on a client tool streams `input_json_delta` chunks as generated and removes server-side JSON validation, so the accumulated JSON "may be incomplete (`max_tokens`) or invalid" [TS-MSG:2557-2564]; [DOC-STREAM tip]. Off by default.

---

## 4. Errors

### 4.1 Envelope and status codes

Errors are always JSON with a top-level `error` object containing `type` and `message`, plus a top-level `request_id` [API-ERRORS "Error shapes"]:

```json
{
  "type": "error",
  "error": { "type": "not_found_error", "message": "The requested resource could not be found." },
  "request_id": "req_011CSHoEeqs5C35K2UUqR7Fy"
}
```

| HTTP | `error.type` | Meaning | Source |
| --- | --- | --- | --- |
| 400 | `invalid_request_error` | format/content problem; also used for other unlisted 4xx and for self-set spend limits | [API-ERRORS]; [API-RATELIMITS "Setting your own spend limit"] |
| 401 | `authentication_error` | bad/revoked/expired key | [API-ERRORS] |
| 402 | `billing_error` | billing problem | [API-ERRORS] |
| 403 | `permission_error` | key lacks permission for the resource | [API-ERRORS] |
| 404 | `not_found_error` | resource not found | [API-ERRORS] |
| 409 | `conflict_error` | state conflict | [API-ERRORS] |
| 413 | `request_too_large` | over 32 MB (Messages, count_tokens) | [API-ERRORS "Request size limits"] |
| 429 | `rate_limit_error` | rate limit or spend cap; spend-cap 429s carry `error.details.error_code: "enforced_spend_limit_reached"` and no `retry-after` | [API-ERRORS]; [API-RATELIMITS "Reaching your spend cap"] |
| 500 | `api_error` | internal error | [API-ERRORS] |
| 504 | `timeout_error` | request timed out | [API-ERRORS] |
| 529 | `overloaded_error` | temporarily overloaded | [API-ERRORS] |

Headers: every response (success or error) carries `request-id` (`req_...`), which equals the body's `request_id`; also `anthropic-organization-id` and `anthropic-workspace-id` [API-OVERVIEW "Response headers"]; [API-ERRORS "Request ID"]. 429s carry `retry-after` in seconds plus the `anthropic-ratelimit-{requests,tokens,input-tokens,output-tokens}-{limit,remaining,reset}` headers (reset in RFC 3339) [API-RATELIMITS "Response headers"].

### 4.2 How the SDKs map errors

TypeScript `APIError.generate(status, body, message, headers)` [TS-ERR:38-67]: 400 `BadRequestError`, 401 `AuthenticationError`, 403 `PermissionDeniedError`, 404 `NotFoundError`, 409 `ConflictError`, 422 `UnprocessableEntityError`, 429 `RateLimitError`, >=500 `InternalServerError`, anything else `APIError`. `error.type` is read from `body.error.type`; the message is `${status} ${body.error.message}` (or the raw text when the body is not JSON); `requestID` comes from the `request-id` header [TS-ERR:12-37]; [TS-CLIENT:603-615]. Python `_make_status_error` [PY-CLIENT]: the same set plus 413 `RequestTooLargeError` and 529 `OverloadedError`; 503/504 fall into `InternalServerError`; unmatched statuses return `APIStatusError`; `type` is read from `body["error"]["type"]` and `request_id` from the `request-id` header [PY-EXC].

Retries (both SDKs, default 2): obey a non-standard `x-should-retry: true|false` header, otherwise retry 408, 409, 429 and >=500, honouring `retry-after-ms` then `retry-after` (seconds or HTTP date) with exponential backoff fallback [TS-CLIENT:113, :709-772]; [PY-BASE `_should_retry`, `_parse_retry_timeout`]; [API-ERRORS].

Non-streaming body parsing: TS parses JSON only when the response `content-type` is `application/json` or `*+json`; otherwise `messages.create()` resolves to the raw text [TS-PARSE `internal/parse.js:24-36`]. Python attempts `response.json()` even for a non-JSON content type when the target is a model, falls back to text, and raises `APIResponseValidationError` only in strict mode [PY-RESP `_parse`].

---

## 5. Headers

| Header | Required | Notes | Source |
| --- | --- | --- | --- |
| `Authorization: Bearer <token>` | yes, unless `x-api-key` is set | token is an API key or a short-lived WIF/OAuth token | [API-OVERVIEW "Authentication"] |
| `x-api-key` | no ("legacy fallback for `Authorization`, still supported") | | [API-OVERVIEW] |
| `anthropic-version` | yes ("you must send an `anthropic-version` request header") | current `2023-06-01`; `2023-01-01` is the only other value and is deprecated | [API-VERSIONING]; [API-OVERVIEW] |
| `content-type: application/json` | yes | | [API-OVERVIEW] |
| `anthropic-beta` | no | comma-separated list or repeated header; unknown value returns 400 `invalid_request_error`: ``Unexpected value(s) `invalid-beta-name` for the `anthropic-beta` header. ...`` | [API-BETA] |
| `anthropic-workspace-id` | required only for multi-workspace keys | | [API-OVERVIEW]; [API-COUNT "Headers"] |
| `anthropic-user-profile-id` | no (needs `user-profiles` beta) | | [API-COUNT "Headers"]; [TS-MSG:3767-3771] |
| `anthropic-dangerous-direct-browser-access: true` | no | sent by the TS SDK only when `dangerouslyAllowBrowser: true`; the browser is "disabled by default to avoid exposing your secret API credentials" | [TS-CLIENT:839-841]; TS SDK README |

What the TypeScript SDK sends on every request [TS-CLIENT:831-850]: `Accept: application/json`, `User-Agent`, `X-Stainless-Retry-Count`, `X-Stainless-Timeout`, platform headers (`X-Stainless-*`), conditionally `anthropic-dangerous-direct-browser-access`, `anthropic-version: 2023-06-01`, then the auth headers (`X-Api-Key` when `apiKey` is set, `Authorization: Bearer` when `authToken` or an OAuth/WIF token cache is used) [TS-CLIENT:348-377], then `defaultHeaders`, body headers and per-request headers. When token-cache auth is used it also appends `oauth-2025-04-20` to `anthropic-beta` [TS-CLIENT:428-450]; [`lib/credentials/types.js:50`]. If neither `x-api-key` nor `authorization` ends up set, the client throws `Could not resolve authentication method...` before sending [TS-CLIENT:316-338]. The Python SDK sends `anthropic-version: 2023-06-01`, `X-Stainless-Async`, and `X-Api-Key` / `Authorization: Bearer` the same way [PY-CLIENT `default_headers`, `_api_key_auth`, `_bearer_auth`].

Timeouts: TS default 10 minutes; for a non-streaming request with `max_tokens` such that `60*60*max_tokens/128000 > 600` seconds the client throws `Streaming is required for operations that may take longer than 10 minutes` without sending [TS-CLIENT:104, :402-410, :912]. The SDKs also "validate that your non-streaming Messages API requests are not expected to exceed a 10-minute timeout" and set TCP keep-alive [API-ERRORS "Long requests"].

---

## 6. Companion endpoints

### 6.1 `GET /v1/models` and `GET /v1/models/{model_id}`

Query: `after_id`, `before_id`, `limit` (default 20, 1-1000). Response: `{data: ModelInfo[], first_id: string|null, last_id: string|null, has_more: boolean}`; "more recently released models are listed first" [API-MODELS]. `GET /v1/models/{model_id}` takes a "model identifier or alias" and returns one `ModelInfo`; it "can be used to ... resolve a model alias to a model ID" [API-MODELS]; [TS-MODELS:7-18].

`ModelInfo` [API-MODELS]; [TS-MODELS:136-169]:

```
{
  "type": "model",
  "id": "claude-opus-5",
  "display_name": "Claude Opus 5",
  "created_at": "2026-07-24T00:00:00Z",          // RFC 3339; may be an epoch value if unknown
  "max_input_tokens": 200000 | null,              // context window
  "max_tokens": 32000 | null,                     // max value of the max_tokens request param
  "capabilities": null | {
    "batch": {"supported": bool},
    "citations": {"supported": bool},
    "code_execution": {"supported": bool},
    "context_management": {"supported": bool, "clear_thinking_20251015": {...}|null, "clear_tool_uses_20250919": {...}|null, "compact_20260112": {...}|null},
    "effort": {"supported": bool, "low": {...}, "medium": {...}, "high": {...}, "xhigh": {...}|null, "max": {...}},
    "image_input": {"supported": bool},
    "pdf_input": {"supported": bool},
    "structured_outputs": {"supported": bool},
    "thinking": {"supported": bool, "types": {"adaptive": {...}, "enabled": {...}}}
  }
}
```

"Keys are always present for all known capabilities" when `capabilities` is non-null [TS-MODELS:141-145]. The SDK's `client.models.list()` auto-paginates by following `has_more`/`last_id`, so a listing must return `has_more: false` to terminate [TS-MODELS:19-33]; [API-OVERVIEW "Pagination" note].

### 6.2 `POST /v1/messages/count_tokens`

Body: `messages` and `model` required; optional `system`, `tools` (`MessageCountTokensTool` union, same tool types as Messages), `tool_choice`, `thinking`, `output_config`, `cache_control` [API-COUNT "Body parameters"]; [TS-MSG:3813-4020, :2044]. Response: `{"input_tokens": 2095}` only, "the total number of tokens across the provided list of messages, system prompt, and tools" [API-COUNT "Returns"]; [TS-MSG:2084-2090]. Same forced-`tool_choice` 400 as Messages on the affected models [API-ERRORS].

---

## 7. Web search as a client sees it

### 7.1 Tool definitions

Three versions: `web_search_20250305` (basic), `web_search_20260209` (adds dynamic filtering via code execution), `web_search_20260318` (adds `response_inclusion`) [DOC-WEBSEARCH intro]. All share `name: "web_search"` [TS-MSG:3313, :3362, :3411].

```json
{
  "type": "web_search_20250305",
  "name": "web_search",
  "max_uses": 5,
  "allowed_domains": ["example.com", "trusteddomain.org"],
  "blocked_domains": ["untrustedsource.com"],
  "user_location": {"type": "approximate", "city": "San Francisco", "region": "California", "country": "US", "timezone": "America/Los_Angeles"}
}
```
[DOC-WEBSEARCH "Tool definition"]

Optional fields per the SDK: `max_uses: number|null`, `allowed_domains`/`blocked_domains: string[]|null` ("Cannot be used alongside" each other), `user_location: {type:"approximate", city?, region?, country? (ISO 3166-1 alpha-2), timezone? (IANA)}`, `cache_control`, `defer_loading`, `strict`, `allowed_callers`; `20260318` adds `response_inclusion: "full"|"excluded"` [TS-MSG:3307-3455, :2937-2957]. Rules: providing both domain lists returns 400; domains have no scheme, subdomains are included, a path suffix matches anything under it, `*` is allowed only in the path; invalid formats return 400 [DOC-WEBSEARCH "Domain filtering"]; [DOC-SERVER "Domain filtering"]. `allowed_callers` defaults to `["direct"]` on 20250305 and to `["code_execution_20260120"]` on 20260209+; models without programmatic tool calling need `allowed_callers: ["direct"]` or get a 400 [DOC-WEBSEARCH "Dynamic filtering"]; [DOC-SERVER "ZDR and allowed_callers"]. If web search is disabled for the organization, the request fails with 400 `invalid_request_error` rather than an in-result error [DOC-WEBSEARCH "How to use web search"].

### 7.2 Response shape (verbatim structure from [DOC-WEBSEARCH "Response"])

```json
{
  "role": "assistant",
  "content": [
    {"type": "text", "text": "I'll search for when Claude Shannon was born."},
    {"type": "server_tool_use", "id": "srvtoolu_01WYG3ziw53XMcoyKL4XcZmE", "name": "web_search", "input": {"query": "claude shannon birth date"}},
    {"type": "web_search_tool_result", "tool_use_id": "srvtoolu_01WYG3ziw53XMcoyKL4XcZmE",
     "content": [{"type": "web_search_result", "url": "https://en.wikipedia.org/wiki/Claude_Shannon", "title": "Claude Shannon - Wikipedia", "encrypted_content": "EqgfCioIARgBIiQ3YTAwMjY1Mi1mZjM5LTQ1NGUtODgxNC1kNjNjNTk1ZWI3Y...", "page_age": "April 30, 2025"}]},
    {"text": "Based on the search results, ", "type": "text"},
    {"text": "Claude Shannon was born on April 30, 1916, in Petoskey, Michigan", "type": "text",
     "citations": [{"type": "web_search_result_location", "url": "https://en.wikipedia.org/wiki/Claude_Shannon", "title": "Claude Shannon - Wikipedia", "encrypted_index": "Eo8BCioIAhgBIiQyYjQ0OWJmZi1lNm..", "cited_text": "Claude Elwood Shannon (April 30, 1916 – February 24, 2001) was an American mathematician, electrical engineer, computer scientist, cryptographer and i..."}]}
  ],
  "id": "msg_a930390d3a",
  "usage": {"input_tokens": 6039, "output_tokens": 931, "server_tool_use": {"web_search_requests": 1}},
  "stop_reason": "end_turn"
}
```

- `server_tool_use` and `web_search_tool_result` pair by `tool_use_id`, not by position; ids use the `srvtoolu_` prefix [DOC-SERVER].
- Citations are always enabled for web search; each `web_search_result_location` has `url`, `title`, `encrypted_index` ("must be passed back for multi-turn conversations") and `cited_text` (up to 150 characters) [DOC-WEBSEARCH "Citations"].
- Replay: "send the assistant's content blocks back exactly as you received them, including each result's `encrypted_content`. ... If `encrypted_content` is missing or modified, the request fails with a 400 validation error." [DOC-WEBSEARCH "Search results"].
- Errors come back inside a 200 as `{"type":"web_search_tool_result","tool_use_id":"srvtoolu_a93jad","content":{"type":"web_search_tool_result_error","error_code":"max_uses_exceeded"}}`; the content is an object for an error and a list for success; codes `too_many_requests`, `invalid_tool_input`, `max_uses_exceeded`, `query_too_long`, `request_too_large`, `unavailable` [DOC-WEBSEARCH "Errors"]; [TS-MSG:3482].
- `pause_turn`: resend the paused assistant message unchanged with the same `tools`. Mixed with a client tool: `stop_reason: "tool_use"`, the `server_tool_use` appears without a result block, and the next request (user message containing only `tool_result` blocks, same `tools`) starts with that result block [DOC-WEBSEARCH "pause_turn stop reason"]; [DOC-SERVER "Mixing server tools and client tools in one turn"].
- Usage: `usage.server_tool_use.web_search_requests` counts searches ("Each web search counts as one use, regardless of the number of results returned. If an error occurs during web search, the web search will not be billed"); $10 per 1,000 searches plus tokens; results count as input tokens on later turns [DOC-WEBSEARCH "Usage and pricing"].
- Streaming: `server_tool_use` streams like `tool_use` (`content_block_start` with `input: {}` then `input_json_delta`), and "the result block arrives complete in a single `content_block_start` event, with no deltas" (section 3.6) [DOC-SERVER "Streaming server-tool events"]; [DOC-STREAM].

### 7.3 Web fetch (for completeness)

`{type: "web_fetch_20250910"|"web_fetch_20260209"|"web_fetch_20260309"|"web_fetch_20260318", name: "web_fetch", max_uses?, allowed_domains?|blocked_domains?, citations?: {enabled}, max_content_tokens?, use_cache? (20260309+), response_inclusion? (20260318), url_sources?}`; result shape in section 2.2; only URLs already present in the conversation can be fetched; `usage.server_tool_use.web_fetch_requests`; no per-fetch charge [TS-MSG:2982-3205]; [DOC-WEBFETCH].

---

## 8. Minimum viable response: what the official SDKs actually require

### 8.1 Non-streaming `POST /v1/messages`

TypeScript `client.messages.create()`:
1. HTTP 2xx, else `APIError.generate` throws (after up to 2 retries for 408/409/429/5xx) [TS-CLIENT:603-615, :709-740].
2. `content-type: application/json` (or `+json`), else the promise resolves to the body *text* and user code breaks on `message.content` [TS-PARSE `internal/parse.js:24-36`].
3. Body is `JSON.parse`d and returned as-is with non-enumerable `_request_id`/`_workspace_id` copied from headers. **No field is validated.** [TS-PARSE `internal/parse.js:33-34, :57-66`].
4. `maybeParseMessage` only touches `content` when `output_config.format` has a parse function (zod helper); otherwise it maps `content` (so `content` must be an array) and sets `parsed_output: null` [TS-PARSE `lib/parser.js`].

Python `client.messages.create()`:
1. HTTP 2xx, else `_make_status_error_from_response` (JSON body preferred, text fallback) [PY-BASE].
2. Body parsed with `construct_type` because `_strict_response_validation` defaults to `False`; `construct_type` does not validate, so missing fields simply become missing attributes and extra fields are kept. `validate_type` (pydantic validation, raising `APIResponseValidationError`) runs only in strict mode [PY-BASE `_process_response_data`]; [PY-CLIENT constructor default].
3. A non-JSON content type is tolerated when the body still parses as JSON [PY-RESP `_parse`].

Must-emit for non-streaming: a 2xx JSON body with `content` as an array. Everything else is "must to be useful": `id`, `type: "message"`, `role: "assistant"`, `model`, `stop_reason` (non-null), `stop_sequence`, `usage.input_tokens`, `usage.output_tokens`, matching the reference example [API-MSG example]. Nice-to-emit: `cache_creation_input_tokens`, `cache_read_input_tokens` (present as `0` in the reference example), `stop_details: null`, `container: null`, `diagnostics: null`, `usage.service_tier`, `usage.inference_geo`, `cache_creation`, `output_tokens_details`.

### 8.2 Streaming: TypeScript `client.messages.stream(...).finalMessage()`

`messages.stream()` forces `stream: true` and feeds every decoded event to `#accumulateMessage` [TS-STREAM:121-129, :145-173]. For `finalMessage()` to resolve:

| # | Requirement | What happens otherwise | Source |
| --- | --- | --- | --- |
| 1 | HTTP 2xx | `APIError` thrown before any SSE is read | [TS-CLIENT:603-615] |
| 2 | Well-formed SSE: `event:`/`data:` lines, blank-line dispatch | events never dispatch; stream ends with "request ended without sending any chunks" | [TS-SSE `SSEDecoder`]; [TS-STREAM:432-439] |
| 3 | Event names in the recognised set; `ping` is skipped; any other unknown name is silently dropped; `error` throws | `error` -> `APIError(undefined, body, ..., body.error.type)` | [TS-SSE `fromSSEResponse`] |
| 4 | `data` of recognised events is valid JSON | `JSON.parse` throws (logged "Could not parse message into JSON") | [TS-SSE] |
| 5 | First event is `message_start`; no second `message_start` before `message_stop` | `AnthropicError("Unexpected event order, got X before \"message_start\"")` / `... before receiving "message_stop"` | [TS-STREAM:444-452] |
| 6 | `message_start.message.content` is an array and `message_start.message.usage` is an object | `content_block_start` does `snapshot.content.push(...)`; `message_delta` does `snapshot.usage.output_tokens = ...` -> `TypeError` | [TS-STREAM:482-484, :460] |
| 7 | Content block indices are 0..n-1 in arrival order | blocks are appended with `push`; deltas address `content.at(event.index)`, so a gap or reorder applies deltas to the wrong block (silently) | [TS-STREAM:483, :486] |
| 8 | Delta types match block types (`text_delta` on `text`, `input_json_delta` on `tool_use`/`server_tool_use`, `thinking_delta`/`signature_delta` on `thinking`, `citations_delta` on `text`) | mismatches and unknown `delta.type` are silently ignored (`checkNever` is a runtime no-op) | [TS-STREAM:13-15, :485-535]; [TS-PARSE `internal/utils/values.js:124`] |
| 9 | `message_delta` has a `delta` object and `usage.output_tokens` | `event.delta.stop_reason` / `event.usage.output_tokens` -> `TypeError` when `delta` or `usage` is missing; `stop_reason`/`stop_sequence`/`stop_details` may be `null`; other counters are copied only when non-null | [TS-STREAM:456-481] |
| 10 | `message_stop` is sent | only `message_stop` pushes the snapshot into `receivedMessages`; without it `finalMessage()` throws `stream ended without producing a Message with role=assistant` | [TS-STREAM:415-419, :350-354] |
| 11 | The HTTP body closes after `message_stop` | `_createMessage` awaits the end of the stream before `#endRequest`; an idle open connection hangs until the client timeout | [TS-STREAM:156-166] |

Tool input: the `input_json_delta` buffer is parsed lazily with the vendored `partialParse` (= `JSON.parse(repair(buf))`) on first read of `block.input`, so `finalMessage()` itself cannot fail on bad JSON but reading `.input` throws a `SyntaxError` if the text is unrepairable; an empty buffer yields `{}` [TS-PARSE `internal/message-stream-utils.js`, `_vendor/partial-json-parser/parser.js:249`]. `finalText()` additionally requires at least one `text` block [TS-STREAM:355-366]. With a zod `output_config.format`, every text block must be valid JSON or `AnthropicError("Failed to parse structured output: ...")` is thrown [TS-PARSE `lib/parser.js`].

### 8.3 Streaming: Python `client.messages.stream(...)` -> `get_final_message()`

| # | Requirement | What happens otherwise | Source |
| --- | --- | --- | --- |
| 1 | HTTP 2xx | `APIStatusError` subclass raised | [PY-BASE] |
| 2 | Well-formed SSE (`event:`, `data:`, optional `id:`/`retry:`, blank-line dispatch) | nothing dispatches | [PY-SSE `SSEDecoder`] |
| 3 | Recognised event names; `data["type"]` is injected from the event name if absent; `ping` skipped; unknown names silently skipped; `error` raises | `error` -> `_make_status_error(...)` -> generic `APIStatusError` (status 200) | [PY-SSE]; [PY-CLIENT] |
| 4 | First event is `message_start` | `RuntimeError('Unexpected event order, got {type} before "message_start"')` | [PY-STREAM `accumulate_event`] |
| 5 | `message_start.message` has `content` (list) and `usage` | snapshot is `ParsedMessage.construct(**event.message.to_dict())` (no validation); `content_block_start` appends to `current_snapshot.content`, `message_delta` sets `current_snapshot.usage.output_tokens` -> `AttributeError` if absent | [PY-STREAM] |
| 6 | `message_delta` has `delta` and `usage.output_tokens` | attribute errors as above; optional counters copied only when not `None` | [PY-STREAM `message_delta` branch] |
| 7 | `input_json_delta` buffers parse with `jiter.from_json(partial_mode=True)` **at delta time** | `ValueError("Unable to parse tool parameter JSON from model. Please retry your request or adjust your prompt. ...")` raised while iterating (stricter than TS) | [PY-STREAM `input_json_delta` branch] |
| 8 | Stream ends (HTTP body closes) | `get_final_message()` runs `until_done()` (consumes the iterator) then `assert self.__final_message_snapshot is not None`; unlike TS it does **not** require `message_stop`, only that `message_start` was seen | [PY-STREAM `get_final_message`] |

### 8.4 Must-emit versus nice-to-emit (streaming)

Must-emit (either SDK breaks without it): correct SSE framing; `message_start` carrying `message.content: []` and `message.usage: {input_tokens, output_tokens}`; contiguous `index` values; `content_block_stop` for each block; at least one `message_delta` with `delta: {stop_reason, stop_sequence}` and `usage: {output_tokens}`; a final `message_stop` (TS); valid JSON in every `data` line; closing the response after `message_stop`. For `tool_use` blocks, `content_block_start` with `input: {}` followed by `input_json_delta` chunks that concatenate to valid JSON (Python parses eagerly).

Nice-to-emit (tolerated when absent by both accumulators and absent from the official transcripts): `ping` events; `stop_details`, `container`, `diagnostics` in `message_start.message` or `message_delta.delta`; `cache_*`, `server_tool_use`, `output_tokens_details`, `inference_geo`, `service_tier` in usage; `citations` on text blocks (`null` is fine); `caller` on `tool_use`/`server_tool_use` blocks.

---

## 9. Implications for the surface

1. **Framing is the hard part, not the field count.** Both accumulators are lenient on fields but strict on event order: `message_start` first, blocks with contiguous indices, `message_delta` with `usage.output_tokens`, `message_stop` last, then close the connection. A simulated stream that emits a single text block in several `text_delta` events after the upstream run finishes satisfies both SDKs (sections 3.4, 8.2, 8.3). Real incremental streaming is a quality choice, not a compatibility one, except that the TS client refuses to send non-streaming requests whose `max_tokens` implies more than 10 minutes and times out non-streaming calls at 10 minutes (section 5).
2. **Client tools can be emitted exactly as the real API does.** A `tool_use` block needs `id` (`toolu_` prefix in all examples), `name`, `input` object; the surface then expects the next user message to open with `tool_result` blocks in the documented order (section 1.2). The ids are opaque to clients, so the tool bridge can mint them.
3. **Server tools need the pairing, not the encryption.** For web search the surface must emit `server_tool_use` (`srvtoolu_` id, `input.query`) plus a `web_search_tool_result` with `web_search_result` items (`url`, `title`, `encrypted_content`, `page_age`), report `usage.server_tool_use.web_search_requests`, and accept the same blocks back on replay. `encrypted_content`/`encrypted_index` are opaque to clients, so the surface can carry its own payload there; the only documented rule is that the real API 400s when they are missing or modified on replay (section 7.2). Citations are optional for SDK acceptance.
4. **Errors are cheap to get right.** Status code plus `{type:"error", error:{type,message}, request_id}` plus a `request-id` header is the entire contract both SDKs read; `retry-after` on 429 and `x-should-retry: false` on deterministic failures steer client retries (section 4).
5. **Headers.** SDKs always send `anthropic-version: 2023-06-01` and one of `x-api-key`/`Authorization: Bearer`; the real API requires the version header and accepts either credential header. Whether the surface rejects a missing version header or unknown `anthropic-beta` values (the real API 400s) is a fidelity decision for the spec, not a client-compatibility one (section 5).
6. **Non-streaming responses must be `application/json`** or the TS SDK returns text (section 8.1).
7. **Parameter rejection is model-specific upstream.** `temperature`/`top_p`/`top_k` non-defaults, `tool_choice: any|tool`, `thinking.type` variants and assistant prefill all 400 on current models with specific messages (section 1.1); the surface can mirror those messages or accept-and-ignore, but SDK clients do not depend on either.
8. **Companion endpoints are small.** `GET /v1/models` needs `data[]` of `ModelInfo` with `has_more: false` to stop SDK auto-pagination; `GET /v1/models/{id}` returns one `ModelInfo` and may resolve aliases; `count_tokens` returns only `{input_tokens}` (section 6).
9. **Open question for the spec (not resolvable from primary sources).** The exact `id` formats (`msg_`, `toolu_`, `srvtoolu_`, `req_`) are conventions seen in every example, not documented guarantees ("The format and length of IDs may change over time"); no SDK parses them.
