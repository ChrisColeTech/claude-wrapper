# Hook enforcement of web tool limits upstream

Type: research
Status: resolved
Blocked by: none

## Question

[Web search and built-in tools policy](08-web-search-and-built-in-tools-policy.md) decisions 2 and 5 enforce a client's `allowed_domains`, `blocked_domains` and `max_uses` on `web_search` and `web_fetch` with a `PreToolUse` hook that rewrites the built-in tool's input (`updatedInput`) or denies the call. The hooks reference documents both outputs for any tool, but neither was tried on `WebSearch` or `WebFetch`, nor through `--settings` inline JSON on a `-p` run with `--setting-sources=`. Measure, in as few runs as possible on Claude Code 2.1.289:

1. **Hook loading.** A command hook defined in `--settings '{"hooks":{"PreToolUse":[{"matcher":"WebSearch|WebFetch","hooks":[{"type":"command","command":"<script>"}]}]}}'` fires on a `-p --setting-sources=` run (log the hook's stdin to a file). Record whether `--include-hook-events` shows it.
2. **`updatedInput` on WebSearch.** The hook adds `allowed_domains: ["<one host>"]` to the input; check the `tool_use` frame's input, the `tool_use_result.results[].content[].url` hosts, and whether the model notices. Repeat once with `blocked_domains`.
3. **Deny.** The hook returns `permissionDecision: "deny"` with a reason on the second WebSearch call of a turn; record what the model receives (the `user/tool_result` text or `permission_denied` system frame), whether `result.permission_denials` lists it, and that the run continues to an answer.
4. **WebFetch.** Same two checks: a denial by URL host, and that `--allowedTools "WebFetch(domain:*)"` under `--permission-mode default --permission-prompts none` lets an allowed fetch through without a prompt.
5. **Agent SDK driver** (only if cheap): the same `updatedInput` through the SDK's in-process `hooks` option, one run, using the spike's node_modules.

Hygiene as on [Image and document block pass-through upstream](18-image-and-document-pass-through-upstream.md), plus `--tools WebSearch` (or `WebFetch`) and the matching `--allowedTools`. Each WebSearch run costs a Haiku side call on top; four to six runs expected. Write findings to `.scratch/anthropic-compat-api/research/hook-enforcement-of-web-tool-limits.md`, raw frames and the hook script under `research/cli-probes/` with an `s-` prefix. Released by the human on 2026-10-04 together with [Residual upstream context and the account-email reminder](20-residual-upstream-context-and-account-email.md).

## Answer

Probed on `claude` 2.1.289 (and Agent SDK 0.3.289 for item 5), four runs, all exit 0. Findings with per-claim probe citations: [research/hook-enforcement-of-web-tool-limits.md](../research/hook-enforcement-of-web-tool-limits.md); raw frames, hook logs, hook script and harnesses: `research/cli-probes/s-*`.

1. **Hook loading: worked.** The `--settings` inline hook fired on every WebSearch/WebFetch call of a `-p --setting-sources=` run; `--include-hook-events` shows `system/hook_started` and `system/hook_response` (with `output`, `stdout`, `stderr`, `exit_code`, `outcome`) per call, `hook_name` = `PreToolUse:<tool>`.
2. **`updatedInput` on WebSearch: worked** for both lists. `allowed_domains: ["github.com"]` gave 10/10 github hosts where the unfiltered query gives none; `blocked_domains: ["github.com"]` gave 0 github.com hosts even on a query naming GitHub. The `assistant/tool_use` frame keeps the model's original input; the lists appear in no frame; the model does not notice.
3. **Deny: worked.** The model receives a `tool_result` with `is_error: true` and text `PreToolUse:WebSearch hook error: max_uses reached`; no `system/permission_denied` frame; `result.permission_denials` lists the call with its original input; the run continues to an answer; no Haiku side call for the denied search.
4. **WebFetch: worked** on both checks. Denial by host behaves as in 3 (`PreToolUse:WebFetch hook error: url_not_allowed: …`, listed in `permission_denials`); with the hook silent, `--allowedTools "WebFetch(domain:*)"` under `--permission-mode default --permission-prompts none` let the fetch through with no prompt.
5. **Agent SDK `hooks`: worked.** Same `updatedInput`, same result, over the control protocol (`initialize.hooks` → `control_request hook_callback` → `control_response`, 1 ms round trip); no `hook_started`/`hook_response` frames on that path despite `includeHookEvents`.

Quota: five-hour utilisation 0.47 at the batch's first event, 0.52 at its last; CLI cost estimate $0.46.
