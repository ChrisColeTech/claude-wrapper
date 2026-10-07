# Claude Code CLI headless I/O contract

Type: research
Status: resolved
Blocked by: none

## Question

What exactly does the installed Claude Code CLI (2.1.284; see `claude --help`) accept and emit in headless mode, as the upstream for an Anthropic surface? Resolve from primary sources: the official Claude Code docs (code.claude.com/docs: headless mode, CLI reference, output formats, SDK/stream-json pages), the CLI's own `--help`, and live probes with minimal prompts. Needed facts:

1. **Output formats.** Exact JSON shapes of every message `--output-format stream-json` emits (`system`/`init`, `assistant`, `user`, `result`, `stream_event` with `--include-partial-messages`, anything else), with real captured samples. Does the `assistant` message carry a full Anthropic `Message` (content blocks, `stop_reason`, `usage`)? Does `result` carry real token usage, cost, duration, `num_turns`, `session_id`, `is_error`, error subtypes?
2. **Tool traffic in output.** How a built-in tool call appears (`tool_use` block, then a `user` message with `tool_result`?). Specifically how **WebSearch** appears: as a built-in `WebSearch` tool_use, or as server-tool blocks (`server_tool_use` / `web_search_tool_result`)? Capture one web search run.
3. **Input formats.** `--input-format stream-json`: the accepted message shape (user messages with content blocks? images? `tool_result` blocks?), whether stdin can stay open for several user messages in one run, and how the run ends.
4. **Prompt and system prompt.** `--system-prompt` vs `--append-system-prompt`; prompt on stdin vs as an argument; size limits (the current code pipes via `echo`, which breaks on large or quote-heavy prompts).
5. **Sessions.** `--session-id`, `--resume`, `--continue`, `--fork-session`, `--no-session-persistence`: can the wrapper mint its own UUID, resume it later, and what is persisted where?
6. **Control flags.** `--tools`, `--allowedTools`, `--disallowedTools`, `--permission-mode`, `--permission-prompts none`, `--max-budget-usd`, `--effort`, `--json-schema`, `--mcp-config`, `--strict-mcp-config`, `--setting-sources`, `--model` (which names and aliases are accepted; what happens on an unknown model), `--fallback-model`. Note `--max-turns` is not in this version's `--help`; confirm whether it exists.
7. **Failure modes.** What is emitted on auth failure, rate limiting, unknown model, budget exceeded, and process kill; exit codes.
8. **Thinking.** Whether thinking blocks appear in stream-json output and under which flags.

Probing rules: run from the scratchpad directory (no project CLAUDE.md), one-line prompts, `--max-budget-usd 0.25` per probe, `--strict-mcp-config` to skip user MCP servers, never `--dangerously-skip-permissions`; for the web search probe use `--tools WebSearch --allowedTools WebSearch --permission-prompts none`. Save raw transcripts next to the findings.

Write findings to `.scratch/anthropic-compat-api/research/cli-headless-io-contract.md`, citing the doc URL or probe for each claim.

## Answer

- `--output-format json` prints one object: the `result` message. `stream-json` (needs `--verbose`) emits `system/init`, `assistant`, `user`, `rate_limit_event`, `result`, plus `system/status`, `system/thinking_tokens`, `system/api_retry`, and `stream_event` with `--include-partial-messages`.
- The `assistant` line's `message` is a full Anthropic `Message`, but one line per content block (shared `message.id`), `stop_reason` always `null`, and `usage` is the `message_start` usage. Final `stop_reason`/`usage` come from the `message_delta` stream event or from `result`. Non-API fields (`caller`, `wire_tool_inputs`, `safeguard_results`, `container`, ...) must be stripped.
- `result` carries real `usage` (per turn, main loop), cumulative `modelUsage` and `total_cost_usd` (an estimate, includes restored session totals), `num_turns`, `session_id`, `is_error`, `subtype` (`success | error_max_turns | error_during_execution | error_max_budget_usd | error_max_structured_output_retries`), `stop_reason`, `api_error_status`, `errors[]`, `permission_denials`, `structured_output`. `is_error: true` can pair with `subtype: "success"` (API 404 on `--model zzz`); the error arm has no `result` text.
- WebSearch is a built-in tool in the output: `tool_use{name:"WebSearch", input:{query}}` then a `user`/`tool_result` text blob with `tool_use_result{query, results:[{tool_use_id:"srvtoolu_...", content:[{title,url}]}, summary], searchCount}`. No `server_tool_use`/`web_search_tool_result`, no `encrypted_content`/citations; the main model's `usage.server_tool_use.web_search_requests` stays 0 (the search runs on a Haiku side call listed in `modelUsage`).
- `--input-format stream-json`: stdin can stay open; each `{"type":"user","message":{"role":"user","content":...}}` line is a turn with its own `system/init` and `result` (`result_index` increments, same `session_id`, cumulative cost). Base64 image blocks work. A bare `tool_result` block is silently dropped (model sees an empty message), so client tool results cannot be fed via stdin; the bridge needs MCP (`--mcp-config`). Closing stdin ends the run (exit 0 within ~1 s).
- Prompt on stdin works verbatim (quotes, `$`, backticks), capped at 10 MB. With the prompt as an argument, close the child's stdin or the CLI waits 3 s. `--system-prompt` removes only ~4k of ~20k prompt tokens (tools and environment context stay; the model still says it is Claude Code) and forces a cache miss; `--append-system-prompt` is cheap. On `--resume` the system prompt is frozen from the first turn unless `--system-prompt-snapshot off`.
- Sessions: a wrapper-minted `--session-id <uuid>` works, `--resume <uuid>` works from `-p` and any directory, `--fork-session` yields a new id, `--no-session-persistence` writes nothing. Transcripts: `~/.claude/projects/<cwd-slug>/<uuid>.jsonl` (~115 KB per tiny session, internal format, 30-day sweep).
- Flags: `--tools ""` disables all built-in tools (init `tools: []`). `--max-turns` is accepted although absent from `--help`. `--effort zzz` only warns. `--permission-mode` choices: `acceptEdits, auto, bypassPermissions, manual, dontAsk, plan` (+`default`); the `-p` default depends on user settings, so pass it explicitly with `--permission-prompts none`. `--json-schema` is validated at startup, adds a `StructuredOutput` tool call (`num_turns` 2) and fills `result.structured_output`. `--model` accepts aliases (`fable`, `opus`, `sonnet`, `haiku`, `best`, `default`, `[1m]` variants) or full ids; unknown ids fail on the first request.
- Failures: exit 0 success, 1 on error result or bad flag, 143 on SIGTERM (no `result` emitted). Auth failure retries up to 10x with backoff (still retrying at 90 s) as `system/api_retry {error_status:401, error:"authentication_failed"}`. `--max-budget-usd` is checked after the call that crosses it (`error_max_budget_usd`, `terminal_reason: budget_exhausted`, exit 1).
- Thinking: blocks appear with `thinking: ""` plus a signature (and `thinking_delta` events with empty text); real counts in `usage.output_tokens_details.thinking_tokens`. `showThinkingSummaries` does not change `-p` output; thinking cannot be disabled for Fable. Only `--effort` is controllable.

Full findings: .scratch/anthropic-compat-api/research/cli-headless-io-contract.md
