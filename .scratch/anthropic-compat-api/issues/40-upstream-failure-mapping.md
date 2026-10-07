# 40: Upstream failure mapping

Spec: [spec.md](../spec.md), section 13, section 11 (failure after content, retry cap), ADR 0005

**What to build:** Every upstream failure reaches the client as the spec's tables say: by what the client should do, with the API's own message where there is one, operator-side failures as a 500 that names the upstream login, fail-fast on deterministic retry categories, the billing gate relayed verbatim, `retry-after` when known, and post-commit failures as one SSE `error` event.

**Blocked by:** 29 (Plain turn end to end)

**Status:** resolved

- [x] An `api_retry` reader: the deterministic categories interrupt at first sight; the others start the 60 s cap (configurable); on firing, the last category maps
- [x] The synthetic-frame message extraction (the text after `API Error: <status> `); source precedence `api_error_status`, then category, then `result.subtype`, then process exit
- [x] Both mapping tables implemented as data with a test per row; `x-should-retry: false` on operator-side 500s; `retry-after` from the run's last `rate_limit_event` when it reported `rejected`; no `anthropic-ratelimit-*` headers
- [x] The billing-gate 400 relayed verbatim, never retried, logged at warn with the client's `system` length
- [x] The post-commit triggers (i) to (iv) produce the `error` event with the mapped type, then interrupt, teardown and forget; a plain `api_retry` after content is not a trigger
- [x] Timer firings map to 504 `timeout_error` pre-commit and the SSE error post-commit; a process exit without `result` maps to 500 with the exit code
- [x] Integration through the SDK against the replay runner: the error class the SDK raises for each row; the SSE error raising the SDK's error with the mapped type
- [x] E2E (flag): scenario 1, a model call failing after it has streamed content (record the real shape when first seen; the test documents which trigger fired). Scenario 8 (a live 429 and an OAuth-expiry run) is observe-when-it-happens: a recording procedure is documented, not a test

## Comments

- Resolved by merge cfdcbf8 on anthropic-compat-api.
- The surface table's 529 run-cap and 429 admission rows are deferred to ticket 42, which owns the scheduler that produces them.
- The E2E criterion is ticked on scenario 1 being written (`app/tests/e2e/upstream/failure-after-content.test.ts`); its run against the real CLI is still pending.
- Merging after ticket 31: the conductor keeps 31's `TurnSession` for forgetting the session on a failed turn, in place of this branch's `forgetSession`; 31's error-turn test now expects an upstream 400 as `BadRequestError` (5c65d75).
- E2E scenario 1 (2026-10-07, Claude Code 2.1.291, fixture `app/tests/fixtures/upstream/e2e-runs/scenario-1-failure-after-content-error_event.jsonl`): after a mid-stream `overloaded_error` upstream ends the call with `content_block_stop` and `message_stop` but no `message_delta`, retries it with no `api_retry` and no stream event, and reports `success`, so the surface relayed a truncated success. Trigger (i) now also covers a `message_stop` with no `message_delta`. Reading: the wrapper cannot see the cause, so the row is section 13's `unknown` (500 `api_error`, the SDKs' default retry); an `api_retry` naming a cause would still win.
- 2026-10-08: after merge 4970909 (the surface now fails a call that ends without `message_delta`), scenario 1 reran and passed: the client got the mapped `api_error`. Scenario 8 (a live 429 or OAuth expiry) was not observed.
