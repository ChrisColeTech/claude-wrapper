---
status: accepted
date: 2026-10-07
---

# Responses are assembled from upstream's stream events, flattened across model calls

Upstream (the Claude Code CLI run with `--include-partial-messages`) emits the raw Messages API event stream of every model call it makes inside a run, and a run that uses a built-in tool makes several: each opens its own `message_start`, restarts block indices at 0 and closes with its own `message_delta` and `message_stop`. The Anthropic surface must present one turn as one API message. We decided that every run is driven with partial messages on, that one stream translator turns the run's frames into a single **turn stream** (first `message_start` kept and later ones suppressed, indices offset, a call's `message_delta`/`message_stop` suppressed when every tool call in it is a built-in, usage summed field-wise), and that both response modes consume that stream: SSE writes it, non-streaming accumulates it into a `Message` the way the official SDK accumulators do. We chose this over simulated streaming (the OpenAI surface's chunked finished answer) and over assembling non-streaming responses from `assistant` frames plus `result`, because the stream events are the only source carrying real incremental tokens, upstream's own `stop_reason` and `tool_use` ids, and document citations (which exist only as `citations_delta`), and because one code path means one set of fixtures.

## Considered options

- **Passthrough with flattening, both modes from one stream** (chosen).
- **Simulated streaming**: chunk a finished answer. SDK-compatible but zero fidelity: no real token timing, `tool_use` not streamed as `input_json_delta`, and built-in tool activity would still have to be reconstructed from `assistant` and `user` frames.
- **Passthrough for SSE, `assistant` frames plus `result` for non-streaming**: two translators to keep in step, and the non-streaming path loses citations.

## Consequences

- The HTTP status and headers are committed at the turn's first relayed `message_start`. Failures before it are HTTP error statuses the SDKs retry; failures after it are one SSE `error` event, after which the run is interrupted and the upstream session forgotten (ADR 0002's replayed turn follows).
- The final `message_delta.usage` is the field-wise sum of the per-call usages, measured equal to `result.usage`, so the response ends at `message_stop` without waiting for `result`.
- Fields outside the Messages API schema are removed by an allowlist per event and block type; the allowlist must grow when the API grows.
- Server-tool input is filtered to the API's shape (`{query}` / `{url}`) in one delta rather than relayed, so the client never sees WebSearch domain lists or the WebFetch extraction prompt.
- A mid-stream client disconnect interrupts the run and forgets the session.
- Every recorded upstream transcript with partial messages is a fixture for the translator.
