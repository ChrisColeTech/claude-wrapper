# 35: Web search and web fetch

Spec: [spec.md](../spec.md), section 8, section 11 (multi-call flattening, mixed message)

**What to build:** A client declaring `web_search_*` or `web_fetch_*` gets the real API's `server_tool_use` and result blocks synthesised from upstream's built-in WebSearch and WebFetch, with `max_uses` and domain lists enforced by the wrapper's hook, usage counts reported, and one surface message even though upstream made several model calls.

**Blocked by:** 34 (Client tools round trip)

**Status:** ready-for-agent

- [ ] Planning: `--tools` and `--allowedTools` per the spec's mapping table; `tool_choice: none` disables server tools; the hook policy (counters, lists) in the plan; a per-run `0600` settings file with the `PreToolUse` hook on `WebSearch|WebFetch`
- [ ] The hook client: an executable shipped with the package that posts its stdin to the run's hook endpoint and prints the reply, invoked with the absolute Node path; the control server's hook endpoint applies the policy (`updatedInput` with the request's domain lists; deny with `max_uses_exceeded` or `url_not_allowed` as the reason)
- [ ] Translator: multi-call flattening (later `message_start` suppressed, block indices offset, a call's `message_delta` and `message_stop` suppressed when every tool call in it is built-in, frames with a `parent_tool_use_id` dropped); the server-tool pass (`server_tool_use` with filtered `{query}` or `{url}` input in one delta, `web_search_tool_result` and `web_fetch_tool_result` synthesised whole on the `user/tool_result` frame, error blocks from hook denials and failures, the WebSearch and WebFetch renames); the mixed-message hold of a client `tool_use` behind a preceding built-in's result
- [ ] Usage: `server_tool_use.web_search_requests` from `searchCount`, `web_fetch_requests` by count, summed into the final `message_delta.usage`
- [ ] `system/init.tools` checked against the expected list; `result.permission_denials` checked when `result` arrives and any entry the wrapper's hook did not issue logged as a misconfiguration
- [ ] Renderer: `server_tool_use`, `web_search_tool_result` and `web_fetch_tool_result` history blocks rendered as the spec states; replayed blocks accepted as sent
- [ ] Unit: translator goldens from the web-search and hook recordings; the policy; the renderer; integration through the SDK against the replay runner with a two-call search turn
- [ ] E2E (flag): a search with `allowed_domains` returning only allowed hosts; a fetch; and scenario 7, the hook client round trip through the control server
