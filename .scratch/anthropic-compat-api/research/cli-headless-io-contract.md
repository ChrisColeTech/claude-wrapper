# Claude Code CLI headless I/O contract (2.1.284)

Research for ticket `issues/02-cli-headless-io-contract.md`. Date: 2026-10-04.
Upstream probed: `claude` 2.1.284 at `~/.local/share/mise/installs/claude/latest/claude`, logged in with a Claude subscription (`apiKeySource: "none"`), model `claude-fable-5-1`, user settings `permissions.defaultMode: auto`.

## Method and sources

- **Official docs** (fetched 2026-10-04 as raw markdown by appending `.md` to the page URL):
  - H  = https://code.claude.com/docs/en/headless (Run Claude Code programmatically)
  - CR = https://code.claude.com/docs/en/cli-reference
  - S  = https://code.claude.com/docs/en/sessions
  - MC = https://code.claude.com/docs/en/model-config
  - PM = https://code.claude.com/docs/en/permission-modes
  - SR = https://code.claude.com/docs/en/settings-reference
  - TS = https://code.claude.com/docs/en/agent-sdk/typescript (the CLI emits the SDK message types verbatim)
  - PY = https://code.claude.com/docs/en/agent-sdk/python
  - AL = https://code.claude.com/docs/en/agent-sdk/agent-loop
  - SO = https://code.claude.com/docs/en/agent-sdk/structured-outputs
  - STR = https://code.claude.com/docs/en/agent-sdk/streaming-output
  - SIN = https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode
  - CT = https://code.claude.com/docs/en/agent-sdk/cost-tracking
- **`claude --help`**: `cli-probes/help.txt`.
- **Live probes**: run from an empty scratch directory (no project CLAUDE.md), one-line prompts, `--max-budget-usd 0.25 --strict-mcp-config`, never `--dangerously-skip-permissions`. Raw transcripts are in `cli-probes/` next to this file; each probe below names its file. Every probe exited within 15 s except the auth-failure probe, which was still retrying at the 90 s kill.
- Cost caveat: because `-p` loads the user's whole `~/.claude` config (skills, plugins, agents; about 20k prompt tokens) and writes it to a 1-hour cache at list price, the trivial probes cost $0.08-$0.34 each by the CLI's own estimate; two probes tripped the $0.25 budget, which turned out to be useful (see 6 and 7).

Probe index: `a-json.txt` (json), `b-stream-json.jsonl`, `c-partial.jsonl` (partial messages), `d-websearch.jsonl`, `e-stream-json-input.jsonl` + `.harness.txt` + `.harness.py` (stdin held open), `f1-session-id.txt`/`f2-resume.txt`/`f3-resume-fork.txt`, `g1-system-prompt.jsonl`/`g2-append-system-prompt.jsonl`, `h-unknown-model.txt`, `i-no-tools.jsonl`, `j-json-schema-stdin.txt` (budget hit) and `j2-json-schema-stdin.jsonl`, `k-sigterm.jsonl`, `l-parse-errors.txt`, `m-thinking-partial.jsonl`, `n-thinking-summaries.jsonl`, `auth-failure.jsonl`. Each `*.stderr.txt` holds stderr plus the exit code.

## 1. Output formats

### 1.1 `--output-format json`

Stdout is exactly one JSON object: the `result` message, identical in shape to the last line of `stream-json`. (H: "`json`: structured JSON with result, session ID, and metadata".) Captured from `cli-probes/a-json.txt`, trimmed:

```json
{"type":"result","subtype":"success","is_error":false,"api_error_status":null,
 "result":"pong","stop_reason":"end_turn",
 "session_id":"d483084f-8156-48cd-a8af-300dd6e0f55a","uuid":"71983251-...",
 "num_turns":1,"duration_ms":3474,"duration_api_ms":3079,"ttft_ms":3423,"ttft_stream_ms":2500,
 "time_to_request_ms":391,"first_content_frame_ms":2501,
 "total_cost_usd":0.197247,
 "usage":{"input_tokens":2,"cache_creation_input_tokens":9719,"cache_read_input_tokens":10588,
          "output_tokens":4,"output_tokens_details":{"thinking_tokens":0},
          "server_tool_use":{"web_search_requests":0,"web_fetch_requests":0},
          "service_tier":"standard","cache_creation":{"ephemeral_1h_input_tokens":9719,"ephemeral_5m_input_tokens":0},
          "inference_geo":"not_available","iterations":[{"input_tokens":2,"output_tokens":4,"...":"..."}],"speed":"standard"},
 "modelUsage":{"claude-fable-5-1":{"inputTokens":2,"outputTokens":4,"cacheReadInputTokens":10588,
          "cacheCreationInputTokens":9719,"webSearchRequests":0,"costUSD":0.197247,"contextWindow":1000000,
          "maxOutputTokens":64000,"thinkingTokens":0,"canonicalModel":"claude-fable-5-1","provider":"firstParty","costBasis":"list"}},
 "permission_denials":[],"terminal_reason":"completed",
 "fast_mode_state":"off","fast_mode_disabled_reason":"sdk_opt_in_required",
 "subagent_stats":{"spawned":0,"...":"..."},"queued_turn_count":0,"result_index":0}
```

Documented type (TS, `SDKResultMessage`, quoted): success arm has `subtype: "success"`, `duration_ms`, `duration_api_ms`, `is_error`, `api_error_status?`, `num_turns`, `result: string`, `stop_reason: string | null`, `total_cost_usd`, `usage: NonNullableUsage`, `modelUsage: {[model]: ModelUsage}`, `permission_denials: SDKPermissionDenial[]`, `structured_output?`, `terminal_reason?`, `result_index?`, `queued_turn_count?`. Error arm has `subtype: "error_max_turns" | "error_during_execution" | "error_max_budget_usd" | "error_max_structured_output_retries"`, the same accounting fields, `errors: string[]`, `startup_failure_reason?`, and **no `result` field** (TS; AL "The `result` field holds the final text output and is only present on the `success` variant").

