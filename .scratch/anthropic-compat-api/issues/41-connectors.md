# 41: Connectors

Spec: [spec.md](../spec.md), section 9

**What to build:** With the operator's connector host list set, a beta client's `mcp_servers` reach upstream as remote MCP servers beside the bridge server, their calls come back as `mcp_tool_use` and `mcp_tool_result` blocks, and every rule of the real API's validation plus the surface's own is enforced before spawn.

**Blocked by:** 35 (Web search and web fetch), 38 (count_tokens)

**Status:** ready-for-agent

- [ ] The connector host list setting (default off, `*` allows all); off, or a host outside the list, is 400 naming the setting
- [ ] The beta gate: `mcp_servers` or an `mcp_toolset` without `mcp-client-2025-11-20` is 400 "Extra inputs are not permitted"
- [ ] Validation: `type` is `url`, the url is `https`, names unique, one toolset per server and every toolset naming a declared server, no server named `client`
- [ ] Planning: one `http` entry per enabled server in the per-run config file with the Bearer header when given, `alwaysLoad: true` and the connector timeout (default 60 s); `--allowedTools` additions per `allowed_tools`; `defer_loading` and `configs` ignored; every server `connected` in `system/init` else a pre-commit 400 naming it with the init error text
- [ ] Translator: the connector pass (`mcp__<server>__<tool>` to `mcp_tool_use` with `server_name` split out, `mcp_tool_result` from the `user/tool_result` frame); a connector call separates model calls like a built-in, no park
- [ ] Renderer: the two block kinds; `count_tokens` mounts connectors
- [ ] Secrets: the token only in the `0600` file, redacted in logs, removed at teardown
- [ ] Unit and integration through the beta SDK client against the replay runner (the connector recording is made in the e2e below and scrubbed into the fixtures)
- [ ] E2E (flag): scenario 9, a round trip against a real `https` MCP server, including the not-connected failure path
