# Streaming fidelity

Type: grilling
Status: resolved
Blocked by: 02, 03

## Question

Does the Anthropic surface stream for real? Candidates: pass upstream's raw `stream_event`s (from `--include-partial-messages`) straight through as SSE, renumbering content block indexes and rewriting `message_start`/`message_delta` so one turn looks like one API message even when upstream made several model calls; or simulate streaming by chunking a finished answer (what the OpenAI surface does). Decide: passthrough vs simulated; how several upstream model calls within one turn are flattened into one message's event stream, or whether built-in tool activity is dropped from the stream; `ping` cadence; how upstream errors mid-stream become an `error` event; what `usage` goes in `message_delta`; back-pressure and client disconnect handling (kill the run?). Recommended: passthrough.

## Facts from research

- `stream_event.event` is the raw Messages API event stream and can be relayed almost verbatim (strip `thinking_delta.estimated_tokens` and `message_delta` extras). Non-streaming `assistant` lines are one per content block with a shared `message.id` and `stop_reason: null`; the final `stop_reason`/`usage` come from `message_delta` or `result`. Non-API fields (`caller`, `container`, `wire_tool_inputs`, `safeguard_results`, and others) must be stripped ([CLI contract](02-cli-headless-io-contract.md) §1). A run that uses a built-in tool makes several API calls, so passthrough must flatten several `message_start`..`message_stop` sequences into one.
- SDK clients need `message_start` with empty content and usage, contiguous block indices, `message_delta` with `usage.output_tokens`, a `message_stop`, and valid JSON per event; the Python SDK parses tool-input JSON eagerly ([wire contract](03-messages-api-wire-contract.md), minimum viable). One prior-art project already does verbatim passthrough ([Prior art](05-prior-art.md)).

## Facts from the spike (2026-10-04)

From [Spike: round-trip one client tool call through upstream](06-spike-client-tool-round-trip.md) (`../spike/runs/*.wire.ndjson`).

- When the model calls a client tool, upstream's own `message_delta {stop_reason: "tool_use"}` and `message_stop` arrive while the run is parked, within 1 ms of the MCP `tools/call`. The parked turn's SSE can therefore be a verbatim passthrough that ends on upstream's events, nothing synthesised; the resumed turn starts with a fresh `message_start` and a new `msg_` id, so in the client-tool case one surface turn is exactly one upstream API message.
- Multi-block assistant messages happen: in `cli-http-happy` a `text` block ("Checking the current weather in Paris now.") preceded the `tool_use` block, indices 0 and 1, each with its own `content_block_start`/`content_block_stop` and its own `assistant` frame.
- Flattening is still needed for **built-in** tool activity inside a turn (several `message_start`..`message_stop` sequences); that case was not in the spike.
- While any tool call is pending upstream emits `tool_progress` heartbeats every 30 s; while a built-in tool (WebSearch) runs mid-stream this is a natural `ping` trigger. While parked on a client tool there is no open HTTP response, so nothing to ping.

## Decided in Tool bridge strategy (2026-10-04)

- A parked turn streams upstream's own `message_delta {stop_reason: tool_use}` and `message_stop`; nothing is synthesised. Client disconnect **while parked** is the bridge's to handle (interrupt, then reject); disconnect **mid-stream** stays this ticket's. See [Tool bridge strategy](07-tool-bridge-strategy.md) decisions 1 and 6.

## Decided in Conversation state and system prompt (2026-10-04)

- Every turn is its own run (`--resume` for continued turns, a fresh run for replayed turns), held open only while parked. A `system/init` opens every run; a continued turn's `message_start`…`message_stop` come from the resumed run.
- Per-turn `usage` comes from `message_delta.usage` / `result.usage`, never from `total_cost_usd` or `modelUsage`, which include totals restored on resume.
- Transport is `spawn` with `-p --input-format stream-json --output-format stream-json --verbose --include-partial-messages`; stdin closes after the turn's `result` unless parked. See [Conversation state and system prompt](10-conversation-state-and-system-prompt.md) decisions 2 and 7.

## Found in Image and document block pass-through upstream (2026-10-04)

Document citations reach the output only as `stream_event` `content_block_delta` `citations_delta` frames; the CLI's complete-block `assistant` frame has `citations: []` and `result.result` holds only the last text block. A passthrough stream relays them for free; a non-streaming response must be assembled from the `stream_event`s (or at least the deltas) rather than from `assistant` frames or `result`. See [Image and document block pass-through upstream](18-image-and-document-pass-through-upstream.md).