### 1.2 `--output-format stream-json` line types

Requires `--verbose` in print mode (H: "Use `--output-format stream-json` with `--verbose`"). Each stdout line is one JSON object. Observed in the probes:

| `type` / `subtype` | Seen in | Notes |
| - | - | - |
| `system` / `init` | all | first line; re-emitted for every stdin message in stream-json input mode (e) |
| `system` / `status` | c, m | `{"status":"requesting"}` before the API call. TS types `status` as `"compacting" \| null`; `requesting` is observed but undocumented |
| `system` / `thinking_tokens` | i, m, n, j2 | `estimated_tokens`, `estimated_tokens_delta` (TS: "Emitted while Claude is producing a thinking block, including a redacted one") |
| `system` / `api_retry` | auth-failure | see 7 |
| `assistant` | all | one line **per content block** (1.4) |
| `user` | d, j2, e | tool results (1.5); with `--replay-user-messages`, echoed input with `isReplay: true` |
| `rate_limit_event` | most | see 1.7 |
| `stream_event` | c, m | only with `--include-partial-messages` (1.6) |
| `result` | all | last line of a turn (1.8) |

Documented but not triggered here: `system/permission_denied` (H: "denials appear as `permission_denied` system messages"), `system/compact_boundary` (AL), `system/plugin_install`, hook events (`--include-hook-events`), `prompt_suggestion` (CR), `tool_progress`, `task_*`, `auth_status`, `informational` (full union in TS `SDKMessage`). AL: "A small number of trailing system events, such as `prompt_suggestion`, can arrive after [the result], so iterate the stream to completion rather than breaking on the result."

Observed line order for a plain text answer (`b-stream-json.jsonl`): `system/init` -> `assistant` -> `rate_limit_event` -> `result`.

### 1.3 `system/init`

From `cli-probes/b-stream-json.jsonl` (trimmed; the real line lists 25 tools, 60+ slash commands, 30 skills):

```json
{"type":"system","subtype":"init","cwd":"/tmp/.../cli-probes","session_id":"3d1476c0-...",
 "tools":["Task","Bash","Edit","Read","WebFetch","WebSearch","Write","..."],
 "mcp_servers":[],"model":"claude-fable-5-1","permissionMode":"auto",
 "slash_commands":["..."],"terminal_slash_commands":["doctor","color","focus","reload-plugins"],
 "apiKeySource":"none","claude_code_version":"2.1.284","output_style":"default",
 "agents":["claude","Explore","general-purpose","Plan","statusline-setup"],"skills":["..."],
 "plugins":[{"name":"agents-md","path":"builtin","source":"agents-md@builtin"},{"name":"telemetry","path":"builtin","source":"telemetry@builtin"}],
 "capabilities":["interrupt_receipt_v1","interrupt_cancel_queued_v1","msg_lifecycle_v1","mcp_read_resource_v1","mcp_tool_ui_meta_v1"],
 "analytics_disabled":false,"product_feedback_disabled":false,"uuid":"d90ee340-...",
 "memory_paths":{"auto":"/home/anas/.claude/projects/<slug>/memory/"},
 "messaging_socket_path":"/run/user/1000/cc-socks/3751399.sock",
 "fast_mode_state":"off","fast_mode_disabled_reason":"sdk_opt_in_required","per_turn_effort_active":true,"view_mode":"default"}
```

TS `SDKSystemMessage` documents `tools`, `mcp_servers[{name,status,source?}]`, `model`, `permissionMode`, `slash_commands`, `apiKeySource`, `claude_code_version`, `output_style`, `skills`, `plugins`, `plugin_errors?`, `agents?`, `effort?`, `capabilities?`. `memory_paths`, `messaging_socket_path`, `per_turn_effort_active`, `view_mode`, `analytics_disabled` are observed but not in the documented type. `tools` reflects `--tools` (`[]` with `--tools ""`, `["WebSearch"]` with `--tools WebSearch`, `["Bash","Edit","Read"]` under `--bare`; probes i, d, auth-failure). `permissionMode: "auto"` here comes from `~/.claude/settings.json` (`permissions.defaultMode: auto`); PM's table says a `claude -p` run otherwise starts in `default` "in sessions that fetch feature flags".

### 1.4 `assistant`

`message` is a full Anthropic `Message` object (TS: `message: BetaMessage; // From Anthropic SDK`), but with three caveats the surface must handle:

1. **One line per content block.** STR: "Claude Code emits an `AssistantMessage` as each non-empty content block completes, so a response with a text block and a tool call yields two `AssistantMessage` objects. Each one carries only its own content block, and both share the same message ID." Confirmed: `d-websearch.jsonl` lines 1 and 2 share `"id":"msg_011Cfh1iYsL7CvpSR4SGgRM3"`; the first has `[{"type":"text",...}]`, the second `[{"type":"tool_use",...}]`.
2. **`stop_reason` is `null` on every `assistant` line captured** (a, b, c, d, g, i, j2, m, n). The final stop reason and final usage arrive in the `stream_event` `message_delta` (with partial messages) and in `result.stop_reason`.
3. **`usage` is the `message_start` usage** (`output_tokens` 1 or 2), not the final count. Final per-call usage is in `message_delta.usage` and the run total in `result.usage`.

Sample (`cli-probes/b-stream-json.jsonl`):

```json
{"type":"assistant",
 "message":{"model":"claude-fable-5-1","id":"msg_011Cfh1bQZ5JFwJhmY1n83mj","type":"message","role":"assistant",
            "content":[{"type":"text","text":"pong"}],
            "container":null,"stop_reason":null,"stop_sequence":null,"stop_details":null,
            "usage":{"input_tokens":2,"cache_creation_input_tokens":0,"cache_read_input_tokens":20307,
                     "cache_creation":{"ephemeral_5m_input_tokens":0,"ephemeral_1h_input_tokens":0},
                     "output_tokens":1,"service_tier":"standard","inference_geo":"not_available"},
            "input_transformations":[],"diagnostics":null,"context_management":null},
 "parent_tool_use_id":null,"session_id":"3d1476c0-...","uuid":"1c37ce62-...",
 "timestamp":"2026-10-04T10:07:01.459Z","request_id":"req_011Cfh1bQEE73yhRzvuP323K"}
```

