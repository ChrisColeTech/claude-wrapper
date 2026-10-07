# Hook enforcement of web tool limits upstream

Resolves [issue 21](../issues/21-hook-enforcement-of-web-tool-limits-upstream.md) for [Web search and built-in tools policy](../issues/08-web-search-and-built-in-tools-policy.md) decisions 2, 4 and 5. Probed 2026-10-04 on `claude` **2.1.289** (`claude --version`: `2.1.289 (Claude Code)`; `system/init.claude_code_version` is `2.1.289` in every run) and, for measurement 5, `@anthropic-ai/claude-agent-sdk` **0.3.289** from `../spike/node_modules`. Four upstream runs, all exit 0, none timed out. Raw frames, hook logs, scripts: `cli-probes/s-*`.

**Verdict.** Yes on every count. A `PreToolUse` command hook passed as inline JSON in `--settings` loads and fires on a `-p --setting-sources=` run; its `updatedInput` adds `allowed_domains` or `blocked_domains` to a WebSearch call and the API-side filter takes effect; its `permissionDecision: "deny"` stops a WebSearch or WebFetch call before any side call is made; `--allowedTools "WebFetch(domain:*)"` lets an undenied fetch through under `--permission-mode default --permission-prompts none` with no prompt. On a denial the model receives a `tool_result` with `is_error: true` whose text is `PreToolUse:<Tool> hook error: <permissionDecisionReason>`, no `system/permission_denied` frame is emitted, `result.permission_denials` lists the call with the model's original input, and the run continues to an answer. The same `updatedInput` works through the Agent SDK's in-process `hooks` option over the control protocol.

## 1. Method

| | |
| - | - |
| Binary | `/home/anas/.local/share/mise/installs/claude/latest/claude`, 2.1.289 |
| CLI harness | `cli-probes/s-run-probe.harness.py` (adapted from `p-run-probe.harness.py`, which is unchanged). Base argv: `-p --input-format stream-json --output-format stream-json --verbose --include-partial-messages --include-hook-events --setting-sources= --strict-mcp-config --permission-mode default --permission-prompts none --max-budget-usd 1 --no-session-persistence --system-prompt "" --system-prompt-snapshot off`, plus `--tools WebSearch --allowedTools WebSearch` or `--tools WebFetch --allowedTools "WebFetch(domain:*)"`, plus `--settings '<JSON>'`. Full argv per run in each `*.harness.txt` and `s-run-log.jsonl`. |
| Hook config | `{"hooks":{"PreToolUse":[{"matcher":"WebSearch\|WebFetch","hooks":[{"type":"command","command":"<scratch>/s-hook.py --mode <mode> --log <log>","timeout":30}]}]}}` (`s-websearch-allowed-then-deny.harness.txt`, `argv[-1]`) |
| Hook script | `cli-probes/s-hook.py`: reads stdin JSON, appends `{n, stdin, stdout, exit}` to its log (ordinal `n` under an `flock`), prints the mode's JSON, exits 0. Modes: `allowed-then-deny` (n=1: bare `updatedInput` = `tool_input` + `allowed_domains: ["github.com"]`, no `permissionDecision`; n>=2: deny `max_uses reached`), `blocked-allow` (n<=2: `permissionDecision: "allow"` + `updatedInput` with `blocked_domains: ["github.com"]`; n>=3 deny), `fetch-hostlist` (host of `tool_input.url` in `{example.com}`: empty stdout, i.e. no decision; otherwise deny `url_not_allowed: host <h> is not in allowed_domains`; n>=3 deny). |
| SDK driver | `cli-probes/s-sdk-hooks.mjs`: `query({prompt, options: {hooks: {PreToolUse: [{matcher: 'WebSearch\|WebFetch', hooks: [cb], timeout: 30}]}, tools: ['WebSearch'], allowedTools: ['WebSearch'], permissionMode: 'default', permissionPrompts: 'none', settingSources: [], strictMcpConfig: true, persistSession: false, includePartialMessages: true, includeHookEvents: true, maxBudgetUsd: 1, systemPrompt: ''}})`; the child's stdio tapped to `*.wire.ndjson`. |
| Hygiene | Empty scratch cwd under the session scratchpad (never the repo); cwd still empty after the four runs; no transcript directory was created for it under `~/.claude/projects/` (`--no-session-persistence`); `CLAUDE*` env stripped (`env_stripped` in each `*.harness.txt`); one stream-json user message on stdin, stdin closed right after; 180 s cap; no `--dangerously-skip-permissions`. stderr empty in all four runs (`*.stderr.txt`). |
| Summaries | `cli-probes/s-summarise.py <file.jsonl>` prints the frame lines cited below (line numbers are lines of the `.jsonl`). |

