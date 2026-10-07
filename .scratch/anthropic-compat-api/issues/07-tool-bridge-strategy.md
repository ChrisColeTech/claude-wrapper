# Tool bridge strategy

Type: grilling
Status: resolved
Blocked by: 01, 06

## Question

How does the Anthropic surface implement client tools? A turn on the surface is stateless and may end mid-run with `stop_reason: tool_use`; upstream wants to run its own loop to completion. Candidates:

- **Held-open run**: keep the upstream run alive across turns; the client tool is exposed to upstream as an MCP or SDK tool whose handler blocks until the client's next turn supplies the matching `tool_result`. High fidelity; needs run-to-turn correlation, idle timeouts, and cleanup of abandoned runs.
- **Replay run**: a fresh run per turn; history (including prior `tool_use` and `tool_result`) is re-rendered into the prompt; client tools are described to the model, which is asked to emit a structured tool call (what the OpenAI surface does today). Simple; fragile parsing, no genuine `tool_use` blocks, token-expensive.
- **Hybrid**: replay for history, but the current turn's tools are real MCP or SDK tools so the model emits genuine `tool_use`; the run is cancelled once the call is captured, and the next turn resumes the upstream session with the result injected as a user text message (a bare `tool_result` block on stdin is dropped, per the CLI contract).

Decide the strategy, how `tool_use` ids are minted and matched, how `tool_choice` (`auto`, `none`, `any`, `tool`, `disable_parallel_tool_use`) is honoured or rejected, how parallel tool calls are returned, and what happens on an abandoned run. This decision is hard to reverse and surprising without context: record it as an ADR in `docs/adr/`.

## Facts from research

- Upstream will not accept client tool results on stdin; only an MCP tool the wrapper hosts can hand a result back into a live run ([CLI contract](02-cli-headless-io-contract.md) §3). The SDK's in-process tool handler can block for hours and carries the assistant `tool_use` id ([Agent SDK](04-agent-sdk-and-control-protocol.md) §2). Three OpenAI-surface projects shipped exactly that held-open design; none on `/v1/messages` ([Prior art](05-prior-art.md)).
- `tool_choice: any|tool` is a 400 on the 5.x models in the real API ([wire contract](03-messages-api-wire-contract.md)), so rejecting forced tool choice is faithful, not a gap.

## Facts from the spike (2026-10-04)

From [Spike: round-trip one client tool call through upstream](06-spike-client-tool-round-trip.md); frames in `../spike/runs/`, state machine in `../spike/bridge.mjs`, click-through demo in `../spike/bridge-demo.html`. Now unblocked: both blockers are resolved.

- **Held-open run is proven on both drivers.** Agent SDK in-process MCP tool, and raw `claude -p --input-format stream-json` with `--mcp-config {type: "http"}` pointing at an MCP server the wrapper hosts in its own process (low-level `Server` + Streamable HTTP, JSON Schema verbatim). Two model calls per round trip, bridge overhead 0 to 9 ms each way, `permission_denials` empty with `--tools "" --allowedTools mcp__<server>__<tool> --permission-mode default --permission-prompts none --strict-mcp-config`.
- **Hybrid is proven, as prose.** Interrupt the parked run, then `--resume` with the result as a user text message: accepted, one model call, coherent answer, but the transcript carries upstream's rejection `tool_result` and the model says "Based on the result you provided". The pure replay run was not exercised (prior art covers it).
- **Ids need no minting.** `tool_use.id` on the assistant frame = `_meta["claudecode/toolUseId"]` on the MCP `tools/call` (SDK channel and HTTP alike) = `tool_use_id` on upstream's `user/tool_result`. Key the pending map on upstream's `toolu_` ids.
- **Parallel calls: upstream runs one message's `tool_use` blocks one at a time.** The MCP call for block 2 is not issued until block 1's handler returns, so a bridge that waits for every handler deadlocks (first attempt, 240 s). Park when the assistant message completes (`message_delta stop_reason: tool_use`) and at least one client call is announced; return *all* announced blocks; hold results the client sends for calls upstream has not asked for yet and serve them the instant it asks (<1 ms observed). A client that answers only some calls leaves the bridge in `partial`; decide here whether that is a 400, a wait, or a re-return of the missing calls (claudegate force-releases with a placeholder).
- **Abandonment: interrupt first, and only interrupt.** `interrupt` (SDK `query.interrupt()`, or a raw `{"type":"control_request","request_id":...,"request":{"subtype":"interrupt"}}` on stdin, accepted without any `initialize`) made upstream cancel the MCP call (`notifications/cancelled`), write a rejection `tool_result` plus "[Request interrupted by user for tool use]", emit `result` `error_during_execution` / `is_error: true` / `stop_reason: tool_use`, and exit 1 after EOF, with **zero** further model calls. An MCP `timeout` instead gave the model an error result and it retried (3 model calls); stdin EOF while parked gave it "interrupted before a result was received… retry if needed" and it retried twice (4 model calls, $0.037). The wrapper must therefore treat `error_during_execution` + exit 1 as the *expected* end of an abandoned run.
- **Heartbeats.** While a tool call is pending upstream emits `tool_progress` every 30 s (`heartbeat: true`, `elapsed_time_seconds`); no MCP timeout fired in 240 s without an explicit `timeout`. A parked-run TTL is the wrapper's to set.
- **Untested here:** `tool_choice` (all values), parks beyond four minutes, client disconnect mid-stream, concurrent parked runs, the HTTP MCP idle timer (5 min default for non-stdio transports per the binary).
- **Vocabulary to settle for `GLOSSARY.md`:** held-open run vs ended run (prior art), park / parked turn, pre-delivered result.

