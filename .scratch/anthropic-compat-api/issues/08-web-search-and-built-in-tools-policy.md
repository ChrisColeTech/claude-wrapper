# Web search and built-in tools policy

Type: grilling
Status: resolved
Blocked by: 01, 02, 03

## Question

How do server tools and built-in tools show up on the Anthropic surface?

1. **Web search**: when a client declares `web_search_20260209` (or the older `web_search_20250305`), enable upstream's built-in WebSearch for that run. Should its activity be translated into real `server_tool_use` and `web_search_tool_result` blocks (so SDK clients see citations and `usage.server_tool_use.web_search_requests`), or folded into the text answer? Honour `max_uses`, `allowed_domains`/`blocked_domains`, `user_location`? Should `web_fetch_20260209` map to built-in WebFetch the same way?
2. **No tools declared**: should upstream run with all built-in tools disabled so the surface behaves like a pure model endpoint? Recommended: yes.
3. **Permissions**: which `--permission-mode` / `--permission-prompts` combination upstream runs under for each of the above.

Settled upstream of this ticket: agent mode (host-side file and shell tools) is out of scope, see [Destination and target clients](01-destination-and-target-clients.md); every run on this surface must leave those built-in tools disabled.

Record the mapping table on this ticket; add a glossary entry if a new term emerges.

## Facts from research

- In upstream output WebSearch is a built-in tool, not a server tool: `tool_use{name:"WebSearch", input:{query}}`, then a `user`/`tool_result` text blob plus `tool_use_result{query, results:[{tool_use_id:"srvtoolu_...", content:[{title,url}]}], summary, searchCount}`. Only title and url are available; no `encrypted_content`, `page_age`, or citations; the main model's `web_search_requests` stays 0 (a Haiku side call does the search). Enable with `--tools WebSearch --allowedTools WebSearch` and always pass `--permission-mode` and `--permission-prompts none` explicitly ([CLI contract](02-cli-headless-io-contract.md) §2, §6).
- Clients expect `server_tool_use` + `web_search_tool_result` + text with `web_search_result_location` citations, and replay `encrypted_content` on later turns ([wire contract](03-messages-api-wire-contract.md) §7). The surface can synthesize the blocks from `tool_use_result` and compute `usage.server_tool_use.web_search_requests` itself, but must decide what to put in the fields upstream cannot supply.
- Prior art: forwarding built-in `tool_use` blocks to clients causes agentic loops; use the `mcp__` prefix to tell client tool calls (park) from built-ins (continue) ([Prior art](05-prior-art.md), lessons).

## Decided in Tool bridge strategy (2026-10-04)

- The bridge parks only on `mcp__client__*` names; a built-in `tool_use` (WebSearch) never parks and the run continues through it. When client tools and `web_search` are both declared, the run has WebSearch enabled and the bridge server mounted at once. See [Tool bridge strategy](07-tool-bridge-strategy.md) decision 7.

## Decided in Conversation state and system prompt (2026-10-04)

- Every turn is its own run and the bridge server and `--tools` are passed afresh each run, so a turn's `tools[]` alone decides that run's WebSearch and bridge configuration; nothing carries over from the previous turn.
- The history renderer for replayed turns needs a rendered form for `server_tool_use` and `web_search_tool_result` blocks the client replays (and the fingerprint normalisation accepts them as the wrapper emitted them). This ticket decides that form.
- The upstream system prompt is exactly the client's `system`, with no wrapper preamble, so any guidance to the model about when to search goes in-band or not at all. See [Conversation state and system prompt](10-conversation-state-and-system-prompt.md) decisions 4 to 6.

## Answer

Resolved 2026-10-04 with the human, one grilling round, every recommendation taken. No ADR (a translation, not an architectural commitment); no new glossary term. Facts new to this ticket come from Claude Code's tools reference and CLI reference (fetched 2026-10-04 for 2.1.289): WebSearch returns titles and URLs only, may run up to eight backend searches per call, takes `allowed_domains` or `blocked_domains` as tool input, has no permission-rule specifier, and is capped at 200 calls per session (`CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION`); WebFetch is lossy by design (fetch, Markdown, the model's own extraction prompt run in a separate model call), caches 15 minutes, upgrades to HTTPS, truncates, returns cross-host redirects instead of following them, and takes `WebFetch(domain:…)` permission rules; `--settings` accepts inline JSON at its own precedence level, loaded even with `--setting-sources=`.

