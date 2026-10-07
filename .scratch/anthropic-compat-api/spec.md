# Spec: Anthropic surface for claude-wrapper

Status: ready-for-agent
Written: 2026-10-07
Map: [Anthropic surface for claude-wrapper](map.md), closed by this spec
Binding decisions: ADR 0001 to 0006 under `docs/adr/`
Vocabulary: `GLOSSARY.md` (surface, upstream, turn, run, model call, turn stream, commit, cut, upstream session, fingerprint, continued turn, replayed turn, run-bound parameter, catalogue, client tool, built-in tool, server tool, tool bridge, bridge server, control server, connector, held-open run, park, pre-delivered result, operator-side failure)

How to read this document: every statement under **Implementation Decisions** is settled. Each section names the ticket that settled it, so an implementer can zoom into the ticket's `## Answer` for the facts and probe recordings behind a line. Nothing here is a proposal. Anything that is still unverified is listed as such under **Further Notes**, with the e2e scenario that will verify it.

## Problem Statement

A developer with a Claude Code login wants the tools they already use against the Anthropic Messages API (the official TypeScript and Python SDKs, and everything built on them) to run against claude-wrapper by changing one setting, `ANTHROPIC_BASE_URL`. Today the wrapper offers only an OpenAI surface. That surface asks the model to emit OpenAI-shaped JSON through a prompt template, simulates streaming by chunking a finished answer, pipes the prompt to upstream through a shell, reports placeholder usage, and has no genuine tool calling, no web search, and no way to hold a conversation with real assistant turns. An Anthropic SDK client cannot use it at all: the paths, envelopes, headers and event stream are different, and the SDKs are strict about shape and event order.

## Solution

Add an **Anthropic surface** next to the OpenAI surface on the same server, port and optional API key: `POST /v1/messages` (non-streaming and SSE streaming), `POST /v1/messages/count_tokens`, `GET /v1/models` and `GET /v1/models/{id}`. The surface is a pure model endpoint. It never runs Claude Code's file or shell tools on the host.

From the client's side it behaves like the real API wherever upstream makes that possible, and tells the truth where it does not:

- The official SDKs work unmodified. Every decision below was checked against the SDK minimums (one `message_start` first, contiguous block indices, `message_delta` with `usage.output_tokens`, `message_stop` then close, valid JSON per event, the error envelope and headers the SDKs read).
- **Client tools** round-trip for real. Upstream calls the client's tool through a bridge server the wrapper hosts; the turn ends with upstream's own `tool_use` block and ids, the run stays held open, and the client's `tool_result` on the next request continues the same run (ADR 0001).
- **Conversations** continue upstream's own session when the client's history matches what the wrapper served, so the model's history is genuinely its own; anything else is a replayed turn with the history rendered into the prompt (ADR 0002).
- **Streaming** is a passthrough of upstream's real stream events, flattened so one turn is one API message even when upstream made several model calls; the non-streaming response is accumulated from the same stream (ADR 0003).
- **Output limits** (`max_tokens`, `stop_sequences`, `count_tokens`) are honoured by cutting the turn stream and interrupting upstream (ADR 0004).
- **Errors** are mapped by what the client should do; failures of the operator's Claude Code login are a 500 that says so, never a 401 about the client's key (ADR 0005).
- **Web search and web fetch** are served by upstream's built-in tools and rendered as the API's server-tool blocks; **connectors** (`mcp_servers`) are honoured when the operator opts in; the operator's account email that upstream leaks into every session is redacted on output.

Upstream is driven as a raw CLI process over stream-json (ADR 0006) by a new surface-neutral runner; the OpenAI surface is untouched beyond five wiring points.

## User Stories

Compatibility and endpoints

1. As an Anthropic SDK developer, I want to point `ANTHROPIC_BASE_URL` at the wrapper and call `messages.create` unmodified, so that tools built on the official SDKs run on a Claude Code login.
2. As a TypeScript SDK developer, I want `messages.stream()` and `finalMessage()` to work, so that my streaming code needs no special casing for the wrapper.
3. As a Python SDK developer, I want streamed tool input to parse eagerly without error, so that my `MessageStream` accumulator never throws on a partial JSON chunk.
4. As an existing OpenAI-surface user, I want `/v1/chat/completions`, `/v1/sessions` and the header-less `GET /v1/models` to behave exactly as today, so that adding the Anthropic surface breaks nothing I rely on.
5. As a client, I want `GET /v1/models` and `GET /v1/models/{id}` in the Anthropic shape listing the models the surface actually serves, so that `models.list()` terminates and aliases resolve.
6. As a client, I want `POST /v1/messages/count_tokens` to return a count measured from what upstream actually sends, so that my budgeting is honest about the residual context the wrapper cannot remove.
7. As a client, I want every response to carry a `request-id` header and every error body a `request_id`, so that I can quote one id when I ask the operator what happened.

Request handling

8. As a client, I want to name a model by its canonical id or an alias and have the response state the model that actually answered, so that I am never misled about which model ran.
9. As a client, I want an unknown model to fail with 404 `not_found_error` before anything is spawned, so that a typo costs nothing.
10. As a client, I want `max_tokens` honoured, with `stop_reason: max_tokens` and partial content when it binds, so that my output budgets mean what they say.
11. As a client, I want `stop_sequences` honoured, with `stop_reason: stop_sequence` and the matched sequence reported, so that my parsers can rely on them.
12. As a client, I want a non-default `temperature`, `top_p` or `top_k` to be a 400 rather than silently ignored, so that I know upstream has no such knob instead of trusting a sampling setting that never applied.
13. As a client, I want my `system` prompt, as a string or text blocks, to be the whole upstream system prompt, so that no wrapper preamble changes my model's behaviour.
14. As a client, I want an unchanged history with one new user message to be served as a continued turn on upstream's own session, so that later turns pay only for the new tokens and the model sees its earlier replies as its own.
15. As a client, I want an edited or truncated history, or a regenerate, to still be served, so that my application can revise a conversation without special handling.
16. As a client, I want base64 images and base64, text and content-sourced documents, with titles, context and citations, to reach the model, so that multimodal and document workflows work.
17. As a client, I want a URL-sourced image or document, a `file` source or a `search_result` block to be a 400 that names the block, so that I learn the limit at once instead of getting an answer that ignored my content.
18. As a client, I want `cache_control` accepted anywhere, so that prompts written for the real API need no stripping.
19. As a client, I want `thinking` validated per model as the real API validates it, with Haiku's thinking switched on or off as I ask, so that my requests behave the same on both.
20. As a client, I want `output_config.effort` passed to upstream and validated against the model's capability, so that an unsupported level is a 400 rather than a silent ignore.
21. As a client, I want `output_config.format` with a JSON schema to produce a single JSON text block that the SDK `parse()` helpers accept, so that structured outputs work.
22. As a client, I want unknown and beta-only body fields to be a 400 with the real API's "Extra inputs are not permitted" wording, so that unsupported features are visible instead of silently dropped.
23. As a client, I want `service_tier`, `metadata`, `inference_geo` and `diagnostics` accepted, so that requests written for the real API do not fail on fields that have no meaning here.

Client tools

24. As a client, I want to define tools with JSON Schema and receive genuine `tool_use` blocks carrying upstream's own ids, so that my tool loop is identical to the one I run against the real API.
25. As a client, I want to return `tool_result` blocks on the next request and have the same run continue with a genuine tool result, so that the model never treats my result as quoted prose.
26. As a client, I want every `tool_use` block of a message returned together when the model calls several tools, and my results accepted in any order, so that parallel tool loops work.
27. As a client, I want a partial set of results to be a 400 with the real API's message while the run stays parked, so that I can complete the set and continue.
28. As a client, I want `tool_choice: none` to hide my tools for a turn, and `any` or `tool` to fail with the real API's message, so that behaviour matches the real API on the served models.
29. As a client, I want a tool call I never answer to be reclaimed after a TTL, and my next request to still be served, so that an abandoned loop never wedges my conversation.
30. As a client, I want tool names up to 115 characters accepted and longer names rejected with a 400 that names my tool's index, so that I find out before any run is spawned.
31. As a client, I want text and image content in `tool_result`, with `is_error` honoured, so that my tools can report failures and return screenshots.

Streaming

32. As a client, I want real token-by-token streaming from upstream, so that latency and partial output behave as on the real API.
33. As a client, I want one message per turn even when upstream used a built-in tool and made several model calls, so that block indices are contiguous and my accumulator never sees a second `message_start`.
34. As a client, I want `ping` events while the stream is idle, so that my connection stays alive through a slow model call.
35. As a client, I want a failure after content has streamed to arrive as one SSE `error` event and then a closed connection, so that the SDK raises the same error class it raises against the real API.
36. As a client, I want accurate `usage` (input, output, cache creation and read, thinking tokens, server-tool counts) summed across the turn's model calls, so that my accounting is right.
37. As a client, I want thinking blocks relayed as the real API relays them with display omitted, so that my code that tolerates empty thinking keeps working.

Web search and web fetch

38. As a client, I want to declare a `web_search_*` tool and receive `server_tool_use` and `web_search_tool_result` blocks with real URLs and titles, so that search-backed answers work and I can show sources.
39. As a client, I want `max_uses`, `allowed_domains` and `blocked_domains` enforced, so that my search policy holds without the model knowing it was constrained.
40. As a client, I want `web_fetch_*` to work with the fetched content as a document, so that URL-grounded answers work.
41. As a client, I want to replay web search and web fetch result blocks on later turns exactly as I received them, so that multi-turn search conversations never fail validation.
42. As a client, I want `usage.server_tool_use.web_search_requests` and `web_fetch_requests` reported, so that I can account for searches.
43. As a client, I want a server tool type the surface cannot serve to be a 400 naming the type, so that I know at once rather than getting an answer without the tool.

Connectors

44. As a client, I want `mcp_servers` with the `mcp-client-2025-11-20` beta to reach upstream when the operator allows my connector's host, so that my remote MCP tools work through the surface.
45. As a client, I want `mcp_tool_use` and `mcp_tool_result` blocks in the response, so that my beta client renders connector calls as it does against the real API.
46. As a client, I want a clear 400 naming the operator setting when connectors are off or my host is not allowed, so that I know whom to ask.
47. As a client, I want my `authorization_token` kept out of logs and removed when the run ends, so that a secret I send stays a secret.

Errors and credentials

48. As a client, I want every error in the Anthropic envelope `{type: "error", error: {type, message}, request_id}`, so that the SDK raises the right error class.
49. As a client, I want to authenticate with `x-api-key` or `Authorization: Bearer` when the operator has set a wrapper key, and a 401 in the Anthropic envelope when I get it wrong, so that both SDKs' credential paths work.
50. As a client, I want `anthropic-version` required and my `anthropic-beta` values accepted, so that the SDK's default headers work and `client.beta` users are not rejected.
51. As a client, I want a failure of the operator's upstream login or billing to be a 500 whose message names the upstream login, with `x-should-retry: false`, so that I do not debug a key the wrapper just accepted.
52. As a client, I want 429 and 529 for upstream rate limits and overload, with `retry-after` when known, so that the SDK's backoff works.
53. As a client, I want the upstream billing-gate 400 relayed verbatim, so that I can see that my own system text triggered it.
54. As a client, I want bodies up to 32 MB accepted, so that a single base64 image does not hit a parser limit.
55. As a client, I want a concurrency cap or wrapper shutdown to answer 529, and a stalled upstream to answer 504, so that the SDK retries or backs off instead of hanging.

