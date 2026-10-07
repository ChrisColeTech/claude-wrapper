# 41: Connectors

Spec: [spec.md](../spec.md), section 9

**What to build:** With the operator's connector host list set, a beta client's `mcp_servers` reach upstream as remote MCP servers beside the bridge server, their calls come back as `mcp_tool_use` and `mcp_tool_result` blocks, and every rule of the real API's validation plus the surface's own is enforced before spawn.

**Blocked by:** 35 (Web search and web fetch), 38 (count_tokens)

**Status:** resolved

- [x] The connector host list setting (default off, `*` allows all); off, or a host outside the list, is 400 naming the setting
- [x] The beta gate: `mcp_servers` or an `mcp_toolset` without `mcp-client-2025-11-20` is 400 "Extra inputs are not permitted"
- [x] Validation: `type` is `url`, the url is `https`, names unique, one toolset per server and every toolset naming a declared server, no server named `client`
- [x] Planning: one `http` entry per enabled server in the per-run config file with the Bearer header when given, `alwaysLoad: true` and the connector timeout (default 60 s); `--allowedTools` additions per `allowed_tools`; `defer_loading` and `configs` ignored; every server `connected` in `system/init` else a pre-commit 400 naming it with the init error text
- [x] Translator: the connector pass (`mcp__<server>__<tool>` to `mcp_tool_use` with `server_name` split out, `mcp_tool_result` from the `user/tool_result` frame); a connector call separates model calls like a built-in, no park
- [x] Renderer: the two block kinds; `count_tokens` mounts connectors
- [x] Secrets: the token only in the `0600` file, redacted in logs, removed at teardown
- [x] Unit and integration through the beta SDK client against the replay runner (the connector recording is made in the e2e below and scrubbed into the fixtures)
- [x] E2E (flag): scenario 9, a round trip against a real `https` MCP server, including the not-connected failure path

## Comments

- Resolved by merge 9d093ba on anthropic-compat-api.
- The E2E criterion is ticked on scenario 9 being written (`app/tests/e2e/upstream/connectors.test.ts`, against the public `https://mcp.deepwiki.com/mcp`); its run against the real CLI is still pending.
- The connector fixtures are derived from bridge recordings, not recorded: `app/tests/fixtures/upstream/derived/connector-labels.wire.ndjson` and `connector-weather.wire.ndjson`. A real recording from scenario 9, scrubbed into the fixtures, replaces them.
- Reading: a connector name holds only `[A-Za-z0-9_-]` and no `__`, since upstream names the tools `mcp__<name>__<tool>` and the surface splits `server_name` back out on `__`; any other name is a 400.
- Reading: a pinned tool listing (an `mcp_toolset`'s `tools`, copied from an `mcp_tool_listing` block this surface never emits) is a 400.
- Reading: `enabled: false` (in `default_config` or a per-tool `configs` entry) is honoured through the `--allowedTools` rules; the one case those rules cannot express, a tool disabled by `configs` while the toolset is enabled by default and the server has no `tool_configuration.allowed_tools`, is a 400.
- Unproven risk: the CLI's MCP connect timeout (`MCP_TIMEOUT`, 30 s by default) is longer than the surface's 20 s startup timer, so a dead connector may surface as a 504 from the startup timer rather than the not-connected 400. Scenario 9's not-connected path should show which one happens.
- 2026-10-07/08: real-CLI run passed (`connectors.test.ts`, scenario 9, against DeepWiki). The whole-server `--allowedTools` rule works, and a dead connector reports `failed` in about 2.7 s. The real recordings replaced the derived fixtures in merge 4970909, and the rerun passed.