Wrapper-level fields: `parent_tool_use_id` (null for the main conversation, a tool id for subagent output; H), `session_id`, `uuid`, `timestamp`, `request_id`, and on tool-use lines `wire_tool_inputs: {<tool_use_id>: <input>}` (d, j2). Inside `tool_use` blocks the CLI adds a non-API field `"caller":{"type":"direct"}` (d, j2). TS also documents optional `error?: SDKAssistantMessageError` (`authentication_failed | oauth_org_not_allowed | account_on_hold | billing_error | rate_limit | overloaded | invalid_request | model_not_found | server_error | max_output_tokens | cloud_credential_error | unknown`), `aborted?: true`, `context_usage?`.

### 1.5 `user`

Emitted after each built-in tool execution (AL: "`UserMessage`: emitted after each tool execution with the tool result content sent back to Claude. Also emitted for any user inputs you stream mid-loop."). Sample (`cli-probes/j2-json-schema-stdin.jsonl`):

```json
{"type":"user","message":{"role":"user","content":[{"tool_use_id":"toolu_01Se7NkEHcHS5e4nZTj7wMVf","type":"tool_result","content":"Structured output provided successfully"}]},
 "parent_tool_use_id":null,"session_id":"d0eb7ac3-...","uuid":"d84f3a93-...","timestamp":"2026-10-04T10:15:37.796Z",
 "tool_use_result":"Structured output provided successfully"}
```

TS `SDKUserMessage`: "On a message that carries a `tool_result` block, `tool_use_result` is the tool's structured output object rather than the text sent to the model. Its shape depends on the tool." Replayed stdin messages (`--replay-user-messages`) are `SDKUserMessageReplay` with `isReplay: true` (TS; observed in `e-stream-json-input.jsonl`, which echoes the full base64 image back).

### 1.6 `stream_event` (`--include-partial-messages`)

Wraps raw API streaming events (TS `SDKPartialAssistantMessage`: `{type: "stream_event"; event: BetaRawMessageStreamEvent; parent_tool_use_id; uuid; session_id; ttft_ms? // only on message_start}`). Observed sequence in `cli-probes/c-partial.jsonl`: `system/status(requesting)` -> `stream_event message_start` -> `content_block_start` -> `content_block_delta(text_delta)` -> **`assistant` (complete block)** -> `content_block_stop` -> `message_delta` -> `message_stop` -> `rate_limit_event` -> `result`. This matches STR: "each `AssistantMessage` arrives before that block's `content_block_stop` event". STR: "Stream events are emitted for the main session only; token-level deltas from subagents aren't forwarded."

`message_start` carries two undocumented extras: `"ttft_ms":2108` and `"thinking_display":"updates"`. `message_delta` carries the final `stop_reason`, the final `usage` (with `output_tokens_details.thinking_tokens` and `iterations`), plus non-API `safeguard_results` and `context_management` (c line 7):

```json
{"type":"stream_event","event":{"type":"message_delta",
  "delta":{"stop_reason":"end_turn","stop_sequence":null,"stop_details":null,"container":null,
           "safeguard_results":[{"type":"dangerous_tool_use","status":{"type":"available","tool_uses":{}}}]},
  "usage":{"input_tokens":2,"cache_creation_input_tokens":6332,"cache_read_input_tokens":13985,"output_tokens":3,
           "output_tokens_details":{"thinking_tokens":0},"iterations":[{"...":"..."}]},
  "context_management":{"applied_edits":[]}},
 "session_id":"7fd9e2df-...","parent_tool_use_id":null,"uuid":"62a8a1e1-..."}
```

Tool input streams as `input_json_delta` (STR); structured output streams "as a tool call's unvalidated `input_json_delta` chunks" (STR, Known limitations).

### 1.7 `rate_limit_event`

Emitted on most runs even when nothing is throttled. Sample (`cli-probes/b-stream-json.jsonl`):

```json
{"type":"rate_limit_event","rate_limit_info":{"status":"allowed","resetsAt":1791123600,"rateLimitType":"five_hour",
  "overageStatus":"rejected","overageDisabledReason":"out_of_credits","isUsingOverage":false,
  "unifiedWindows":{"five_hour":{"utilization":0.12,"resetsAt":1791123600},"seven_day":{"utilization":0.05,"resetsAt":1791460800},
                    "seven_day_overage_included":{"utilization":0.08,"resetsAt":1791460800}}},
 "uuid":"df52ccf0-...","session_id":"3d1476c0-..."}
```

TS `SDKRateLimitEvent`: `rate_limit_info: {status: "allowed" | "allowed_warning" | "rejected"; resetsAt?; utilization?; errorCode?: "credits_required"; canUserPurchaseCredits?; hasChargeableSavedPaymentMethod?}`. `rateLimitType`, `overage*`, `unifiedWindows` are observed but undocumented.

### 1.8 `result`

Yes to every question in the ticket: real token usage (`usage`, per-model `modelUsage`), cost (`total_cost_usd`, an estimate: CT "client-side estimates, not authoritative billing data"), `duration_ms`/`duration_api_ms`, `num_turns`, `session_id`, `is_error`, `subtype`, plus `stop_reason`, `api_error_status`, `errors[]`, `terminal_reason`, `permission_denials`, `structured_output`. Observed `terminal_reason` values: `completed`, `budget_exhausted`, `api_error`. Semantics (TS field notes; CT):