## Decided in Web search and built-in tools policy (2026-10-04)

A turn with web search is one surface message in upstream order: text before the call, `server_tool_use` streamed as `content_block_start` plus `input_json_delta`, a `web_search_tool_result` (or `web_fetch_tool_result`) emitted complete in one `content_block_start` when upstream's `user/tool_result` frame arrives, then the answer text. The result block is synthesised by the server-tool translator, not relayed. Index renumbering and `message_start` suppression across upstream's two API calls are this ticket's. See [Web search and built-in tools policy](08-web-search-and-built-in-tools-policy.md) decisions 1, 5, 9.

## Answer

Resolved 2026-10-07 with the human, one grilling round, every recommendation taken under one condition: **no decision may harm client compatibility**. Each was checked against the SDK minimums in the [wire contract](03-messages-api-wire-contract.md) §8.2 to §8.4 (one `message_start` first, contiguous indices, `message_delta` with `usage.output_tokens`, `message_stop` then close, `ping` skipped, `error` thrown exactly as the real API's error events are); all fifteen pass. Recorded as [ADR 0003](../../../docs/adr/0003-responses-assembled-from-stream-events-flattened-across-model-calls.md). Vocabulary added to `GLOSSARY.md`: model call, turn stream.

Facts new to this ticket, from `research/cli-probes/s-websearch-allowed-then-deny.jsonl`, `s-websearch-blocked-allow.jsonl`, `../spike/runs/sdk-parallel.wire.ndjson`, `../spike/runs/cli-http-interrupt.wire.ndjson` and `research/cli-probes/o-pass-through-run1.jsonl`:

- Each model call opens its own `message_start` with a new `msg_` id and restarts block indices at 0; a call that ends in a tool call closes with its own `message_delta {stop_reason: tool_use}` and `message_stop` **before** the tool runs, for built-ins as well as client tools.
- `result.usage` is the field-wise sum of the per-call `message_delta.usage` values (435 = 58 + 57 + 320 output tokens; 66 = 2 + 32 + 32 input tokens across three calls).
- Upstream emits one `user/tool_result` frame per tool as each completes, not one batched frame per assistant message.
- `control_request {subtype: "interrupt"}` on stdin ends a run in about 9 ms with zero extra model calls: a synthetic error `tool_result`, then `result {subtype: "error_during_execution"}`.
- A model call rejected before streaming begins produces no `stream_event` at all: a synthetic `assistant` frame with a UUID id and `stop_reason: "stop_sequence"`, then `result {is_error: true, api_error_status: 400}`.
- A thinking block can open a later model call (`thinking` at index 0, `text` at index 1) and a middle call can mix `thinking`, `text` and `tool_use`.

### Decisions

| # | Decision |
| - | - |
| 1 | **One translator, two sinks.** Every run uses `--include-partial-messages`. One stream translator turns a run's frames into exactly one *turn stream* (the API event sequence for the turn). The SSE sink writes it; the non-streaming sink accumulates it into a `Message` the way the official SDK accumulators do, which is also what citations require ([Image and document pass-through](18-image-and-document-pass-through-upstream.md)). The translator's inputs are `stream_event`, `user` tool-result frames, `system/api_retry` and `result`; `assistant`, `rate_limit_event`, `tool_progress`, `system/status` and hook frames are not inputs. |
| 2 | **Flattening across model calls.** (a) The turn's first `message_start` is relayed, every later one suppressed. (b) Each call's block indices are offset by the number of surface blocks already emitted in the turn, synthesised result blocks included. (c) At `message_delta {stop_reason: tool_use}`: if any `tool_use` block in that call is under `mcp__client__`, relay `message_delta` and `message_stop` and park ([Tool bridge strategy](07-tool-bridge-strategy.md) decision 4); if all are built-in, suppress both and the run continues. (d) Frames with a non-null `parent_tool_use_id` are dropped. (e) Any other `stop_reason` (`end_turn`, `max_tokens`, `refusal`, `stop_sequence`) is final: relay `message_delta` and `message_stop` verbatim. |
| 3 | **Mixed message (client tool and built-in in one assistant message).** A client `tool_use` block's events are held until every built-in that precedes it in the same message has had its result block emitted, so the order is the real API's: `server_tool_use`, `web_search_tool_result`, `tool_use`. Known deviation, documented: when the client call precedes the built-in, upstream parks before the built-in runs; the turn ends with a `server_tool_use` and no result block, and the result block opens the resuming turn's message at index 0. |
| 4 | **Server-tool block input is filtered.** `content_block_start` for a `server_tool_use` is emitted immediately with `input: {}`; at upstream's `content_block_stop` one `input_json_delta` carries exactly `{"query": …}` (web search) or `{"url": …}` (web fetch), then `content_block_stop`. Upstream's deltas, which may carry `allowed_domains`/`blocked_domains` or the WebFetch extraction `prompt`, are never relayed ([Web search policy](08-web-search-and-built-in-tools-policy.md) decision 5 already demanded this for web fetch). |
| 5 | **Thinking blocks are relayed** as upstream emits them: `content_block_start {thinking: ""}`, `thinking_delta` with empty text, one `signature_delta`, `content_block_stop`, which is the real API's shape on these models with the default `display: "omitted"`. `estimated_tokens` is stripped; `system/thinking_tokens` frames are dropped; `thinking_tokens` stays in `usage.output_tokens_details`. |
| 6 | **Usage.** `message_start.message.usage` is the first call's. The final `message_delta.usage` is the field-wise sum of every relayed call's `message_delta.usage` (`input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`, `cache_creation.*`, `output_tokens_details.thinking_tokens`) plus `server_tool_use` counts per Web search policy decision 8. Equal to `result.usage` by measurement, so the response never waits on `result`. The non-streaming `usage` is the same object. `iterations` is dropped. |
| 7 | **Field hygiene by allowlist.** Per event and block type only the fields the Messages API schema defines are emitted; `caller`, `wire_tool_inputs`, `iterations`, `estimated_tokens`, `thinking_display`, `ttft_ms`, `uuid`, `session_id`, `parent_tool_use_id` and anything unknown are dropped, and each dropped name is logged at debug so CLI drift is visible. The `mcp__client__` strip (ticket 07) and the WebSearch/WebFetch rename (ticket 08) run in the same pass. `message.model` is [Model and parameter mapping](11-model-and-parameter-mapping.md)'s. |
| 8 | **The HTTP status is committed at the turn's first relayed `message_start`.** Before it, an upstream failure (error `result` with no `message_start`, or the decision 9 cap) is a real HTTP error status via [Error envelope and auth](12-error-envelope-and-auth.md), which the SDKs retry on 429 and 5xx. After it, failures are SSE `error` events (decision 10). No `ping` is possible before commit; observed time to `message_start` is 2.4 to 3.8 s. Headers that depend on the first `rate_limit_event` remain possible because it precedes `message_start`. |
| 9 | **Upstream's retry loop is capped.** If `system/api_retry` has been seen and no new model call has produced a frame within 60 s (configurable), interrupt the run and fail the turn with the error the last `api_retry` named, mapped by ticket 12. Applies in both phases of decision 8. |
| 10 | **Failure after content.** Triggers: (i) a `message_start` arriving while the current upstream message still has an open block (upstream restarted a call whose partial content was already relayed); (ii) `result` with `is_error: true` or a non-success subtype before the turn's final `message_stop`; (iii) process exit or the stall watchdog ([Process lifecycle](19-process-lifecycle-and-concurrency.md)); (iv) the decision 9 cap. A plain `api_retry` after content is not a trigger: if the failed call had emitted nothing, its retry is one more suppressed `message_start`. Action: one `error` event `{type: "error", error: {type, message}}` with the type from ticket 12's mapping, end the response, `control_request interrupt`, tear down per ticket 19, and forget the upstream session (the error-turn eviction rule of [Conversation state](10-conversation-state-and-system-prompt.md)) so the client's retry is a replayed turn. A half-emitted message is never resumed. |
| 11 | **Ping.** Idle-based: a `ping` event whenever 15 s (configurable) pass with no event written, from commit until `message_stop`. No `:` comment heartbeats; upstream's `tool_progress` is not used. |
| 12 | **Client disconnect mid-stream** (after commit, before `message_stop`, not parked): `control_request interrupt` on stdin, close stdin, tear down per ticket 19, forget the upstream session so the next request is a replayed turn. Disconnect while parked stays the bridge's (ticket 07 decision 6). |
| 13 | **Back-pressure and close.** Upstream's stdout is never paused (a parked run's bridge traffic and `result` must flow); response writes use Node's socket buffer, bounded by the response size, no ceiling. The response ends immediately after `message_stop`; `result` and process exit are consumed asynchronously for logging and session registration. A continued turn arriving before the previous run has exited waits for the exit; serialisation per upstream session is ticket 19's. |
| 14 | **Vocabulary**: *model call*, *turn stream* (see `GLOSSARY.md`). |
| 15 | **ADR 0003** recorded (link above); decisions 6 and 8 are consequences in it. |