Operator

56. As an operator, I want the surface to be a pure model endpoint with no host-side tools ever enabled, so that exposing it over HTTP does not expose my machine.
57. As an operator, I want connectors off until I list the hosts upstream may reach, so that a client cannot make my machine open connections inside my network.
58. As an operator, I want my account email, display name and full name redacted from every response by default, and a `redact` list for more strings, so that one login serving several clients does not leak who I am.
59. As an operator, I want the park TTL, fingerprint expiry, run timers, run cap and map capacity configurable, so that I can size the wrapper for my machine.
60. As an operator, I want an explicit `upstream.env` map for an API key or OAuth token if I choose one, and no inherited `CLAUDE*` or `ANTHROPIC*` variables otherwise, so that the credential upstream runs on is always my explicit choice.
61. As an operator, I want upstream transcripts deleted when a conversation is forgotten, orphans swept at start, and nothing older than the expiry kept, so that disk use is bounded and old conversations do not linger.
62. As an operator, I want run counts and the last rate-limit state on `/health`, and every timer firing, cap rejection, kill and sweep logged with the request id and upstream session id, so that I can see what the wrapper is doing.
63. As an operator, I want graceful shutdown to drain in-flight streams with an error event and reclaim every run, so that a restart never leaves orphan processes.
64. As an operator, I want the README to warn me about the residual context, the account-email disclosure, the connector default and the auth stance, so that I deploy with eyes open.
65. As an operator, I want an OpenAPI document for the surface in the existing Swagger UI, so that I can browse the contract.

Maintainer

66. As a maintainer, I want one surface-neutral runner interface mockable with recorded transcripts, so that every module above it is testable without a process.
67. As a maintainer, I want a pure translator with golden fixtures from every recorded transcript, so that CLI drift shows up as a failing fixture.
68. As a maintainer, I want the integration suite driven by the official SDK as a devDependency, so that client compatibility is a test, not a review.
69. As a maintainer, I want every fixture scrubbed of the operator's account strings with a guard test, so that recordings can be committed.
70. As a maintainer, I want the real-CLI scenarios behind an environment flag and never in CI, so that the suite does not spend subscription quota.
71. As a maintainer, I want the OpenAI surface touched in exactly five places, so that the change is reviewable and reversible.
72. As a maintainer, I want the project's size rules (files under 200 lines, functions under 50, at most 5 parameters) respected by one file per translator pass and per validation concern, so that the new code matches the standard.

## Implementation Decisions

### 1. Standing rules

Settled in [Destination and target clients](issues/01-destination-and-target-clients.md) and confirmed on every later ticket.

- **Additive, Anthropic wins on collision.** The Anthropic surface is added next to the OpenAI surface on the same server, port and optional API key. Where the two collide (a shared path or shared middleware with different wire shapes) the Anthropic approach wins. The known collisions and their resolutions: `GET /v1/models` (section 3), the shared error handler and JSON-parse branch (section 13), the auth middleware (section 2).
- **Compatibility veto.** The official TypeScript and Python SDKs must work unmodified. Every decision was checked against what the SDKs require and read; the check is restated per section where it mattered.
- **Fidelity over convenience.** An honest 400 or a faithful emulation beats a silently ignored parameter. Where the surface cannot do what the real API does, it says so (section 13 for errors, Further Notes for the deviations list).
- **Pure model endpoint.** No request may run Claude Code's Bash, Edit, Read or other host-side built-in tools. Every run passes `--tools ""` plus exactly the built-ins a declared server tool needs.
- **Feature priority** (for ticket ordering, not scope): client tools, streaming, web search, system prompts and multi-turn, model mapping, real usage reporting; then thinking, structured outputs, images, connectors.

### 2. Endpoints, headers and credentials

Settled in [Error envelope and auth headers](issues/12-error-envelope-and-auth.md) and [Model and parameter mapping](issues/11-model-and-parameter-mapping.md).

**Surface tag.** One early middleware tags every request with its surface: path under `/v1/messages`, or the `anthropic-version` header present, is Anthropic; everything else is OpenAI. The shared error handler, the JSON-parse branch and the auth middleware all render by that tag. The OpenAI surface, `/v1/sessions`, `/v1/auth`, `/health`, `/logs`, `/docs` and `/port-forwarding` are untouched.

| Endpoint | Tag | Behaviour |
| - | - | - |
| `POST /v1/messages` | Anthropic | the turn (sections 4 to 14) |
| `POST /v1/messages/count_tokens` | Anthropic | measures (section 12) |
| `GET /v1/models` | by header | header present: Anthropic shape over the catalogue; absent: today's OpenAI handler, untouched |
| `GET /v1/models/{id}` | by header | header present: the catalogue entry; absent: unserved, as today |
| any other path or method under `/v1/messages` | Anthropic | 404 `not_found_error`, "The requested resource could not be found." |

**`anthropic-version`** is required on `/v1/messages` and `/v1/messages/count_tokens`: missing is 400 `invalid_request_error` naming the header; accepted values are `2023-06-01` and the deprecated `2023-01-01`; any other value is 400 quoting it. On `/v1/models*` presence alone selects the surface.

**Credentials.** When the wrapper's `API_KEY` is configured, the Anthropic surface accepts `x-api-key: <key>` or `Authorization: Bearer <key>`, compared in constant time; missing or wrong is 401 `authentication_error` in the Anthropic envelope. No key configured means open, as today. The client's credential is a gate only and never reaches upstream, which runs on the CLI's own login (section 10; the stance on that login is the operator's, see Further Notes). The OpenAI surface stays Bearer-only.

**`anthropic-beta`** is accepted and ignored, every value, logged at debug, except `mcp-client-2025-11-20`, which section 9 consumes. The real API's 400 for unknown beta names is not mirrored: it would break `client.beta.messages` users and the SDK's own `oauth-2025-04-20` without changing any behaviour.

