# Spike: round-trip one client tool call through upstream

Type: prototype
Status: resolved
Blocked by: 02, 04, 05

## Question

Can a single client tool call make the round trip: the client defines a tool on the Anthropic surface, upstream decides to call it, the surface returns `stop_reason: tool_use` with a `tool_use` block, the client answers with a `tool_result` on the next turn, and upstream continues with that result? Build the cheapest throwaway script that proves or disproves the leading tool-bridge candidates from the research: a stdin-held-open run with an MCP or SDK tool whose handler awaits an external promise, versus a fresh run per turn with the history replayed. Measure whether it works at all, latency added, what breaks when the client never answers, and how `tool_use` ids line up across turns. Follow the `prototype` skill's logic branch; keep it in a clearly named throwaway location and record the verdict on this ticket.

## Leads from research

- [Agent SDK and the stream-json control protocol](04-agent-sdk-and-control-protocol.md): an in-process tool handler can block for hours; the call carries the assistant `tool_use` id in `_meta`; stdin held open keeps the run alive between turns. Start the spike there.
- [Prior art](05-prior-art.md): three OpenAI-surface projects did exactly this (openchamber/opencode-claude, claudegate, claude-sub-proxy); none did it on `/v1/messages`. Pass the client's JSON Schema verbatim, key the pending map on `toolu_` ids, park calls with the `mcp__` prefix and let built-ins continue, and measure what happens when the client never answers (TTL, stall watchdog, interrupt before reject).
- [Claude Code CLI headless I/O contract](02-cli-headless-io-contract.md): a bare `tool_result` block written to stdin is silently dropped, so the bridge cannot feed results through stdin; it must be an MCP tool the wrapper hosts (SDK in-process, or `--mcp-config` with names `mcp__<server>__<tool>`) or a fresh run. Expect a `system/init` per stdin message, per-turn `result` lines, and trailing events after `result`. Probes consume the subscription's five-hour window (the research probes used about 0.6 of it); keep the spike to a handful of runs.

## Answer

**Yes.** One client tool call made the full round trip, on both candidate drivers, with upstream's own ids and its own stream events, at single-digit-millisecond bridge overhead. Resolved 2026-10-04 by nine live runs against Claude Code **2.1.289** (the mise `latest` moved from 2.1.284 since the research). Primary source: [`spike/`](../spike/README.md), with every frame of every run in `spike/runs/*.wire.ndjson` and a shareable state-machine demo in `spike/bridge-demo.html`. The whole spike moved the five-hour window from 0.05 to 0.07.

### Measurements

| Scenario | Driver | Model calls | Bridge overhead | Cost (CLI estimate) | Result |
| - | - | - | - | - | - |
| `sdk-happy` | Agent SDK, in-process MCP tool; client answers after 3 s | 2 | park ≤1 ms after `message_stop`; 8 ms from client delivery to upstream's `tool_result` frame; 3.3 s to the next `message_start` (model time) | $0.028 | `success`, `end_turn`, `num_turns 2` |
| `cli-http-happy` | raw `claude -p --mcp-config {type:http}` to a wrapper-hosted MCP server; client answers after 3 s | 2 | 6 ms / 8 ms / 1.4 s | $0.106 | `success`, `end_turn`, `num_turns 2` |
| `sdk-parallel` (second attempt) | SDK; two `tool_use` blocks in one message | 2 | 8 ms; second call served from the held result in <1 ms | $0.013 | `success`, `end_turn`, `num_turns 3` |
| `sdk-parallel` (first attempt) | bridge waited for both handlers to register | 1 (+1 started at teardown) | deadlock to the 240 s cap | n/a | killed |
| `sdk-interrupt` | SDK; client never answers; `interrupt()` 3 s after park | 1 | `control_response` in 3 ms, `result` 10 ms later | $0.004 | `error_during_execution`, `is_error`, exit 1 |
| `cli-http-interrupt` | raw CLI; `{"type":"control_request","request":{"subtype":"interrupt"}}` written to stdin | 1 | `control_response` in 3 ms | $0.005 | same as above |
| `sdk-timeout` | SDK; client never answers; MCP server `timeout: 5000` | 3 | n/a | $0.021 | model retried the tool once, timed out again, apologised |
| `sdk-close-while-parked` | SDK; client never answers; stdin EOF, **no** interrupt | 4 | n/a | $0.037 | model retried twice, apologised, `success` |
| `sdk-hybrid-resume` | park, interrupt, exit; new run `--resume` + result as user text | 1 + 1 | n/a | $0.004 + $0.019 | coherent: "Based on the result you provided, Paris is currently overcast..." |

