---
status: accepted
date: 2026-10-07
---

# Output limits are emulated by cutting the turn stream and interrupting upstream

Upstream (the Claude Code CLI) takes no per-request `max_tokens`, `stop_sequences` or token count. It has one process-wide output cap (`CLAUDE_CODE_MAX_OUTPUT_TOKENS`), and when a model call hits it upstream does not stop: it injects a "resume directly" user message and calls the model again, up to four times, then fails the run. We decided that the Anthropic surface honours these parameters anyway, by making the cap equal to the request's `max_tokens` and ending the turn itself: at the first model call that stops with `max_tokens`, at the first text match of a stop sequence (scanned in the translator), and after the first `message_delta` of a one-token run for `count_tokens`. In every case the surface then sends upstream an interrupt and forgets the upstream session, so the next turn is a replayed turn (ADR 0002). We chose this over validating the fields and ignoring them, which would silently misreport what ran, and over letting upstream finish, which would waste generation and hand the client upstream's continuation prose.

## Considered options

- **Cap, cut, interrupt, forget** (chosen): the real API's response shape (partial content, `stop_reason: max_tokens` or `stop_sequence`), one model call, no auto-continuation.
- **Accept and ignore**: simplest, SDK-compatible, but `max_tokens` and `stop_sequences` would have no effect and the surface would never report `stop_reason: max_tokens` except at upstream's own default cap, where the auto-continuation would then run anyway.
- **Let upstream run on**: exact usage numbers for a stop-sequence cut, but seconds of wasted generation per cut and, for `max_tokens`, upstream's continuation messages in the transcript.

## Consequences

- A cut turn's upstream session is forgotten; the following turn pays the replayed-turn cost.
- The cap applies per model call, so a turn with built-in tool calls can emit more than `max_tokens` in total; the spec documents this.
- A stop-sequence cut aborts the call before upstream reports its usage, so `output_tokens` for that call is an estimate; the only inexact usage figure on the surface.
- `count_tokens` costs one minimal model call and reports what upstream actually sends, residual context included.
- The interrupt races upstream's next call; frames after the cut are ignored and one extra capped call is the worst case.
- The run-bound cap means a turn that resumes a parked run keeps the parking turn's `max_tokens`.
