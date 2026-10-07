# Upstream fixtures

Recorded Claude Code runs, copied from the Anthropic surface's research probes (`cli-probes/`) and the client-tool spike (`spike-runs/`). Each fixture keeps its source file name. Tests pick a fixture by its path below, relative to this directory.

**Scrubbed.** `npm run fixtures:scrub` copies the recordings here and replaces the operator's account email with `user@example.invalid` and the display and full names with `Example User`, reading the live values from the CLI's account file at scrub time. It is re-runnable: it writes only new or changed files, and a recording saved straight into this directory is scrubbed in place. Before the unit, integration and `test:ci` runs, a Jest global setup refuses to run the suite if any file under `tests/fixtures/` still carries a live value. A value split across `text_delta` chunks counts, and so does one inside a wire log's frame string. The guard skips with a notice when there is no account file. Values match as whole words and ignore case. The harness scripts (`*.py`, `*.mjs`) are code and are not copied; their originals stay beside the recordings in `.scratch/anthropic-compat-api/`.

**Address column.** `scrubbed` marks the seventeen recordings that carried the account email. Each now holds the placeholder where the address was. Where the address was split across deltas, the placeholder sits whole in the first chunk and the later chunks are empty `text_delta`s, so these files do not exercise a split.

## Kinds

Frame recordings are the `frames` and `wire` kinds. All other kinds are not.

| Kind | Format |
| - | - |
| `frames` | The CLI's `--output-format stream-json` stdout: one frame per line, no timestamps. `frames+partial` adds `stream_event` frames (`--include-partial-messages`). |
| `wire` | A timestamped log of both directions: `{t_ms, dir, frame}` per line, where `frame` is the raw line as a JSON string (`line` instead of `frame` in `s-sdk-hooks-allowed`). `dir` is `host->cli` (stdin), `cli->host` (stdout), `mcp-http->server`, `meta` or `proc` (exit). Marker strings such as `[stdin EOF]` and `[exit code=0 signal=null]` are not JSON. All the `wire` recordings include partial messages except `q-tool-names-run1`. |
| `transcript` | The CLI's own session file (`~/.claude/projects/...jsonl`), copied after the run: `queue-operation`, `user`, `attachment`, `assistant`, `last-prompt`, `cost-state` records. |
| `result` | `--output-format json` stdout: one `result` object. |
| `stderr` | stderr, then `exit=<code>` on the last line. |
| `text` | Plain stdout or a hand-written capture. |
| `summary` | A harness's summary JSON: argv, ids, timings, and for the spike the bridge trace. |
| `harness-log` | A harness's own timeline of what it sent and received, or (`s-*`) the spawn record as JSON. |
| `hook-log` | One line per `PreToolUse` hook call: the hook's stdin and its reply. |
| `mcp-log` | The wrapper-hosted MCP server's request log. |
| `run-log` | One line per probe in a series: argv, duration, exit. |
| `input` | A file a probe sent upstream. |

## Index

Spec sections refer to `.scratch/anthropic-compat-api/spec.md`.