Runs, in order:

| Run | Driver | Tool | Hook mode | Prompt gist | Hook calls | `num_turns` | `total_cost_usd` | Haiku `webSearchRequests` | Five-hour utilisation |
| - | - | - | - | - | - | - | - | - | - |
| S1 `s-websearch-allowed-then-deny` | CLI | WebSearch | `allowed-then-deny` | exactly two sequential searches: latest Claude Code release notes, then latest version number | 2 | 3 | 0.105 | 1 | 0.47 (L14) → 0.48 (L29) |
| S2 `s-websearch-blocked-allow` | CLI | WebSearch | `blocked-allow` | two sequential searches: latest release notes, then "anthropics/claude-code CHANGELOG.md on GitHub" | 2 | 3 | 0.194 | 2 | 0.49 (L15) |
| F1 `s-webfetch-hostlist` | CLI | WebFetch | `fetch-hostlist` | fetch `https://example.com/` then `https://www.iana.org/help/example-domains`, one sentence each | 2 | 3 | 0.053 | 0 (Haiku 192 in / 25 out for the extraction) | 0.49 (L21) |
| S3 `s-sdk-hooks-allowed` | SDK | WebSearch | n=1 bare `updatedInput` + `allowed_domains` | exactly one search: latest release notes | 1 | 2 | 0.110 | 1 | 0.52 (L3) → 0.52 (L14) |

Utilisation: 0.47 at the first `rate_limit_event` of the batch, 0.52 at the last; the CLI's cost estimate for the batch is $0.46. (The last value recorded before this ticket, 0.33 in `o-pass-through-run2.jsonl`, predates other work on the account the same day.)

## 2. Hook protocol facts relied on

Quoted from the Claude Code hooks reference (`https://code.claude.com/docs/en/hooks.md`), CLI reference (`cli-reference.md`), settings (`settings.md`) and headless (`headless.md`) pages, fetched 2026-10-04.

- **Config shape.** The reference's first example: `{"hooks": {"PreToolUse": [{"matcher": "Bash", "hooks": [{"type": "command", ..., "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/block-rm.sh", "args": []}]}]}}`; terms: "**hook event** for the lifecycle point, **matcher group** for the filter, and **hook handler** for the shell command". The optional `timeout` is a handler field.
- **Matcher.** "For tool events, that field is `tool_name`." `PreToolUse` "Matches on any tool name except `EndConversation`: built-in tools such as `Bash`, `PowerShell`, `Edit`, `Write`, `Read`, `Glob`, `Grep`, `Agent`, `Workflow`, `WebFetch`, `WebSearch`, ..." A matcher containing `|` "is tested with JavaScript's `RegExp.prototype.test`".
- **Command-hook protocol.** "Command hooks receive JSON data via stdin and communicate results through exit codes, stdout, and stderr." "Exit 0 means success, and is the intended exit code when you print JSON for structured control." Stdout that "**Starts with `{` and ends with `}`**: Claude Code parses it as JSON." "Exit code 0 with no output means the hook has no decision to report, so the tool call continues through the normal permission flow. The hook can deny the call, but staying silent doesn't approve it." "Claude Code reads JSON output fields from stdout on every exit code, not just 0".
- **PreToolUse input.** "PreToolUse hooks receive `tool_name`, `tool_input`, and `tool_use_id`" in addition to the common fields (`session_id`, `prompt_id`, `transcript_path`, `cwd`, `permission_mode`, `effort`, `hook_event_name`). WebSearch input fields: `query`; `allowed_domains` "Optional: only include results from these domains"; `blocked_domains` "Optional: exclude results from these domains". WebFetch: `url`, `prompt`.
- **PreToolUse decision control.** `permissionDecision`: "`"deny"` prevents the tool call." `permissionDecisionReason`: "For `"deny"`, shown to Claude." `updatedInput`: "Modifies the tool's input parameters before execution. Replaces the entire input object, so include unchanged fields alongside modified ones. Claude Code evaluates permission rules ... against the input your hook returns, not the input Claude sent. Combine with `"allow"` to auto-approve". Precedence across hooks: "`deny` > `defer` > `ask` > `allow`".
- **Timeouts.** "Claude Code cancels a `command`, `http`, or `mcp_tool` hook that reaches its `timeout`, discarding the hook's output". On `PreToolUse`: "A timed-out `command`, `http`, or `mcp_tool` hook doesn't block the tool call. The call continues through the normal permission flow, so don't count on a stalled hook to act as a gate." "An Agent SDK callback hook that exceeds its timeout blocks the tool call."
- **Misconfigured path.** "When the script path doesn't exist or isn't executable, the shell exits with a code like 127 ... For most hook events, the action proceeds. ... a mistyped path in `settings.json` leaves the gate silently disabled."
- **`--settings` and `--setting-sources`.** CLI reference: `--settings` is a "Path to a settings JSON file or an inline JSON string. Values you set here override the same keys in your `settings.json` files for this session." `--setting-sources`: "Comma-separated list of setting sources to load (`user`, `project`, `local`)." Settings page: "`--settings`: pass a key as JSON, inline or as a path to a file. Claude Code applies it above your user, project, and local files and below managed settings." Hooks page: "`-p` or SDK session: Claude Code never shows the dialog and treats the folder as trusted, so hooks committed in a repository's `.claude/settings.json` run in a folder you've never trusted" (so `--setting-sources=` matters for a wrapper that runs in arbitrary directories).
- **Hook frames.** CLI reference, `--include-hook-events`: "Include hook lifecycle events in the output stream. `SessionStart` and `Setup` hook events are always included and don't need this flag. ... Requires `--output-format stream-json`."
- **Denials in stream-json.** Headless page: "With `--output-format stream-json`, denials appear as `permission_denied` system messages, and the final result message lists them in `permission_denials`." Measured below: a hook deny produces the `permission_denials` entry but no `permission_denied` system message.