- `usage`: "main agent loop only. Excludes subagent and auxiliary model calls, and is per-turn in streaming-input sessions. Prefer `modelUsage` for token/cost accounting." On `error_max_budget_usd`, "`usage` leaves out the response that crossed the budget, while `total_cost_usd` and `modelUsage` include it" (CT; confirmed in g1: `usage` all zeros, `total_cost_usd` 0.336).
- `total_cost_usd`/`modelUsage`: cumulative for the call, and "A call that resumes a session also counts the totals restored from the session's earlier calls" (TS; confirmed f2: 0.262 = 0.130 + 0.132). In streaming-input sessions "the totals are cumulative across turns, so read the latest result rather than summing" (TS; confirmed e: 0.010 -> 0.024 -> 0.034).
- `num_turns` counts tool-use round trips plus the final answer (AL): 1 for a text answer, 2 for one WebSearch call (d), 2 for a structured-output run (j2). Per turn in streaming input (e: always 1).
- `stop_reason`: "`end_turn`, `max_tokens`, and `refusal` (the model declined the request)" (AL); observed `end_turn`, `tool_use` (j2, j), and `stop_sequence` on the unknown-model error result (h).
- `is_error: true` can appear together with `subtype: "success"` (h: API 404) - check both.

## 2. Tool traffic in output

A built-in tool call is an `assistant` line whose single content block is `tool_use`, followed by a `user` line carrying the `tool_result` (1.5). Doc: STR "Tool use blocks have the structure `{type: "tool_use"; id; name; input}`"; AL "emitted after each tool execution with the tool result content sent back to Claude".

**WebSearch appears as a built-in `WebSearch` tool, not as API server-tool blocks.** `cli-probes/d-websearch.jsonl` (run with `--tools WebSearch --allowedTools WebSearch --permission-prompts none`), trimmed:

```json
{"type":"assistant","message":{"id":"msg_011Cfh1iYsL7CvpSR4SGgRM3","content":[
   {"type":"tool_use","id":"toolu_01Wrz8sGu6UBDMXmpegmoiZ9","name":"WebSearch",
    "input":{"query":"Claude Code latest release version changelog"},"caller":{"type":"direct"}}],"...":"..."},
 "wire_tool_inputs":{"toolu_01Wrz8sGu6UBDMXmpegmoiZ9":{"query":"Claude Code latest release version changelog"}},"...":"..."}

{"type":"user","message":{"role":"user","content":[{"tool_use_id":"toolu_01Wrz8sGu6UBDMXmpegmoiZ9","type":"tool_result",
   "content":"Web search results for query: \"Claude Code latest release version changelog\"\n\nLinks: [{\"title\":\"Claude Code Changelog (September 2026)\",\"url\":\"https://www.gradually.ai/en/changelogs/claude-code/\"}, ...]\n\nBased on the search results, ... (prose summary)"}]},
 "tool_use_result":{"query":"Claude Code latest release version changelog",
   "results":[{"tool_use_id":"srvtoolu_01EdAvUQCXxUCQfvYZ3N4iAc",
               "content":[{"title":"Claude Code Changelog (September 2026)","url":"https://www.gradually.ai/en/changelogs/claude-code/"}, "... 8 more {title,url}"]},
              "Based on the search results, here's information about Claude Code's latest release version ... (prose summary)"],
   "durationSeconds":6.02793146,"searchCount":1},"...":"..."}
```

Facts the surface has to live with (all from probe d; the docs do not describe the WebSearch output shape):

- No `server_tool_use` / `web_search_tool_result` blocks and no citations reach the output. The `srvtoolu_...` id inside `tool_use_result.results[0]` shows the API server tool was used *inside* the tool implementation.
- The search is executed by a side call on a different model: `result.modelUsage` has a second entry `"claude-haiku-4-5-20251001": {"webSearchRequests":1, "inputTokens":10194, "outputTokens":363, "costUSD":0.022009, ...}` while the main model's `usage.server_tool_use.web_search_requests` stays `0`. The wrapper must count web searches itself (from `tool_use` blocks named `WebSearch` or from `modelUsage[*].webSearchRequests`).
- Result pages carry only `title` and `url`; there is no `encrypted_content`, `page_age`, or per-result text beyond the Haiku-written summary string.
- After the tool result, the model emitted a `thinking` block (empty text, see 8) and then the text answer; `num_turns: 2`.

## 3. Input formats

`--input-format stream-json` ("realtime streaming input", `--help`; CR example pairs it with `--output-format json`; the e probe used `--output-format stream-json --replay-user-messages`).

**Accepted message shape.** SIN shows the canonical form; the harness sent exactly:

```json
{"type":"user","message":{"role":"user","content":[{"type":"text","text":"Reply with the single word pong"}]}}
```

one JSON object per line. `content` may be a string or an array of blocks (SIN examples use both). `parent_tool_use_id` is shown in the TS SDK examples but was omitted here and the CLI accepted the message (`cli-probes/e-stream-json-input.jsonl`).

**Stdin can stay open for several user messages in one run.** From `cli-probes/e-stream-json-input.harness.txt`: message 1 at 0.00 s -> `result` at 4.71 s; message 2 sent at 4.81 s -> `result` at 8.21 s; message 3 at 8.41 s -> `result` at 12.64 s; stdin closed at 12.81 s; process exit code 0 at 13.68 s. All 13 output lines share one `session_id`. Each message produced its own `system/init` (three init lines, distinct `uuid`s), its own `assistant` line(s) and its own `result` with `result_index` 0, 1, 2, `num_turns` 1 each, and cumulative `total_cost_usd`. Docs: AL "A streaming input session stays alive, and you can keep sending messages, except after a session crash, which emits a final `error_during_execution` result and exits the process"; SIN lists "Queued messages: send multiple messages that process sequentially, with ability to interrupt" and "Context persistence".

