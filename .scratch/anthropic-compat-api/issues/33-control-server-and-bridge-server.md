# 33: Control server and bridge server

Spec: [spec.md](../spec.md), section 7, section 16, ADR 0001

**What to build:** The wrapper hosts a loopback control server that each run registers with, and a bridge server that exposes a client's tools to upstream over MCP with their JSON Schema verbatim, parks when upstream calls one, and resumes when the result is delivered. Proven by unit tests from the spike's event sequences and by one real run behind the flag; wiring into the surface is the next ticket.

**Blocked by:** 27 (Upstream runner)

**Status:** resolved

- [x] The control server: one per wrapper process on 127.0.0.1 and an ephemeral port, started with the app and alive as long as it; `start() → {baseUrl}`, `registerRun(id, handlers) → {mcpUrl, hookUrl, token}`, `releaseRun(id)`; per-run paths guarded by a random token; a wrong token is 404
- [x] The bridge state machine lifted from the spike with behaviour unchanged: announce, message complete, call, deliver, abandon; `park` emitted when the assistant message completes with at least one client call; pre-delivered results held and served; `partial` reported
- [x] The MCP adapter: a low-level MCP `Server` over Streamable HTTP serving `tools/list` from the client's `name`, `description` and `input_schema` verbatim (never Zod), turning `tools/call` into bridge calls keyed by `_meta["claudecode/toolUseId"]`, with a per-call timeout above the park TTL; `tool_result` content mapped (string and text to MCP text, image to MCP image, `is_error` to `isError`)
- [x] The per-run `0600` MCP config file with the bridge's `http` entry (`alwaysLoad: true`, the timeout) written before spawn and removed at teardown; the token never in argv or environment
- [x] The abandon order is enforced by the interface: `abandon()` interrupts the run first, then rejects the handlers
- [x] Unit: the state machine against the spike's happy, parallel, pre-delivered and interrupt sequences; the adapter driven by an MCP client; supertest for the token checks
- [x] E2E (flag): a real run spawned with the config file calls one bridge tool, the result is delivered after a delay, and the run completes with `num_turns 2` and empty `permission_denials`

## Comments

- Resolved by merge 3d32b1a on anthropic-compat-api.
- The e2e criterion is met as written (the bridge-run test exists behind the flag), but the real-CLI run is pending; it was deliberately not run against the real CLI at merge time.
- 2026-10-07: real-CLI run passed (`bridge-run.test.ts`).
