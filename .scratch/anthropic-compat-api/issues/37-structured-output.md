# 37: Structured output

Spec: [spec.md](../spec.md), section 12

**What to build:** `output_config.format` with a JSON schema returns a single JSON text block that both SDKs' `parse()` helpers accept, streaming and non-streaming, with the failure path as a post-commit error.

**Blocked by:** 36 (Output limits, thinking and effort)

**Status:** ready-for-agent

- [ ] `format.type` must be `json_schema`; the schema passes verbatim as `--json-schema`; a CLI startup rejection on stderr is a pre-commit 400
- [ ] The expected `system/init.tools` list includes `StructuredOutput` on a format run
- [ ] Translator: the `StructuredOutput` `tool_use` block is buffered until its synthetic `tool_result`; on success emitted as one `text` block from the `partial_json` chunks with that call's `stop_reason` rewritten to `end_turn`; on failure dropped like a built-in call; `error_max_structured_output_retries` is a post-commit error; prose text blocks dropped and logged; a `max_tokens` cut inside the buffer flushes it first
- [ ] Unit: a translator golden from the structured-output recording; integration through the SDK's `parse()` helper against the replay runner
- [ ] E2E (flag): a format run against the real CLI yielding parseable JSON