### Findings

1. **Ids line up with no minting.** In every run the `tool_use.id` on the `assistant` frame equalled `_meta["claudecode/toolUseId"]` on the MCP `tools/call` (over the SDK control channel and over plain HTTP MCP alike) and equalled `tool_use_id` on the `user/tool_result` frame upstream wrote back. The surface can key its pending map on upstream's `toolu_` ids and pass them to the client verbatim.
2. **The parked turn's stream is upstream's own.** `message_delta {stop_reason: "tool_use"}` and `message_stop` arrived while the run was parked, within 1 ms of the `tools/call`. Nothing has to be synthesised for the parked message; the next turn begins with a fresh `message_start` (new `msg_` id) once the result is in. The `tools/call` followed the `assistant` frame by 0 to 9 ms in all runs; the early-call race from prior art was not observed (the bridge handles it anyway).
3. **Upstream runs one message's `tool_use` blocks one at a time.** With two blocks, the MCP call for block 2 was not issued until block 1's handler returned; in 240 s only one `tools/call` arrived. So the bridge must park as soon as the assistant message is complete and at least one client call is announced, return *all* announced `tool_use` blocks to the client, and hold results the client delivers for calls upstream has not asked for yet (pre-delivered). The fixed bridge did exactly that and the two-call turn completed.
4. **Abandon by interrupt, and only by interrupt.** On `interrupt`, upstream sends `notifications/cancelled` to the MCP server (`reason: "AbortError: remote-cancel"`), writes a rejection `tool_result` ("The user doesn't want to proceed with this tool use...") plus a user text "[Request interrupted by user for tool use]", emits `result` with `subtype: "error_during_execution"`, `is_error: true`, `stop_reason: "tool_use"`, `errors: ["[ede_diagnostic] result_type=user last_content_type=n/a stop_reason=tool_use"]`, idles, and exits 1 after stdin EOF, **with no further model call**. The raw CLI accepts the interrupt as a `control_request` on stdin with no prior `initialize`, so this does not require the SDK. The two other teardowns cost model calls: an MCP timeout gives the model an error result and it retries (3 calls); stdin EOF while parked gives it "The tool call was interrupted before a result was received... retry if needed" and it retries twice (4 calls, $0.037).
5. **Upstream heartbeats while parked.** Every 30 s a `tool_progress` frame with `heartbeat: true`, `elapsed_time_seconds`, `tool_use_id "<id>-heartbeat-N"`, `parent_tool_use_id <id>`. Free stall detection and an SSE keepalive source. No MCP timeout fired in 240 s without an explicit `timeout`, consistent with the ~28 h default.
6. **The hybrid works, as prose.** Interrupt, then `--resume` the session with the result as a user text message: the API accepted the transcript (upstream had already closed the dangling `tool_use` with its rejection result), one model call, context restored (`cache_read 1072`). The model's history now holds a rejection and a prose result, and it said "Based on the result you provided". Lower fidelity than the held-open run; no genuine `tool_result` reaches the model.
7. **Context and cost differ by driver.** With identical flags the SDK run carried about 2.1k prompt tokens (cache read 1013 + creation 1149) and the raw CLI about 9.8k (4834 + 4988): the SDK's `initialize` frame sent `systemPrompt: [""]`, so the Agent SDK defaults to an empty system prompt where `-p` keeps Claude Code's default. Two-call runs cost $0.013 to $0.028 on the SDK and $0.106 on the raw CLI. Lead for [Minimal-context upstream run](16-minimal-context-upstream-run.md): try `--system-prompt ""` on the raw CLI.
8. **Flags that made it work on both drivers:** `--tools ""`, `--allowedTools mcp__spike__get_weather`, `--permission-mode default`, `--permission-prompts none`, `--strict-mcp-config`, `--setting-sources=`; `permission_denials` stayed empty. On the HTTP MCP path the client's JSON Schema went through verbatim (low-level `Server`, raw `tools/list`); on the SDK path `tool()` + zod reproduced name, description, type and `required` in the `initialize` manifest.
9. **Latency.** Bridge overhead was 0 to 9 ms on each side in every run; the rest was model time (1.4 to 3.3 s per call here).

### Not answered by this spike

Parks longer than four minutes; many concurrent runs; client disconnect mid-stream; `tool_choice`; a client that answers only some of the parallel calls (the bridge reports `partial`, untested live); resuming with a genuine `tool_result` rather than prose; the CLI's per-tool idle timer for HTTP MCP servers (5 min default in the binary for non-stdio transports, not reached here). These belong to [Tool bridge strategy](07-tool-bridge-strategy.md) and the process-lifecycle fog.