## Answer

Resolved 2026-10-04 with the human, two grilling rounds, every recommendation taken. Recorded as [ADR 0001](../../../docs/adr/0001-client-tools-through-a-held-open-run.md). Vocabulary added to `GLOSSARY.md`: bridge server, held-open run, park, pre-delivered result.

### Decisions

| # | Decision |
| - | - |
| 1 | **Strategy: held-open run.** The wrapper hosts a bridge server exposing the client's tools to upstream; the handler blocks, the turn parks on upstream's own `tool_use` message, the run stays alive until the matching `tool_result` arrives and continues. Replay and hybrid are not bridge fallbacks; they survive only as the history renderer that [Conversation state and system prompt](10-conversation-state-and-system-prompt.md) defines. |
| 2 | **Driver deferred** to [Module layout and seams](13-module-layout-and-seams.md). The bridge is driver-agnostic; its requirements on the runner: handler in the wrapper process, MCP as the only path into a live run, interrupt capability, `stream-json` in and out. Both the Agent SDK and the raw CLI met them in the spike. |
| 3 | **Correlation by upstream's `tool_use` ids only**, passed to the client verbatim, never minted. The `tool_result` blocks at the head of the last user message name ids that belong to exactly one parked run. No session header, no `metadata` field; the official SDKs work unmodified. |
| 4 | **Parallel calls.** Park when the assistant message completes (`message_delta stop_reason: tool_use`) and at least one client call is announced; return every `tool_use` block; hold pre-delivered results and serve them when upstream asks. **Partial answers**: 400 `invalid_request_error` with the real API's message ("`tool_use` ids were found without `tool_result` blocks immediately after"); the run stays parked. Never invent a result. |
| 5 | **`tool_choice`.** `auto` or absent: default. `none`: client tools are not exposed to upstream for that turn. `any` and `tool`: 400 with the real API's message, `tool_choice: type "tool" and "any" are not supported for this model.`, on every model. `disable_parallel_tool_use`: accepted and ignored. |
| 6 | **Abandonment.** Park TTL configurable, default 10 minutes. On expiry, and on client disconnect while parked: interrupt the run first, then reject the handlers (zero extra model calls, measured). A `tool_result` naming ids with no parked run (TTL expired, wrapper restarted) falls through to a fresh run with history replayed; the client gets a normal answer, the wrapper logs the lost park. |
| 7 | **Built-in tools in the same run.** The bridge parks only on names under the bridge server's prefix; every other `tool_use` (WebSearch when a server tool is declared) is upstream's business and the run continues. Rendering of that activity is [Web search and built-in tools policy](08-web-search-and-built-in-tools-policy.md). |
| 8 | **Fidelity of names and schemas.** One bridge server, fixed name `client`; upstream sees `mcp__client__<name>`; the prefix is stripped from everything the client receives. `name`, `description`, `input_schema` go to upstream verbatim via a raw `tools/list`, never through Zod, with `alwaysLoad` on. If the SDK driver is chosen, override its `tools/list` handler. |
| 9 | **Vocabulary** adopted as proposed (see above). |
| 10 | **`tool_result` content.** String and `text` blocks become MCP text; `image` blocks become MCP image content; `is_error` maps to `isError`. `search_result`, `document`, `tool_reference`, `browser_state` are 400 `invalid_request_error` naming the block type, until Conversation state widens document support. |
| 11 | **Edited history on the resuming turn is ignored.** The parked run continues with the history upstream holds; the contract is the ids. Deliberate limitation, recorded; no history fingerprinting. |

### Boundaries handed to other tickets

- [Conversation state and system prompt](10-conversation-state-and-system-prompt.md): what happens to the run once the tool turn ends with `end_turn` (close it, or keep it as the conversation's run); the history renderer must render past `tool_use`/`tool_result` pairs, which is also the fall-through path for a lost park; whether `document` blocks are supported at all.
- [Streaming fidelity](09-streaming-fidelity.md): the parked turn's SSE is upstream's own events, nothing synthesised; client disconnect while parked is the bridge's (interrupt-then-reject), disconnect mid-stream is Streaming's.
- [Module layout and seams](13-module-layout-and-seams.md): the runner requirements in decision 2; the bridge server's per-call `timeout` must exceed the park TTL so upstream never times out first; on the raw-CLI driver the HTTP MCP idle timer (5 min default for non-stdio transports in the binary) must be raised or kept alive; the spike's `bridge.mjs` is the liftable state machine.
- [MCP connector passthrough](15-mcp-connector-passthrough.md): the bridge server occupies the name `client`; connector servers are additional entries beside it.
- New research ticket [MCP tool name limits upstream](17-mcp-tool-name-limits-upstream.md): whether upstream accepts the API's full `^[a-zA-Z0-9_-]{1,128}$` once prefixed.

### Primary sources

Spike runs and the pure state machine: `../spike/` (see [Spike: round-trip one client tool call through upstream](06-spike-client-tool-round-trip.md)). Prior-art lessons: [Prior art](05-prior-art.md), design lessons 1 to 3.
