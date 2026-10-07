# Module layout and seams

Type: grilling
Status: resolved
Blocked by: 07, 09, 10

## Question

Where does the Anthropic surface live in `app/src`, and what does it share with the OpenAI surface? The current upstream driver (`exec` plus `echo` piping, string in, string out) cannot stream or hold a run open, so a new upstream runner (spawn, stream-json in and out, run lifecycle) is implied. Decide: the runner's interface (the seam tests will mock with recorded transcripts); whether it is a new module the OpenAI surface may later adopt or private to the new surface; the translation layer boundaries (request to run config, run events to Message and SSE); how routes, swagger, and the auth middleware are extended; how the project's size rules (files <200 lines) shape the split; the test seams. Consult the `codebase-design` skill. Record the module map on this ticket.

## Facts from the spike (2026-10-04)

From [Spike: round-trip one client tool call through upstream](06-spike-client-tool-round-trip.md); code in `../spike/`.

- Both upstream drivers are viable for the tool bridge, so the runner's shape is a real choice here, not forced. Agent SDK: `@anthropic-ai/claude-agent-sdk@0.3.289` plus peer deps `@anthropic-ai/sdk`, `@modelcontextprotocol/sdk`, `zod`; about 290 MB installed, of which about 235 MB is the bundled CLI binary (skippable with `--omit=optional` and `pathToClaudeCodeExecutable` at the mise binary). Raw CLI: `child_process.spawn` with `--input-format stream-json --output-format stream-json --verbose --include-partial-messages`, plus `@modelcontextprotocol/sdk` (about 6 MB) for the wrapper-hosted HTTP MCP server; interrupt works as a raw `control_request` on stdin, so no SDK is needed for teardown either.
- Candidate seams the spike already separated: a pure tool-bridge state machine (`bridge.mjs`, no I/O, testable from recorded frames), an MCP server that serves client JSON Schema verbatim (`mcp-http-server.mjs`, low-level `Server`, never Zod), and a frame handler whose event set is what a runner must expose: `system/init`, `stream_event`, `assistant`, `user` (tool_result), `result`, `tool_progress`, `control_response`, `rate_limit_event`, `system/status`.
- The recorded runs in `../spike/runs/*.wire.ndjson` are nine more transcripts for the fixture set the test-strategy fog mentions.
- Default context differs by driver (about 2k tokens on the SDK, 10k raw); see [Conversation state and system prompt](10-conversation-state-and-system-prompt.md).

## Decided in Tool bridge strategy (2026-10-04)

