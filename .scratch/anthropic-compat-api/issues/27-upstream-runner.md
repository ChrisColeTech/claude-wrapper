# 27: Upstream runner

Spec: [spec.md](../spec.md), section 10 (driver), section 14 (timers, buffers), section 16 (runner)

**What to build:** One surface-neutral way to drive a Claude Code run: `startRun(spec)` returns a run whose frames arrive in upstream order, that can be sent a user message, interrupted and closed, and whose exit always settles. A replay runner plays a recorded fixture with its timestamps for tests; the spawn runner drives the real CLI behind an environment flag.

**Blocked by:** 26 (Fixture recordings: copy, scrub, guard test)

**Status:** resolved

- [x] A typed frame union covering the CLI contract: `system/init`, `system/api_retry`, `system/status`, `stream_event`, `assistant`, `user`, `result`, `rate_limit_event`, `tool_progress`, `control_request`, `control_response`; unknown frame types pass through typed as unknown and logged at debug
- [x] `startRun(spec) → Run` with `Run = {frames, send(userMessage), interrupt(), close(), exited}` and `RunSpec = {flags, mcp, hooks, env, cwd, timers}` as the spec states; `interrupt()` writes a `control_request {subtype: "interrupt"}` and resolves on its `control_response`
- [x] The spawn runner: no-shell spawn, NDJSON line framing, one line over 16 MB fails the run, a 64 KB stderr ring kept for error messages, stdin written with drain awareness, exit code and signal tracked
- [x] The three timers enforced by the runner (startup: spawn to `system/init`; stall: any frame resets it; active lifetime, with a way for the bridge to exclude park time); a firing ends the run with a typed reason
- [x] The replay runner plays a fixture's frames with their recorded timing (scalable), honours `interrupt()` by emitting the recorded interrupt tail where one exists, and settles `exited`
- [x] An e2e harness: an environment flag gates tests that spawn the real CLI; with it set, a plain run with the spec's flags yields `system/init`, frames, `result` and exit 0; every later e2e scenario reuses the harness
- [x] Unit tests: framing (split lines, oversize line, partial last line), control matching, each timer with a fake clock, replay of at least three fixtures (plain, web search, client-tool park)

## Comments

- Resolved by merge 6b08dfa on anthropic-compat-api.
- The e2e harness criterion is met as written, but the real-CLI run (env flag set) is pending; it was deliberately not run against the real CLI at merge time.
- 2026-10-07: real-CLI run passed (`plain-run.test.ts`, Claude Code 2.1.291, Haiku 4.5); the empty `--allowedTools ""` and `--tools ""` were accepted at startup.
