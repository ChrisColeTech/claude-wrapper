# 38: count_tokens

Spec: [spec.md](../spec.md), section 12

**What to build:** `POST /v1/messages/count_tokens` answers `{input_tokens}` measured from a one-token run of the fully translated request, tools mounted, no session kept.

**Blocked by:** 34 (Client tools round trip), 36 (Output limits, thinking and effort)

**Status:** ready-for-agent

- [ ] The same validation and translation as Messages (`tool_choice` `any` and `tool` 400); spawned with `CLAUDE_CODE_MAX_OUTPUT_TOKENS=1` and `--no-session-persistence`
- [ ] The first `message_delta` ends it: interrupt, no fingerprint entry, the answer is the sum of the three input counters
- [ ] Pre-commit failures are HTTP statuses as on Messages
- [ ] Integration through the SDK's `countTokens` against the replay runner
- [ ] E2E (flag): scenario 5, end to end against the real CLI; the count includes the residual context
