# 29: Plain turn end to end

Spec: [spec.md](../spec.md), sections 11, 2, 16

**What to build:** `messages.create` with one user message works through the SDK, streaming and non-streaming, against the replay runner in the integration suite and against the real CLI behind the flag: the client sees one message with real token deltas, thinking relayed, accurate usage, a `request-id`, pings while idle, and a well-formed error if the stream fails after it started.

**Blocked by:** 24 (Surface skeleton: tag, envelope, version header, credentials, request ids, body limit), 28 (Turn planning and run spec)

**Status:** ready-for-agent

- [ ] The translator `createTranslator(config) → {push(frame), end()}` produces API SSE events with the control signals inline; this ticket's passes: synthetic-frame drop, the flattener for a single model call (first `message_start` relayed, final `stop_reason` relayed verbatim), thinking relay (empty `thinking_delta`, one `signature_delta`, `estimated_tokens` stripped, `system/thinking_tokens` dropped), the field allowlist as data with every dropped name logged at debug, usage from `message_delta` with `message_start.message.usage` from the first call; `assistant` frames are never inputs
- [ ] The SSE sink commits status and headers at the first relayed `message_start`, writes named SSE events, emits `ping` after 15 s (configurable) without an event, ends the response right after `message_stop`, detects client disconnect and signals it, and on a post-commit failure writes one `error` event carrying `request_id` then closes
- [ ] The accumulator builds a `Message` from the same events the way the SDK accumulators do, including `usage`, `stop_reason` and `model` (upstream's resolved id)
- [ ] The conductor `handleMessages`: plan, run, translator, sink; applies the `system/init` checks; closes stdin after `result`; consumes `result` and exit asynchronously for logging; interrupts and tears down on disconnect; a `fail` before commit becomes an HTTP error through the surface error type (this ticket maps a pre-commit `result` error to 500 `api_error` with upstream's text; the full mapping is the upstream-failure ticket's)
- [ ] The composition root builds the surface from the injected dependencies and the route is mounted through the app factory
- [ ] Integration: `messages.create` and `messages.stream().finalMessage()` through the SDK against the replay runner with the plain fixtures; events in the real API's order; non-streaming and streaming `usage` equal
- [ ] E2E (flag): a plain turn against the real CLI, streaming and non-streaming; `message.model` is the resolved id; the prompt does not ask about the account, since redaction is a later ticket
- [ ] Every translator fixture with a plain shape is a golden test (frames in, events out)