## 3. Measurements

### 3.1 Hook loading through `--settings` on a `-p --setting-sources=` run

| Check | Result | Evidence |
| - | - | - |
| Hook fires | worked, in all three CLI runs, on every WebSearch/WebFetch call | hook logs: `s-websearch-allowed-then-deny.hooklog.jsonl` (2 lines), `s-websearch-blocked-allow.hooklog.jsonl` (2), `s-webfetch-hostlist.hooklog.jsonl` (2); each line's `stdin` is the full hook input |
| Hook stdin shape | `{session_id, transcript_path, cwd, prompt_id, permission_mode: "default", effort: {level: "high"}, hook_event_name: "PreToolUse", tool_name, tool_input, tool_use_id}`; `tool_input` is exactly the model's input | `s-websearch-allowed-then-deny.hooklog.jsonl:1` (`tool_input: {"query": "Claude Code release notes latest"}`, `tool_use_id: toolu_01JPSLPqnv3xaVreSLxVoGeQ`), matching `s-websearch-allowed-then-deny.jsonl:9` (`assistant/tool_use` with the same id and input) |
| `--include-hook-events` shows it | worked: `system/hook_started` then `system/hook_response` per call | `s-websearch-allowed-then-deny.jsonl:10` `{"type":"system","subtype":"hook_started","hook_id":"40036802-…","hook_name":"PreToolUse:WebSearch","hook_event":"PreToolUse"}`; `:15` `{"type":"system","subtype":"hook_response","hook_id":"40036802-…","hook_name":"PreToolUse:WebSearch","hook_event":"PreToolUse","output":"<stdout JSON>","stdout":"<same>","stderr":"","exit_code":0,"outcome":"success"}`; WebFetch: `s-webfetch-hostlist.jsonl:17,22,35,39` with `hook_name: "PreToolUse:WebFetch"` |
| Frame order | `assistant/tool_use` → `hook_started` → (`rate_limit_event`) → `hook_response` → `user/tool_result` | `s-websearch-allowed-then-deny.jsonl:9,10,14,15,16` |
| No other settings loaded | `system/init.tools == ["WebSearch"]` / `["WebFetch"]`, `permissionMode: "default"` | `s-websearch-allowed-then-deny.jsonl:1`, `s-webfetch-hostlist.jsonl:1` |