**Images.** Message 2 carried `{"type":"image","source":{"type":"base64","media_type":"image/png","data":"iVBORw0..."}}` plus a text block; the model answered about the pixel's colour, so the image reached it. SIN: streaming input mode supports "Image uploads: attach images directly to messages"; single-message input "does **not** support: Direct image attachments in messages". SIN also: "If an image block's `source` is missing or isn't an object, the SDK doesn't report an error. Claude Code sends Claude a text note in place of the image ... and the session continues." Documents/PDF blocks were not probed.

**`tool_result` blocks are not honoured.** Message 3 was `{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_01Fake...","content":"42"}]}}`. The CLI did not forward it as a tool result and the API did not reject it; the model replied "Your last message came through empty. Let me know what you'd like me to do next." (`e-stream-json-input.jsonl`, third `assistant` line; exit 0). So a client tool's result cannot be injected through stdin as a plain `tool_result`; the documented paths for tools the host executes are MCP servers (`--mcp-config`) and `--permission-prompt-tool` (CR). This is the single most important constraint for the tool bridge.

**How the run ends.** Closing stdin ends the run: the process exited 0 about 0.9 s after the last `result` (harness log). H adds: "If your consumer reads the stream slowly, Claude Code waits for the queued output to drain before exiting ... capped at 30 seconds"; a background Bash task "is terminated about five seconds after Claude has returned its final result and stdin has closed"; a background subagent keeps the process open "until that work completes", capped at 10 minutes idle (`CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS`). With `--max-turns` in streaming input, "a message still queued when the limit ends a turn stays queued and starts a new turn with its own limit" (CR); the budget keeps accumulating across messages (AL).

## 4. Prompt and system prompt

**Prompt as argument vs stdin.** Both work and are documented together: CR lists `claude -p "query"` and `cat file | claude -p "query"` ("Process piped content"); H: "Non-interactive mode reads stdin, so you can pipe data in". Probe j2 passed the whole prompt on stdin with no argument, including `"quotes"`, `$dollars` and `` `backticks` ``, and the model answered correctly - when the wrapper writes to the child's stdin pipe there is no shell, so none of the quoting problems of `echo ... | claude` apply. How a stdin body and a prompt argument are combined is not spelled out in the docs and was not probed.

**Limits.** H: "Piped stdin is capped at 10MB. If you exceed the cap, Claude Code exits with a clear error and a non-zero status." H: "If Claude Code can't read stdin ... Claude Code prints a warning to stderr and continues with the prompt from the command line." Observed (probe m, `m-thinking-partial.stderr.txt`): when the prompt is an argument and stdin is an open pipe that never delivers data, the CLI waits and prints `Warning: no stdin data received in 3s, proceeding without it. If piping from a slow command, redirect stdin explicitly: < /dev/null to skip, or wait longer.` - so a wrapper that passes the prompt as an argument must close the child's stdin or lose 3 s per run. No documented argv size limit beyond the OS's; `--settings` files must be "no larger than 2 MiB" (CR); `--system-prompt-file` / `--append-system-prompt-file` exist for text "too long to pass on the command line" (CR, said of the subagent variant).

**`--system-prompt` vs `--append-system-prompt`.** CR: "`--system-prompt` Replaces the entire default prompt"; "`--append-system-prompt` Appends to the default prompt"; both have `-file` forms; "You can combine these flags. To replace the default prompt and still append your own text, pass `--append-system-prompt` ... together with `--system-prompt`". CR also documents a `__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__` line that splits a replacement prompt into a cached static part and a per-run part (v2.1.275+). Observable difference (probes g1/g2, same question "what product are you running inside and what is your working directory?", same persona text):

| | prompt tokens (cache write + cache read) | answer |
| - | - | - |
| `--system-prompt "You are Pongbot..."` (g1) | 16,443 + 0 (all new cache) | "I'M RUNNING INSIDE CLAUDE CODE (BUILT ON THE CLAUDE AGENT SDK) AS PONGBOT, AND MY WORKING DIRECTORY IS /tmp/.../cli-probes." |
| `--append-system-prompt "You are Pongbot..."` (g2) | 9,754 + 10,597 | "I'M RUNNING INSIDE CLAUDE CODE (ANTHROPIC'S CLI, VIA THE CLAUDE AGENT SDK), AND MY WORKING DIRECTORY IS ..." |

So `--system-prompt` removed only about 4k of the ~20k prompt tokens: the tool definitions, environment context (cwd) and the user's skills/plugin context are still sent, and the model still identifies as Claude Code. It also made the whole prefix a cache miss, which cost $0.336 and tripped the $0.25 budget (`g1-system-prompt.jsonl` ends in `error_max_budget_usd`). `--exclude-dynamic-system-prompt-sections` "Only applies with the default system prompt; ignored when `--system-prompt` ... is set" (CR).

**System prompt on resume.** CR: "By default, Claude Code builds the system prompt once, on a conversation's first request, with the text from any system prompt flags applied, and records it in the session. Until the conversation is compacted, every later request uses that recorded prompt, including after you return to the conversation with `--resume` or `--continue`. If you pass different system prompt flag text, or none, on that later launch, it takes effect once the conversation is compacted or when you start a new conversation." Pass `--system-prompt-snapshot off` to rebuild every request (CR; `--help`). Any design that resumes an upstream session across turns must pass this flag or accept that the client's `system` text is frozen at the first turn.

## 5. Sessions