| Fixture | Kind | What it shows | Spec | Address |
| - | - | - | - | - |
| `cli-probes/a-json.stderr.txt` | stderr | stderr of the json-output probe (empty, exit 0) | §10 | |
| `cli-probes/a-json.txt` | result | `--output-format json`: the single `result` object, same shape as stream-json's last line | §10 | |
| `cli-probes/auth-failure.jsonl` | frames | `--bare` with an invalid API key: `system/init`, then `api_retry` 401 `authentication_failed` repeating until killed | §13, §14 | |
| `cli-probes/auth-failure.stderr.txt` | stderr | stderr of the auth-failure probe (killed by timeout, exit 124) | §13 | |
| `cli-probes/b-stream-json.jsonl` | frames | Plain text answer without partial messages: `system/init`, `assistant`, `rate_limit_event`, `result` | §11 | |
| `cli-probes/b-stream-json.stderr.txt` | stderr | stderr of `b-stream-json` | §11 | |
| `cli-probes/c-partial.jsonl` | frames+partial | Plain text turn with partial messages: `system/status`, the `stream_event` sequence, `assistant`, `result` | §11 | |
| `cli-probes/c-partial.stderr.txt` | stderr | stderr of `c-partial` | §11 | |
| `cli-probes/d-websearch.jsonl` | frames | Built-in WebSearch as upstream reports it: `tool_use` and `tool_result` frames, not server-tool blocks | §8 | |
| `cli-probes/d-websearch.stderr.txt` | stderr | stderr of `d-websearch` | §8 | |
| `cli-probes/e-stream-json-input.harness.txt` | harness-log | Timeline of three user messages over one held-open stdin, with timings | §10 | |
| `cli-probes/e-stream-json-input.jsonl` | frames | Three stream-json user messages in one run (text, base64 image, an ignored `tool_result`), three `result`s | §4.3, §10 | |
| `cli-probes/f-session-uuid.txt` | text | The UUID minted for `f1` to `f3` | §5 | |
| `cli-probes/f1-session-id.stderr.txt` | stderr | stderr of `f1-session-id` | §5 | |
| `cli-probes/f1-session-id.txt` | result | `--session-id <uuid>` honoured: `result.session_id` equals it | §5 | |
| `cli-probes/f2-resume.stderr.txt` | stderr | stderr of `f2-resume` | §5 | |
| `cli-probes/f2-resume.txt` | result | `--resume <uuid>` from `-p`: same session, conversation-wide cost | §5 | |
| `cli-probes/f3-resume-fork.stderr.txt` | stderr | stderr of `f3-resume-fork` | §5 | |
| `cli-probes/f3-resume-fork.txt` | result | `--resume --fork-session`: a new session id that still knows the earlier turn | §5 | |
| `cli-probes/g1-system-prompt.jsonl` | frames | `--system-prompt` on default tools: the budget cap hit, `result/error_max_budget_usd` | §6, §13 | |
| `cli-probes/g1-system-prompt.stderr.txt` | stderr | stderr of `g1-system-prompt` | §6 | |
| `cli-probes/g2-append-system-prompt.jsonl` | frames | `--append-system-prompt`: plain answer | §6 | |
| `cli-probes/g2-append-system-prompt.stderr.txt` | stderr | stderr of `g2-append-system-prompt` | §6 | |
| `cli-probes/h-unknown-model.stderr.txt` | stderr | `[claude-code:unrecognized_model]` diagnostic, exit 1 | §3, §13 | |
| `cli-probes/h-unknown-model.txt` | result | Unknown `--model`: `result` with `is_error: true` and `stop_reason: stop_sequence` | §3, §13 | |
| `cli-probes/help.txt` | text | `claude --help` (2.1.28x) | §10 | |
| `cli-probes/i-no-tools.jsonl` | frames | `--tools ""` and `--no-session-persistence`: `init.tools` empty, `system/thinking_tokens` frames | §10 | |
| `cli-probes/i-no-tools.stderr.txt` | stderr | stderr of `i-no-tools` | §10 | |
| `cli-probes/j-json-schema-stdin.stderr.txt` | stderr | stderr of `j-json-schema-stdin` | §12 | |
| `cli-probes/j-json-schema-stdin.txt` | result | `--json-schema` that hit the budget cap: `result/error_max_budget_usd` with `stop_reason: tool_use` | §12, §13 | |
| `cli-probes/j2-json-schema-stdin.jsonl` | frames | `--json-schema` without partial messages: `StructuredOutput` `tool_use`, its `tool_result`, `structured_output` in `result` | §12 | |
| `cli-probes/j2-json-schema-stdin.stderr.txt` | stderr | stderr of `j2-json-schema-stdin` | §12 | |
| `cli-probes/k-sigterm.exit.txt` | text | SIGTERM 1.5 s into a run: exit code 143 | §14 | |
| `cli-probes/k-sigterm.jsonl` | frames | What a SIGTERM leaves on stdout: only `system/init`, no `result` | §14 | |
| `cli-probes/l-parse-errors.txt` | text | Six flag-validation runs (`--effort`, `--permission-mode`, `--session-id`, `--output-format`, `--json-schema`, `--max-turns`): stdout, stderr and exit code of each; rejected flags exit 1 before any API call | §10, §13 | |
| `cli-probes/m-thinking-partial.jsonl` | frames+partial | Thinking with partial messages: empty `thinking_delta`s carrying `estimated_tokens`, then text | §11, §12 | |
| `cli-probes/m-thinking-partial.stderr.txt` | stderr | The "no stdin data received in 3s" warning, exit 0 | §10 | |
| `cli-probes/n-thinking-summaries.jsonl` | frames | `showThinkingSummaries` setting: thinking text still empty, `thinking_tokens` reported | §11, §12 | |
| `cli-probes/n-thinking-summaries.stderr.txt` | stderr | stderr of `n-thinking-summaries` | §12 | |
| `cli-probes/o-pass-through-run1.harness.txt` | harness-log | Timeline of run 1: six content-block messages sent cheapest first | §4.3 | |
| `cli-probes/o-pass-through-run1.jsonl` | frames+partial | Text, content and base64 PDF documents forwarded; URL image and URL document rejected as a synthetic `API Error: 400` assistant frame; citations document | §4.3, §13 | |
| `cli-probes/o-pass-through-run1.stderr.txt` | stderr | stderr of run 1 (exit 1 after the API errors) | §13 | |
| `cli-probes/o-pass-through-run2.harness.txt` | harness-log | Timeline of run 2 | §4.3 | |
| `cli-probes/o-pass-through-run2.jsonl` | frames+partial | The optional document fields (`title`, `context`, `citations`) as a fresh session's sole document, then URL sources on other hosts rejected with `API Error: 400` | §4.3, §13 | |
| `cli-probes/o-pass-through-run2.stderr.txt` | stderr | stderr of run 2 (exit 1) | §13 | |
| `cli-probes/o-pass-through.tangerine.pdf` | input | The one-page PDF sent as a base64 document (codeword "tangerine-7"); not UTF-8 | §4.3 | |
| `cli-probes/p-run-log.jsonl` | run-log | argv, duration and exit of `p1` to `p7` | §6, §10 | |
| `cli-probes/p1-empty-system-prompt.jsonl` | frames+partial | `--system-prompt ""` with snapshot off: the 493-token floor and the model's self-description | §6, §10 | |
| `cli-probes/p1-empty-system-prompt.stderr.txt` | stderr | stderr of `p1` | §6 | |
| `cli-probes/p2-empty-system-prompt-repeat.jsonl` | frames+partial | `p1` repeated: identical input tokens | §6 | |
| `cli-probes/p2-empty-system-prompt-repeat.stderr.txt` | stderr | stderr of `p2` | §6 | |
| `cli-probes/p3-helpful-assistant-persisted.jsonl` | frames+partial | A one-line system prompt, session persisted (the session `p6` and `p7` resume) | §5, §6 | |
| `cli-probes/p3-helpful-assistant-persisted.stderr.txt` | stderr | stderr of `p3` | §6 | |
| `cli-probes/p4-bare.jsonl` | frames | `--bare` on a subscription login: synthetic "Not logged in" assistant frame, `authentication_failed`, no API call | §10, §13 | |
| `cli-probes/p4-bare.stderr.txt` | stderr | stderr of `p4` | §13 | |
| `cli-probes/p5-safe-mode-disable-slash.jsonl` | frames+partial | `--safe-mode --disable-slash-commands` on top of `p1`: same floor | §6, §10 | |
| `cli-probes/p5-safe-mode-disable-slash.stderr.txt` | stderr | stderr of `p5` | §6 | |
| `cli-probes/p6-resume-snapshot-off.jsonl` | frames+partial | `--resume` of `p3` with a new system prompt (end every reply with BANANA) and snapshot off: the new prompt applies | §5, §6 | |
| `cli-probes/p6-resume-snapshot-off.stderr.txt` | stderr | stderr of `p6` | §5 | |
| `cli-probes/p6-session-after-resume.transcript.jsonl` | transcript | The `p3` session file after the `p6` resume | §5, §6 | scrubbed |
| `cli-probes/p7-resume-snapshot-on.jsonl` | frames+partial | `--resume` of `p3` with the same new system prompt and snapshot on | §5, §6 | |
| `cli-probes/p7-resume-snapshot-on.stderr.txt` | stderr | stderr of `p7` | §5 | |
| `cli-probes/p7-session-after-resume.transcript.jsonl` | transcript | The `p3` session file after the `p7` resume | §5, §6 | scrubbed |
| `cli-probes/q-tool-names-run1.mcp-server.ndjson` | mcp-log | MCP server log for run 1: discover, initialize, `tools/list` with seven names | §4.4, §7 | |
| `cli-probes/q-tool-names-run1.stderr.txt` | stderr | stderr of run 1 (empty) | §4.4 | |
| `cli-probes/q-tool-names-run1.summary.json` | summary | Run 1 argv, served names and lengths, init tools, `result` | §4.4, §7 | |
| `cli-probes/q-tool-names-run1.wire.ndjson` | wire | A 141-character MCP tool name: `init.tools` lists it, the API rejects the call (`API Error: 400 ... at most 128 characters`) | §4.4, §13 | |
| `cli-probes/q-tool-names-run2.mcp-server.ndjson` | mcp-log | MCP server log for run 2: six `tools/call`s, one at a time | §7 | |
| `cli-probes/q-tool-names-run2.stderr.txt` | stderr | stderr of run 2 (empty) | §7 | |
| `cli-probes/q-tool-names-run2.summary.json` | summary | Run 2 per-name table: exact names in init, `tool_use`, MCP calls | §4.4, §7 | |
| `cli-probes/q-tool-names-run2.wire.ndjson` | wire | Six MCP tools called in one assistant message over HTTP MCP, then `done`: names up to 128 characters pass | §4.4, §7 | |
| `cli-probes/r-run-log.jsonl` | run-log | argv, duration and exit of `r1` to `r6` | §6 | |
| `cli-probes/r1-simple-env.jsonl` | frames | `CLAUDE_CODE_SIMPLE=1`: synthetic "Not logged in" assistant frame, no API call | §6, §13 | |
| `cli-probes/r1-simple-env.stderr.txt` | stderr | stderr of `r1` | §6 | |
| `cli-probes/r1-simple-env.transcript.jsonl` | transcript | Session file of `r1`: a rendered `date` and an empty `session_context`, nothing else | §6 | |
| `cli-probes/r2-exclude-dynamic.jsonl` | frames+partial | `--exclude-dynamic-system-prompt-sections`: the account email still disclosed | §6 | scrubbed |
| `cli-probes/r2-exclude-dynamic.stderr.txt` | stderr | stderr of `r2` | §6 | |
| `cli-probes/r2-exclude-dynamic.transcript.jsonl` | transcript | Session file of `r2`: residual-context attachments, the email among them | §6 | scrubbed |
| `cli-probes/r3-baseline-disclosure.jsonl` | frames+partial | Baseline: asked for the email in context, the model quotes it. **The redaction fixture** (ticket 39) | §6, §11 | scrubbed |
| `cli-probes/r3-baseline-disclosure.stderr.txt` | stderr | stderr of `r3` | §6 | |
| `cli-probes/r3-baseline-disclosure.transcript.jsonl` | transcript | Session file of `r3`: the seven residual-context attachments in order | §6 | scrubbed |
| `cli-probes/r4-system-instruction-disclosure.jsonl` | frames+partial | A system prompt forbidding disclosure: the model declines | §6 | |
| `cli-probes/r4-system-instruction-disclosure.stderr.txt` | stderr | stderr of `r4` | §6 | |
| `cli-probes/r5-disable-attachments-env.jsonl` | frames+partial | `CLAUDE_CODE_DISABLE_ATTACHMENTS=1`: some attachments gone, the email still disclosed | §6 | scrubbed |
| `cli-probes/r5-disable-attachments-env.stderr.txt` | stderr | stderr of `r5` | §6 | |
| `cli-probes/r5-disable-attachments-env.transcript.jsonl` | transcript | Session file of `r5` | §6 | scrubbed |
| `cli-probes/r6-nonessential-traffic-env.jsonl` | frames+partial | `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` (on Opus 5.5): the email still disclosed | §6 | scrubbed |
| `cli-probes/r6-nonessential-traffic-env.stderr.txt` | stderr | stderr of `r6` | §6 | |
| `cli-probes/r6-nonessential-traffic-env.transcript.jsonl` | transcript | Session file of `r6` | §6 | scrubbed |
| `cli-probes/s-run-log.jsonl` | run-log | argv, duration and exit of the four hook probes | §8 | |
| `cli-probes/s-sdk-hooks-allowed.harness.txt` | harness-log | Spawn record of the SDK hook probe | §8 | |
| `cli-probes/s-sdk-hooks-allowed.hooklog.jsonl` | hook-log | One WebSearch hook call answered with `updatedInput` plus `allowed_domains` | §8 | |
| `cli-probes/s-sdk-hooks-allowed.jsonl` | frames+partial | The SDK driver's messages for one domain-filtered web search | §8 | |
| `cli-probes/s-sdk-hooks-allowed.stderr.txt` | stderr | stderr of the SDK hook probe (empty) | §8 | |
| `cli-probes/s-sdk-hooks-allowed.wire.ndjson` | wire | The same run on the wire: `initialize` and hook `control_request`s, one web search | §8, §16 | scrubbed |
| `cli-probes/s-webfetch-hostlist.harness.txt` | harness-log | Spawn record of the WebFetch host-list probe | §8 | |
| `cli-probes/s-webfetch-hostlist.hooklog.jsonl` | hook-log | Two WebFetch hook calls: one allowed silently, one denied by host | §8 | |
| `cli-probes/s-webfetch-hostlist.jsonl` | frames+partial | WebFetch with a host allow list: `hook_started` and `hook_response` frames, the denied fetch's error `tool_result`, `permission_denials` | §8 | |
| `cli-probes/s-webfetch-hostlist.stderr.txt` | stderr | stderr of the WebFetch probe | §8 | |
| `cli-probes/s-websearch-allowed-then-deny.harness.txt` | harness-log | Spawn record of the `max_uses` probe | §8 | |
| `cli-probes/s-websearch-allowed-then-deny.hooklog.jsonl` | hook-log | Two WebSearch hook calls: allowed, then denied with `max_uses reached` | §8 | |
| `cli-probes/s-websearch-allowed-then-deny.jsonl` | frames+partial | Second search denied by the hook: error `tool_result`, `permission_denials`, the run continues to `end_turn` | §8 | |
| `cli-probes/s-websearch-allowed-then-deny.stderr.txt` | stderr | stderr of the `max_uses` probe | §8 | |
| `cli-probes/s-websearch-blocked-allow.harness.txt` | harness-log | Spawn record of the blocked-domains probe | §8 | |
| `cli-probes/s-websearch-blocked-allow.hooklog.jsonl` | hook-log | Two WebSearch hook calls rewritten with `blocked_domains` and `permissionDecision: allow` | §8 | |
| `cli-probes/s-websearch-blocked-allow.jsonl` | frames+partial | Two searches with a domain block list applied by the hook | §8 | |
| `cli-probes/s-websearch-blocked-allow.stderr.txt` | stderr | stderr of the blocked-domains probe | §8 | |
| `cli-probes/t1-max-output-100.jsonl` | frames+partial | `CLAUDE_CODE_MAX_OUTPUT_TOKENS=100`: four capped calls with auto-continuation, then a synthetic `max_output_tokens` error frame | §12, §13 | |
| `cli-probes/t2-alias-sonnet-effort-low.jsonl` | frames+partial | `--model sonnet --effort low`: the alias resolved to `claude-sonnet-5-5` before the call | §3, §12 | |
| `cli-probes/t3-json-schema-stream.jsonl` | frames+partial | `--json-schema` streamed: `StructuredOutput` `input_json_delta`s, the synthetic `tool_result` inside the same call, `structured_output` | §12 | |
| `cli-probes/t4-haiku-baseline.jsonl` | frames+partial | `--model haiku`: dated id, thinks by default | §3, §12 | |
| `cli-probes/t5-haiku-disable-thinking.jsonl` | frames+partial | Haiku with `CLAUDE_CODE_DISABLE_THINKING=1`: no thinking block | §12 | |
| `cli-probes/t6-haiku-max-thinking-1024.jsonl` | frames+partial | Haiku with `MAX_THINKING_TOKENS=1024`: accepted, thinks normally | §12 | |
| `cli-probes/t7-websearch-cap-300.jsonl` | frames+partial | A two-call web-search turn with partial messages (output cap 300) | §8, §12 | |
| `spike-runs/cli-http-happy.summary.json` | summary | Timings, ids and bridge trace of `cli-http-happy` | §7 | |
| `spike-runs/cli-http-happy.wire.ndjson` | wire | Raw CLI plus wrapper-hosted HTTP MCP server: one client tool round trip, `_meta["claudecode/toolUseId"]` over HTTP | §7, §16 | |
| `spike-runs/cli-http-interrupt.summary.json` | summary | Timings, ids and bridge trace of `cli-http-interrupt` | §7, §14 | |
| `spike-runs/cli-http-interrupt.wire.ndjson` | wire | Parked, then a raw `control_request {subtype: interrupt}` on stdin: `control_response`, rejection `tool_result`, `result/error_during_execution`, exit 1 | §7, §14 | |
| `spike-runs/sdk-close-while-parked.summary.json` | summary | Timings, ids and bridge trace of `sdk-close-while-parked` | §7, §14 | |
| `spike-runs/sdk-close-while-parked.wire.ndjson` | wire | Stdin closed while parked, no interrupt: upstream writes "interrupted" results and the model retries twice | §7, §14 | scrubbed |
| `spike-runs/sdk-happy.summary.json` | summary | Timings, ids and bridge trace of `sdk-happy` | §7 | |
| `spike-runs/sdk-happy.wire.ndjson` | wire | Agent SDK driver: one client tool round trip through the bridge, ids matching end to end | §7 | scrubbed |
| `spike-runs/sdk-hybrid-resume.summary.json` | summary | Timings, ids and bridge trace of `sdk-hybrid-resume` | §5, §7 | |
| `spike-runs/sdk-hybrid-resume.wire.ndjson` | wire | Park, interrupt, exit, then a new run with `--resume` and the tool result as user text | §5, §7 | scrubbed |
| `spike-runs/sdk-interrupt.summary.json` | summary | Timings, ids and bridge trace of `sdk-interrupt` | §7, §14 | |
| `spike-runs/sdk-interrupt.wire.ndjson` | wire | Client never answers; interrupt 3 s after the park: rejection `tool_result`, `result/error_during_execution`, no extra model call | §7, §14 | scrubbed |
| `spike-runs/sdk-parallel.summary.json` | summary | Timings, ids and bridge trace of `sdk-parallel` | §7 | |
| `spike-runs/sdk-parallel.wire.ndjson` | wire | Two `tool_use` blocks in one message; upstream issues the MCP calls one at a time (the parallel-call park) | §7 | scrubbed |
| `spike-runs/sdk-timeout.summary.json` | summary | Timings, ids and bridge trace of `sdk-timeout` | §7 | |
| `spike-runs/sdk-timeout.wire.ndjson` | wire | MCP server timeout of 5 s: error `tool_result`, the model retries once and apologises | §7 | scrubbed |
