# Spike: one client tool call, round trip through a held-open upstream run

**PROTOTYPE, THROWAWAY.** Wayfinder ticket [06](../issues/06-spike-client-tool-round-trip.md). Verdict and measurements live on the ticket; this directory is the primary source behind them. Nothing here is production code. The one liftable piece is `bridge.mjs`, a pure tool-bridge state machine with no I/O.

Vocabulary: [`GLOSSARY.md`](../../../GLOSSARY.md). Upstream is the Claude Code CLI run; a client tool is defined and executed by the HTTP client; the tool bridge is how a client tool call inside the run reaches the client and its result comes back.

## Run it

```sh
cd .scratch/anthropic-compat-api/spike
npm install                      # Agent SDK 0.3.289, MCP SDK 1.32.0, zod 4.6.5 (~290 MB, mostly the SDK's bundled CLI binary)
node spike.mjs sdk-happy         # or any scenario name below
node inspect.mjs runs/sdk-happy.wire.ndjson [from_ms] [to_ms]   # print a wire log, trimmed
open bridge-demo.html            # click through the state machine, no install needed
```

Every run costs the human's Claude subscription quota. It uses the mise-installed CLI (`SPIKE_CLI`), runs from an empty scratch cwd (`SPIKE_CWD`), passes `--tools "" --setting-sources= --permission-mode default --permission-prompts none --strict-mcp-config --max-budget-usd 1`, and caps itself at 240 s (`SPIKE_RUN_CAP_MS`) with a 90 s stall watchdog. The simulated client answers after 3 s (`SPIKE_CLIENT_DELAY_MS`).

## Files

| File | What |
| - | - |
| `bridge.mjs` | Pure state machine: announce, message complete, MCP call, client result, abandon. Decides when the surface may end the turn with `stop_reason: tool_use` ("park") and when the run resumes. |
| `spike.mjs` | Scenario runner. Two drivers share one frame handler and one bridge: the Agent SDK with an in-process MCP tool, and the raw `claude -p` with `--mcp-config` pointing at a wrapper-hosted HTTP MCP server. |
| `mcp-http-server.mjs` | The wrapper-hosted MCP server (low-level `Server` + Streamable HTTP). Serves the client's JSON Schema verbatim, no Zod. |
| `recorder.mjs` | Writes `runs/<scenario>.wire.ndjson` (every stdin/stdout frame, both directions, timestamped) and `runs/<scenario>.summary.json` (timings, ids, cost, bridge trace). |
| `inspect.mjs` | Pretty-prints a wire log. |
| `bridge-demo.html` | Shareable one-file demo of `bridge.mjs` with free-play buttons and five walkthroughs (prototype skill, logic branch). |
| `runs/` | The nine recorded runs. `sdk-parallel` holds the successful second attempt; the first attempt's frames are quoted on the ticket. |

## Scenarios and what each one showed

| Scenario | Driver | Model calls | Outcome |
| - | - | - | - |
| `sdk-happy` | Agent SDK, in-process MCP tool, client answers after 3 s | 2 | Round trip. Ids match end to end. 8 ms from client delivery to upstream's `tool_result` frame. $0.028. |
| `cli-http-happy` | Raw CLI + wrapper-hosted HTTP MCP server, client answers after 3 s | 2 | Round trip. `_meta["claudecode/toolUseId"]` present over HTTP too. 8 ms resume overhead. $0.106 (larger default context, see ticket). |
| `sdk-parallel` | Two `tool_use` blocks in one message | 2 | Upstream issues the MCP calls **one at a time**; first attempt (park only when every handler registered) deadlocked to the 240 s cap. Fixed bridge parks on message completion and holds pre-delivered results; second call served in <1 ms. $0.013. |
| `sdk-interrupt` | Client never answers; `query.interrupt()` 3 s after park | 1 | Upstream cancels the MCP call, writes a rejection `tool_result`, emits `result/error_during_execution`, exits 1. **No extra model call.** $0.004. |
| `cli-http-interrupt` | Same, but a raw `control_request {subtype: interrupt}` written to stdin, no SDK | 1 | Accepted without a prior `initialize`; `control_response` on stdout in 3 ms; identical teardown. $0.005. |
| `sdk-timeout` | Client never answers; MCP server `timeout: 5000` | 3 | Upstream feeds the model an error `tool_result` ("timed out after 5s"); the model **retries once**, times out again, apologises. $0.021. |
| `sdk-close-while-parked` | Client never answers; stdin closed **without** interrupt | 4 | Upstream writes "interrupted before a result was received" results and keeps going; the model **retries twice**, apologises. $0.037. |
| `sdk-hybrid-resume` | Park, interrupt, exit; new run with `--resume` and the result as a user text message | 1 + 1 | Works. Model answers coherently but says "Based on the result you provided": the transcript holds the rejection and the result as prose, not a `tool_result`. $0.004 + $0.019. |

Quota for the whole spike: the five-hour window went from 0.05 to 0.07 (fresh window; it had reset at 18:20 local).