- **Minting a UUID works.** `--session-id 11111111-2222-4333-8444-555555555555` ran normally and `result.session_id` equals it (`cli-probes/f1-session-id.txt`). Validation: `--session-id not-a-uuid` -> stderr `Error: Invalid session ID. Must be a valid UUID.`, exit 1, no API call (`l-parse-errors.txt`). CR: "`--session-id` Use a specific session ID for the conversation (must be a valid UUID)".
- **Resume works from `-p`.** `claude -p "What is the codeword?..." --resume <uuid>` answered `tangerine` (set in the first run), same `session_id`, `num_turns: 1`, `total_cost_usd` 0.262 = both runs (`f2-resume.txt`; H "the run reports the conversation's whole total"). S: "You can run `claude --resume <session-id>` from any directory" (v2.1.223+); not found -> `No conversation found with session ID: <session-id>`. S: "-p" sessions are hidden from the picker and from plain `claude --continue`, but "`claude -p --continue` includes `-p`, SDK, and `/loop` sessions".
- **Fork.** `--resume <uuid> --fork-session` produced a new `session_id` (`0b02c034-...`) that still knew the codeword (`f3-resume-fork.txt`); CR: "When resuming, create a new session ID instead of reusing the original (use with `--resume` or `--continue`)". Reported cost 0.459 includes the restored totals (CT "restores them when a later call resumes or forks the session").
- **`--continue`**: "Continue the most recent conversation in the current directory" (`--help`); not probed.
- **`--no-session-persistence`**: no transcript file appeared for that run's `session_id` (`i-no-tools.jsonl`, `ls` in the probe output); CR: "sessions are not saved to disk and cannot be resumed. Print mode only."
- **What is persisted where.** S: "`~/.claude/projects/<project>/<session-id>.jsonl`, where `<project>` is your working directory path with non-alphanumeric characters replaced by `-`"; "Each line is a JSON object for a message, tool use, or metadata entry. The entry format is internal to Claude Code and changes between versions". Observed: the two-turn probe session is 119 KB / 33 lines: `queue-operation`, `user`, many `attachment` entries (one of 55 KB, the skills/context attachments), `assistant`, `last-prompt`, `atis-latch`, `mode`, `cost-state` (totalCostUSD, modelUsage). Storage knobs (S): `CLAUDE_CONFIG_DIR`, `CLAUDE_CODE_PROJECT_DIR_NAME` (name the project dir yourself, v2.1.234+), `cleanupPeriodDays` (30-day default retention), `CLAUDE_CODE_TRANSCRIPT_LOCAL_GC`, `CLAUDE_CODE_SKIP_PROMPT_HISTORY`.
- **What resume restores / does not.** S: full history incl. tool calls; the model (unless `--model` given); not `--mcp-config`, `--settings`, `--plugin-dir`, `--fallback-model`, `--add-dir` ("pass them again when you resume"). A `-p --resume` run starts in "the permission mode a new `claude -p` run would start in" (S). An interrupted turn is left as-is unless `CLAUDE_CODE_RESUME_INTERRUPTED_TURN=1` (H).

## 6. Control flags

Observed validation shapes are in `cli-probes/l-parse-errors.txt`; all flag errors go to stderr before any API call and exit 1 (H: "If you pass an invalid flag, Claude Code reports the error to stderr before the run starts").

- **`--tools`**: `""` disables every built-in tool - `init.tools: []` and the model answered `NONE` (`i-no-tools.jsonl`). `--help`: `""` all off, `"default"` all on, or names. CR: "The flag doesn't affect MCP tools; to deny those too, use `--disallowedTools "mcp__*"`"; on Linux the default set omits `Glob`/`Grep`. With `--json-schema`, `--tools ""` still yields `init.tools: ["StructuredOutput"]` (j2).
- **`--allowedTools` / `--disallowedTools`**: permission-rule syntax (`"Bash(git diff *)"`), H; a bare `Bash` allow rule is dropped in auto mode (H). `--disallowedTools "*"` removes every tool (CR).
- **`--permission-mode`**: error text lists the accepted values: `Allowed choices are acceptEdits, auto, bypassPermissions, manual, dontAsk, plan.`; CR adds `default` ("`manual` as an alias for `default`"). Starting mode for `-p` without the flag: `default` in sessions that fetch feature flags, else `auto` on v2.1.285+ (PM); a `defaultMode` from `~/.claude/settings.json` applies (observed `auto`). `dontAsk` denies every call that would prompt (H, AL).
- **`--permission-prompts none`**: "anything that would prompt is denied automatically; the permission mode still decides everything else" (`--help`); H: removes `AskUserQuestion`; "denials appear as `permission_denied` system messages, and the final result message lists them in `permission_denials`" (`SDKPermissionDenial = {tool_name, tool_use_id, tool_input}`, TS). Requires v2.1.259+. In probe d, WebSearch ran with `permission_denials: []`.
- **`--max-budget-usd`**: enforced *after* the call that crosses it. g1 and j: the `assistant` lines were emitted, then `result` with `"subtype":"error_max_budget_usd","is_error":true,"terminal_reason":"budget_exhausted","errors":["Reached maximum budget ($0.25)"]`, no `result` text, `usage` zeroed, `total_cost_usd` 0.336 / 0.412 (over the cap), exit 1. CR/CT: restored totals from a resumed session don't count; subagent spend does; "print mode only".
- **`--max-turns`**: absent from `--help` but **accepted**: `--max-turns 1` ran normally (l, exit 0). CR documents it ("Limit the number of agentic turns (print mode only). Exits with an error when the limit is reached. No limit by default") and warns: "`claude --help` does not list every flag, so a flag's absence from `--help` does not mean it is unavailable." AL: counts tool-use turns; result `error_max_turns`.
- **`--effort`**: `low, medium, high, xhigh, max` (`--help`); CR adds `ultracode`. An unknown value is *not* fatal: stderr `Warning: Unknown --effort value 'zzz' — ignoring it and using the default effort. Valid values: low, medium, high, xhigh, max.` and the run proceeds (l, exit 0). Fable 5.1 supports all five (MC). AL: effort "trades latency and token cost for reasoning depth"; independent of extended thinking.
- **`--json-schema`**: validated at startup: `Error: --json-schema is not valid JSON: JSON Parse error: Expected '}'` exit 1 (l); invalid schema -> `Error: --json-schema is not a valid JSON Schema` (H); draft-07 only, `format` not enforced (SO). Mechanism (j2): the CLI adds a `StructuredOutput` tool, the model calls it (`tool_use` with `input: {"word":"pong"}`), a synthetic `tool_result` "Structured output provided successfully" follows, and `result` has `"structured_output":{"word":"pong"}`, `"result":"{\"word\":\"pong\"}"`, `"stop_reason":"tool_use"`, `num_turns: 2`. Failure: `error_max_structured_output_retries`; "A result can also end with subtype `success` but no `structured_output` value" (SO).
- **`--mcp-config` / `--strict-mcp-config`**: documented (CR); with `-p` the CLI waits for servers up to `MCP_TIMEOUT` (30 s default) before the first turn; invalid entries are skipped and listed in `init.mcp_server_errors` (H). Only `--strict-mcp-config` was exercised (`init.mcp_servers: []`).
- **`--setting-sources user,project,local`**: documented (CR), not probed. Related ways to shrink the ~20k-token default context: `--bare` (but "Anthropic auth is strictly ANTHROPIC_API_KEY or apiKeyHelper ... OAuth and keychain are never read", `--help`; so unusable on a subscription login), `--safe-mode` (customizations off, "Auth, model selection, built-in tools, and permissions work normally", `--help`; not probed), `--disable-slash-commands`.
- **`--model`**: aliases `default`, `best`, `fable`, `opus`, `sonnet`, `haiku`, `sonnet[1m]`, `opus[1m]`, `opusplan`, or a full model name (MC; `--help`). MC: a `--model` value is not checked up front; "a mistyped value produces 'There's an issue with the selected model' on the first request". Probe h (`--model zzz`, `--output-format json`): exit 1; stderr `[claude-code:unrecognized_model] {"model":"zzz","query_source":"sdk"}`; stdout result `{"type":"result","subtype":"success","is_error":true,"api_error_status":404,"terminal_reason":"api_error","stop_reason":"stop_sequence","total_cost_usd":0,"num_turns":1,"result":"There's an issue with the selected model (zzz). It may not exist or you may not have access to it. Run --model to pick a different model.", ...}`.
- **`--fallback-model`**: comma list tried in order on overload/unavailable/non-retryable server error only ("Authentication, billing, rate-limit, request-size, and transport errors do NOT trigger a switch"), per-turn, max three models (MC).
- Others relevant to a wrapper (`--help`/CR): `--include-hook-events`, `--forward-subagent-text`, `--prompt-suggestions`, `--replay-user-messages`, `--exclude-dynamic-system-prompt-sections`, `--autocompact`, `--restricted`, `--betas` ("API key users only"), `--name`, `--add-dir`.