Notes: `hook_name` is `<event>:<tool_name>`, not the matcher string. The `hook_started`/`hook_response` frames carry `hook_id` but not `tool_use_id`, so a consumer that wants to correlate a hook decision to a call should use the hook's own stdin (`tool_use_id`) or the `user/tool_result` that follows. `hook_response.output` equals `stdout` (both `""` for the silent case, `s-webfetch-hostlist.jsonl:22`).

### 3.2 `updatedInput` on WebSearch

| Check | Result | Evidence |
| - | - | - |
| `allowed_domains: ["github.com"]`, bare `updatedInput` (no `permissionDecision`) | worked: 10/10 result URLs on `github.com` or `gist.github.com` | hook returned `{"hookSpecificOutput":{"hookEventName":"PreToolUse","updatedInput":{"query":"Claude Code release notes latest","allowed_domains":["github.com"]}}}` (`s-websearch-allowed-then-deny.hooklog.jsonl:1`, echoed in `s-websearch-allowed-then-deny.jsonl:15`); `tool_use_result.results[0].content[].url` = `github.com/anthropics/claude-code/releases`, `github.com/jqueryscript/…`, `github.com/agent-sh/agnix/issues/1535`, `github.com/VILA-Lab/…`, `gist.github.com/doggy8088/…`, `github.com/agent-sh/agnix/issues/1598`, `github.com/anthropics/claude-code-action/releases`, `github.com/anthropics/claude-code/releases/tag/v2.1.274`, `github.com/duysqubix/claude-office/issues/140`, `github.com/anthropics-claude/claude-code/blob/main/CHANGELOG.md` (`s-websearch-allowed-then-deny.jsonl:16`, `searchCount: 1`) |
| Baseline for the same broad query without the filter | 0/10 github hosts | `s-websearch-blocked-allow.jsonl:17` (hosts `releasebot.io`, `claudelog.com`, `claude.com`, `www.gradually.ai`, `www.builder.io`, `claude-world.com`, `clockedcode.com`); earlier `d-websearch.jsonl` likewise had no github host |
| `blocked_domains: ["github.com"]` with `permissionDecision: "allow"` | worked: 0 `github.com` hosts in 18 URLs over two searches, including one whose query named GitHub | hook output `s-websearch-blocked-allow.hooklog.jsonl:1,2`; call 1 hosts above (`s-websearch-blocked-allow.jsonl:17`); call 2 query `anthropics/claude-code CHANGELOG.md GitHub` returned `raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md`, three `www.threads.com` posts, `code.claude.com/docs/en/changelog?…`, `x.com/…`, `agent-safehouse.dev/…`, `deepwiki.com/anthropics/claude-code/…` (`s-websearch-blocked-allow.jsonl:48`) |
| Domain matching semantics | suffix match on the registrable host: `gist.github.com` passed an allow list of `github.com`; `raw.githubusercontent.com` was not blocked by a block list of `github.com` | `s-websearch-allowed-then-deny.jsonl:16`; `s-websearch-blocked-allow.jsonl:48` |
| `assistant/tool_use` frame input | the model's original input, not the rewritten one; `wire_tool_inputs` likewise | `s-websearch-allowed-then-deny.jsonl:9` `input: {"query":"Claude Code release notes latest"}`; `s-websearch-blocked-allow.jsonl:10,42` |
| `tool_use_result` echo | `tool_use_result.query` is the original query; no `allowed_domains`/`blocked_domains` field appears anywhere in the result | `s-websearch-allowed-then-deny.jsonl:16`; `s-websearch-blocked-allow.jsonl:17,48` |
| Does the model notice? | no: neither answer mentions a restriction; the `tool_result` text starts `Web search results for query: "<original>"` and lists the filtered links | `s-websearch-allowed-then-deny.jsonl:90` (answers from github URLs without comment); `s-websearch-blocked-allow.jsonl:267` ("Both searches completed without refusal") |
| Context cost of the rewrite | none visible: `message_start` input tokens 2 / 32 / 32 per model call in both runs (cache_creation 1272 / 1275 / 138, S1) | `s-websearch-allowed-then-deny.jsonl:3,18,33`; `s-websearch-blocked-allow.jsonl:3,19,50` |

### 3.3 Deny on the second WebSearch call