**Body.** Anthropic paths get a 32 MB JSON body limit (413 `request_too_large` above it; today's 100 kB default would reject one base64 image). Invalid JSON, or a missing or wrong content type, is 400 `invalid_request_error`.

**Request ids.** Every Anthropic-surface response, success or error, streaming or not, carries `request-id: req_<24 base62 characters>`, minted per request regardless of debug mode. Error bodies and the SSE `error` event data carry the same `request_id`. The id is logged beside upstream's session id and `result`.

### 3. Catalogue and model resolution

Settled in [Model and parameter mapping](issues/11-model-and-parameter-mapping.md) decisions 1 to 3.

- The **catalogue** is a JSON file shipped with the wrapper at an operator-overridable path: one entry per served model in the API's `ModelInfo` shape plus `aliases[]`. First content: `claude-fable-5-1` (alias `fable`), `claude-opus-5-5` (`opus`), `claude-sonnet-5-5` (`sonnet`), `claude-haiku-4-5-20251001` (`haiku`, `claude-haiku-4-5`). CLI-only aliases (`default`, `best`, `opusplan`, `sonnet[1m]`, `opus[1m]`) are not included unless an operator adds them.
- A request's `model` must resolve to an entry by id or alias, else 404 `not_found_error` with the real API's message `model: <name>`, before any spawn. The entry's canonical id goes to `--model`, never the client's alias. `system/init.model` must equal the canonical id or the turn fails (a child-environment variable can silently switch the model; section 10 forbids it, this check catches it). `message.model` in `message_start` relays upstream's value, which is the resolved id. Upstream's own 404 (`result.api_error_status: 404`) remains the backstop for a catalogued model the login cannot use.
- `ModelInfo` content: `id`, `type: "model"`, `display_name`, `created_at`, `max_input_tokens`, `max_tokens` copied from the real API's listing at implementation time (`null` where unsourceable). `capabilities` is honest to the surface: `batch`, `code_execution`, `context_management` (and its three dated keys) and `citations` unsupported; `image_input`, `pdf_input`, `structured_outputs` supported; `effort` and `thinking` as the real API reports them for that model. The catalogue is the source for every per-model validation in section 12.
- `GET /v1/models` with the header returns `{data: ModelInfo[] (newest first), first_id, last_id, has_more: false}` with `limit`, `after_id`, `before_id` applied over the catalogue. `GET /v1/models/{id}` resolves id or alias to the entry under its canonical id, else 404 `not_found_error`. The negotiation is mounting order: the Anthropic models route runs first and passes the request on when the tag is OpenAI, so the existing OpenAI handler is not edited.

### 4. Request contract

Settled in [Model and parameter mapping](issues/11-model-and-parameter-mapping.md), [Conversation state and system prompt](issues/10-conversation-state-and-system-prompt.md), [Tool bridge strategy](issues/07-tool-bridge-strategy.md), [Web search and built-in tools policy](issues/08-web-search-and-built-in-tools-policy.md), [MCP tool name limits upstream](issues/17-mcp-tool-name-limits-upstream.md) and [Image and document block pass-through upstream](issues/18-image-and-document-pass-through-upstream.md). All validation runs before any spawn; every rejection is 400 `invalid_request_error` unless stated.

#### 4.1 Body fields

| Field | Treatment | Section |
| - | - | - |
| `model` | resolved in the catalogue by id or alias; canonical id to `--model`; unknown is 404 | 3 |
| `messages` | normalised (4.2); continued or replayed turn | 5 |
| `system` | replaces the upstream system prompt exactly | 6 |
| `max_tokens` | required; integer, 1 ≤ n ≤ the entry's `max_tokens` (`0` is 400); honoured by cut | 12 |
| `stream` | honoured | 11 |
| `tools` | client tools through the bridge server; `web_search_*` and `web_fetch_*` through built-ins; `mcp_toolset` per section 9; any other server tool type is 400 naming it | 7, 8, 9 |
| `tool_choice` | `auto` or absent: default; `none`: client tools and server tools hidden for the turn; `any` and `tool`: 400 with the real API's message `tool_choice: type "tool" and "any" are not supported for this model.` on every model; `disable_parallel_tool_use` accepted and ignored | 7 |
| `temperature`, `top_p`, `top_k` | absent or `1.0`; absent or ≥ `0.99`; absent; anything else is 400 naming the field and the accepted value, on every catalogue model (stricter than the real API on Haiku 4.5, deliberately: upstream has no knob) | 12 |
| `stop_sequences` | non-empty array of non-empty strings; emulated in the translator | 12 |
| `metadata` | accepted, ignored (`user_id` is never a session key) | 5 |
| `thinking` | validated per catalogue entry; `display` ignored | 12 |
| `output_config.effort` | `--effort <level>`; enum and capability validated | 12 |
| `output_config.format` | `--json-schema`; the `StructuredOutput` call rendered as the JSON text block | 12 |
| `output_config.task_budget` | 400, beta-only | this table |
| `service_tier` | enum `auto`/`standard_only` validated, ignored; `usage.service_tier` relays upstream's | 12 |
| `cache_control` (anywhere) | accepted, ignored | 5 |
| `container` | 400 (no containers on this surface, own message) | this table |
| `inference_geo`, `diagnostics` | accepted, ignored; `usage.inference_geo` relays upstream's, response `diagnostics: null` | 12 |
| `mcp_servers` | section 9 | 9 |
| `context_management`, `speed`, `fallbacks`, `output_format`, any unknown top-level field | 400 with the real API's "Extra inputs are not permitted" wording | this table |

#### 4.2 Messages: normalisation and validation

Applied before fingerprinting and rendering, in this order.

| Input | Rule |
| - | - |
| Consecutive same-role messages | merged into one message (real API semantics) |
| String content | one `text` block |
| First message not `user` | 400 |
| Last message `assistant` (prefill) | 400 with the API's text: "This model does not support assistant message prefill. The conversation must end with a user message." |
| Empty `content: []` or an empty text block | 400 (API: text `minLength` 1) |
| `role: "system"` inside `messages` | 400 (model-gated feature with no upstream path) |
| `cache_control` anywhere | accepted, ignored |
| `thinking` / `redacted_thinking` in history | accepted, dropped: continued turns never need them, replayed turns cannot carry signatures |
| `tool_use` in assistant history, `tool_result` at the head of the last user message | bridge when a park matches (section 7), else a replayed turn (section 5) |
| `server_tool_use`, `web_search_tool_result`, `web_fetch_tool_result` replay blocks | accepted exactly as sent, never validated; rendered per section 8 on a replayed turn |
| `mcp_tool_use`, `mcp_tool_result` replay blocks | accepted exactly as sent; rendered per section 9 on a replayed turn |

#### 4.3 Content blocks in user messages

Nothing is dropped silently. A block upstream would drop, substitute or that the API rejects is a 400 naming the block type.

| Block | Treatment |
| - | - |
| `text` | supported |
| `image` with a `base64` source | supported on both turn kinds; rendered as a real block on a replayed turn |
| `document` with a `base64` PDF, `text` or `content` source, including `title`, `context` and `citations: {enabled}` | supported; rendered as a real block on a replayed turn. Citations must be enabled on every document block across the whole upstream history or on none; otherwise the API's 400 is relayed (section 13). A citation reaches the client only through the turn stream's `citations_delta`, which section 11 relays. |
| `image` with a `url` source, `document` with a `url` source | 400 naming the block (the CLI forwards them; the API behind Claude Code answers "Unable to download the file" on every host) |
| `file` sources, `search_result` | 400 naming the block (Files API is out of scope) |
| `mcp_tool_listing`, tool-change blocks | 400 naming the block |
| `tool_result` | section 7; content: string and `text` blocks become MCP text, `image` blocks MCP image content, `is_error` maps to `isError`; `search_result`, `document`, `tool_reference` and `browser_state` inside a `tool_result` are 400 naming the block |

#### 4.4 Tools

- `tools[].name` must match `^[a-zA-Z0-9_-]{1,115}$`. Names of 116 to 128 characters are legal on the real API but exceed the API's 128-character limit once prefixed `mcp__client__` (13 characters), so they are a 400 before any spawn with the message `tools.<i>.custom.name: String should have at most 115 characters`, `<i>` being the client's index (upstream's own 400 would index its alphabetically re-sorted list). Hyphens and long shared prefixes need nothing; upstream neither truncates, aliases nor rejects long names.
- `name`, `description` and `input_schema` go to upstream verbatim through the bridge server's `tools/list`, never through Zod.
- A `web_search_*` or `web_fetch_*` tool carrying both `allowed_domains` and `blocked_domains` is 400, as on the real API.
- Server tool types the surface cannot serve (`code_execution_*`, `text_editor_*`, `bash_*`, `computer_*`, `memory_*`, `tool_search_*`, `browser_*`) are 400 naming the type.
- `mcp_toolset` entries are validated per section 9.

### 5. Conversation state

Settled in [Conversation state and system prompt](issues/10-conversation-state-and-system-prompt.md) and ADR 0002.

- **Continuity model.** A request is matched to the upstream session that produced its last assistant message and only the new user message is sent: a **continued turn**. Upstream's own transcript is the history: real assistant turns, the bridge's real `tool_use`/`tool_result` pairs, thinking with signatures. When nothing matches, a fresh run receives the history rendered into the prompt: a **replayed turn**. The replayed turn is also the fall-through for a lost park (section 7) and for an error turn.
- **Run lifetime.** A run ends after `end_turn`; the upstream session is persisted and the next continued turn starts a new run with `--resume <session id>`. A run is held open only while parked. Every flag (`--model`, `--mcp-config`, `--system-prompt`, the rest of section 10) is passed again on every run. No hot cache of idle processes in this spec.
- **Matching rule.** Per upstream session the wrapper records the normalised transcript exchanged so far: the client's messages as normalised plus the assistant message the wrapper returned. A request continues session S if and only if its normalised `messages[0..n-1]` equals S's transcript exactly and the tail is exactly one user message carrying no `tool_result` block. Not part of the key: `system` (sent fresh every run), `model` (`--model` on every run, so the model may change mid-conversation), `tools` and `mcp_servers` (re-mounted per run; a stale `tool_use` in history is legal API-side). Everything else (edited or truncated history, regenerate, multi-message tail, wrapper restart, map expiry) is a replayed turn. No `--fork-session` on a shorter matching prefix in this spec.
- **The fingerprint map** lives in memory, keyed fingerprint to upstream session id, at most 1,000 entries (configurable, LRU eviction is a forget); an entry expires after 24 h idle (configurable). Forgetting a session deletes upstream's transcript file. A wrapper restart makes every conversation's next turn a replayed turn.
- **Error-turn eviction.** A turn that ends in an upstream error, a cut, a post-commit failure, a mid-stream disconnect, or a run ended before its `result` does not update the session's recorded transcript, and its upstream session is forgotten, so the client's retry is a replayed turn rather than a resume onto a dangling message (an API 400 leaves the rejected user message in upstream's transcript with no assistant reply).
- **Rendering a replayed turn.** One stream-json user message. It opens with a `<conversation_history>` block of `<turn role="user|assistant">` children: text verbatim; `tool_use` as `<tool_use id="…" name="…">{input JSON}</tool_use>`; `tool_result` as `<tool_result tool_use_id="…" is_error="true|false">…</tool_result>`; `server_tool_use` as `<web_search query="…"/>` or `<web_fetch url="…"/>`; `web_search_tool_result` as `<web_search_results>` with one `title: url` line per result, or `<web_search_error code="…"/>`; `web_fetch_tool_result` as `<web_fetch_result>` holding the document text; `mcp_tool_use` as `<mcp_tool_use server="…" name="…">{input JSON}</mcp_tool_use>`; `mcp_tool_result` as `<mcp_tool_result tool_use_id="…" is_error="…">…</mcp_tool_result>`; images and documents as real blocks inline (the content array mixes text and media blocks); `thinking` and `redacted_thinking` dropped. The block carries one sentence stating that these are the earlier turns of this conversation and that the assistant turns are the model's own, so the system prompt stays exactly the client's. The final user message's blocks follow verbatim.
- **Wrapper sessions** have no Anthropic-side equivalent: `/v1/sessions` and the `session_id` body field stay on the OpenAI surface; `metadata.user_id` is accepted and ignored; upstream sessions are invisible to clients.
- **Edits on the turn that resumes a parked run are ignored** (section 7): the parked run continues with the history upstream holds; the contract is the ids.

### 6. System prompt, residual context and redaction

Settled in [Conversation state and system prompt](issues/10-conversation-state-and-system-prompt.md) decision 5, [Minimal-context upstream run](issues/16-minimal-context-upstream-run.md), [Residual upstream context and the account-email reminder](issues/20-residual-upstream-context-and-account-email.md) and [Mitigating the account-email disclosure](issues/22-mitigating-the-account-email-disclosure.md).

- **Replace, never append.** The upstream system prompt is exactly the client's `system`: a string as-is, text blocks joined with a blank line, the empty string when absent, passed as `--system-prompt`, with `--system-prompt-snapshot off` on every run so the current turn's text applies on `--resume` (the default `on` ignores new text). No wrapper preamble, no appended line. Measured cost with the decided flags: 493 input tokens per run with an empty prompt, nothing cached.
- **Config isolation.** `--setting-sources=` (empty), `--strict-mcp-config`, one wrapper-owned empty working directory for every run. The user's `~/.claude` is inherited only for credentials and session storage: no CLAUDE.md, skills, plugins, hooks or permission defaults reach a run. `--safe-mode` and `--disable-slash-commands` add nothing once those are set and are not passed.
- **Residual context, a known deviation.** Upstream prepends `You are a Claude agent, built on Anthropic's Claude Agent SDK.` to any `--system-prompt` and injects `<system-reminder>` blocks into a session's first user turn: environment (working directory, platform, shell, OS), model identity and knowledge cutoff, remaining token budget, USD budget, today's date, and `session_context` carrying the **account owner's email**; on resume only the budget and token reminders recur. The model therefore self-identifies as "Claude, built on Anthropic's Claude Agent SDK" (never as Claude Code) and knows the operator's email. Nothing removes this on the subscription login: `CLAUDE_CODE_SIMPLE=1` and `--bare` refuse the login with no API call; `--exclude-dynamic-system-prompt-sections` is ignored with `--system-prompt`; `CLAUDE_CODE_DISABLE_ATTACHMENTS=1` drops only the two budget reminders; `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` changes nothing and silently switches the model to Opus 5.5. Without an instruction the model quotes the email on a direct ask.
- **Mitigation: output redaction, no system-prompt line.** The translator carries a redaction pass (section 11) that replaces each armed string, matched case-insensitively, with `[redacted]` in `text_delta` and `input_json_delta` payloads (so client-tool inputs and structured-output text are covered). On by default. At startup the wrapper reads the CLI's account file and arms `oauthAccount.emailAddress`, `displayName` and `fullName` when present, logging that redaction is armed and with how many strings, never the values; an operator `redact` list adds strings (the OS username, for instance). If nothing can be read and the list is empty, the surface starts with a warning that redaction is unarmed (an API-key login has no OAuth account). Documented limits: a paraphrase or spelled-out address escapes it; the OS username inside the working-directory path the environment reminder shows is a separate residual unless added to the list. The replacement carries no JSON-significant characters, so the Python SDK's eager partial-JSON parse and the TypeScript accumulator see valid streams.
- **Why not an instruction.** A wrapper-added system line would change what the client's `system` means, costs tokens on every run, relies on the model complying, and is the kind of appended system text that triggered the upstream billing gate for other wrappers (section 13).

### 7. Client tools: the tool bridge

Settled in [Tool bridge strategy](issues/07-tool-bridge-strategy.md), proven in [Spike: round-trip one client tool call through upstream](issues/06-spike-client-tool-round-trip.md), recorded as ADR 0001.

- **Held-open run.** The wrapper hosts one **bridge server**, an MCP server with the fixed name `client`, served over Streamable HTTP from the control server (section 16) and mounted into the run through `--mcp-config` whenever the turn exposes client tools. Upstream sees each tool as `mcp__client__<name>`; the prefix is stripped from everything the client receives. When upstream calls one, the handler blocks and the turn **parks**: it ends with upstream's own `tool_use` message and stream events (`message_delta {stop_reason: "tool_use"}` and `message_stop` arrive within a millisecond of the call; nothing is synthesised). The run stays **held open** until a request arrives whose `tool_result` ids match, which resolves the handler and continues the same run; the resuming turn is a new turn stream from the same run, beginning with a fresh `message_start`.
- **Correlation by upstream's ids only.** `tool_use.id` on the assistant frame equals `_meta["claudecode/toolUseId"]` on the MCP `tools/call` equals `tool_use_id` on the `tool_result` frame upstream writes back, so no id is ever minted. The `tool_result` blocks at the head of the last user message must name ids that belong to exactly one parked run. No session header, no `metadata` field.
- **Parallel calls.** Upstream runs one assistant message's `tool_use` blocks one at a time: the MCP call for block 2 is not issued until block 1's handler returns. So the bridge parks as soon as the assistant message is complete and at least one client call is announced, returns every `tool_use` block, holds **pre-delivered results** for calls upstream has not asked for yet, and serves them the instant it asks.
- **Partial answers** (some of a message's ids without results) are 400 `invalid_request_error` with the real API's message ("`tool_use` ids were found without `tool_result` blocks immediately after"); the run stays parked. The wrapper never invents a result.
- **`tool_choice`.** `auto` or absent: default. `none`: the bridge server is not mounted for that turn (and server tools are disabled too, section 8). `any` and `tool`: 400 on every model. `disable_parallel_tool_use`: accepted and ignored.
- **Abandonment.** Park TTL is configurable, default 10 minutes. On expiry, and on client disconnect while parked: **interrupt the run first, then reject the handlers**. Measured: an interrupt costs zero extra model calls (upstream cancels the MCP call, writes a rejection `tool_result`, emits `result {subtype: "error_during_execution"}` and exits); an MCP timeout or a closed stdin instead hands the model an error result and it retries (three and four model calls). The wrapper treats `error_during_execution` plus exit 1 as the expected end of an abandoned run. A `tool_result` naming ids with no parked run (TTL expired, wrapper restarted) falls through to a replayed turn; the client gets a normal answer and the wrapper logs the lost park.
- **Built-in tools in the same run** never park: the bridge acts only on names under `mcp__client__`; every other `tool_use` (WebSearch, WebFetch, a connector's `mcp__<server>__`) is upstream's business and the run continues (section 8, section 9).
- **Timeouts that protect a park.** The bridge server's per-call `timeout` and the child environment's `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT` and `MCP_TOOL_TIMEOUT` are set above the park TTL so upstream never times out first (the HTTP MCP idle default in the binary is 5 minutes; the knob's effect is e2e scenario 6). While parked, upstream emits a `tool_progress` heartbeat every 30 s; the stall timer (section 14) counts it as a frame.
- **Memory.** A parked run is a live subprocess of 230 to 260 MB per outstanding round trip, bounded by the park TTL and the run cap (section 14).

### 8. Server tools: web search and web fetch

Settled in [Web search and built-in tools policy](issues/08-web-search-and-built-in-tools-policy.md), verified in [Hook enforcement of web tool limits upstream](issues/21-hook-enforcement-of-web-tool-limits-upstream.md).

| Client declares | Upstream flags | Client sees |
| - | - | - |
| no server tool | `--tools ""` | no server-tool blocks |
| `web_search_*` (`20250305`, `20260209`, `20260318`) | `--tools WebSearch --allowedTools WebSearch` + hook | `server_tool_use(web_search)` + `web_search_tool_result` per call; `usage.server_tool_use.web_search_requests` |
| `web_fetch_*` (`20250910` to `20260318`) | `--tools WebFetch --allowedTools "WebFetch(domain:*)"` + hook | `server_tool_use(web_fetch)` + `web_fetch_tool_result` per call; `usage.server_tool_use.web_fetch_requests` |
| both | `--tools WebSearch,WebFetch` + both allow rules + hook | both |
| any, with `tool_choice: none` | `--tools ""` | none |
| any other server tool type | not spawned | 400 naming the type |

- **Web search is synthesised as the API's blocks** by the translator's server-tool pass (section 11). Per WebSearch call: one `server_tool_use {name: "web_search", input: {query}}` with `id` = the first `srvtoolu_` id in upstream's `tool_use_result.results` (wrapper-minted `srvtoolu_` if none), streamed as `content_block_start` with `input: {}` then one `input_json_delta` carrying exactly `{"query": …}` at upstream's `content_block_stop`; and one `web_search_tool_result` emitted complete in one `content_block_start` when upstream's `user/tool_result` frame arrives, whose `content` lists every `{type: "web_search_result", url, title, encrypted_content, page_age: null}` across the call's backend searches. `encrypted_content` is a wrapper-minted opaque token (base64 of url and title), never validated on replay. Upstream's Haiku summary string is not exposed. Text blocks carry `citations: null`; no citations are synthesised. `response_inclusion`, `allowed_callers`, `strict`, `defer_loading`, `cache_control` and `user_location` are accepted and ignored. A failed search becomes `web_search_tool_result_error {error_code: "unavailable"}`.
- **Web fetch is supported, lossiness documented.** `server_tool_use {name: "web_fetch", input: {url}}` (the model's extraction prompt is never shown), then `web_fetch_tool_result {content: {type: "web_fetch_result", url, retrieved_at: <wrapper time>, content: {type: "document", source: {type: "text", media_type: "text/plain", data: <what upstream's model received>}, title: null}}}`. The document is upstream's extraction (fetch, Markdown, a separate model call's extraction prompt, truncation, 15-minute cache, HTTPS upgrade, cross-host redirects reported not followed), not the page. `citations`, `max_content_tokens`, `use_cache`, `response_inclusion`, `url_sources` are accepted and ignored; a fetch failure maps to `url_not_accessible`.
- **Limits are enforced by a `PreToolUse` hook** on `WebSearch` and `WebFetch`, loaded through a per-run `--settings` file (section 10) as a command hook that posts its stdin to the control server's hook endpoint (section 16). The hook injects the request's `allowed_domains` or `blocked_domains` into every call's input through `updatedInput`, which upstream applies silently (verified: 10 of 10 hosts allowed, 0 of N blocked; the `tool_use` frame keeps the model's original input, so the translator takes the lists from the request, never from the frame). After `max_uses` calls, or on a URL outside the lists, the hook denies the call with a reason naming the code; upstream hands the model a `tool_result` with `is_error: true` and text `PreToolUse:<tool> hook error: <reason>`, lists it in `result.permission_denials`, makes no side call, and continues. The translator maps that frame to `web_search_tool_result_error` or `web_fetch_tool_result_error` with the code the reason names (`max_uses_exceeded`, `url_not_allowed`). Policy state (counters, lists) lives in the wrapper beside the bridge, never in the hook script.
- **Permissions.** `--permission-mode default --permission-prompts none` on every run; `--allowedTools` lists exactly the enabled tools. `result.permission_denials` may contain only denials the wrapper's own hook issued, matched by `tool_use_id`; any other entry is a misconfiguration, logged at error (by the time `result` arrives the response has closed at `message_stop`, section 11).
- **Usage.** `usage.server_tool_use.web_search_requests` is the sum of upstream's `searchCount` over the turn's WebSearch calls (fallback: the count of WebSearch `tool_use` blocks); `web_fetch_requests` is the count of WebFetch calls. Side-call tokens are not reported, matching the real API.
- **Block order within a turn** is upstream's: text before the call, `server_tool_use`, the result block, then the answer text, in one surface message; index renumbering and `message_start` suppression across upstream's model calls are section 11's.
- **Upstream's session cap** on searches (`CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION`) is set to 200 in the child environment; a run is one turn, so it never binds before `max_uses`.

### 9. Connectors

Settled in [MCP connector passthrough](issues/15-mcp-connector-passthrough.md). Checked against the beta SDK types: the synthesised blocks carry exactly the fields `client.beta.messages` reads, ids are opaque, every rejection is a well-formed 400.

- **Honoured, opt-in per deployment.** An operator setting lists the connector hosts the wrapper may reach (`*` allows all); default off. Off, or a host outside the list, is 400 `invalid_request_error` naming the setting. Reason: upstream connects from the operator's machine, so an unrestricted passthrough lets any client make that machine open connections inside its network, which the real API's connector (connecting from Anthropic) never does. **The default-off setting was flagged to and accepted by the human**: a client sending `mcp_servers` receives a 400 until the operator enables the host list; this is a deployment default, not a wire deviation, and is one setting to change.
- **Beta gate, as the real API.** `mcp_servers`, or an `mcp_toolset` in `tools`, without `anthropic-beta: mcp-client-2025-11-20` is 400 "Extra inputs are not permitted".
- **Validation before spawn**, mirroring the real API: `type` must be `url`; `url` must be `https`; `name` unique; every server referenced by exactly one `mcp_toolset` and every toolset naming a declared server; each violation a 400 stating the rule. One wrapper rule: a connector named `client` (the bridge server's fixed name) is 400. Remote tool names cannot be pre-validated against the 128-character limit on `mcp__<server>__<tool>`; an over-long one surfaces as upstream's API 400, pre-commit.
- **Mapping to the run.** One `--mcp-config` entry per enabled server in the run's per-run config file beside the bridge's: `{type: "http", url, headers: {Authorization: "Bearer <authorization_token>"} when given, alwaysLoad: true, timeout: <connector call timeout>}`, the timeout defaulting to 60 s and operator-configurable, so a dead connector yields an error `tool_result` the model can report instead of a turn that waits on the stall timer. `tool_configuration.enabled: false` means not mounted. `--allowedTools` gains `mcp__<name>` for a whole server, or one `mcp__<name>__<tool>` per entry when `allowed_tools` is set; anything else prompts and is denied under `--permission-mode default --permission-prompts none`. `default_config.defer_loading` and per-tool `configs` are accepted and ignored: with `--tools ""` there is no tool search, so a deferred tool would be unreachable. `alwaysLoad` blocks upstream's startup until each server connects, capped by the CLI's connect timeout, inside the startup timer (section 14). Before the first turn every declared server must read `connected` in `system/init.mcp_servers`; otherwise the turn fails pre-commit with 400 naming the server and the `init.mcp_server_errors` text (`needs-auth` included). `mcp_servers` is run-bound like `tools`: passed on every run, never part of the fingerprint, fixed on a resumed parked run. `--strict-mcp-config` stays, so the operator's own servers never load.
- **Output rendering.** The translator's connector pass synthesises the beta blocks the way the server-tool pass does: a `tool_use` block named `mcp__<server>__<tool>` is relayed as `mcp_tool_use` with `name` and `server_name` split out and upstream's id kept, its `input_json_delta`s relayed as they arrive; the `user/tool_result` frame becomes one `mcp_tool_result` block (`tool_use_id`, `is_error`, text items as text blocks, other item types dropped and logged). A connector call separates two model calls exactly as a built-in does: that call's `message_delta`/`message_stop` are suppressed and there is no park. No usage counters; the real API has none for MCP.
- **Replay** is section 5's rendering for the two block kinds; `mcp_tool_listing` and the tool-change block types are 400s naming the block.
- **`count_tokens`** takes the same body, so connectors are mounted for the one-token run and their tool definitions count.
- **Secrets.** The `authorization_token` lives only in the per-run `0600` file, is redacted from every log line, and is removed with the run directory at teardown.

### 10. The run: spawn contract

Settled in [Conversation state and system prompt](issues/10-conversation-state-and-system-prompt.md) decisions 6 and 7, [Web search and built-in tools policy](issues/08-web-search-and-built-in-tools-policy.md) decisions 3 and 4, [Model and parameter mapping](issues/11-model-and-parameter-mapping.md) decision 13, [Module layout and seams](issues/13-module-layout-and-seams.md) decisions 1 and 4, [Process lifecycle and concurrency](issues/19-process-lifecycle-and-concurrency.md) decisions 7 to 9, and ADR 0006.

**Driver.** The CLI is spawned directly with no shell; stream-json in and out over stdio; the only new runtime dependency is the MCP SDK for the bridge server. The Agent SDK is not used. The stream-json control protocol is consumed directly (a `control_request {subtype: "interrupt"}` on stdin is the interrupt; it is accepted without any `initialize`), with the Agent SDK's type declarations as the reference and `system/init.capabilities` as the feature-detection point when the CLI moves. The binary is the operator's installed Claude Code (the project runs the mise-installed CLI, which the user updates independently); the spec was settled on 2.1.291.

**Argument list**, assembled per run:

| Argument | Rule |
| - | - |
| `-p --input-format stream-json --output-format stream-json --verbose --include-partial-messages` | every run |
| `--system-prompt <text>` | exactly the client's `system`, or the empty string |
| `--system-prompt-snapshot off` | every run |
| `--setting-sources=` (empty) and `--strict-mcp-config` | every run |
| `--model <canonical id>` | every run, including `--resume` |
| `--tools <"" \| WebSearch \| WebFetch \| WebSearch,WebFetch>` | exactly the built-ins the declared server tools need; `""` under `tool_choice: none` |
| `--allowedTools <list>` | exactly the enabled tools: every `mcp__client__<name>`, `WebSearch`, `WebFetch(domain:*)`, `mcp__<connector>` or `mcp__<connector>__<tool>` |
| `--permission-mode default --permission-prompts none` | every run |
| `--mcp-config <per-run file>` | when the turn exposes client tools or connectors: the bridge server's `http` entry (`alwaysLoad: true`, timeout above the park TTL) and one entry per connector |
| `--settings <per-run file>` | when a server tool is enabled: the `PreToolUse` hook on `WebSearch|WebFetch` running the shipped hook client |
| `--max-turns 25` | every run (configurable); a runaway guard, see section 14 |
| `--effort <level>` | when `output_config.effort` is given |
| `--json-schema <schema>` | when `output_config.format` is given; the CLI validates it at startup and a stderr rejection is a pre-commit 400 |
| `--resume <upstream session id>` | on a continued turn |
| `--no-session-persistence` | on `count_tokens` runs |

Working directory: one fixed, empty, wrapper-owned directory for every run, so every upstream transcript lands in one CLI project directory. The turn is one stream-json `user` message carrying the normalised content-block array (or the rendered history, section 5); stdin is closed after the turn's `result` unless the turn parked.

**Child environment**, an allowlist built from scratch, never inherited:

| Group | Variables |
| - | - |
| Base, copied from the wrapper's environment when present | `HOME`, `PATH`, `LANG`, `LC_ALL`, `TZ`, `TMPDIR`, `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY` and their lowercase forms |
| Always set | `CLAUDE_CODE_MAX_OUTPUT_TOKENS` (= `max_tokens`, or 1 for `count_tokens`); `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT` and `MCP_TOOL_TIMEOUT` above the park TTL; `MCP_CONNECT_TIMEOUT_MS`, pinned so the connector connect wait is known and sits inside the startup timer (the CLI default is 5 s); `CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION=200` |
| Per request, Haiku only | `CLAUDE_CODE_DISABLE_THINKING=1` or `MAX_THINKING_TOKENS=<budget_tokens>` (section 12) |
| Operator's `upstream.env` map, merged last | where `ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN` or `DISABLE_TELEMETRY` go if the operator chooses them; the auth stance stays theirs and explicit |
| Never inherited | everything else, in particular every `CLAUDE*` and `ANTHROPIC*` variable (a stale `CLAUDE_CODE_OAUTH_TOKEN` from Claude Desktop has overridden logins in prior art) |
| Refused even from the operator | `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` (silently switches the model to Opus 5.5) and `CLAUDE_CODE_SIMPLE` (refuses the subscription login) |
| Never set | `CLAUDE_EFFORT`, `CLAUDE_CODE_EFFORT_LEVEL`, `CLAUDE_CODE_DISABLE_STRUCTURED_OUTPUTS`, any other model-affecting variable the binary reads (`ANTHROPIC_MODEL`, `ANTHROPIC_DEFAULT_*_MODEL`, `CLAUDE_CODE_MODEL_CATALOG*`, `CLAUDE_CODE_NO_MODEL_FALLBACK`, and the rest) |

The hook command in the per-run settings file uses the absolute Node path.

**Flags never used.** `--fallback-model` (a silent model switch would contradict `message.model`); `--max-budget-usd` (checked only after the call that crosses it, and it zeroes `usage`); `--append-system-prompt`; `--bare`; `--dangerously-skip-permissions`; `--exclude-dynamic-system-prompt-sections` (no effect with `--system-prompt`).

**Per-run files.** Each run gets a directory under the wrapper's state directory holding its `0600` MCP config file and `0600` settings file, created before spawn and removed at teardown; the control-server token appears only in those files, never in argv or the environment.

**Startup checks on `system/init`**, each failing the turn pre-commit: `model` equals the canonical id (section 3); `tools` equals the expected list (the enabled built-ins, every `mcp__client__<name>`, the connectors' tools, plus `StructuredOutput` when `--json-schema` was passed, which upstream adds regardless of `--tools ""`); every connector's `mcp_servers[].status` is `connected` (section 9). A run that uses the subscription login reports `apiKeySource: "none"`.

### 11. The turn stream

Settled in [Streaming fidelity](issues/09-streaming-fidelity.md) and ADR 0003, with passes added by [Model and parameter mapping](issues/11-model-and-parameter-mapping.md), [MCP connector passthrough](issues/15-mcp-connector-passthrough.md) and [Mitigating the account-email disclosure](issues/22-mitigating-the-account-email-disclosure.md). All fifteen Streaming decisions were checked against the SDK minimums.

**One translator, two sinks.** Every run uses `--include-partial-messages`. One stream translator turns a run's frames into exactly one **turn stream**: the API event sequence for the turn, with the control signals `park`, `cut` and `fail` inline in the same ordered stream. The SSE sink writes it; the non-streaming sink accumulates it into a `Message` the way the official SDK accumulators do (which is also what document citations require: they exist only as `citations_delta`). The translator's inputs are `stream_event`, `user` tool-result frames, `system/api_retry` and `result`; `assistant`, `rate_limit_event`, `tool_progress`, `system/status` and hook frames are not inputs (lifecycle and error modules read `rate_limit_event` and `tool_progress`).

**Passes, in order, one file each**:

1. synthetic-frame drop: an `assistant` frame whose `message.model` is `"<synthetic>"` is upstream's error prose (seen after the output-cap auto-continuation fails and on API rejections) and is dropped; status and type come from `result` (section 13);
2. flattener (below);
3. server-tool pass (section 8);
4. connector pass (section 9);
5. bridge prefix strip (`mcp__client__` removed from names the client sees);
6. StructuredOutput buffer (section 12);
7. `max_tokens` cut (section 12);
8. stop-sequence scan (section 12);
9. redaction (section 6);
10. field allowlist (below);
11. usage sum (below).

**Flattening across model calls.** Each model call upstream makes opens its own `message_start` with a new `msg_` id, restarts block indices at 0, and (when it ends in a tool call) closes with its own `message_delta {stop_reason: "tool_use"}` and `message_stop` before the tool runs. The flattener: (a) relays the turn's first `message_start` and suppresses every later one; (b) offsets each call's block indices by the number of surface blocks already emitted in the turn, synthesised result blocks included; (c) at `message_delta {stop_reason: "tool_use"}`, if any `tool_use` block in that call is under `mcp__client__`, relays `message_delta` and `message_stop` and parks; if all are built-in or connector calls, suppresses both and the run continues; (d) drops frames with a non-null `parent_tool_use_id`; (e) relays any other `stop_reason` (`end_turn`, `max_tokens`, `refusal`, `stop_sequence`) with its `message_delta` and `message_stop` verbatim as the turn's end.

**Mixed message.** When one assistant message holds a client `tool_use` and a built-in call, the client block's events are held until every built-in that precedes it in the message has had its result block emitted, so the order is the real API's: `server_tool_use`, `web_search_tool_result`, `tool_use`. Known deviation: when the client call precedes the built-in, upstream parks before the built-in runs; the turn ends with a `server_tool_use` and no result block, and the result block opens the resuming turn's message at index 0.

**Server-tool input is filtered**: `content_block_start` for a `server_tool_use` is emitted immediately with `input: {}`; at upstream's `content_block_stop` one `input_json_delta` carries exactly `{"query": …}` or `{"url": …}`; upstream's own deltas, which may carry domain lists or the WebFetch extraction prompt, are never relayed.

**Thinking** is relayed as upstream emits it: `content_block_start {thinking: ""}`, `thinking_delta` with empty text, one `signature_delta`, `content_block_stop`, which is the real API's shape with the default `display: "omitted"`. `estimated_tokens` is stripped; `system/thinking_tokens` frames are dropped; `thinking_tokens` stays in `usage.output_tokens_details`.

**Usage.** `message_start.message.usage` is the first call's. The final `message_delta.usage` is the field-wise sum of every relayed call's `message_delta.usage` (`input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`, `cache_creation.*`, `output_tokens_details.thinking_tokens`) plus the `server_tool_use` counts of section 8. Measured equal to `result.usage`, so the response never waits on `result`. The non-streaming `usage` is the same object; `iterations` is dropped. Per-turn usage never comes from `total_cost_usd` or `modelUsage`, which include totals restored on resume.

**Field hygiene by allowlist.** Per event and block type only the fields the Messages API schema defines are emitted; `caller`, `wire_tool_inputs`, `iterations`, `estimated_tokens`, `thinking_display`, `ttft_ms`, `uuid`, `session_id`, `parent_tool_use_id` and anything unknown are dropped, each dropped name logged at debug so CLI drift is visible. The allowlist is data and must grow when the API grows.

**Commit.** The HTTP status and headers are committed at the turn's first relayed `message_start` (observed 2.4 to 3.8 s after spawn). Before commit, an upstream failure is a real HTTP error status (section 13), which the SDKs retry on 429 and 5xx; headers that depend on the first `rate_limit_event` are possible because it precedes `message_start`. After commit, failures are SSE `error` events.

**Upstream's retry loop is capped.** If `system/api_retry` has been seen and no new model call has produced a frame within 60 s (configurable), the run is interrupted and the turn fails with the error the last `api_retry` named, mapped by section 13. This cap applies only to the `rate_limit`, `overloaded`, `server_error` and `unknown` categories; the deterministic categories interrupt at first sight (section 13).

**Failure after content.** Triggers: (i) a `message_start` arriving while the current upstream message still has an open block (designed, not observed; e2e scenario 1); (ii) `result` with `is_error: true` or a non-success subtype before the turn's final `message_stop`; (iii) process exit or a timer firing (section 14); (iv) the retry cap. A plain `api_retry` after content is not a trigger: if the failed call had emitted nothing, its retry is one more suppressed `message_start`. Action: one `error` event `{type: "error", error: {type, message}, request_id}` with the type from section 13, end the response, interrupt, tear down (section 14), and forget the upstream session so the client's retry is a replayed turn. A half-emitted message is never resumed.

**Ping.** Idle-based: a `ping` event whenever 15 s (configurable) pass with no event written, from commit until `message_stop`. No comment heartbeats; `tool_progress` is not used for this.

**Client disconnect mid-stream** (after commit, before `message_stop`, not parked): interrupt, close stdin, tear down, forget the upstream session. Disconnect while parked is the bridge's (section 7).

**Back-pressure and close.** Upstream's stdout is never paused (a parked run's bridge traffic and `result` must flow); response writes use the socket buffer, bounded by the response size, no ceiling. The response ends immediately after `message_stop`; `result` and process exit are consumed asynchronously for logging and session registration. A continued turn arriving before the previous run has exited waits for the exit (section 14).

**Canonical shapes** (surface indices after offsetting):

- Plain: `message_start` → `[thinking]` → `text` → `message_delta {end_turn}` → `message_stop`. One model call.
- Web search: `message_start` (call 1) → `text?` → `server_tool_use` (filtered input) → *[call 1's `message_delta`/`message_stop` suppressed]* → `web_search_tool_result` (one `content_block_start` + `content_block_stop` on the `user/tool_result` frame) → *[call 2's `message_start` suppressed]* → `[thinking]` → `text` → `message_delta {end_turn, summed usage}` → `message_stop`.
- Client tool park: `message_start` → `text?` → `tool_use` (prefix stripped, deltas verbatim) → `message_delta {tool_use}` → `message_stop`; the resuming turn is a new turn stream from the resumed run.
- Structured output: `message_start` → `text` (the buffered JSON, section 12) → `message_delta {end_turn}` → `message_stop`.

### 12. Output limits and model-side parameters

Settled in [Model and parameter mapping](issues/11-model-and-parameter-mapping.md) decisions 4 to 11 and ADR 0004.

- **`max_tokens` is honoured.** The child environment carries `CLAUDE_CODE_MAX_OUTPUT_TOKENS=<max_tokens>`, which caps every model call. Upstream does not stop at its cap: it injects a "resume directly" user message and calls the model again, up to four times, then fails the run. **Cut rule**: when a relayed model call's `message_delta` carries `stop_reason: "max_tokens"`, the translator relays that `message_delta` and `message_stop` (the real API's exact shape: partial content, `output_tokens` = the cap), the response closes, the run is interrupted so upstream does not auto-continue, and the upstream session is forgotten. Frames after the cut are ignored. Documented deviations: the cap applies per model call, so a turn with built-in or connector calls can emit more than `max_tokens` in total; the interrupt can lose the race against upstream's next call (observed within the same second), costing at most one more capped call (e2e scenario 4).
- **`stop_sequences` are emulated.** The translator scans `text_delta` payloads only (thinking, tool and server-tool blocks untouched), holding back `len(longest sequence) - 1` characters so a match split across deltas is found, and flushing the hold-back at `content_block_stop`. On a match it relays the text before the match, closes the open block, emits `message_delta {stop_reason: "stop_sequence", stop_sequence: <matched>}` and `message_stop`, closes the response, interrupts and forgets the session. Usage in that `message_delta`: input and cache counters from the current call's `message_start` plus earlier calls' sums; `output_tokens` for the cut call is an **estimate** (the call's own `message_start.usage.output_tokens` plus the relayed characters divided by four), because the interrupt aborts the call before upstream reports it. This is the one inexact usage figure on the surface.
- **`thinking`** is catalogue-driven, mirroring the real API's acceptance per model; `display` is ignored (upstream always omits thinking text). 5.x entries: `adaptive` accepted with nothing to pass; `enabled`, `disabled` and `between_tools` are 400 with the real API's messages. Haiku 4.5 entry: absent or `disabled` sets `CLAUDE_CODE_DISABLE_THINKING=1` (verified; needed because upstream thinks by default on Haiku where the real API does not); `enabled` sets `MAX_THINKING_TOKENS=<budget_tokens>` after the real API's checks (`budget_tokens` integer ≥ 1024 and < `max_tokens`, else 400); `adaptive` and `between_tools` are 400. The effect of `MAX_THINKING_TOKENS` under a binding budget is unverified (e2e scenario 2).
- **`output_config.effort`** passes verbatim as `--effort <level>` after validation: one of `low`, `medium`, `high`, `xhigh`, `max`, supported by the entry's `effort` capability, else 400; so upstream's warn-and-ignore never triggers. Absent means no flag. Not verifiable from frames (`system/init` carries no `effort`).
- **`output_config.format` maps to `--json-schema`.** `format.type` must be `json_schema`; `schema` passes verbatim. Upstream answers through a `tool_use` block named `StructuredOutput` followed by a synthetic `tool_result` ("Structured output provided successfully") inside the same model call, then that call's `message_delta {stop_reason: "tool_use"}`; no further model call. Translator rule: the `StructuredOutput` block is **buffered** (start, `input_json_delta`s, stop) until its `tool_result` frame arrives. On success the buffer is emitted as one `text` block whose `text_delta`s are the buffered `partial_json` chunks (empty chunks skipped), that call's `stop_reason` is rewritten to `"end_turn"`, and the turn closes on its `message_delta`/`message_stop`. On a validation failure (`tool_result` with `is_error`) the call is treated like a built-in tool call: buffer dropped, `message_delta`/`message_stop` suppressed, the retry call follows; `result {subtype: "error_max_structured_output_retries"}` is a post-commit error. Prose `text` blocks in a format run are dropped and logged, because both SDKs' `parse()` helpers require every text block to be JSON. A `max_tokens` cut inside a buffered block flushes the buffer as the text block first. Non-streaming accumulates the same text; `result.structured_output` is not used.
- **`POST /v1/messages/count_tokens` measures.** The request goes through the normal validation and translation (system prompt, rendered history, mounted tools and connectors; `tool_choice` `any`/`tool` 400 as on Messages), spawned with `CLAUDE_CODE_MAX_OUTPUT_TOKENS=1` and `--no-session-persistence`. The surface reads the first `message_delta`, interrupts, keeps no fingerprint entry, and answers `{input_tokens: input_tokens + cache_creation_input_tokens + cache_read_input_tokens}` from that `message_delta.usage`. Exact for what upstream actually sends, which includes the residual context (about 500 tokens on an empty system prompt) and the replayed-turn rendering. Cost: one minimal model call per count, which also warms the cache for the request that usually follows. Pre-commit failures are HTTP statuses as on Messages. End to end unverified (e2e scenario 5).
- **Run-bound parameters on a resuming turn are ignored.** `model`, `max_tokens`, `thinking`, `output_config.effort`, `output_config.format`, `system`, `tools` and `mcp_servers` are fixed when upstream is spawned, so the turn that resumes a parked run cannot change them: differing values are ignored and logged at debug. `message.model` relays upstream's actual model, so the client is never misled. `stop_sequences` and the redaction list are not run-bound (applied per turn in the translator).
- **`result` never overrides a relayed `stop_reason`.** It is consulted only on the error paths of section 11 and, for `count_tokens`, not at all.

### 13. Errors

Settled in [Error envelope and auth headers](issues/12-error-envelope-and-auth.md) and ADR 0005. Checked against what the SDKs read on failure: the HTTP status, `error.type`, `error.message`, the `request-id` header, `x-should-retry` and `retry-after`.

**Principle.** Upstream failures are mapped by **what the client should do** (fix the request, retry later, or stop and tell the operator), never by relaying upstream's status. An **operator-side failure** (the Claude Code login missing, expired, not allowed for the organisation, on hold, or out of billing) is 500 `api_error` with `x-should-retry: false` and a message naming the upstream login or billing; never 401 or 402, because the client's own credential was accepted and a 401 would send them debugging the wrong key.

**Envelope.** `{type: "error", error: {type, message}, request_id}` with the `request-id` header, rendered by the shared handler under the surface tag (section 2). The Anthropic surface throws one error type carrying `{status, type, message, retryable}` from anywhere in its pipeline; a stray error of the wrapper's existing classes reaching an Anthropic-tagged request maps by status (4xx to `invalid_request_error` with that status, 5xx to 500 `api_error`). The OpenAI surface's error classes are untouched.

**Pre-commit versus post-commit.** Before commit (section 11) a failure is the HTTP status in the tables below. After commit it is one SSE `error` event (`event: error`, data `{type: "error", error: {type, message}, request_id}`) carrying the same `error.type`, after which the response closes, the run is interrupted and torn down, and the upstream session is forgotten. The TypeScript SDK throws an `APIError` with the type from the data; the Python SDK raises `APIStatusError`; both read `request_id` from the header.

**Surface-side failures** (before any spawn):

| Condition | HTTP | `error.type` | `x-should-retry` |
| - | - | - | - |
| Invalid JSON body | 400 | `invalid_request_error` | false |
| Missing or wrong content type | 400 | `invalid_request_error` | false |
| Body over 32 MB | 413 | `request_too_large` | false |
| Missing or unknown `anthropic-version` | 400 | `invalid_request_error` | false |
| Client key missing or wrong (when `API_KEY` is set) | 401 | `authentication_error` | false |
| Request validation (sections 4, 7, 8, 9, 12) | 400 | `invalid_request_error` | false |
| Unknown model (catalogue) | 404 | `not_found_error` (`model: <name>`) | false |
| Unknown path or method under `/v1/messages` | 404 | `not_found_error` ("The requested resource could not be found.") | false |
| CLI binary missing or unspawnable | 500 | `api_error` | false |
| Pre-commit timer firing (section 14) | 504 | `timeout_error` | (default) |
| Run cap or wrapper shutdown (section 14) | 529 | `overloaded_error` | (default) |
| Rate-limit admission after upstream's last `rate_limit_event` reported `rejected` (section 14) | 429 | `rate_limit_error` + `retry-after` | (default) |

**Upstream failures.** Source precedence: `result.api_error_status` first, then the category (`system/api_retry.error` or the synthetic frame's `error`; one enum: `authentication_failed | oauth_org_not_allowed | account_on_hold | billing_error | rate_limit | overloaded | invalid_request | model_not_found | server_error | max_output_tokens | cloud_credential_error | unknown`), then `result.subtype`, then process exit. The API's own message is taken from the synthetic frame's text after `API Error: <status> `.

| Upstream signal | Class | HTTP | `error.type` | Message | `x-should-retry` |
| - | - | - | - | - | - |
| `api_error_status` 400, category `invalid_request` | fix the request | 400 | `invalid_request_error` | after `API Error: 400 ` | false |
| `api_error_status` 404, category `model_not_found` | fix the request | 404 | `not_found_error` | `model: <requested name>` | false |
| `api_error_status` 413 | fix the request | 413 | `request_too_large` | after `API Error: 413 ` | false |
| other 4xx `api_error_status` | fix the request | that status | `invalid_request_error` | after `API Error: <status> ` | false |
| the billing-gate 400 | fix the request | 400 | `invalid_request_error` | verbatim | false |
| category `rate_limit`, `api_error_status` 429 | retry later | 429 | `rate_limit_error` | upstream's, else "Upstream rate limit reached" | (default) + `retry-after` when known |
| category `overloaded`, `api_error_status` 529 | retry later | 529 | `overloaded_error` | upstream's, else "Upstream overloaded" | (default) |
| category `server_error`, `api_error_status` 500 or other 5xx | retry later | 500 | `api_error` | upstream's | (default) |
| `api_error_status` 504 | retry later | 504 | `timeout_error` | upstream's | (default) |
| category `authentication_failed`, `oauth_org_not_allowed`, `cloud_credential_error`; `api_error_status` 401 or 403; the "Not logged in" prose | operator-side | 500 | `api_error` | names the upstream login | false |
| category `account_on_hold`, `billing_error`; `api_error_status` 402 | operator-side | 500 | `api_error` | names the upstream billing | false |
| category `max_output_tokens` | other | 500 | `api_error` | upstream's prose | false |
| category `unknown` without `api_error_status` | other | 500 | `api_error` | upstream's prose | (default) |
| `result.subtype` `error_max_turns`, `error_max_budget_usd`, `error_max_structured_output_retries`, `error_during_execution` | other | 500 | `api_error` | `result.errors[]` joined, else the subtype | false |
| process exit with no `result` (SIGTERM 143, crash) | other | 500 | `api_error` | "upstream exited with code N" | (default) |

**Fail fast on deterministic categories.** The first `api_retry` whose category is `authentication_failed`, `oauth_org_not_allowed`, `account_on_hold`, `billing_error`, `invalid_request`, `model_not_found` or `cloud_credential_error` ends the run at once with an interrupt and maps per the table; the CLI's own ten-retry loop (minutes, measured) never runs on the surface. `rate_limit`, `overloaded`, `server_error` and `unknown` wait for section 11's 60 s cap.

**Retry-steering headers.** `x-should-retry: false` on every 4xx and on operator-side 500s. `retry-after` on 429 is the seconds until `rate_limit_event.rate_limit_info.resetsAt` when that event reported `status: "rejected"`, else omitted; the last `rate_limit_event` is kept per run for this. No `anthropic-ratelimit-*` headers: a subscription reports window utilisation, not token budgets, and fabricated limits would mislead.

**The billing gate.** Since late September 2026 the API behind Claude Code answers some third-party wrappers with 400 "Third-party apps now draw from extra usage…", which users bisected to appended system-prompt content. It is relayed as what it is: 400 `invalid_request_error` with upstream's message verbatim and `x-should-retry: false`; never retried by the surface; logged at warn with the length of the client's `system`. It is a known environmental failure a client's own system text can trigger; the surface adds no system text of its own (section 6).

### 14. Process lifecycle and concurrency

Settled in [Process lifecycle and concurrency](issues/19-process-lifecycle-and-concurrency.md); every status it emits checked against the SDKs' retry behaviour (429 and 529 retried with backoff; 504 and 500 retried as `InternalServerError`).

- **Three timers per run**, operator-configurable, enforced by the runner. **Startup**: spawn to `system/init`, default 20 s (includes the connector connect wait). **Stall**: any frame resets it, including `tool_progress` heartbeats, empty thinking deltas and `system/*` frames, default 90 s, above the longest legitimate silence (time to first token on a large prompt, the 40 s retry backoff gap, the 30 s heartbeat spacing). **Active lifetime**: 30 min from spawn, park time excluded (the park TTL covers it). A firing is pre-commit 504 `timeout_error` or post-commit the SSE `error` of that type, then the teardown ladder and the session forgotten.
- **Caps and admission.** One cap on runs in existence, active plus parked, default 4; at the cap a request gets 529 `overloaded_error` immediately, no queue. A parked run is never evicted to admit a turn. Admission also reads upstream's last `rate_limit_event`: after `status: "rejected"`, every request until `resetsAt` gets 429 `rate_limit_error` with `retry-after` before any spawn; `allowed_warning` is logged.
- **Per-session serialisation.** A mutex per upstream session. A continued turn waits for the previous run's exit up to 10 s, then SIGKILLs it and proceeds (the transcript is written at `result`). Concurrent requests on one session queue FIFO and are re-planned after acquiring the mutex, so a duplicate becomes a replayed turn rather than a resume onto a changed transcript.
- **Teardown ladder** for every early end (disconnect, cut, failure, park TTL, shutdown): `control_request interrupt` → wait up to 5 s for `result` → close stdin → wait up to 2 s for exit → SIGTERM → wait up to 5 s → SIGKILL. A run ended before its `result` is an error turn: fingerprint forgotten, transcript deleted.
- **Wrapper shutdown.** New Anthropic-surface requests get 529 `overloaded_error`; streams in flight get the SSE `error` `{type: "api_error", message: "server shutting down"}`; parked runs are interrupted and their handlers rejected; every run descends the ladder in parallel, the drain bounded at 15 s before SIGKILL. The memory-only fingerprint map is lost, so every next turn is a replayed turn; orphaned transcripts are swept at the next start.
- **Buffers.** Stdout is a line stream into the translator, never buffered whole; one line over 16 MB fails the run with 500 `api_error`. Stderr goes to a 64 KB ring buffer kept for error messages. Stdin carries one rendered message per turn, bounded by the 32 MB request limit, written with drain awareness. No other ceilings.
- **Disk and retention.** One fixed, empty working directory for every run; per-run `0600` files in a per-run directory removed at teardown. Forget deletes the transcript; at wrapper start every transcript in the project directory is an orphan and is deleted; an hourly sweep removes files older than the 24 h expiry as a backstop, so the CLI's 30-day sweep is never relied on. `count_tokens` runs persist nothing.
- **Runaway guard**: `--max-turns 25` per run (configurable). Hitting it ends the run with `error_max_turns`, a post-commit 500 `api_error`; this is not the real API's `pause_turn`. The StructuredOutput call and any output-cap continuation count as turns.
- **Observability.** The scheduler exposes counts (active, parked, queued per session, last rate-limit state) on the existing `/health` route and logs every timer firing, cap rejection, kill and sweep with the request id and upstream session id. No new endpoint. Connector tokens and the control-server token are redacted from every log line.

### 15. Operator settings

Collected on [Process lifecycle and concurrency](issues/19-process-lifecycle-and-concurrency.md) with the `redact` row from [Mitigating the account-email disclosure](issues/22-mitigating-the-account-email-disclosure.md). This is the whole configuration surface the spec adds.

| Setting | Default | Section |
| - | - | - |
| Park TTL | 10 min | 7 |
| Fingerprint idle expiry | 24 h | 5 |
| Fingerprint map capacity | 1,000 | 5 |
| Retry cap after `api_retry` | 60 s | 11 |
| SSE idle `ping` | 15 s | 11 |
| Catalogue path | shipped JSON | 3 |
| Connector host list | off | 9 |
| Connector call timeout | 60 s | 9 |
| Startup / stall / active-lifetime timers | 20 s / 90 s / 30 min | 14 |
| Runs in existence | 4 | 14 |
| Continued-turn wait for exit | 10 s | 14 |
| Shutdown drain | 15 s | 14 |
| `--max-turns` | 25 | 14 |
| `upstream.env` | empty | 10 |
| `redact` | empty (the account email, display name and full name are armed automatically from the CLI's account file) | 6 |
| `API_KEY` (client gate) | unset | 2 (existing setting) |

### 16. Module layout and interfaces

Settled in [Module layout and seams](issues/13-module-layout-and-seams.md) with the `codebase-design` vocabulary (module, interface, seam, adapter), amended by the scheduler interface from [Process lifecycle and concurrency](issues/19-process-lifecycle-and-concurrency.md) and the passes from sections 9 and 6; recorded as ADR 0006.

**Two new packages, the OpenAI surface untouched.** A surface-neutral **upstream** package drives one run; an **anthropic** package is the surface. The upstream package has one consumer in this spec; migrating the OpenAI surface onto it is out of scope, and the existing resolver is not touched. The project's size rules are applied as one file per translator pass and per validation concern, each module exporting only its interface.

Upstream package:

- **frames**: the typed frame union of the CLI contract (`system/init`, `system/api_retry`, `system/status`, `stream_event`, `assistant`, `user`, `result`, `rate_limit_event`, `tool_progress`, `control_request`, `control_response`).
- **runner**: `startRun(spec) → Run` with `Run = {frames: AsyncIterable<Frame>, send(userMessage), interrupt(), close(), exited: Promise<{code, signal}>}` and `RunSpec = {flags, mcp: {url, token}, hooks: {url, token}, env, cwd, timers: {startup, stall, lifetime}}`. Inside: no-shell spawn, NDJSON line framing, `control_request` ids matched to `control_response`, the per-run timers, exit tracking. Two adapters make the seam real: a spawn runner (the real CLI) and a replay runner (plays a recorded transcript with its timestamps). Nothing above the runner knows a process exists.
- **control server**: one loopback HTTP server per wrapper process (127.0.0.1, ephemeral port, started with the app, alive as long as the app); `start() → {baseUrl}`, `registerRun(id, {mcpHandler, hookHandler}) → {mcpUrl, hookUrl, token}`, `releaseRun(id)`. Per-run paths `/runs/<id>/mcp` (the bridge server over Streamable HTTP) and `/runs/<id>/hook`, each guarded by a random token.
- **bridge**: the pure state machine lifted from the spike (announce, message complete, call, deliver, abandon; emits `park`), typed, behaviour unchanged, plus one adapter: a low-level MCP `Server` serving `tools/list` from the client's JSON Schema verbatim and turning `tools/call` into bridge calls keyed by `_meta["claudecode/toolUseId"]`. Interface: `createBridge(tools) → {onFrame(frame), deliver(results), abandon(), events}`.
- **scheduler**: gates `startRun`; `admit(plan) → Promise<Lease> | SurfaceError` (run cap, rate-limit admission from the last `rate_limit_event`, per-session mutex with re-plan), `Lease.release()`, `registerParked(run)`, `shutdown(deadline)`; the held-run registry and the teardown ladder; counts for `/health`.

Anthropic package:

- **composition root**: builds the surface from injected dependencies (runner, catalogue, sessions, control server, clock); reads the CLI's account file and the `redact` setting to arm redaction.
- **conductor**: the only orchestrator, `handleMessages(req, res)` and `handleCountTokens(req, res)`: plan → admit → run or parked run → translator → sink, acting on `park` (register the held run), `cut` and `fail` (interrupt, forget session, tear down).
- **http**: Express routers, the surface-tag middleware, the surface error type and its renderer, the static OpenAPI document.
- **request**: one deep function `planTurn(request, catalogue, sessions) → TurnPlan | SurfaceError`, `TurnPlan = {runSpec, continuation: {resume: id} | {replay: userMessage} | {parked: run}, bridgeTools, hookPolicy, translatorConfig}`. Inside, pure modules with their own tests: validate (every 400 rule, one file per concern), normalise (canonical transcript and fingerprint), render (the replayed-turn message), tools (client tools to the bridge, server tools to built-ins and hook policy, connectors to config entries and allow rules), run spec (argv and environment allowlist). Nothing in it performs I/O.
- **catalogue**: `load(path) → Catalogue`, `resolve(name) → entry | null`, `list(page)`; loaded once at start.
- **translate**: `createTranslator(config) → {push(frame): TurnEvent[], end(): TurnEvent[]}`; `TurnEvent` is an API SSE event or a control signal (`park`, `cut`, `fail`) in the same ordered stream; the eleven passes of section 11, one file each; the allowlist as data.
- **respond**: `writeSse(events, res)` (owns commit, the idle ping timer, disconnect detection and the `error` event) and `accumulate(events) → Message` (mirrors the SDK accumulators).
- **sessions**: `lookup(fingerprint)`, `record(…)`, `forget(sessionId)`, `parked.{get, put, remove}`; the 24 h expiry and capacity; deletes transcripts on forget.

Shipped beside the packages: the **hook client**, an executable that posts its stdin to the hook endpoint and prints the reply (a child process per hook call; the policy lives in-process).

**The HTTP layer's five changes to existing files**: the surface-tag middleware mounted first; the 32 MB JSON parser on Anthropic paths; the auth middleware accepting `x-api-key` on tagged requests; the error handler's Anthropic branch; route mounting (the Anthropic models route before the OpenAI one). The existing Swagger definition file is not edited: the surface's static OpenAPI document is added to the Swagger UI's definition picker.

### 17. Documentation

Graduated from the map's last fog item; the deliverables are settled on [Mitigating the account-email disclosure](issues/22-mitigating-the-account-email-disclosure.md) decision 1 (the README warning) and [Module layout and seams](issues/13-module-layout-and-seams.md) decision 9 (the OpenAPI document).

- The README gains the Anthropic surface: how to point an SDK at it, the four endpoints, and an operator warning covering the residual context and self-identification, the account-email disclosure and what redaction does and does not cover, the connector default and host list, and the auth stance as the operator's own choice with the `upstream.env` map.
- The architecture API reference gains the surface's endpoints and points at the OpenAPI document.
- A static OpenAPI document for the surface, served through the existing Swagger UI's definition picker.

## Testing Decisions

Settled in [Module layout and seams](issues/13-module-layout-and-seams.md) decision 10, amended by [Mitigating the account-email disclosure](issues/22-mitigating-the-account-email-disclosure.md) decision 4 and the e2e additions from [MCP connector passthrough](issues/15-mcp-connector-passthrough.md) and [Mitigating the account-email disclosure](issues/22-mitigating-the-account-email-disclosure.md).

**What makes a good test here.** A test asserts external behaviour at a seam, never implementation: frames in and turn events out for the translator; a request in and a turn plan out for planning; HTTP in and the SDK's returned objects or raised error classes out for the surface. Golden fixtures are recorded upstream transcripts, so a test that fails on a new CLI version is the drift detector, not a flake. The compatibility veto is automated: if the official SDK cannot drive the surface in the integration suite, the build fails.

**Three layers**, matching the project's existing Jest projects (unit, integration, e2e), its fixtures directory and its mocks directory:

- **Unit**: every pure module against golden fixtures: the translator (every recorded transcript with partial messages is a fixture; the account-email baseline recording becomes the redaction fixture, its quoted address coming out as `[redacted]`), the bridge state machine (from the spike's event sequences), `planTurn` (golden request to plan), normalise and fingerprint, render, catalogue, the sinks, sessions with a fake clock, the control server's token checks.
- **Integration**: the Express app built with the replay runner injected, driven by the official TypeScript SDK as a devDependency (`messages.create`, `messages.stream().finalMessage()`, `models.list`, `models.retrieve`, `count_tokens`, and the error classes for every row of the error tables), plus supertest for the HTTP layer and the control server.
- **E2E**: the real CLI behind an environment flag, each scenario consuming subscription quota, never in CI. The scenario list is the surface's real-CLI verification list, carried here verbatim:
  1. A model call failing **after** it has streamed content (section 11, the one unobserved turn-stream shape: whether upstream then emits `api_retry` plus a fresh `message_start`, or an error `result`; the trigger set covers both, and the test records the real shape when first seen).
  2. `MAX_THINKING_TOKENS` under a binding budget on Haiku (section 12).
  3. `CLAUDE_CODE_DISABLE_THINKING=1` on a 5.x model (expected: no effect).
  4. The interrupt racing upstream's auto-continuation after a `max_tokens` cut (section 12).
  5. `count_tokens` end to end: one-token cap, first `message_delta`, interrupt (section 12).
  6. A park longer than five minutes on the raw driver with `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT` raised (section 7; the knob's effect is unverified).
  7. The hook client round trip through the control server (section 16; `--settings` command hooks are verified, the HTTP-callback script is not).
  8. Observe-when-it-happens, not deliberately triggered: a live 429 (subscription window exhausted) and an OAuth-expiry run (section 13; those rows rest on documented shapes only).
  9. A connector round trip against a real `https` MCP server with `alwaysLoad`, including the not-connected failure path (section 9).
  10. A direct ask for the account email with redaction armed (section 6).

**Fixtures.** The recordings under the effort's research probes and spike runs are copied into the app's fixtures directory at implementation time. The copy **scrubs** every recording: the operator's account email, display name and full name are replaced with placeholders (`user@example.invalid`, `Example User`), because the address sits in seventeen recordings including every SDK spike run; a scrub script in the test scripts directory does it, and a guard test fails the suite if any fixture still carries the live values. Copying and scrubbing is its own implementation ticket. New fixture shapes recorded on the way: the output-cap auto-continuation, the structured-output call, Haiku with thinking disabled, the hook-deny frames, the two-call web-search turns, the parallel-call park, the interrupt.

**Prior art in the codebase.** The three Jest projects with their separate configs, `tests/fixtures/` and `tests/mocks/`, and the existing streaming tests on the OpenAI surface are the patterns to follow; the official Anthropic SDK is not yet a dependency and enters as a devDependency only.

## Out of Scope

From the map, settled before the first ticket:

- Replacing or removing the OpenAI surface; the brief says "also".
- Reworking the OpenAI surface's prompt-template approach, or migrating it onto the new runner. The runner is surface-neutral so that a later effort can.
- Message Batches, Files API (so `file` sources are 400), Admin API, Managed Agents, Agent Skills, prompt-caching semantics (`cache_control` is accepted and ignored). None has an upstream equivalent in a CLI run.
- **Agent mode**: letting a request run Claude Code's file and shell tools on the host. If wanted later, it is an opt-in server flag and a fresh effort.
- Implementing this spec: `/to-tickets` and `/implement-spec` take over.

Ruled out within tickets, left as later refinements:

- A hot cache of idle upstream processes between turns (same fidelity, lower latency, about 230 MB per idle conversation).
- `--fork-session` on a shorter matching history prefix, and `--resume-session-at` the last good message after an error turn; both are replayed turns in this spec.
- The Agent SDK as a driver.
- Synthesised web-search citations, real `encrypted_content`, `page_age`; upstream supplies titles and URLs only.
- `anthropic-ratelimit-*` headers.
- Mirroring the real API's 400 for unknown `anthropic-beta` names.
- URL-sourced images and documents (the API behind Claude Code cannot download them).
- Tool search and deferred tool loading for connectors.
- A system-prompt instruction against disclosure; redaction replaces it.
- Any Anthropic-side equivalent of wrapper sessions.

## Further Notes

### Known deviations from the real API

Listed so the README and the implementing agent state them rather than discover them.

- **Residual context and self-identification** (section 6): the model knows it is "a Claude agent built on the Claude Agent SDK", the working directory, platform, date and the operator's account email; the email, display name and full name are redacted on output, a paraphrase is not.
- **`max_tokens` applies per model call** (section 12): a turn with built-in or connector calls can emit more than `max_tokens` in total.
- **A stop-sequence cut reports an estimated `output_tokens`** for the cut call (section 12), the only inexact usage figure.
- **`error_max_turns` is a 500**, not the real API's `pause_turn` (section 14).
- **`count_tokens` counts the residual context** and the replayed-turn rendering (section 12).
- **Sampling parameters are 400 on every model**, including Haiku 4.5 where the real API still accepts them (section 4.1).
- **`tool_choice` `any` and `tool` are 400 on every model**, including Haiku 4.5 (section 7).
- **Thinking text is always empty** (display omitted), whatever `thinking.display` asks (section 11).
- **Web search carries no citations, an opaque `encrypted_content` and `page_age: null`**; web fetch returns upstream's extraction, not the page (section 8).
- **A mixed message with the client call before the built-in** ends the turn with a `server_tool_use` and no result block; the result opens the resuming turn (section 11).
- **Connector `defer_loading` and per-tool `configs` are ignored**; connectors are off by default and gated by an operator host list (section 9).
- **Operator-side upstream failures are 500**, never 401 or 402 (section 13).
- **Unknown `anthropic-beta` names are accepted** rather than rejected (section 2).
- **No `anthropic-ratelimit-*` headers** (section 13).
- **`max_tokens: 0`** (the real API's cache pre-warm) is 400 (section 4.1).
- **Edits to earlier history on the turn that resumes a parked run are ignored**; a regenerate or edit elsewhere is a replayed turn, not a fork (sections 5, 7).
- **`user_location`, `disable_parallel_tool_use`, `service_tier`, `metadata.user_id`, `inference_geo`, `diagnostics` and `cache_control`** are accepted and ignored (section 4.1).
- **URL-sourced images and documents, `file` sources, `search_result` and the newer connector blocks** are 400 (section 4.3).

### Unverified mechanics

Every mechanic the spec relies on but no probe has observed is in the e2e scenario list above (scenarios 1 to 10) and nowhere else. Two further facts are documented, not measured: the `rate_limit` and `overloaded` rows of the upstream failure table rest on documented shapes, and the applied `effort` level cannot be read back from frames.

### Reconciliations made while assembling

Places where two closed decisions had to be read together; none is a new decision.

- `result.permission_denials` "must contain only the wrapper's own hook denials, else the turn fails" (Web search policy) meets "the response ends at `message_stop` and `result` is consumed asynchronously" (Streaming fidelity). The check runs when `result` arrives and a foreign entry is logged as a misconfiguration; it cannot fail a response that has closed.
- "`system/init.tools` must equal the expected list" (Web search policy) meets the probe fact that `init.tools` is `["StructuredOutput"]` on a `--json-schema` run despite `--tools ""` (Model and parameter mapping). The expected list includes `StructuredOutput` when `--json-schema` is passed.
- `document` blocks inside a `tool_result` were left conditional on Conversation state widening document support (Tool bridge decision 10). Conversation state widened it for user content only and no ticket extended the bridge's MCP content mapping, so `tool_result` content stays text and image.
- `MCP_CONNECT_TIMEOUT_MS` is in the always-set environment (Process lifecycle) with no value fixed; the constraint from MCP connector passthrough (the connect wait sits inside the startup timer) is stated and the value is the implementer's.
- The bridge server is mounted "per run" (Conversation state); the spec reads this as "when the turn exposes client tools", since an empty bridge server has nothing to serve and `tool_choice: none` hides the tools.

### Environment and auth facts

- **Upstream version.** The decisions were probed on Claude Code 2.1.284 to 2.1.291 (mise-installed; `latest` moves between sessions). `system/init.capabilities` is the feature-detection point; the field allowlist and the frame union are where drift shows.
- **Auth stance is the operator's.** Upstream runs on the CLI's own login; the probes ran on the subscription OAuth login (`apiKeySource: "none"`). Anthropic's legal page says developers should use API-key authentication and that OAuth is for ordinary use of Claude Code, while a support article says SDK and `-p` use still draws on subscription limits; details and citations are in the Agent SDK research (§6). The surface presents this as the operator's choice: the `upstream.env` map is where an explicit API key or OAuth token goes, nothing is inherited, and the README says so. The spec decides nothing about which login an operator should use.
- **The billing gate** (section 13) is an environmental failure a client's own system text can trigger; the surface adds no system text and relays the 400 verbatim.
- **Cost of a run.** With the decided flags an empty-system-prompt run sends 493 input tokens (about $0.012 by the CLI's estimate), uncached; spawn to `system/init` is 0.7 to 1.0 s; `system/init` to the first `message_start` 2.4 to 3.8 s.

### Sources

- The map and its tickets: `.scratch/anthropic-compat-api/map.md`, `issues/01` to `22` (each ticket's `## Answer`, `## Decided in …` and `## Comments` sections are the record; this spec restates them).
- Research with per-claim probe citations: `.scratch/anthropic-compat-api/research/*.md`, raw probe recordings under `research/cli-probes/`.
- The spike (both drivers, the bridge state machine, nine recorded runs): `.scratch/anthropic-compat-api/spike/`.
- ADRs: `docs/adr/0001` client tools through a held-open run; `0002` conversations continue an upstream session by fingerprint; `0003` responses assembled from stream events flattened across model calls; `0004` output limits emulated by cutting the turn stream; `0005` operator-side upstream failures surface as 500; `0006` raw CLI driver over the Agent SDK.
- Vocabulary: `GLOSSARY.md`.
