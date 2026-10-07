# Error envelope and auth headers

Type: grilling
Status: resolved
Blocked by: 03

## Question

How do the surface's errors and auth look to an Anthropic SDK client? Map the wrapper's existing error classes (`InvalidRequestError`, `ClaudeCliError` 503, `TimeoutError` 408, `ValidationError`) and upstream failures (CLI not found, auth failure, rate limit, unknown model, killed run) to Anthropic error types and HTTP codes (`invalid_request_error`, `authentication_error`, `not_found_error`, `rate_limit_error`, `api_error`, `overloaded_error`), including the `request-id` header and mid-stream `error` events. Decide how the wrapper's optional API key is checked on this surface (`x-api-key` and/or `Authorization: Bearer`, since the OpenAI surface uses Bearer), whether `anthropic-version` is required and which values are accepted, and whether unknown `anthropic-beta` flags are ignored. **Collision**: the shared error handler (`app/src/api/middleware/error.ts`) and the JSON-parse failure path emit the OpenAI envelope for every route, and the auth middleware reads `Authorization: Bearer` only. Per [Destination and target clients](01-destination-and-target-clients.md) the Anthropic approach wins where they collide; decide whether the envelope is chosen per route prefix or the Anthropic envelope becomes the default for everything outside `/v1/chat/completions`.

Record the table on this ticket.

## Facts from research

- Upstream reports failures in `result` as `is_error` + `subtype` + `api_error_status` (404, 401, 429, 5xx) + `errors[]`, which map directly to `not_found_error`, `authentication_error`, `rate_limit_error`, `api_error`/`overloaded_error`. Auth failures retry ten times with backoff for minutes before any `result`, so the surface needs its own per-run timeout and should read `system/api_retry` lines to fail early. SIGTERM gives exit 143 and no `result`. Live 429 and OAuth-expiry shapes could not be triggered ([CLI contract](02-cli-headless-io-contract.md) §7).
- The real envelope is `{type:"error", error:{type,message}, request_id}` with a `request-id` header on every response and `retry-after` on 429; mid-stream errors are an `event: error`. `anthropic-version` is required and SDKs always send `2023-06-01`; auth is `x-api-key` or `Authorization: Bearer`, either accepted ([wire contract](03-messages-api-wire-contract.md) §4, §5).
- Prior art reports a server-side 400 "Third-party apps now draw from extra usage" since late September 2026; decide how the surface relays it ([Prior art](05-prior-art.md), pitfalls).

## Decided in Conversation state and system prompt (2026-10-04)