### Turn stream shapes

Canonical sequences the spec can quote (surface indices after offsetting):

- **Plain**: `message_start` → `[thinking]` → `text` → `message_delta {end_turn}` → `message_stop`. One model call.
- **Web search**: `message_start` (call 1) → `text?` → `server_tool_use` (filtered input) → *[call 1's `message_delta`/`message_stop` suppressed]* → `web_search_tool_result` (one `content_block_start` + `content_block_stop` on the `user/tool_result` frame) → *[call 2's `message_start` suppressed]* → `[thinking]` → `text` → `message_delta {end_turn, summed usage}` → `message_stop`.
- **Client tool park**: `message_start` → `text?` → `tool_use` (prefix stripped, deltas verbatim) → `message_delta {tool_use}` → `message_stop`; the resuming turn is a new turn stream from the resumed run.

### Boundaries handed to other tickets

- [Model and parameter mapping](11-model-and-parameter-mapping.md): `message.model` in `message_start` (requested name or upstream's); `thinking.display` has nothing to map to (decision 5); `stop_reason` is relayed verbatim, so `max_tokens` and `refusal` arrive as upstream reports them.
- [Error envelope and auth](12-error-envelope-and-auth.md): the mapping from `system/api_retry.error` categories, `result.api_error_status` and `result.errors[]` to an HTTP status (pre-commit) and to the SSE `error.error.type` (post-commit); whether the SSE `error` data carries `request_id`; `request-id` and rate-limit headers are possible because commit is deferred.
- [Module layout and seams](13-module-layout-and-seams.md): the translator is a pure seam (frames in, turn stream out) holding the server-tool translator and the bridge prefix strip as passes and the allowlist as data; the accumulator mirrors the SDK pattern; the idle `ping` timer and the commit point belong to the SSE sink. **Ticket 13 is now unblocked** (07, 09, 10 resolved).
- [Process lifecycle and concurrency](19-process-lifecycle-and-concurrency.md): stall-watchdog threshold; teardown after `control_request interrupt` (grace, then SIGTERM); per-upstream-session serialisation (a continued turn waits for the previous run's exit; `session_held_by_background` is a documented startup failure); the run timeout that bounds decision 9's cap.
- [Assemble the spec](14-assemble-spec.md): state the unverified assumption below as such.

### Unverified assumption

Decision 10 trigger (i) is designed, not observed: no probe has captured a model call failing *after* it streamed content, so whether upstream then emits `api_retry` plus a fresh `message_start`, or an error `result`, is unknown. The trigger set covers both outcomes; the test strategy should record the real shape when it is first seen.

### Primary sources

Event order and SDK requirements: [wire contract](03-messages-api-wire-contract.md) §3 and §8. CLI frame shapes: [CLI contract](02-cli-headless-io-contract.md) §1.4 to §1.8, §7, §8. Multi-call runs with partial messages: `research/cli-probes/s-websearch-allowed-then-deny.jsonl`, `s-websearch-blocked-allow.jsonl`. Client park, parallel calls, interrupt: `../spike/runs/cli-http-happy.wire.ndjson`, `sdk-parallel.wire.ndjson`, `cli-http-interrupt.wire.ndjson`. Pre-content API error: `research/cli-probes/o-pass-through-run1.jsonl`. Passthrough precedent and heartbeat practice: [Prior art](05-prior-art.md), AntonioAEMartins notes and "Streaming hygiene".

## Comments

- 2026-10-07, from [Model and parameter mapping](11-model-and-parameter-mapping.md): one more hygiene rule for decision 7's allowlist pass: an `assistant` frame whose `message.model` is `"<synthetic>"` carries upstream's error prose (seen after the output-cap auto-continuation fails in `research/cli-probes/t1-max-output-100.jsonl`, under `--bare`, and in the pass-through runs) and is dropped (its decision 14). Its decisions 4, 6 and 9 add three cut-or-buffer rules to the translator (max_tokens cut, stop-sequence scan, StructuredOutput buffering); see its answer.
- 2026-10-07, from [Error envelope and auth headers](12-error-envelope-and-auth.md): decision 9's 60 s cap now applies only to `rate_limit`, `overloaded`, `server_error` and `unknown`; deterministic categories interrupt at the first `api_retry` (its decision 8). The SSE `error` data carries `request_id` (its decision 10).
