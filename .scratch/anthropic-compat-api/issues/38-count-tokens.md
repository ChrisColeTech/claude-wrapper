# 38: count_tokens

Spec: [spec.md](../spec.md), section 12

**What to build:** `POST /v1/messages/count_tokens` answers `{input_tokens}` measured from a one-token run of the fully translated request, tools mounted, no session kept.

**Blocked by:** 34 (Client tools round trip), 36 (Output limits, thinking and effort)

**Status:** resolved

- [x] The same validation and translation as Messages (`tool_choice` `any` and `tool` 400); spawned with `CLAUDE_CODE_MAX_OUTPUT_TOKENS=1` and `--no-session-persistence`
- [x] The first `message_delta` ends it: interrupt, no fingerprint entry, the answer is the sum of the three input counters
- [x] Pre-commit failures are HTTP statuses as on Messages
- [x] Integration through the SDK's `countTokens` against the replay runner
- [x] E2E (flag): scenario 5, end to end against the real CLI; the count includes the residual context

## Comments

- Resolved by merge 5d5e344 on anthropic-compat-api.
- The E2E criterion is ticked on scenario 5 being written (`app/tests/e2e/upstream/count-tokens.test.ts`); its run against the real CLI is still pending.
- Reading: a count always sends the replayed-turn rendering of the history, even when the history matches a session; it continues no session and answers no parked run.
- Reading: `thinking.enabled` on a count runs with `CLAUDE_CODE_DISABLE_THINKING=1`, because the CLI raises any budget to at least 1024 and no budget fits under the one-token cap; scenario 5 checks this.
- Reading: the Messages-only fields (`max_tokens`, `stream`, `stop_sequences`, the sampling and plain fields, `container`) on a count are a 400 with "Extra inputs are not permitted".
- 2026-10-07/08: real-CLI run passed (`count-tokens.test.ts`, 5/5). A leaked control server kept Jest alive; that was fixed in merge 4970909, and the rerun exited cleanly.
