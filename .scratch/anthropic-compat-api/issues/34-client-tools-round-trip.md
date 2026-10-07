# 34: Client tools round trip

Spec: [spec.md](../spec.md), section 7, section 4.4, section 12 (run-bound parameters), ADR 0001

**What to build:** The SDK tool loop works end to end: the client declares tools, the turn ends with `stop_reason: tool_use` carrying upstream's own `tool_use` blocks and ids, the run stays held open, the next request's `tool_result` blocks continue the same run, and the client's answer comes from a genuine tool result. Parallel calls, partial answers, `tool_choice`, abandonment and the lost-park fall-through behave as specified.

**Blocked by:** 31 (Conversation state), 33 (Control server and bridge server)

**Status:** resolved

- [x] Planning: `tools[]` validated (`^[a-zA-Z0-9_-]{1,115}$`, 400 with the indexed message for 116 to 128) and mounted into the bridge server when the turn exposes client tools; `--allowedTools` lists every `mcp__client__<name>`; `tool_choice: none` leaves the bridge unmounted
- [x] Translator: the flattener's park rule (relay `message_delta` and `message_stop` and emit `park` when any `tool_use` in the call is under `mcp__client__`); the bridge prefix strip pass
- [x] Conductor: on `park` the run is registered as parked, keyed by its `tool_use` ids; a request whose last user message heads with `tool_result` blocks naming a parked run's ids delivers them and continues that run; the resuming turn is a new turn stream from the same run; run-bound parameters that differ on the resuming request are ignored and logged at debug
- [x] Parallel calls: every `tool_use` block returned; results accepted in any order; pre-delivered results served when upstream asks
- [x] Partial answers are 400 with the real API's message and the run stays parked; a `tool_result` naming ids with no parked run is a replayed turn with the lost park logged
- [x] Abandonment: the park TTL (default 10 min) and a client disconnect while parked interrupt first then reject; the run's `error_during_execution` end is treated as expected; the session is forgotten
- [x] Edits to earlier history on the resuming request are ignored
- [x] Integration: the SDK tool loop with two parallel tools against the replay runner; partial 400; the `tool_choice` cases; TTL expiry with a fake clock
- [x] E2E (flag): a real round trip; and scenario 6, a park longer than five minutes with the idle-timeout knob raised, completing on delivery

## Comments

- Resolved by merge 241a32f on anthropic-compat-api.
- The E2E criterion is ticked on the real round trip and scenario 6 being written (`app/tests/e2e/upstream/client-tools.test.ts`); their runs against the real CLI are still pending.
- Reading: a client disconnect while parked is observable only while the parking response is still open, and that response ends at `message_stop`; after that the park TTL is the backstop for an abandoned run.
- Reading: the 400 message for duplicate tool names (`tools: Tool names must be unique.`) is written from memory, not taken from the real API.
- Deviation (recorded in review fixes, impl/review-fixes): content after the `tool_result` blocks of a request that answers a parked run is a 400 (`messages.<i>.content.<j>: "<type>" blocks after the tool_result blocks are not supported on this surface when the results answer a parked tool call; send them in the next turn`). The real API accepts trailing text there; a held-open run can take only the tool results, so the surface refuses rather than dropping it. Listed in both READMEs' deviations.
- 2026-10-07: real-CLI runs passed (`client-tools.test.ts`): the round trip, and scenario 6, a 5.5-minute park that completed on delivery.
