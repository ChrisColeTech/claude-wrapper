# Process lifecycle and concurrency

Type: grilling
Status: resolved
Blocked by: 10

## Question

Graduated from the map's fog on 2026-10-04 once [Conversation state and system prompt](10-conversation-state-and-system-prompt.md) fixed the run model: one upstream run per turn (`--resume` for continued turns), a run held open only while parked, sessions persisted under one wrapper-owned project directory, child environment passed through for now. Decide the operating envelope around that model:

1. **Per-run timeouts**: a wall-clock cap and a stall watchdog on frame silence (the current 30 s default is far too low; upstream retries auth failures for minutes before any `result`; `tool_progress` heartbeats arrive every 30 s while a tool runs, so silence is a usable signal). What the client sees when each fires.
2. **Early failure**: whether to read `system/api_retry` and fail the turn before upstream's ten retries, and which `error` categories fail fast versus wait.
3. **Caps**: concurrent runs, parked runs (about 230 MB each), and the response when a cap is hit (429 with `retry-after`, or queue with a bound).
4. **Teardown**: order on wrapper shutdown and on client disconnect mid-stream (interrupt, SIGINT, SIGTERM; SIGTERM yields exit 143 and no `result`); what happens to a conversation whose run was killed mid-turn (its fingerprint entry, its transcript).
5. **Buffers**: stdout line and total buffer limits; the 10 MB stdin cap.
6. **Disk**: retention of upstream transcripts beyond the 24 h fingerprint expiry (`cleanupPeriodDays` is 30 days by default), a cap on stored sessions, and whether forgetting deletes the file (Conversation state says yes).
7. **Child environment**: pass-through versus curated. Prior art saw a stale `CLAUDE_CODE_OAUTH_TOKEN` inherited from Claude Desktop override the login, and `ANTHROPIC_API_KEY` always wins over the login in `-p`. The spawn environment is part of the contract; the auth stance is the human's.

Settled elsewhere, do not reopen: park TTL (10 min default) and park teardown order (interrupt first, then reject) in [Tool bridge strategy](07-tool-bridge-strategy.md) decision 6; one run per turn and the 24 h fingerprint expiry in Conversation state decisions 2 and 3.

## Facts from research