### Decisions

| # | Decision |
| - | - |
| 1 | **Web search is synthesised as the API's blocks.** Per WebSearch call: one `server_tool_use {name: "web_search", input: {query}}` with `id` = the first `srvtoolu_` id in `tool_use_result.results` (wrapper-minted `srvtoolu_` if none), and one `web_search_tool_result` whose `content` lists every `{type: "web_search_result", url, title, encrypted_content, page_age: null}` across the call's backend searches. `encrypted_content` is a wrapper-minted opaque token (base64 of url and title), never validated on replay. The Haiku summary string is not exposed. Text blocks carry `citations: null`; no citations are synthesised. `web_search_20250305`, `20260209`, `20260318` are accepted and mapped alike; `response_inclusion`, `allowed_callers`, `strict`, `defer_loading`, `cache_control` accepted and ignored. A failed search becomes `web_search_tool_result_error {error_code: "unavailable"}`. |
| 2 | **Limits are enforced by a `PreToolUse` hook on `WebSearch`.** The hook injects the request's `allowed_domains` or `blocked_domains` into every call's input via `updatedInput`; both lists in one tool definition is a 400 as on the real API. After `max_uses` calls the hook denies the call and the surface emits `web_search_tool_result_error {error_code: "max_uses_exceeded"}` for it. `user_location` accepted and ignored. Mechanism: the Agent SDK's in-process `hooks` option, or a command hook passed through `--settings '{"hooks": …}'` on the raw CLI. Verification is [Hook enforcement of web tool limits upstream](21-hook-enforcement-of-web-tool-limits-upstream.md). |
| 3 | **Built-ins.** `--tools ""` on every run. A declared server tool adds exactly its built-in: `WebSearch`, `WebFetch`, or both. Nothing else, ever. `system/init.tools` is checked against the expected list and a mismatch fails the run before the first turn. |
| 4 | **Permissions.** `--permission-mode default --permission-prompts none` on every run; `--allowedTools` lists exactly the enabled tools: every `mcp__client__<name>`, `WebSearch` when declared, `WebFetch(domain:*)` when declared. Domain and use limits are the hook's (decisions 2, 5). `result.permission_denials` must be empty on a healthy run. |
| 5 | **Web fetch is supported, lossiness documented.** `web_fetch_20250910` to `20260318` map to built-in WebFetch: `server_tool_use {name: "web_fetch", input: {url}}` (the model's extraction `prompt` is not shown), `web_fetch_tool_result {content: {type: "web_fetch_result", url, retrieved_at: <wrapper time>, content: {type: "document", source: {type: "text", media_type: "text/plain", data: <what upstream's model received>}, title: null}}}`. The same hook enforces `max_uses`, `allowed_domains`, `blocked_domains` (deny → `url_not_allowed` or `max_uses_exceeded`); `citations`, `max_content_tokens`, `use_cache`, `response_inclusion`, `url_sources` accepted and ignored; a fetch failure maps to `url_not_accessible`. The spec states that the document is an extraction, not the page. |
| 6 | **`tool_choice: none`** also disables WebSearch and WebFetch for the run (`--tools ""`). `auto` or absent is the default; `any`/`tool` remain 400s ([Tool bridge strategy](07-tool-bridge-strategy.md) decision 5). |
| 7 | **Replayed-turn rendering** (for [Conversation state and system prompt](10-conversation-state-and-system-prompt.md) decision 4): `server_tool_use` → `<web_search query="…"/>` or `<web_fetch url="…"/>`; `web_search_tool_result` → `<web_search_results>` with one `title: url` line per result, or `<web_search_error code="…"/>`; `web_fetch_tool_result` → `<web_fetch_result>` holding the document text. Replayed blocks are accepted exactly as sent; `encrypted_content` is never checked. |
| 8 | **Usage.** `usage.server_tool_use.web_search_requests` = sum of `searchCount` over the turn's WebSearch calls (fallback: count of WebSearch `tool_use` blocks); `web_fetch_requests` = count of WebFetch calls. Side-call tokens are not reported, matching the real API. |
| 9 | **Block order within a turn.** One surface message in upstream order: text before the call, `server_tool_use` (streamed as `content_block_start` plus `input_json_delta`), `web_search_tool_result` emitted complete in one `content_block_start` when upstream's `user/tool_result` frame arrives, then the answer text. Index renumbering and `message_start` suppression are [Streaming fidelity](09-streaming-fidelity.md)'s; thinking blocks between calls follow Streaming fidelity and [Model and parameter mapping](11-model-and-parameter-mapping.md). |
| 10 | **No ADR, no glossary term.** |
| 11 | **Probe batch released**: [Hook enforcement of web tool limits upstream](21-hook-enforcement-of-web-tool-limits-upstream.md) (new) fired together with [Residual upstream context and the account-email reminder](20-residual-upstream-context-and-account-email.md) on 2026-10-04. |

### Mapping table

| Client declares | Upstream flags | Client sees |
| - | - | - |
| no server tool | `--tools ""` | no server-tool blocks |
| `web_search_*` | `--tools WebSearch --allowedTools WebSearch` + hook | `server_tool_use(web_search)` + `web_search_tool_result` per call; `usage.server_tool_use.web_search_requests` |
| `web_fetch_*` | `--tools WebFetch --allowedTools "WebFetch(domain:*)"` + hook | `server_tool_use(web_fetch)` + `web_fetch_tool_result` per call; `usage.server_tool_use.web_fetch_requests` |
| both | `--tools WebSearch,WebFetch` + both allow rules + hook | both |
| any, with `tool_choice: none` | `--tools ""` | none |
| any other server tool type (`code_execution_*`, `text_editor_*`, `bash_*`, `computer_*`, `memory_*`, `tool_search_*`, `browser_*`) | not spawned | 400 `invalid_request_error` naming the tool type ([Error envelope and auth](12-error-envelope-and-auth.md)) |

### Boundaries handed to other tickets

- [Streaming fidelity](09-streaming-fidelity.md): decision 9 (block order, where the result block is synthesised).
- [Model and parameter mapping](11-model-and-parameter-mapping.md): decision 8 (usage fields).
- [Error envelope and auth](12-error-envelope-and-auth.md): 400 for both domain lists, for unsupported server-tool types; the in-result error codes above are not HTTP errors.
- [Module layout and seams](13-module-layout-and-seams.md): the runner must host a `PreToolUse` hook (SDK `hooks` option or `--settings` command hook) and check `init.tools`; the server-tool translator is a seam beside the bridge.
- [Process lifecycle and concurrency](19-process-lifecycle-and-concurrency.md): the child environment may set `CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION` and `CLAUDE_CODE_WEBFETCH_*` knobs; decide there.

### Primary sources

[CLI contract](02-cli-headless-io-contract.md) §2 and probe `research/cli-probes/d-websearch.jsonl` (WebSearch output shape); [wire contract](03-messages-api-wire-contract.md) §2.2 and §7 (block shapes, error codes, usage); Claude Code tools reference, sections "WebFetch tool behavior", "WebSearch tool behavior", "Session search limit", and CLI reference entries for `--settings`, `--tools`, `--allowedTools`, `--permission-prompts` (code.claude.com, fetched 2026-10-04); hooks reference, `PreToolUse` `updatedInput` and `permissionDecision`.

## Facts found after resolution (2026-10-04, [Hook enforcement of web tool limits upstream](21-hook-enforcement-of-web-tool-limits-upstream.md))

- Decisions 2 and 5 are verified on both drivers: `updatedInput` applies the domain lists silently (the `tool_use` frame keeps the model's original input, so the translator takes `allowed_domains`/`blocked_domains` from the request, never from the frame), and a hook deny reaches the model as a `tool_result` with `is_error: true` and text `PreToolUse:<tool> hook error: <reason>`, with no side call. The translator maps that frame to `web_search_tool_result_error` / `web_fetch_tool_result_error` with the code the hook's reason names (`max_uses_exceeded`, `url_not_allowed`).
- **Refinement of decision 4 (implied):** a hook deny is listed in `result.permission_denials`, so "must be empty on a healthy run" becomes "must contain only denials the wrapper's own hook issued, matched by `tool_use_id`"; any other entry is a misconfiguration and fails the turn.
- Decision 4 confirmed: `--allowedTools "WebFetch(domain:*)"` under `--permission-mode default --permission-prompts none` fetches with no prompt.
- On the SDK driver no `hook_started`/`hook_response` frames appear even with hook events enabled; the hook's own log is the only trace. Relevant to the test strategy fog.