| Check | Result | Evidence |
| - | - | - |
| Hook decision | `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"max_uses reached"}}` on call 2 | `s-websearch-allowed-then-deny.hooklog.jsonl:2`; `s-websearch-allowed-then-deny.jsonl:30` (`hook_response`, `outcome: "success"`) |
| What the model receives | `user` frame, `tool_result` with `is_error: true`, `content: "PreToolUse:WebSearch hook error: max_uses reached"`; `tool_use_result: "Error: PreToolUse:WebSearch hook error: max_uses reached"` | `s-websearch-allowed-then-deny.jsonl:31` |
| `system/permission_denied` frame | none emitted (frame types in the run: `system/init`, `system/status`, `system/hook_started`, `system/hook_response` only) | `s-summarise.py` frame counts for `s-websearch-allowed-then-deny.jsonl` |
| `result.permission_denials` | lists it, with the model's original input: `[{"tool_name":"WebSearch","tool_use_id":"toolu_018zHuHRTSteCjb6oFNfrzsB","tool_input":{"query":"Claude Code latest version number"}}]` | `s-websearch-allowed-then-deny.jsonl:94` |
| Run continues | yes: `num_turns: 3`, `stop_reason: "end_turn"`, `is_error: false`, answer text begins "The second search was refused by a tool-use limit (hook error: max_uses reached), so I'm answering from the first search only." | `s-websearch-allowed-then-deny.jsonl:90,94` |
| Side-call cost of a denied call | none: Haiku `webSearchRequests: 1` for the run (one allowed search), `durationSeconds` absent on the denied result | `s-websearch-allowed-then-deny.jsonl:94` (`modelUsage`) |

### 3.4 WebFetch: host denial and the `WebFetch(domain:*)` allow rule

| Check | Result | Evidence |
| - | - | - |
| Allowed host passes without a prompt | worked: hook silent (empty stdout, exit 0) → call went through under `--permission-mode default --permission-prompts none` with `--allowedTools "WebFetch(domain:*)"`; `tool_result.content` is the one-sentence extraction; `tool_use_result: {"bytes":577,"code":200,"codeText":"OK","result":"…","durationMs":1638,"url":"https://example.com/"}` | `s-webfetch-hostlist.hooklog.jsonl:1` (`stdout: ""`); `s-webfetch-hostlist.jsonl:22` (`hook_response.output: ""`), `:23` |
| Not in `permission_denials` | the allowed fetch is absent; only the denied one is listed | `s-webfetch-hostlist.jsonl:77` |
| Denial by host | worked: `permissionDecisionReason: "url_not_allowed: host www.iana.org is not in allowed_domains"` → `tool_result` `is_error: true`, `content: "PreToolUse:WebFetch hook error: url_not_allowed: host www.iana.org is not in allowed_domains"` | `s-webfetch-hostlist.hooklog.jsonl:2`; `s-webfetch-hostlist.jsonl:39,40` |
| `permission_denials` | `[{"tool_name":"WebFetch","tool_use_id":"toolu_01ECv8NoWHBZhL9TGMxTzh5J","tool_input":{"url":"https://www.iana.org/help/example-domains","prompt":"Summarise this page in one sentence."}}]`; no `permission_denied` system frame | `s-webfetch-hostlist.jsonl:77`; frame counts |
| Run continues | `num_turns: 3`, `end_turn`; answer reports the refusal with the reason verbatim | `s-webfetch-hostlist.jsonl:73,77` |
| Extraction side call | Haiku 192 input / 25 output tokens for the one allowed fetch (`webSearchRequests: 0`) | `s-webfetch-hostlist.jsonl:77` |
| Hook input for WebFetch | `tool_input: {"url": "…", "prompt": "Summarise this page in one sentence."}` | `s-webfetch-hostlist.hooklog.jsonl:1,2` |

### 3.5 Agent SDK in-process `hooks` (one run)