Request validation 400s this ticket owns the wording and envelope for (all `invalid_request_error`): first message not `user`; last message `assistant` (the API's text: "This model does not support assistant message prefill. The conversation must end with a user message."); empty `content: []` or an empty text block; `role: "system"` inside `messages`; unsupported content block sources (`file`, `search_result`, and whatever [Image and document block pass-through upstream](18-image-and-document-pass-through-upstream.md) finds upstream drops), each naming the block type. Upstream API errors on forwarded images and documents (size limits) map through this ticket's envelope. See [Conversation state and system prompt](10-conversation-state-and-system-prompt.md) decisions 8 and 9.

## Found in MCP tool name limits upstream (2026-10-04)

`tools[].name` validation: `^[a-zA-Z0-9_-]{1,115}$`. Names of 116 to 128 characters (legal on the real API, over 128 once prefixed `mcp__client__`) are a wrapper-side 400 `invalid_request_error` before any run is spawned, message `tools.<i>.custom.name: String should have at most 115 characters` with `<i>` the client's index. Upstream itself passes long names through verbatim and the API rejects the whole request; see [MCP tool name limits upstream](17-mcp-tool-name-limits-upstream.md).

## Found in Image and document block pass-through upstream (2026-10-04)

- Concrete 400s for content blocks: `image`/`url`, `document`/`url`, `file` sources and `search_result` are wrapper-side 400 `invalid_request_error` naming the block type (the first two because the API behind Claude Code answers `400 Unable to download the file`).
- Shape of an upstream API error mid-run: `result` with `subtype: "success"`, `is_error: true`, `api_error_status: <status>`, and the API's message as `result.result` text; the CLI's `assistant` frame may carry `error`. Map `api_error_status` to the Anthropic error type, not the `subtype`. See [Image and document block pass-through upstream](18-image-and-document-pass-through-upstream.md) and [CLI contract](02-cli-headless-io-contract.md) §7.

## Decided in Web search and built-in tools policy (2026-10-04)

400 `invalid_request_error`: a `web_search_*` or `web_fetch_*` tool with both `allowed_domains` and `blocked_domains` (the real API's rule); any server-tool type other than web search and web fetch (`code_execution_*`, `text_editor_*`, `bash_*`, `computer_*`, `memory_*`, `tool_search_*`, `browser_*`), naming the type. In-result error codes (`max_uses_exceeded`, `unavailable`, `url_not_allowed`, `url_not_accessible`) are content blocks inside a 200, not HTTP errors. See [Web search and built-in tools policy](08-web-search-and-built-in-tools-policy.md) decisions 1, 2, 5.

## Decided in Streaming fidelity (2026-10-07)

- The HTTP status is committed at the turn's first relayed `message_start`. **Before** commit, an upstream failure is a real HTTP error status; **after** commit it is one SSE `error` event `{type: "error", error: {type, message}}`, then the run is interrupted and the upstream session forgotten. This ticket owns the mapping from `system/api_retry.error` categories (`authentication_failed`, `rate_limit`, `overloaded`, `invalid_request`, `model_not_found`, `server_error`, `billing_error`, …), `result.api_error_status` and `result.errors[]` to both the HTTP status and the SSE `error.error.type` (`overloaded_error`, `rate_limit_error`, `api_error`, `authentication_error`, …), and whether the SSE `error` data carries `request_id` (the docs' example omits it).
- Upstream's retry loop is capped at 60 s without a new model-call frame; the failure then maps the **last** `api_retry.error` seen.
- Because commit is deferred, `request-id` and `anthropic-ratelimit-*` headers are possible: the first `rate_limit_event` arrives before `message_start`. Whether to emit them is this ticket's.

See [Streaming fidelity](09-streaming-fidelity.md) decisions 8, 9, 10.

## Decided in Model and parameter mapping (2026-10-07)

- The `anthropic-version` header is the **surface discriminator** on any path both surfaces share: `GET /v1/models` serves the Anthropic shape when it is present and today's OpenAI handler when absent (decision 2). Whether `/v1/messages` rejects a missing header remains this ticket's.
- Messages this ticket's envelope carries: unknown `model` is 404 `not_found_error` with the real API's `model: <name>`, both when the catalogue does not resolve it (pre-spawn) and when upstream answers `api_error_status: 404` for a catalogued model the login cannot use (decision 1). Pre-spawn 400s with their own messages: `max_tokens` out of range, `temperature`/`top_p`/`top_k` non-defaults, unsupported `thinking.type`, unknown or unsupported `output_config.effort`, `container`, and unknown or beta-only body fields ("Extra inputs are not permitted", exact wording to confirm here) (decisions 4, 5, 7, 8, 12). Upstream's `--json-schema` startup rejection on stderr is a pre-commit 400 (decision 9).
- Upstream reports API failures as an `assistant` frame with `message.model: "<synthetic>"`, `stop_reason: "stop_sequence"`, zero usage and the error prose as a text block, followed by `result {is_error: true, api_error_status}` (`research/cli-probes/t1-max-output-100.jsonl`; also `p4-bare`, `r1-simple-env`, `o-pass-through-run*`). The frame is dropped (decision 14); the status and type come from `result`.

## Answer

Resolved 2026-10-07 with the human, one grilling round of eleven questions, every recommendation taken ("yes for all"). Each decision was checked against what the official SDKs read on failure ([wire contract](03-messages-api-wire-contract.md) §4.2, §3.7, §8): the HTTP status, `error.type`, `error.message`, the `request-id` header, `x-should-retry` and `retry-after`; all are set here as the real API sets them, and nothing below touches the success path. Recorded as [ADR 0005](../../../docs/adr/0005-operator-side-upstream-failures-surface-as-500.md). Vocabulary added to `GLOSSARY.md`: operator-side failure.

Facts new to this ticket:

- **The wrapper today** (`app/src/api/server.ts`, `app/src/auth/middleware.ts`, `app/src/api/middleware/error.ts`, `app/src/utils/errors.ts`): `express.json()` is mounted with its default 100 kB limit; a global auth middleware reads `Authorization: Bearer` only, skips `/health`, `/docs`, `/swagger.json`, `/v1/auth/status`, `/logs`, `/port-forwarding`, and answers 401 with `{error: {message, type: "authentication_error", code}}`; the shared error handler emits `{error: {message, type: "api_error", code}}` for every `AppError` (`ValidationError` 400, `InvalidRequestError` 400, `TimeoutError` 408, `ClaudeCliError` 503) and `{error: {message: "Invalid JSON format", type: "invalid_request_error", code: "parse_error"}}` for parse failures, with no top-level `type` and no `request_id`; request ids (uuid v4) are minted only in debug mode. `SECURITY_HEADERS.API_KEY_HEADER = 'x-api-key'` exists in `app/src/config/security-constants.ts` but nothing reads it. The key comes from `API_KEY` or the interactive setup.
- **Upstream's failure shapes** (recordings): an API rejection is a synthetic `assistant` frame (`message.model: "<synthetic>"`, `error: "unknown"`) whose text is `API Error: <status> <the API's own message>` (`o-pass-through-run1.jsonl`: `API Error: 400 Unable to download the file. Please verify the URL and try again.` and `API Error: 400 messages.9.content: Citations must be either enabled or disabled on all `document` blocks…`), then `result {subtype: "success", is_error: true, api_error_status: 400, terminal_reason: "api_error", errors: null}` with `result.result` repeating the text. A CLI-internal failure uses the same frame with prose and `api_error_status: null`: `Not logged in · Please run /login` with `error: "authentication_failed"` and **no** `api_retry` loop (`r1-simple-env.jsonl`, `p4-bare.jsonl`); the output-cap failure with `error: "max_output_tokens"` (`t1-max-output-100.jsonl`). The unknown-model case carries `api_error_status: 404` but CLI prose, not the API's `model: zzz` (`h-unknown-model.txt`). An API 401 loops as `system/api_retry {attempt, max_retries: 10, retry_delay_ms, error_status: 401, error: "authentication_failed"}` for minutes (`auth-failure.jsonl`). `api_retry.error` and the synthetic frame's `error` share one category enum: `authentication_failed | oauth_org_not_allowed | account_on_hold | billing_error | rate_limit | overloaded | invalid_request | model_not_found | server_error | max_output_tokens | cloud_credential_error | unknown` ([CLI contract](02-cli-headless-io-contract.md) §1.4, §7).
- **SDK handling of an SSE `error`**: TypeScript throws an `APIError` with `status: undefined` and `error.type` from the data; Python raises a generic `APIStatusError`; both take `request_id` from the `request-id` response header ([wire contract](03-messages-api-wire-contract.md) §3.7, §4.2).

### Decisions

| # | Decision |
| - | - |
| 1 | **Envelope by surface tag.** One early middleware tags each request with its surface: path under `/v1/messages`, or `anthropic-version` present → Anthropic; everything else → OpenAI. The shared error handler, the JSON-parse branch and the auth middleware all consult the tag. Anthropic-surface errors are `{type: "error", error: {type, message}, request_id}` with the `request-id` header. The OpenAI surface, `/v1/sessions`, `/v1/auth`, `/health`, `/logs`, `/docs` and `/port-forwarding` are untouched. |
| 2 | **`anthropic-version` is required** on `/v1/messages` and `/v1/messages/count_tokens`: missing → 400 `invalid_request_error` naming the header; accepted values `2023-06-01` and the deprecated `2023-01-01`; any other value → 400 quoting it. On `/v1/models*` presence alone selects the surface ([Model and parameter mapping](11-model-and-parameter-mapping.md) decision 2). |
| 3 | **Credentials.** When `API_KEY` is configured the Anthropic surface accepts `x-api-key: <key>` or `Authorization: Bearer <key>`, constant-time compared; missing or wrong → 401 `authentication_error` in the Anthropic envelope. No key configured → open, as today. The client's credential is a gate only and never reaches upstream, which runs on the CLI's own login (the stance on that login remains the human's, per the map's Notes). The OpenAI surface stays Bearer-only. |
| 4 | **`anthropic-beta` is accepted and ignored**, every value, logged at debug, except names a ticket consumes (`mcp-client-2025-11-20` → [MCP connector passthrough](15-mcp-connector-passthrough.md)). The real API's 400 for unknown names is not mirrored: it would break `client.beta.messages` users and the SDK's own `oauth-2025-04-20` without changing any behaviour. |
| 5 | **Surface-side failures** (before any spawn): see the first mapping table. The Anthropic paths get a **32 MB body limit** like the real API (413 `request_too_large` above it); today's 100 kB default would reject a single base64 image. |
| 6 | **Upstream failures map by what the client should do**, not by upstream's status. *Fix the request*: API 400 → 400 `invalid_request_error`, 404 → 404 `not_found_error` with `model: <name>`, 413 → 413 `request_too_large`; message taken verbatim from after `API Error: <status> `. *Retry later*: `rate_limit`/429 → 429 `rate_limit_error`; `overloaded`/529 → 529 `overloaded_error`; `server_error`/other 5xx → 500 `api_error`; 504 → 504 `timeout_error`. *Operator-side*: `authentication_failed`, `oauth_org_not_allowed`, `cloud_credential_error`, API 401/403, `account_on_hold`, `billing_error`, API 402, and the "Not logged in" prose → **500 `api_error`** with `x-should-retry: false` and a message naming the upstream login or billing; never 401/402, because the client's own credential was accepted and a 401 would send them debugging the wrong key. *Everything else* (`result.subtype` of `error_max_turns`, `error_during_execution`, `error_max_budget_usd`, `error_max_structured_output_retries`; `max_output_tokens`; `unknown`; process exit with no `result`) → 500 `api_error` with `result.errors[]` or the exit code in the message. `api_error_status` wins over the category when both exist. Post-commit, the same `error.type` goes in the SSE `error` event. See the second mapping table. |
| 7 | **The billing-gate 400** ("Third-party apps now draw from extra usage…", [Prior art](05-prior-art.md) pitfalls) is relayed as what it is: 400 `invalid_request_error` with upstream's message verbatim and `x-should-retry: false`; never retried by the surface; logged at warn with the length of the client's `system`; documented in the spec as a known environmental failure a client's own system text can trigger. |
| 8 | **Fail fast on deterministic categories.** The first `api_retry` whose category is `authentication_failed`, `oauth_org_not_allowed`, `account_on_hold`, `billing_error`, `invalid_request`, `model_not_found` or `cloud_credential_error` ends the run at once (`control_request interrupt`) and maps per decision 6. `rate_limit`, `overloaded`, `server_error` and `unknown` keep [Streaming fidelity](09-streaming-fidelity.md) decision 9's 60 s cap. |
| 9 | **Retry-steering headers.** `x-should-retry: false` on every 4xx and on operator-side 500s. `retry-after` on 429 = seconds until `rate_limit_event.rate_limit_info.resetsAt` when that event reported `status: "rejected"`, else omitted. No `anthropic-ratelimit-*` headers: a subscription reports window utilisation, not token budgets, and fabricated limits would mislead. |
| 10 | **Request ids.** Every Anthropic-surface response, success or error, streaming or not, carries `request-id: req_<24 base62 characters>` minted per request regardless of debug mode; error bodies and the SSE `error` event data carry the same `request_id` (`event: error`, data `{type: "error", error: {type, message}, request_id}`, then the response closes). The id is logged beside upstream's `session_id` and `result`. The SDKs read the header; the body field is for support. |
| 11 | **The wrapper's existing error classes stay the OpenAI surface's.** The Anthropic surface throws its own error type carrying `{status, type, message, retryable}` from anywhere in its pipeline, rendered by the shared handler under decision 1's tag. A stray `AppError` reaching an Anthropic-tagged request maps by status: 4xx → `invalid_request_error` with that status, 5xx → 500 `api_error`. |

### Mapping table: surface-side failures

| Condition | HTTP | `error.type` | `x-should-retry` |
| - | - | - | - |
| Invalid JSON body | 400 | `invalid_request_error` | false |
| Missing or wrong content type | 400 | `invalid_request_error` | false |
| Body over 32 MB | 413 | `request_too_large` | false |
| Missing or unknown `anthropic-version` | 400 | `invalid_request_error` | false |
| Client key missing or wrong (when `API_KEY` is set) | 401 | `authentication_error` | false |
| Request validation (tickets 07, 08, 10, 11, 17, 18) | 400 | `invalid_request_error` | false |
| Unknown model (catalogue) | 404 | `not_found_error` (`model: <name>`) | false |
| Unknown path or method under `/v1/messages` | 404 | `not_found_error` ("The requested resource could not be found.") | false |
| CLI binary missing or unspawnable | 500 | `api_error` | false |
| Pre-commit timeout or stall ([Process lifecycle](19-process-lifecycle-and-concurrency.md)) | 504 | `timeout_error` | (default) |
| Concurrency cap ([Process lifecycle](19-process-lifecycle-and-concurrency.md)) | 529 | `overloaded_error` | (default) |

### Mapping table: upstream failures

Source precedence: `result.api_error_status` first, then the category (`api_retry.error` or the synthetic frame's `error`), then `result.subtype`, then process exit. Pre-commit the row's status is the HTTP status; post-commit its type is the SSE `error.error.type`.

| Upstream signal | Class | HTTP | `error.type` | Message | `x-should-retry` |
| - | - | - | - | - | - |
| `api_error_status` 400, category `invalid_request` | fix the request | 400 | `invalid_request_error` | after `API Error: 400 ` | false |
| `api_error_status` 404, category `model_not_found` | fix the request | 404 | `not_found_error` | `model: <requested name>` | false |
| `api_error_status` 413 | fix the request | 413 | `request_too_large` | after `API Error: 413 ` | false |
| other 4xx `api_error_status` | fix the request | that status | `invalid_request_error` | after `API Error: <status> ` | false |
| the billing-gate 400 | fix the request | 400 | `invalid_request_error` | verbatim | false |
| category `rate_limit`, `api_error_status` 429 | retry later | 429 | `rate_limit_error` | upstream's, else "Upstream rate limit reached" | (default) + `retry-after` when known |
| category `overloaded`, `api_error_status` 529 | retry later | 529 | `overloaded_error` | upstream's, else "Upstream overloaded" | (default) |
| category `server_error`, `api_error_status` 500/other 5xx | retry later | 500 | `api_error` | upstream's | (default) |
| `api_error_status` 504 | retry later | 504 | `timeout_error` | upstream's | (default) |
| category `authentication_failed`, `oauth_org_not_allowed`, `cloud_credential_error`; `api_error_status` 401/403; "Not logged in" prose | operator-side | 500 | `api_error` | names the upstream login | false |
| category `account_on_hold`, `billing_error`; `api_error_status` 402 | operator-side | 500 | `api_error` | names the upstream billing | false |
| category `max_output_tokens` | other | 500 | `api_error` | upstream's prose | false |
| category `unknown` without `api_error_status` | other | 500 | `api_error` | upstream's prose | (default) |
| `result.subtype` `error_max_turns`, `error_max_budget_usd`, `error_max_structured_output_retries`, `error_during_execution` | other | 500 | `api_error` | `result.errors[]` joined, else the subtype | false |
| process exit with no `result` (SIGTERM 143, crash) | other | 500 | `api_error` | "upstream exited with code N" | (default) |

### Boundaries handed to other tickets

- [Module layout and seams](13-module-layout-and-seams.md): the surface-tag middleware (1); the Anthropic error type `{status, type, message, retryable}` and the shared handler's two renderings (1, 11); a 32 MB JSON body parser on Anthropic paths (5); request-id minting independent of debug mode (10); the `api_retry` reader with fail-fast categories (8); `retry-after` needs the last `rate_limit_event` kept per run (9).
- [MCP connector passthrough](15-mcp-connector-passthrough.md): `anthropic-beta` values are ignored except `mcp-client-2025-11-20`, whose meaning that ticket decides (4).
- [Process lifecycle and concurrency](19-process-lifecycle-and-concurrency.md): a concurrency cap answers 529 `overloaded_error`; a pre-commit timeout or stall answers 504 `timeout_error`; a process exit without `result` answers 500 `api_error` with the exit code; deterministic `api_retry` categories interrupt immediately (5, 6, 8).
- [Assemble the spec](14-assemble-spec.md): document the billing gate as an environmental failure (7) and the operator-side mapping principle (6).
- Map, test-strategy fog: live 429 (subscription window exhausted) and OAuth-expiry shapes remain unobserved; the `rate_limit` and `overloaded` rows rest on documented shapes only.

### Primary sources

- `research/cli-probes/o-pass-through-run1.jsonl`, `o-pass-through-run2.jsonl`, `r1-simple-env.jsonl`, `p4-bare.jsonl`, `t1-max-output-100.jsonl`, `h-unknown-model.txt`, `auth-failure.jsonl`.
- `research/messages-api-wire-contract.md` §3.7, §4, §5, §8; `research/cli-headless-io-contract.md` §1.4, §1.7, §7; `research/agent-sdk-and-control-protocol.md` §6; `research/prior-art.md` (pitfalls).
- `app/src/api/server.ts`, `app/src/auth/middleware.ts`, `app/src/api/middleware/error.ts`, `app/src/utils/errors.ts`, `app/src/config/security-constants.ts`.