- Runner requirements from the bridge: handler in the wrapper process, MCP as the only path into a live run, interrupt capability (SDK `interrupt()` or a stdin `control_request`), `stream-json` in and out. The bridge server serves JSON Schema verbatim (override the SDK's `tools/list` if the SDK is chosen); its per-call `timeout` must exceed the park TTL (default 10 min); on the raw-CLI driver the HTTP MCP idle timer must be raised or kept alive. The pure state machine in `../spike/bridge.mjs` is the candidate seam. See [Tool bridge strategy](07-tool-bridge-strategy.md) decisions 2, 6, 8.

## Decided in Conversation state and system prompt (2026-10-04)

- Run model: one process per turn, `--resume` for continued turns, a fresh run for replayed turns; held open only while parked. No idle-process cache in the first spec.
- Seams that fall out: a pure normaliser and fingerprint (messages in, canonical transcript and hash out), a pure history renderer (canonical transcript in, one stream-json user message out), and the session map (fingerprint to upstream session id, 24 h idle expiry, deletes the transcript on expiry). All three testable from recorded transcripts.
- Runner requirements added to the bridge's: `--resume <uuid>`, `--system-prompt <text>` with `--system-prompt-snapshot off`, `--setting-sources=`, `--strict-mcp-config`, a fixed wrapper-owned cwd, stream-json in and out via `spawn` with no shell, `--model` and `--mcp-config` on every run.
- Driver input, corrected by [Minimal-context upstream run](16-minimal-context-upstream-run.md) the same evening: the raw CLI with `--system-prompt ""` and the decided flags sends 493 input tokens per run, below the SDK's empty-prompt first call (1,015, which also carried a tool definition). The spike's "about 2k vs 10k" above were two-call sums. System-prompt cost no longer separates the drivers; both reach the floor. See [Conversation state and system prompt](10-conversation-state-and-system-prompt.md) decisions 2, 3, 5 to 7.

## Decided in Web search and built-in tools policy (2026-10-04)

- The runner must host a `PreToolUse` hook on `WebSearch`/`WebFetch` (SDK: in-process `hooks` option; raw CLI: a command hook shipped with the wrapper and passed through `--settings '{"hooks": …}'`), and must verify `system/init.tools` against the expected list before the first turn.
- A server-tool translator (upstream WebSearch/WebFetch frames in, `server_tool_use` and result blocks plus usage counters out) is a seam beside the tool bridge; pure, testable from `research/cli-probes/d-websearch.jsonl` and the hook-probe transcripts of [Hook enforcement of web tool limits upstream](21-hook-enforcement-of-web-tool-limits-upstream.md). See [Web search and built-in tools policy](08-web-search-and-built-in-tools-policy.md) decisions 2 to 5.

## Found in Hook enforcement of web tool limits upstream (2026-10-04)

Both drivers host the `PreToolUse` hook the server-tool translator needs: the raw CLI through `--settings` inline JSON with a command hook (a child process per call; `hook_started`/`hook_response` frames available), the SDK through its in-process `hooks` option over the control protocol (1 ms round trip, no lifecycle frames). Neither path is a differentiator; the raw path needs a hook script shipped with the wrapper and a way for it to read the turn's limits (file or environment). See [Hook enforcement of web tool limits upstream](21-hook-enforcement-of-web-tool-limits-upstream.md).

## Decided in Streaming fidelity (2026-10-07)

- **This ticket is now unblocked** (07, 09, 10 resolved).
- The stream translator is a pure seam: upstream frames in (`stream_event`, `user` tool-result, `system/api_retry`, `result`), one *turn stream* out. Inside it, as passes: the flattener (first `message_start` kept, index offsets, built-in `message_delta`/`message_stop` suppression, hold of a client `tool_use` behind a preceding built-in's result), the server-tool translator from ticket 08 (block synthesis, filtered `{query}`/`{url}` input), the bridge prefix strip from ticket 07, and the field allowlist (data, per event and block type, with debug logging of drops).
- Two sinks consume the turn stream: the SSE sink (owns the commit point at first `message_start`, the 15 s idle `ping` timer, disconnect detection and the `error` event) and the non-streaming accumulator (mirrors the SDK accumulators; emits `Message` with the summed `usage`).
- `assistant` frames are not inputs anywhere on the response path; `rate_limit_event` and `tool_progress` are available to lifecycle and error modules but unused by the translator.
- Every recorded transcript with partial messages is a translator fixture (see the map's test-strategy fog).

See [Streaming fidelity](09-streaming-fidelity.md) decisions 1, 2, 7, 11 and [ADR 0003](../../../docs/adr/0003-responses-assembled-from-stream-events-flattened-across-model-calls.md).

## Decided in Model and parameter mapping (2026-10-07)

- A **catalogue** module: loads the wrapper-shipped JSON (operator-overridable path), resolves ids and aliases to a canonical id, serves `GET /v1/models` (negotiated on `anthropic-version`) and `GET /v1/models/{id}`, and answers the per-model validation questions (`max_tokens` ceiling, effort levels, thinking types) (decisions 1, 2, 3, 7, 8).
- A per-request **argv and child-environment builder**: `--model <canonical id>`, `--effort`, `--json-schema`, `CLAUDE_CODE_MAX_OUTPUT_TOKENS` (= `max_tokens`, or 1 for `count_tokens`), and on Haiku `CLAUDE_CODE_DISABLE_THINKING=1` or `MAX_THINKING_TOKENS`; the environment is an allowlist built from scratch, never inherited ([Process lifecycle](19-process-lifecycle-and-concurrency.md) owns the base) (decisions 4, 7, 8, 9, 11, 13).
- Three translator rules beside Streaming fidelity's: (a) **max_tokens cut**: a relayed call's `message_delta {stop_reason: "max_tokens"}` closes the turn, then interrupt and forget the session, later frames ignored; (b) **stop-sequence scan** over `text_delta`s with a hold-back of `len(longest) - 1` characters, cutting before the match, emitting `message_delta {stop_reason: "stop_sequence", stop_sequence}` with an estimated `output_tokens` for the cut call, then interrupt and forget; (c) **StructuredOutput buffering**: a `tool_use` block named `StructuredOutput` is held until its synthetic `tool_result` frame, then emitted as a `text` block from the buffered `partial_json` chunks with that call's `stop_reason` rewritten to `end_turn`, or dropped like a built-in tool call on failure; prose `text` blocks in a format run are dropped. Hygiene: `assistant` frames with `message.model: "<synthetic>"` are dropped (decisions 4, 6, 9, 14).
- `POST /v1/messages/count_tokens` reuses the whole run pipeline (validation, system, rendered history, mounted tools) with a one-token cap, reads the first `message_delta`, interrupts, keeps no session, and answers `{input_tokens}` as the sum of the three input counters (decision 11).
- Run-bound parameters (model, `max_tokens`, thinking, effort, format, system) are fixed at spawn; a resuming turn's differing values are ignored and logged at debug (decision 10).

## Decided in Error envelope and auth headers (2026-10-07)

- A **surface-tag middleware** runs first: path under `/v1/messages`, or `anthropic-version` present → Anthropic, else OpenAI. The shared error handler, the JSON-parse branch and the auth middleware render by that tag: the Anthropic envelope `{type: "error", error: {type, message}, request_id}` with a `request-id` header, or today's OpenAI envelope (decisions 1, 11).
- The Anthropic surface has **one error type** `{status, type, message, retryable}` thrown from anywhere in its pipeline; a stray `AppError` on an Anthropic-tagged request maps by status (decision 11). The OpenAI surface keeps its classes.
- Anthropic paths get a **32 MB JSON body parser** (decision 5); the auth middleware accepts `x-api-key` or `Authorization: Bearer` there (decision 3); `request-id: req_<24 base62>` is minted per request regardless of debug mode and logged beside upstream's `session_id` (decision 10).
- The run reader classifies `system/api_retry` by category and **interrupts at once** on a deterministic one (`authentication_failed`, `oauth_org_not_allowed`, `account_on_hold`, `billing_error`, `invalid_request`, `model_not_found`, `cloud_credential_error`); the rest wait for the 60 s cap (decision 8). It keeps the last `rate_limit_event` per run for `retry-after` (decision 9). The API's message is extracted from the synthetic frame's text after `API Error: <status> ` (decision 6).

## Answer

Resolved 2026-10-07 with the human, one grilling round of eleven questions, every recommendation taken ("yes for all"), with the `codebase-design` vocabulary (module, interface, seam, adapter). Nothing here touches the wire, so the SDK-minimum check is met by construction; decision 10 is what keeps it met as the code changes. Recorded as [ADR 0006](../../../docs/adr/0006-raw-cli-driver-over-the-agent-sdk.md). Vocabulary added to `GLOSSARY.md`: control server. The map's **test-strategy fog graduates here** (decision 10) rather than into a new ticket.

Facts new to this ticket:

- The 2.1.291 binary reads `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT` (a function `getMcpToolIdleTimeoutMs` beside it), `MCP_TOOL_TIMEOUT`, `MCP_TIMEOUT` and `MCP_CONNECT_TIMEOUT_MS` (`strings` over `~/.local/share/mise/installs/claude/2.1.291/claude`). So the raw driver's HTTP MCP idle timer, the one risk [Tool bridge strategy](07-tool-bridge-strategy.md) decision 8 left on that driver, has an environment knob; its effect is unverified (see the e2e list).
- On the Agent SDK, an in-process server is `McpSdkServerConfigWithInstance = { instance: McpServer }` (the high-level class), so serving JSON Schema verbatim there means registering a raw `tools/list` handler on its inner server (`sdk.d.ts:1208`). The SDK exposes `extraArgs`, `env` (replaces the environment), `pathToClaudeCodeExecutable`, `hooks`, `permissionPrompts` (`sdk.d.ts:1660-2020`).
- The spike's `bridge.mjs` exports one factory, `createBridge({prefix, now})`, and its frame handler consumed exactly `system/init`, `stream_event`, `assistant`, `user`, `result`, `rate_limit_event`, `control_*`, `system/api_retry` (`../spike/spike.mjs:67-94`); interrupt was one line on stdin (`:168`).
- The app today: 39 source files, 7,172 lines; `swagger.ts` is 691 lines (already over the 200-line rule); tests are split into `tests/unit`, `tests/integration`, `tests/e2e` as three Jest projects with `tests/fixtures/` and `tests/mocks/` present; `@anthropic-ai/sdk` is not a dependency. The size rules (files < 200 lines, functions < 50 lines, max 5 parameters) are stated in `docs/planning/phases/rewrite-phases/PHASE_04_*.md:54`.

### Decisions

| # | Decision |
| - | - |
| 1 | **Driver: raw CLI.** `child_process.spawn` with no shell, stream-json in and out, `@modelcontextprotocol/sdk` as the only new runtime dependency (the bridge server); no Agent SDK. Every decision on the map is expressed as flags, environment and frames, and each SDK convenience (in-process MCP, in-process hooks, `interrupt()`) has a proven raw equivalent. `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT` and `MCP_TOOL_TIMEOUT` are set above the park TTL in the child environment. The official `@anthropic-ai/sdk` enters as a devDependency only (decision 10). [ADR 0006](../../../docs/adr/0006-raw-cli-driver-over-the-agent-sdk.md). |
| 2 | **Two new directories, the OpenAI surface untouched**: `app/src/upstream/` (surface-neutral: drives one run) and `app/src/anthropic/` (the surface). See the module map. `upstream/` has one consumer today; migrating the OpenAI surface onto it stays out of scope, and `core/claude-resolver.ts` is not touched. Size rule applied as: one file per translator pass and per validation concern; each module's `index.ts` exports only its interface. |
| 3 | **Runner interface**: `startRun(spec: RunSpec): Run`, `Run = { frames: AsyncIterable<Frame>, send(userMessage), interrupt(), close(), exited: Promise<{code, signal}> }`, `RunSpec = { flags, mcp: {url, token}, hooks: {url, token}, env, cwd, timers: {startup, stall} }`. Inside: no-shell spawn, NDJSON line framing, `control_request` ids matched to `control_response`, the per-run timers Process lifecycle sets, exit tracking. Two adapters make the seam real: `SpawnRunner` and `ReplayRunner` (plays a recorded transcript with its timestamps). Nothing above the runner knows a process exists. |
| 4 | **Control server and hook host.** One loopback HTTP server per wrapper process (127.0.0.1, ephemeral port, started with the app), per-run paths guarded by a random token: `/runs/<id>/mcp` (the bridge server over Streamable HTTP) and `/runs/<id>/hook`. The `PreToolUse` hook is a thin client script shipped with the package that posts its stdin to the hook endpoint and prints the reply; the policy (`max_uses` counters, domain lists) lives in-process beside the bridge. The MCP config and the `--settings` hooks JSON are written per run as `0600` files in the run's wrapper-owned directory, so no token appears in argv. |
| 5 | **Bridge module**: `upstream/bridge/` = the state machine lifted from `../spike/bridge.mjs` (announce, message complete, call, deliver, abandon; emits `park`), typed, behaviour unchanged, plus one adapter: a low-level MCP `Server` serving `tools/list` from the client's JSON Schema verbatim and turning `tools/call` into bridge calls keyed by `_meta["claudecode/toolUseId"]`. Interface to the conductor: `createBridge(tools) → { onFrame(frame), deliver(results), abandon(), events }`. |
| 6 | **Request side**: one deep function `planTurn(request, catalogue, sessions) → TurnPlan | SurfaceError`, `TurnPlan = { runSpec, continuation: {resume: id} | {replay: userMessage} | {parked: run}, bridgeTools, hookPolicy, translatorConfig }`. Inside, pure modules with their own tests: `validate` (every 400 rule the map defined, one file per concern), `normalise` (canonical transcript and fingerprint), `render` (the replayed-turn message), `tools` (client tools → bridge, server tools → built-ins and policy), `runSpec` (argv and environment allowlist). `catalogue/` is a sibling loaded once at start. Nothing in `request/` performs I/O. |
| 7 | **Translator interface**: `createTranslator(config) → { push(frame): TurnEvent[], end(): TurnEvent[] }`. `TurnEvent` is an API SSE event or a control signal in the same ordered stream: `park`, `cut` (max_tokens or stop sequence), `fail` (mapped error). Passes in order, one file each: synthetic-frame drop, flattener, server-tool translator, bridge prefix strip, StructuredOutput buffer, max_tokens cut, stop-sequence scan, field allowlist, usage sum. Every recording with partial messages is a golden fixture. |
| 8 | **Sinks and conductor**: `respond/` exposes `writeSse(events, res)` (commit at first `message_start`, 15 s ping, disconnect → signal, `error` event) and `accumulate(events) → Message` (mirrors the SDK accumulators). `anthropic/turn.ts` is the only orchestrator: `handleMessages(req, res)` and `handleCountTokens(req, res)` run plan → run or parked run → translator → sink, and act on `park` (register the held run), `cut` and `fail` (interrupt, forget session, tear down). Dependencies (runner, catalogue, sessions, control server, clock) are injected at one composition root, `anthropic/index.ts`. |
| 9 | **HTTP layer.** Routes in `anthropic/http/`, mounted from `server.ts`. Changes to existing files are limited to five: the surface-tag middleware first; `express.json({limit: "32mb"})` on Anthropic paths; the auth middleware accepting `x-api-key` on tagged requests; the error handler's Anthropic branch; route mounting. `/v1/models` negotiation is mounting order: the Anthropic models route runs first and calls `next()` when the tag is OpenAI, so `routes/models.ts` is untouched. OpenAPI: a static `anthropic/http/openapi.json` added to the Swagger UI's definition picker; `swagger.ts` is not edited. |
| 10 | **Tests, three layers**, matching the existing Jest projects. **Unit**: every pure module against golden fixtures. **Integration**: the Express app built with `createServer({ runner: ReplayRunner })` and driven by the official `@anthropic-ai/sdk` as a devDependency (`messages.create`, `messages.stream().finalMessage()`, `models.list`, `count_tokens`, the error classes), which automates the client-compatibility veto. **E2E**: the real CLI behind an environment flag, the scenario list below, never in CI. Fixtures: the recordings under `research/cli-probes/` and `spike/runs/` are copied into `app/tests/fixtures/upstream/` at implementation time, excluding `p6-session-after-resume.transcript.jsonl` and `p7-session-after-resume.transcript.jsonl` (they carry the account email). This resolves the map's test-strategy fog. |
| 11 | **Process lifecycle's home**: `upstream/scheduler/` gates `startRun` (concurrency caps, per-session serialisation, held-run registry, teardown), and `RunSpec.timers` carries its values. Its interface is [Process lifecycle and concurrency](19-process-lifecycle-and-concurrency.md)'s; its seam is fixed here. |

### Module map

```
app/src/upstream/                 surface-neutral: drives one Claude Code run
  frames.ts                       typed frame union (CLI contract §1): system/init, system/api_retry,
                                  system/status, stream_event, assistant, user, result,
                                  rate_limit_event, tool_progress, control_request, control_response
  runner/                         startRun(spec) → Run; SpawnRunner, ReplayRunner
  control-server/                 loopback HTTP; /runs/<id>/mcp and /runs/<id>/hook; per-run tokens
  bridge/                         pure state machine + low-level MCP Server adapter
  scheduler/                      (ticket 19) caps, serialisation, held-run registry, teardown
app/src/anthropic/                the Anthropic surface
  index.ts                        composition root: builds the surface from injected dependencies
  turn.ts                         conductor: handleMessages, handleCountTokens
  http/                           routes, surface tag, SurfaceError + renderer, openapi.json
  request/                        planTurn: validate/, normalise, render, tools, runSpec
  catalogue/                      models, aliases, limits; GET /v1/models handlers' data
  translate/                      createTranslator; one file per pass
  respond/                        writeSse, accumulate
  sessions/                       fingerprint → upstream session (24 h), parked runs
app/bin/hook-client.js            the PreToolUse command hook: stdin → POST hook endpoint → stdout
app/tests/fixtures/upstream/      recordings (copied at implementation time)
```

| Module | Interface (what a caller must know) | Adapters / tests |
| - | - | - |
| runner | `startRun(RunSpec) → Run`; frames arrive in upstream order; `interrupt()` resolves on `control_response`; `exited` always settles | `SpawnRunner` (real), `ReplayRunner` (fixtures); e2e only for the real one |
| control-server | `start() → {baseUrl}`, `registerRun(id, {mcpHandler, hookHandler}) → {mcpUrl, hookUrl, token}`, `releaseRun(id)` | integration (supertest), unit for token checks |
| bridge | `createBridge(tools) → {onFrame, deliver, abandon, events}`; parks on message completion; pre-delivered results held | unit from spike event sequences |
| request | `planTurn(request, catalogue, sessions) → TurnPlan \| SurfaceError`; pure | unit, golden request → plan |
| catalogue | `load(path) → Catalogue`; `resolve(name) → entry \| null`; `list(page)` | unit |
| translate | `createTranslator(config) → {push, end}`; events in API order; control signals inline | unit, golden frames → events |
| respond | `writeSse(events, res)`, `accumulate(events) → Message` | unit + integration with the official SDK |
| sessions | `lookup(fingerprint)`, `record(…)`, `forget(sessionId)`, `parked.{get,put,remove}` | unit with a fake clock |
| turn | `handleMessages(req, res)`, `handleCountTokens(req, res)` | integration with `ReplayRunner` |
| http | Express routers + the tag middleware + `SurfaceError` | integration (supertest, official SDK) |

### E2E scenario list (graduated from the map's test-strategy fog)

Run against the real CLI behind an environment flag, each consuming subscription quota, never in CI:

1. A model call failing **after** it has streamed content ([Streaming fidelity](09-streaming-fidelity.md) decision 10, the one unobserved turn-stream shape).
2. `MAX_THINKING_TOKENS` under a binding budget on Haiku ([Model and parameter mapping](11-model-and-parameter-mapping.md) decision 7).
3. `CLAUDE_CODE_DISABLE_THINKING=1` on a 5.x model (expected: no effect).
4. The interrupt racing upstream's auto-continuation after a `max_tokens` cut (decision 4 there).
5. `count_tokens` end to end: one-token cap, first `message_delta`, interrupt (decision 11 there).
6. A park longer than five minutes on the raw driver with `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT` raised (this ticket, decision 1; the knob's effect is unverified).
7. The hook client round trip through the control server (this ticket, decision 4; `--settings` command hooks are verified, the HTTP-callback script is not).
8. Observe-when-it-happens, not deliberately triggered: a live 429 (subscription window exhausted) and an OAuth-expiry run ([Error envelope and auth headers](12-error-envelope-and-auth.md)).

### Boundaries handed to other tickets

- [MCP connector passthrough](15-mcp-connector-passthrough.md): a client's `mcp_servers` would be translated in `request/tools` into additional `--mcp-config` entries written beside the bridge server's, and carried in `RunSpec.flags`; the control server is not involved (decisions 4, 6).
- [Process lifecycle and concurrency](19-process-lifecycle-and-concurrency.md): `upstream/scheduler/` gates `startRun`; `RunSpec.timers` (startup to `system/init`, stall) carries its values; the control server lives as long as the app; per-run directories (cwd, the `0600` config files) are created before spawn and removed at teardown; the child-environment allowlist gains `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT` and `MCP_TOOL_TIMEOUT` above the park TTL, and the control-server token is never in environment or argv (decisions 1, 3, 4, 11).
- [Assemble the spec](14-assemble-spec.md): the module map, the interfaces table and the test strategy (three layers, fixture copy, e2e list) are spec sections; copying the recordings into `app/tests/fixtures/upstream/` is an implementation ticket.

### Primary sources

- `../spike/README.md`, `../spike/bridge.mjs`, `../spike/spike.mjs`, `../spike/mcp-http-server.mjs`, `../spike/runs/*.wire.ndjson`; [Spike: round-trip one client tool call through upstream](06-spike-client-tool-round-trip.md).
- `research/agent-sdk-and-control-protocol.md` §1, §2, §8, implications; `research/hook-enforcement-of-web-tool-limits.md` §4; `research/cli-headless-io-contract.md` §1.
- `../spike/node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts` (`McpSdkServerConfigWithInstance`, `Options`).
- `strings` over `~/.local/share/mise/installs/claude/2.1.291/claude` (MCP environment names).
- `app/src/api/server.ts`, `app/src/api/swagger.ts`, `app/tests/` layout, `app/jest.config.js`, `app/package.json`; `docs/planning/phases/rewrite-phases/PHASE_04_STREAMING_SUPPORT_IMPLEMENTATION.md` (size rules).

## Comments

- 2026-10-07, from [MCP connector passthrough](15-mcp-connector-passthrough.md): `request/tools` also emits connector `--mcp-config` entries and their `--allowedTools` additions (its decision 3); the translator gains an **mcp-connector pass** (`mcp__<server>__<tool>` calls → `mcp_tool_use` / `mcp_tool_result`, decision 4); `render` gains two block kinds (decision 5). E2E scenario **9**: a connector round trip against a real `https` MCP server with `alwaysLoad`, including the not-connected failure path.
- 2026-10-07, from [Process lifecycle and concurrency](19-process-lifecycle-and-concurrency.md): the `upstream/scheduler/` interface is fixed as `admit(plan) → Promise<Lease> | SurfaceError` (run cap, rate-limit admission from the last `rate_limit_event`, per-session mutex with re-plan), `Lease.release()`, `registerParked(run)`, `shutdown(deadline)`; `RunSpec.timers` = `{startup: 20 s, stall: 90 s, lifetime: 30 min}` enforced by the runner; state directory `<state>/cwd` (fixed, empty) and `<state>/runs/<id>/` (per-run `0600` files). Its decisions 1 to 10.
- 2026-10-07, from [Mitigating the account-email disclosure](22-mitigating-the-account-email-disclosure.md): **decision 10 amended**: the fixture copy *scrubs* every recording (address, display name, full name → `user@example.invalid`, `Example User`) instead of excluding `p6`/`p7`, because the address is in seventeen recordings including every `sdk-*.wire.ndjson`; a scrub script in `app/tests/scripts/` and a guard test that fails the suite if a fixture still carries the live values. `translate/` gains a **redaction pass** after the stop-sequence scan (its decision 1); the composition root reads `~/.claude.json` and the operator `redact` list (its decision 2). E2E scenario **10**: a direct ask for the account email with redaction armed.
