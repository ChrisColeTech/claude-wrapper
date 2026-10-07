# 37: Structured output

Spec: [spec.md](../spec.md), section 12

**What to build:** `output_config.format` with a JSON schema returns a single JSON text block that both SDKs' `parse()` helpers accept, streaming and non-streaming, with the failure path as a post-commit error.

**Blocked by:** 36 (Output limits, thinking and effort)

**Status:** resolved

- [x] `format.type` must be `json_schema`; the schema passes verbatim as `--json-schema`; a CLI startup rejection on stderr is a pre-commit 400
- [x] The expected `system/init.tools` list includes `StructuredOutput` on a format run
- [x] Translator: the `StructuredOutput` `tool_use` block is buffered until its synthetic `tool_result`; on success emitted as one `text` block from the `partial_json` chunks with that call's `stop_reason` rewritten to `end_turn`; on failure dropped like a built-in call; `error_max_structured_output_retries` is a post-commit error; prose text blocks dropped and logged; a `max_tokens` cut inside the buffer flushes it first
- [x] Unit: a translator golden from the structured-output recording; integration through the SDK's `parse()` helper against the replay runner
- [x] E2E (flag): a format run against the real CLI yielding parseable JSON

## Comments

- Resolved by merge b98e7dd on anthropic-compat-api.
- The E2E criterion is ticked on the scenario being written (`app/tests/e2e/upstream/structured-output.test.ts`); its run against the real CLI is still pending.
- Deviation from spec section 11: pass 6 (the StructuredOutput buffer) runs on the raw frames before the flattener, not after pass 5 as section 11 lists it, because it needs the synthetic `tool_result` user frame.
- The redaction-as-JSON fix carried over from ticket 39 is done: on a structured-output run, text deltas are scanned as JSON, so an armed string is replaced only inside string values and `parse()` still reads the text.
- Reading: the e2e test where upstream refuses a schema at startup uses a guessed invalid schema (a property typed `nonsense`); it is not confirmed that the real CLI rejects it.
- 2026-10-07: real-CLI run passed (`structured-output.test.ts`, 4/4). The CLI refuses the nonsense schema at startup (400), and a format turn continues without a format.