## 7. Failure modes and exit codes

- **Exit codes.** H: "Claude Code exits with code 0 on success and a non-zero code when the run fails ... When a failure happens inside the run, such as missing authentication, Claude Code prints the failure as the result on stdout." Observed: 0 for every success; 1 for an error `result` (unknown model h, budget g1/j) and for every flag error (l); 143 on SIGTERM (k). AL: after an error result "The underlying Claude Code process also exits with a nonzero code."
- **Auth failure** (`auth-failure.jsonl`; `--bare` with `ANTHROPIC_API_KEY=sk-ant-...invalid`): `system/init` then repeated `{"type":"system","subtype":"api_retry","attempt":1,"max_retries":10,"retry_delay_ms":537,"error_status":401,"error":"authentication_failed",...}` with delays 0.5 s, 1.2 s, 2.4 s, 4.5 s, 8 s, 18.7 s, 39.8 s, 32 s ... still on attempt 8 of 10 when killed at 90 s. **An auth failure does not fail fast.** H documents the event and its `error` categories: `authentication_failed, oauth_org_not_allowed, account_on_hold, billing_error, rate_limit, overloaded, invalid_request, model_not_found, server_error, max_output_tokens, cloud_credential_error, unknown`. The OAuth-expiry path on a subscription login was not probed.
- **Rate limiting.** Not triggered. Shape available: `rate_limit_event.rate_limit_info.status` `allowed | allowed_warning | rejected`, `errorCode: "credits_required"` (TS); `system/api_retry` with `error: "rate_limit"` or `"overloaded"` (H). Observed `overageStatus: "rejected", overageDisabledReason: "out_of_credits"` while `status: "allowed"`.
- **Unknown model**: see 6 (`is_error: true` with `subtype: "success"`, `api_error_status: 404`, exit 1).
- **Budget exceeded**: see 6 (`error_max_budget_usd`, post-hoc, exit 1).
- **Process kill.** SIGTERM 1.5 s into a run: exit 143 after 1.2 s, only `system/init` on stdout, no `result` (`k-sigterm.jsonl`, `k-sigterm.exit.txt`). H: "Claude Code exits with code 143. Claude Code leaves the turn that was in progress unfinished and records no result for it. To end the turn instead, send SIGINT ... On SIGTERM, Claude Code terminates the process tree of any Bash command that is still running ... runs `SessionEnd` hooks and exits."
- **Crash**: "the final result is an `error_during_execution` whose cost fields may be zeroed and whose `stop_reason` is `null`, and the process exits after emitting it" (AL).
- **Startup refusals**: `result.startup_failure_reason` enum (`org_pin_api_key_conflict`, `provider_not_allowed`, `cwd_unavailable`, `cli_version_too_old`, `session_held_by_background`, ...) (TS).
- **Refusal by the model**: `result.stop_reason === "refusal"` (AL).
- **Deleted working directory**: run continues; a warning message appears in stream-json (H).

## 8. Thinking

Thinking blocks **do** appear in stream-json output, under no special flag, but **with empty text**:

- Complete-block form (d, i, m, n, e): `{"type":"thinking","thinking":"","signature":"CAQSqAoKEAgSGAI4AUIIdGhpbmtpbmcS..."}` (signature ~1.2-2.4 KB).
- With `--include-partial-messages` (`m-thinking-partial.jsonl`): `content_block_start {"type":"thinking","thinking":"","signature":""}` -> several `content_block_delta {"type":"thinking_delta","thinking":"","estimated_tokens":50}` (`estimated_tokens` is a non-API field; last delta has `null`) -> `content_block_delta {"type":"signature_delta","signature":"..."}` -> the `assistant` line -> `content_block_stop`. Interleaved `system/thinking_tokens` events give running estimates (50, 100, 333).
- Real counts: `result.usage.output_tokens_details.thinking_tokens` (213 in m, 356 in n, 43 after the web search in d) and `modelUsage[*].thinkingTokens`.
- Why empty: TS `ThinkingConfig` "The optional `display` field controls whether thinking text is returned `"summarized"` or `"omitted"`. On Claude Opus 4.7 and later, the API default is `"omitted"`"; SR `showThinkingSummaries`: "When unset or `false`, the Anthropic API redacts thinking blocks and Claude Code shows a collapsed stub." Probe n passed `--settings '{"showThinkingSummaries":true}'` to a `-p` run: thinking text was **still empty** (`n-thinking-summaries.jsonl`, `thinking_tokens: 356`). No CLI flag exposes `thinking.display` (`--help`), so in 2.1.284 headless output thinking text is unavailable.
- Turning thinking off is not possible for this model: SR `alwaysThinkingEnabled` "On models that always think, such as Opus 5.5, Sonnet 5.5, and the Fable models, `false` has no effect"; `MAX_THINKING_TOKENS=0` is "under the same model and provider limits as `false`".
- `--effort` is the only reasoning knob exposed (6); AL: effort and extended thinking "are independent".

## Implications for an Anthropic surface

The facts that most constrain the design:

1. **The `assistant` line is a real Anthropic `Message`, but fragmented and preliminary.** One line per content block with a shared `message.id`, `stop_reason: null`, and `message_start` usage. To produce one `/v1/messages` response the wrapper must group lines by `message.id`, concatenate their `content`, and take `stop_reason`/`usage` from `message_delta` (streaming) or from `result`. It must strip non-API fields (`caller` inside `tool_use`, `container`, `stop_details`, `input_transformations`, `diagnostics`, `context_management`, `wire_tool_inputs`, `safeguard_results`). For SSE, `stream_event.event` is already the API event stream, so the streaming surface can relay it almost verbatim (minus `thinking_delta.estimated_tokens` and the `message_delta` extras) instead of simulating chunks.
2. **WebSearch is a built-in tool, not a server tool, in the output.** It shows up as `tool_use{name:"WebSearch", input:{query}}` + `user/tool_result` (text blob) + `tool_use_result{query, results[{tool_use_id:"srvtoolu_...", content:[{title,url}]}, summary], durationSeconds, searchCount}`. A `web_search_20260209` request can be fulfilled by `--tools WebSearch --allowedTools WebSearch`, and the wrapper can synthesize `server_tool_use` / `web_search_tool_result` blocks from `tool_use_result`, but only `title`+`url` are available (no `encrypted_content`, `page_age`, or citations), and `usage.server_tool_use.web_search_requests` must be computed by the wrapper (upstream reports 0 on the main model; the Haiku side call carries `webSearchRequests: 1`).
3. **Stdin can be held open, but not for tool results.** `--input-format stream-json` gives a long-lived run with one turn per message, a stable `session_id`, per-turn `result` lines (`result_index` increments) and image input. A bare `tool_result` block is silently dropped (the model sees an empty message). So the tool bridge for client tools cannot be "write the tool_result to stdin"; it has to be an MCP server the wrapper hosts (`--mcp-config`, tool names `mcp__<server>__<tool>`), or a prompt-level protocol, or the next turn must be a fresh run. Images reach upstream only through stream-json input; `-p "<arg>"` is text-only.
4. **`result` is trustworthy for accounting, with caveats.** Real token usage per turn (`usage`, main loop only) and per model (`modelUsage`, cumulative, includes restored session totals and side calls), `num_turns`, `stop_reason` (`end_turn | tool_use | max_tokens | refusal`), `is_error` + `subtype` + `api_error_status` (404/401/429/5xx -> Anthropic error types), `structured_output`. `is_error: true` can come with `subtype: "success"`; the error arm has no `result` text. `total_cost_usd` is an estimate.
5. **Failure latency and budget semantics.** Auth failures retry 10 times with backoff (minutes) before any result; `--max-budget-usd` is checked after the call that crosses it (and that call's output is emitted). The wrapper needs its own per-run timeout, must read `system/api_retry` to surface errors early, and cannot use the budget flag to cap a single response. SIGTERM yields 143 and no `result`; SIGINT ends the turn.
6. **Context and cost per run.** `-p` loads the user's whole `~/.claude` config (about 20k tokens here, 1-hour cache); `--system-prompt` removes only ~4k of it, makes the model still self-identify as Claude Code, and forces a cache miss. Mapping the request's `system` to `--system-prompt` per turn is therefore expensive and still not a "clean" model; `--append-system-prompt` is the cheap path. On `--resume`, system-prompt text is frozen from the first turn unless `--system-prompt-snapshot off`.
7. **Sessions are wrapper-controllable.** `--session-id <uuid>` accepts a wrapper-minted UUID, `--resume` works from any directory and from `-p`, `--fork-session` branches, `--no-session-persistence` keeps stateless turns off disk. Each persisted `-p` session is ~115 KB and is swept after 30 days by default.
8. **Thinking cannot be surfaced as text.** Blocks arrive with `thinking: ""` plus a signature; `showThinkingSummaries` does not change `-p` output; thinking cannot be disabled for Fable. The surface can report `thinking_tokens` in usage and either drop the blocks or emit them empty; `thinking`/`output_config.effort` in a request can map only to `--effort`.
9. **Hidden and defaulted flags.** `--max-turns` exists despite `--help`; `--effort` ignores bad values with a warning; `--permission-mode` and `--permission-prompts none` should always be passed explicitly because the default mode depends on the user's settings and feature flags. Close the child's stdin when the prompt is an argument, or every run waits 3 s. Expect a `system/init` per stdin message and trailing events after `result`.