| Check | Result | Evidence |
| - | - | - |
| Hook config transport | the SDK did not pass `--settings`; it sent the hooks in the `initialize` control request: `{"PreToolUse":[{"matcher":"WebSearch\|WebFetch","hookCallbackIds":["hook_0"],"timeout":30}]}` | `s-sdk-hooks-allowed.wire.ndjson:1` (`initialize` keys: `hooks`, `subtype`, `systemPrompt`); spawned argv in `s-sdk-hooks-allowed.harness.txt` (no `-p`, no `--settings`) |
| Callback round trip | CLI → SDK `control_request {subtype: "hook_callback", callback_id: "hook_0", input: <same JSON as the command hook's stdin>, tool_use_id}`; SDK → CLI `control_response {subtype: "success", response: <callback return>}` within 1 ms | `s-sdk-hooks-allowed.wire.ndjson:15` (t=3184 ms), `:16` (t=3185 ms); callback input logged at `s-sdk-hooks-allowed.hooklog.jsonl:1` |
| `updatedInput` + `allowed_domains: ["github.com"]` | worked: 10/10 URLs on `github.com`/`gist.github.com`; `permission_denials: []` | `s-sdk-hooks-allowed.jsonl:15,128` |
| Hook lifecycle frames | none: no `hook_started`/`hook_response` in the SDK message stream or on the raw wire, although `includeHookEvents: true` put `--include-hook-events` in argv | frame counts of `s-sdk-hooks-allowed.jsonl` and of `cli->host` lines in `s-sdk-hooks-allowed.wire.ndjson` (`control_request/hook_callback: 1`, no `system/hook_*`) |
| `systemPrompt: ''` | not passed as `--system-prompt`; sent as `"systemPrompt": [""]` in `initialize` and applied (first `message_start`: cache_creation 558 + cache_read 654 = 1212 tokens, against 5021 with the default prompt in `d-websearch.jsonl`) | `s-sdk-hooks-allowed.wire.ndjson:1`; `s-sdk-hooks-allowed.jsonl:4` |

## 4. Shapes the runner will consume

Hook input (command stdin and SDK callback input are identical, `s-websearch-allowed-then-deny.hooklog.jsonl:1` vs `s-sdk-hooks-allowed.hooklog.jsonl:1`):

```json
{"session_id":"…","transcript_path":"…","cwd":"…","prompt_id":"…","permission_mode":"default","effort":{"level":"high"},
 "hook_event_name":"PreToolUse","tool_name":"WebSearch","tool_input":{"query":"…"},"tool_use_id":"toolu_…"}
```

Denied call as the model sees it (`s-websearch-allowed-then-deny.jsonl:31`, trimmed):

```json
{"type":"user","message":{"role":"user","content":[{"tool_use_id":"toolu_018zHuHRTSteCjb6oFNfrzsB","type":"tool_result",
  "content":"PreToolUse:WebSearch hook error: max_uses reached","is_error":true}]},
 "tool_use_result":"Error: PreToolUse:WebSearch hook error: max_uses reached"}
```

`result.permission_denials[]` entry: `{tool_name, tool_use_id, tool_input}` with the original input (`s-websearch-allowed-then-deny.jsonl:94`, `s-webfetch-hostlist.jsonl:77`).

## 5. Consequences for issue 08

- Decisions 2 and 5 are implementable as written, with either mechanism. Bare `updatedInput` is enough on the raw CLI (S1) and the SDK (S3); pairing it with `"allow"` (S2) changes nothing observable because `--allowedTools` already admits the call.
- The surface should mint `web_search_tool_result_error {max_uses_exceeded}` / `web_fetch_tool_result_error {url_not_allowed, max_uses_exceeded}` from its own hook decision keyed by `tool_use_id` (the hook input carries it), and treat the matching `user/tool_result` with `is_error: true` as the trigger; parsing the `PreToolUse:<Tool> hook error: ` prefix is a fallback, not the contract. There is no `permission_denied` frame to wait for, and `permission_denials` arrives only with `result`.
- `server_tool_use.input` (decision 1) should be the model's `tool_use.input` as streamed; the domain lists never appear in any upstream frame, which matches the real API, where they live in the tool definition, not the call.
- Domain matching is the API web_search tool's own (host suffix: `gist.github.com` is inside `github.com`, `raw.githubusercontent.com` is outside), so the surface inherits the real API's semantics for free.
- A denied call makes no Haiku side call, so `usage.server_tool_use.web_search_requests` (decision 8) should count allowed calls only; summing `searchCount` does that naturally.
- Guard rails from the reference: set a hook `timeout` and treat `hook_response.outcome != "success"` (or a missing `hook_response` for a call) as a fault, because a timed-out or unstartable command hook lets the call through; the SDK callback path fails closed on timeout. Keep `--setting-sources=` so a `.claude/settings.json` in the run directory can't add hooks of its own.
- The SDK path gives no `hook_started`/`hook_response` frames; if the runner wants hook telemetry in the stream it must use the command-hook path or log from the callback itself.