- Failure latency, exit codes and signals: [CLI contract](02-cli-headless-io-contract.md) §7 (auth retries with backoff to 10 attempts, SIGTERM 143 and no `result`, SIGINT ends the turn, crash emits `error_during_execution` then exits). Stdout drain is capped at 30 s on exit; background subagents can hold a `-p` run up to 10 min (§3).
- Prior-art timeouts and watchdogs: [Prior art](05-prior-art.md), "Operational pitfalls" (300 to 900 s wall clocks; only openchamber's silence watchdog separates a slow model from a dead CLI; codingworkflow caps 10 concurrent runs and 409s a busy session; openchamber serialises spawns per conversation).
- Spike: interrupt as a raw `control_request` works without the SDK; `tool_progress` heartbeats every 30 s; a parked run costs about 230 MB ([Spike](06-spike-client-tool-round-trip.md)).

## Decided in Web search and built-in tools policy (2026-10-04)

Child-environment knobs this ticket may set: `CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION` (upstream's 200-per-session cap; a run is one turn, so the default is generous) and `CLAUDE_CODE_WEBFETCH_CACHE_TTL_MS` / `CLAUDE_CODE_WEBFETCH_DEADLINE_MS`. See [Web search and built-in tools policy](08-web-search-and-built-in-tools-policy.md).

## Found in Residual upstream context (2026-10-04)

Child-environment facts for question 7: `CLAUDE_CODE_SIMPLE=1` refuses the subscription login (no API call); `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` silently switches the model to `claude-opus-5-5`, so it must never be set; `CLAUDE_CODE_DISABLE_ATTACHMENTS=1` removes only the token-budget and USD-budget reminders. See [Residual upstream context and the account-email reminder](20-residual-upstream-context-and-account-email.md).

## Decided in Streaming fidelity (2026-10-07)

- **Teardown after interrupt** is this ticket's: Streaming ends a turn early (mid-stream client disconnect, post-commit failure, retry cap) with `control_request {subtype: "interrupt"}` on stdin (measured ~9 ms, zero extra model calls, `result {subtype: "error_during_execution"}` follows), then closes stdin; the grace period before SIGTERM and SIGKILL is decided here.
- **Stall watchdog**: Streaming's post-commit failure trigger (iii) fires on it; the silence threshold (prior art: openchamber distinguishes a slow model from a dead CLI by silence, not wall clock) is decided here. The run timeout bounds the 60 s retry cap.
- **Per-upstream-session serialisation**: the response closes at `message_stop` while the run is still exiting (~5 ms to `result`); a continued turn that arrives before the exit must wait for it (`session_held_by_background` is a documented startup failure). Decide the wait and its timeout here.
- Streaming never pauses upstream's stdout and sets no response buffer ceiling; if a memory ceiling per run is wanted it is this ticket's.
- `tool_progress` (every 30 s while a tool call is pending) and `rate_limit_event` are not consumed by the translator; this ticket may use them for liveness or admission.

See [Streaming fidelity](09-streaming-fidelity.md) decisions 9, 10, 12, 13.

## Decided in Model and parameter mapping (2026-10-07)

- The child environment is an **allowlist built from scratch**, never inherited. The binary reads these model-affecting variables (`strings` over 2.1.291): `ANTHROPIC_MODEL`, `ANTHROPIC_DEFAULT_{FABLE,OPUS,SONNET,HAIKU}_MODEL`, `ANTHROPIC_SMALL_FAST_MODEL`, `CLAUDE_CODE_EFFORT_LEVEL`, `CLAUDE_CODE_ALWAYS_ENABLE_EFFORT`, `CLAUDE_CODE_MAX_OUTPUT_TOKENS`, `MAX_THINKING_TOKENS`, `CLAUDE_CODE_DISABLE_THINKING`, `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING`, `CLAUDE_CODE_DISABLE_STRUCTURED_OUTPUTS`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`, `CLAUDE_CODE_NO_MODEL_FALLBACK`, `CLAUDE_CODE_DISABLE_MODEL_ACCESS_FALLBACK`, `CLAUDE_CODE_MODEL_CATALOG`, `CLAUDE_CODE_MODEL_CATALOG_URL`, `CLAUDE_CODE_MAX_CONTEXT_TOKENS`, `CLAUDE_CODE_SUBAGENT_MODEL`, `CLAUDE_CODE_THINKING_DISPLAY_UPDATES`. They are set only as that ticket dictates per request: `CLAUDE_CODE_MAX_OUTPUT_TOKENS` always (= `max_tokens`, or 1 for `count_tokens`), `CLAUDE_CODE_DISABLE_THINKING=1` or `MAX_THINKING_TOKENS` on Haiku (decisions 4, 7, 11, 13).
- Never pass `--fallback-model` or `--max-budget-usd`. `--max-turns` is this ticket's runaway guard; note that upstream's output-cap auto-continuation counts as turns (four in `research/cli-probes/t1-max-output-100.jsonl`) and that the surface's `max_tokens` cut interrupts before the second (decision 13).
- A **cut turn** (`max_tokens` stop, stop-sequence match, `count_tokens` measurement) tears down like a post-commit error: `control_request interrupt`, forget the session, ignore later frames. The interrupt races upstream's auto-continuation (in `t1` the next call's `message_start` followed the previous `message_stop` within the same second); one extra capped call is the worst case (decisions 4, 6, 11).

## Decided in Error envelope and auth headers (2026-10-07)

- Statuses this ticket's mechanisms answer with, pre-commit: a **concurrency cap** → 529 `overloaded_error` (the SDKs back off and retry); a **pre-commit timeout or stall** → 504 `timeout_error`; a **process exit with no `result`** (SIGTERM 143, crash) → 500 `api_error` naming the exit code. Post-commit the same types go in the SSE `error` event (decisions 5, 6).
- Deterministic `api_retry` categories (`authentication_failed`, `oauth_org_not_allowed`, `account_on_hold`, `billing_error`, `invalid_request`, `model_not_found`, `cloud_credential_error`) **interrupt the run immediately**; only `rate_limit`, `overloaded`, `server_error` and `unknown` wait for Streaming fidelity's 60 s cap (decision 8). The recording `auth-failure.jsonl` shows the alternative: ten retries over minutes.
- `retry-after` on a 429 is computed from the run's last `rate_limit_event.rate_limit_info.resetsAt` when it reported `rejected` (decision 9), so that event must be retained per run.

## Decided in Module layout and seams (2026-10-07)

- Your decisions land in `app/src/upstream/scheduler/` (gates `startRun`: concurrency caps, per-session serialisation, held-run registry, teardown) and in `RunSpec.timers` (startup-to-`system/init` and stall values the runner enforces). The runner's interface is fixed: `startRun(spec) → Run { frames, send, interrupt, close, exited }` (decisions 3, 11).
- The driver is the raw CLI: `spawn` with no shell, stdin held for stream-json, `control_request interrupt` on stdin, exit tracked through `Run.exited` (decision 1).
- One **control server** per wrapper process (loopback HTTP, ephemeral port) lives as long as the app; each run registers `/runs/<id>/mcp` and `/runs/<id>/hook` with a random token and releases them at teardown (decision 4).
- Per-run directory: the wrapper-owned cwd plus the `0600` MCP config and `--settings` hooks files are created before spawn and removed at teardown; the token is never in environment or argv (decision 4).
- Child-environment allowlist additions: `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT` and `MCP_TOOL_TIMEOUT` set above the park TTL (knob effect unverified; e2e scenario 6 on ticket 13) (decision 1).

## Decided in MCP connector passthrough (2026-10-07)

- Connectors (client-named remote MCP servers, opt-in per deployment) are mounted with `alwaysLoad: true`, which blocks upstream's startup until each server connects, capped by the CLI's 5 s connect timeout (`MCP_CONNECT_TIMEOUT_MS` is the knob); that wait sits inside this ticket's startup timer, and a server not `connected` in `system/init` fails the turn pre-commit (decision 3).
- Three operator settings arrive from that ticket: the connector host list (default off), the per-server connector call `timeout` (default 60 s, written into the config entry so a dead connector yields an error `tool_result` rather than a stall), and nothing else new; the bridge server keeps its long timeout above the park TTL (decisions 1, 3).
- Per-run `0600` config files may carry a client's `authorization_token`; teardown removes the run directory, and log redaction covers the token (decision 6).

## Answer

Resolved 2026-10-07 with the human, one grilling round of ten questions, every recommendation taken under one condition: **no client compatibility may be harmed**. Checked against what the official SDKs do with each status this ticket emits ([wire contract](03-messages-api-wire-contract.md) §4.2): 429 and 529 are retried with backoff (Python names 529 `OverloadedError`, TypeScript classes it as a retried `APIError`), 504 and 500 are `InternalServerError` and retried; no success-path shape changes. Two of the ticket's questions were already settled and were not reopened: early failure ([Error envelope and auth headers](12-error-envelope-and-auth.md) decision 8) and park TTL and order ([Tool bridge strategy](07-tool-bridge-strategy.md) decision 6). No ADR: these are operating values, each easy to change. No glossary change.

Facts new to this ticket:

- The "10 MB stdin cap" named in the question is the current resolver's `exec` `maxBuffer` (`app/src/core/claude-resolver.ts:191`, a stdout limit), not a CLI limit; the CLI contract documents no stdin size cap ([CLI contract](02-cli-headless-io-contract.md) §3). Stdout drain on exit is capped at 30 s; a background subagent can hold a `-p` run up to 10 min idle (`CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS`), which cannot occur with `--tools ""`.
- The wrapper's existing `process/` module manages the wrapper's own daemon (PID file, signals, 10 s shutdown and 5 s force-kill constants in `app/src/config/constants.ts:102-103`), not child runs; the current upstream timeout is 30 s (`constants.ts:4`).
- Measured points the values rest on: spawn to `system/init` 0.7 to 1.0 s (spike); `system/init` to first `message_start` 2.4 to 3.8 s (Streaming fidelity decision 8); `tool_progress` heartbeats every 30 s while a tool call is pending; `api_retry` backoff gaps up to about 40 s; interrupt to `result` about 10 ms; `result` to exit about 1 s after stdin closes; a parked run holds 230 to 260 MB.

### Decisions

| # | Decision |
| - | - |
| 1 | **Three timers in `RunSpec.timers`**, operator-configurable. **Startup**: spawn to `system/init`, default 20 s. **Stall**: any frame resets it (including `tool_progress` heartbeats, empty thinking deltas and `system/*` frames), default 90 s, above the longest legitimate silence (time to first token on a large prompt, the 40 s retry backoff gap, the 30 s heartbeat spacing). **Active lifetime**: 30 min from spawn, park time excluded (the park TTL covers it). Streaming fidelity's 60 s retry cap runs inside these. A firing is pre-commit 504 `timeout_error` or post-commit the SSE `error` of that type, then the decision 4 ladder and the session forgotten. |
| 2 | **Caps and admission.** One cap on runs in existence, active plus parked, default 4; at the cap a request gets 529 `overloaded_error` immediately, no queue. A parked run is never evicted to admit a turn. Admission also reads upstream's last `rate_limit_event`: after `status: "rejected"`, every request until `resetsAt` gets 429 `rate_limit_error` with `retry-after` before any spawn; `allowed_warning` is logged. |
| 3 | **Per-session serialisation.** A mutex per upstream session. A continued turn waits for the previous run's `exited` up to 10 s, then SIGKILLs it and proceeds (the transcript is written at `result`). Concurrent requests on one session queue FIFO and are re-planned after acquiring the mutex, so a duplicate becomes a replayed turn rather than a resume onto a changed transcript. |
| 4 | **Teardown ladder** for every early end (disconnect, cut, failure, park TTL, shutdown): `control_request interrupt` → wait up to 5 s for `result` → close stdin → wait up to 2 s for exit → SIGTERM → wait up to 5 s → SIGKILL. A run ended before its `result` is an error turn: fingerprint forgotten, transcript deleted. |
| 5 | **Wrapper shutdown.** New Anthropic-surface requests get 529 `overloaded_error`; streams in flight get the SSE `error` `{type: "api_error", message: "server shutting down"}`; parked runs are interrupted and their handlers rejected; every run descends the ladder in parallel, the drain bounded at 15 s before SIGKILL. The memory-only fingerprint map is lost, so every next turn is a replayed turn; orphaned transcripts are swept at the next start. |
| 6 | **Buffers.** Stdout is a line stream into the translator, never buffered whole; one line over 16 MB fails the run with 500 `api_error`. Stderr goes to a 64 KB ring buffer kept for error messages. Stdin carries one rendered message per turn, bounded by the 32 MB request limit, written with drain awareness. No other ceilings. |
| 7 | **Disk and retention.** One fixed, empty cwd for every run (`<state>/cwd`), so every transcript lands in one CLI project directory; per-run `0600` files live in `<state>/runs/<id>/` and are removed at teardown. Forget deletes the transcript; at wrapper start every transcript in the project directory is an orphan and is deleted; an hourly sweep removes files older than the 24 h expiry as a backstop, so the CLI's 30-day sweep is never relied on. The fingerprint map holds at most 1,000 sessions (configurable), LRU eviction being a forget. `count_tokens` runs use `--no-session-persistence`. |
| 8 | **Child environment.** Base, copied from the wrapper's environment when present: `HOME`, `PATH`, `LANG`, `LC_ALL`, `TZ`, `TMPDIR`, `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY` and their lowercase forms. Always set: `CLAUDE_CODE_MAX_OUTPUT_TOKENS`, `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT` and `MCP_TOOL_TIMEOUT` above the park TTL, `MCP_CONNECT_TIMEOUT_MS`, `CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION=200`, plus the per-request thinking variables on Haiku. Never inherited: everything else, in particular every `CLAUDE*` and `ANTHROPIC*` variable; `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` and `CLAUDE_CODE_SIMPLE` are refused even from the operator. An `upstream.env` map in the wrapper's configuration is merged last: that is where `ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN` or `DISABLE_TELEMETRY` go if the operator chooses them, so the auth stance stays theirs and explicit. The hook command uses the absolute Node path. |
| 9 | **Runaway guard**: `--max-turns 25` per run (configurable). Hitting it ends the run with `error_max_turns`, a post-commit 500 `api_error`; this is not the real API's `pause_turn`, and the spec says so. The StructuredOutput call and any output-cap continuation count as turns. |
| 10 | **Observability.** The scheduler exposes counts (active, parked, queued per session, last rate-limit state) to the existing `/health` route and logs every timer firing, cap rejection, kill and sweep with the request id and upstream session id. No new endpoint. |

### Operator settings collected across the map (for the spec's configuration section)

| Setting | Default | Decided in |
| - | - | - |
| Park TTL | 10 min | [Tool bridge strategy](07-tool-bridge-strategy.md) 6 |
| Fingerprint idle expiry | 24 h | [Conversation state](10-conversation-state-and-system-prompt.md) 3 |
| Retry cap after `api_retry` | 60 s | [Streaming fidelity](09-streaming-fidelity.md) 9 |
| SSE idle `ping` | 15 s | [Streaming fidelity](09-streaming-fidelity.md) 11 |
| Catalogue path | shipped JSON | [Model and parameter mapping](11-model-and-parameter-mapping.md) 1 |
| Connector host list | off | [MCP connector passthrough](15-mcp-connector-passthrough.md) 1 |
| Connector call timeout | 60 s | [MCP connector passthrough](15-mcp-connector-passthrough.md) 3 |
| Startup / stall / active-lifetime timers | 20 s / 90 s / 30 min | this ticket, 1 |
| Runs in existence | 4 | this ticket, 2 |
| Continued-turn wait for exit | 10 s | this ticket, 3 |
| Shutdown drain | 15 s | this ticket, 5 |
| Fingerprint map capacity | 1,000 | this ticket, 7 |
| `upstream.env` | empty | this ticket, 8 |
| `--max-turns` | 25 | this ticket, 9 |
| `API_KEY` (client gate) | unset | existing; [Error envelope and auth headers](12-error-envelope-and-auth.md) 3 |

### Boundaries handed to other tickets

- [Module layout and seams](13-module-layout-and-seams.md) (resolved; comment added): the scheduler's interface is now fixed: `admit(plan) → Promise<Lease> | SurfaceError` (cap, rate-limit admission, per-session mutex, re-plan hook), `Lease.release()`, `registerParked(run)`, `shutdown(deadline)`; the runner enforces `RunSpec.timers`; the state directory layout (`<state>/cwd`, `<state>/runs/<id>/`).
- [Assemble the spec](14-assemble-spec.md): the operator settings table above is the configuration section; the environment allowlist is the spawn contract; the shutdown and teardown ladders are the operations section.

### Primary sources

- `research/cli-headless-io-contract.md` §3, §7; `research/agent-sdk-and-control-protocol.md` §1 (graceful-close grace), §8 (memory per run); `research/prior-art.md` (operational pitfalls); [Spike](06-spike-client-tool-round-trip.md) measurements.
- `app/src/core/claude-resolver.ts`, `app/src/config/constants.ts`, `app/src/process/manager.ts`.

## Comments

- 2026-10-07, from [Mitigating the account-email disclosure](22-mitigating-the-account-email-disclosure.md): one more row for the operator settings table: `redact` (extra strings to redact on output; default empty; the account email, display name and full name are armed automatically from `~/.claude.json`).
