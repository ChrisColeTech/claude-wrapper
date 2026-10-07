# MCP connector passthrough

Type: grilling
Status: resolved
Blocked by: 07

## Question

Should the Anthropic surface honour the API's MCP connector (`mcp_servers[]` plus a `mcp_toolset` tool, beta-only behind an `anthropic-beta` header per the [wire contract](03-messages-api-wire-contract.md)) by passing the servers to upstream via `--mcp-config` (`--strict-mcp-config` to exclude the user's own servers), and how does that coexist with the tool bridge's own MCP server if the bridge uses `--mcp-config` too? Also decide whether a request without the beta header that sends `mcp_servers` gets a 400 as the real API does. Lowest priority on the map; graduated from the fog once both wire contracts were known.

## Facts from the spike (2026-10-04)

From [Spike: round-trip one client tool call through upstream](06-spike-client-tool-round-trip.md).

- On the raw-CLI path the bridge's own server is one `--mcp-config` entry (`{"type":"http","url":...,"alwaysLoad":true}`) under `--strict-mcp-config`; `--mcp-config <configs...>` takes several, so client-supplied connectors could sit beside it. On the SDK path the bridge server is in-process (`mcpServers: {bridge: sdkServer}`) and the same map can hold `http`/`sse`/`stdio` entries for client connectors.
- `alwaysLoad: true` was needed so the bridge tool is in the first prompt rather than behind tool search; whether connector tools should be deferred is a separate choice.

## Decided in Tool bridge strategy (2026-10-04)

- Now unblocked. The bridge server is one MCP server with the fixed name `client`, mounted per run (in-process, or an `http` entry under `--strict-mcp-config`); connector servers from `mcp_servers[]` would be additional entries beside it, and a client connector named `client` must be rejected or renamed. See [Tool bridge strategy](07-tool-bridge-strategy.md) decision 8.

## Decided in Model and parameter mapping (2026-10-07)

- Unknown and beta-only top-level body fields are 400 "Extra inputs are not permitted" (decision 12). `mcp_servers`, and the `mcp_toolset` entries in `tools`, are exempt to whatever extent this ticket accepts them; whatever it rejects should use the same message, via [Error envelope and auth headers](12-error-envelope-and-auth.md).

## Decided in Error envelope and auth headers (2026-10-07)

- Every `anthropic-beta` value is accepted and ignored at debug level, **except** `mcp-client-2025-11-20`, whose meaning (and whether its absence makes `mcp_servers` a 400) this ticket decides (decision 4). Any 400 this ticket defines uses the Anthropic envelope and `x-should-retry: false`.

## Decided in Module layout and seams (2026-10-07)

- Driver is the **raw CLI** (`spawn`, stream-json), so a client's `mcp_servers` can only reach upstream as `--mcp-config` entries; they would be produced in `app/src/anthropic/request/tools` beside the bridge server's own entry, written as a per-run `0600` config file, and carried in `RunSpec.flags`. The wrapper's control server (loopback HTTP for the bridge and hook endpoints) is not involved. Any `authorization_token` would therefore pass through a file the wrapper owns for the run's lifetime. See [Module layout and seams](13-module-layout-and-seams.md) decisions 1, 4, 6.

## Answer

Resolved 2026-10-07 with the human, one grilling round of six questions, every recommendation taken under one condition: **no client compatibility may be harmed**. Checked against the beta SDK types (`../spike/node_modules/@anthropic-ai/sdk/resources/beta/messages/messages.d.ts:2550-2666, 3329-3349`) and the SDK minimums ([wire contract](03-messages-api-wire-contract.md) §8): the synthesised `mcp_tool_use` and `mcp_tool_result` blocks carry exactly the fields `client.beta.messages` reads, ids are opaque to both SDKs, and every rejection is a well-formed 400 the SDKs raise as `BadRequestError`. One point was flagged to the human rather than buried: decision 1's default-off setting means a client that sends `mcp_servers` receives a 400 until the operator enables the connector host list; that is a deployment default, not a wire deviation, and the human accepted it. No ADR (a configuration default is easy to reverse). Vocabulary added to `GLOSSARY.md`: connector.

Facts new to this ticket:

- The real API's connector (beta) is `mcp_servers: [{type: "url", url, name, authorization_token?, tool_configuration?: {enabled?, allowed_tools?}}]`, each server referenced by exactly one `{type: "mcp_toolset", mcp_server_name, default_config?: {enabled?, defer_loading?}, configs?: {[tool]: {enabled?, defer_loading?}}}` entry in `tools`, gated by `anthropic-beta: mcp-client-2025-11-20`. Responses carry `mcp_tool_use {id, name, server_name, input}` and `mcp_tool_result {tool_use_id, is_error, content: string | TextBlock[]}`; clients replay `mcp_tool_use` (with `cache_control?`) and `mcp_tool_result` params. Newer beta blocks `mcp_tool_listing` and the tool-change blocks (`BetaRequestToolAdditionBlock` and kin) exist beside them (same file, `:2566-2580, :3361`).
- Upstream's MCP config entry for a remote server is `{type: "http" | "sse", url, headers?, timeout? (ms, ≥ 1000, overrides MCP_TOOL_TIMEOUT per server), tools?: [{name, permission_policy: always_allow | always_ask | always_deny}], alwaysLoad?}`; `alwaysLoad: true` keeps every tool in the first prompt (otherwise tools are deferred behind tool search) and "blocks startup until the server is connected (capped at the standard 5s connect timeout)" (`sdk.d.ts:1178-1193, 1290-1297, 1317-1331`). `system/init.mcp_servers[].status` is `connected | failed | needs-auth | pending | disabled` (`sdk.d.ts:1241`); invalid entries are listed in `init.mcp_server_errors` ([CLI contract](02-cli-headless-io-contract.md) §6). `MCP_CONNECT_TIMEOUT_MS` is read by the binary (ticket 13's `strings` listing).
- Upstream executes a connector's tools itself: the frames are a `tool_use` block named `mcp__<server>__<tool>` followed by a `user/tool_result` frame, the same shape as the spike's bridge calls (`../spike/runs/cli-http-happy.wire.ndjson`).

### Decisions

| # | Decision |
| - | - |
| 1 | **Honoured, opt-in per deployment.** An operator setting lists the connector hosts the wrapper may reach (`*` allows all); default off. Off, or a host outside the list → 400 `invalid_request_error` naming the setting. Reason: upstream connects from the operator's machine, so an unrestricted passthrough lets any client make that machine open connections inside its network, which the real API's connector (connecting from Anthropic) never does. When enabled, the feature is beta-gated like the real API: `mcp_servers`, or an `mcp_toolset` in `tools`, without `anthropic-beta: mcp-client-2025-11-20` → 400 "Extra inputs are not permitted" ([Model and parameter mapping](11-model-and-parameter-mapping.md) decision 12's wording, [Error envelope and auth headers](12-error-envelope-and-auth.md) decision 4's one consumed beta value). |
| 2 | **Validation before spawn**, mirroring the real API: `type` must be `url`; `url` must be `https`; `name` unique; every server referenced by exactly one `mcp_toolset` and every toolset naming a declared server; each violation a 400 stating the rule. The bridge adds one rule: a connector named `client` (the bridge server's fixed name, [Tool bridge strategy](07-tool-bridge-strategy.md) decision 8) is a 400; renaming would change `server_name` in the response. Remote tool names cannot be pre-validated against the 128-character limit on `mcp__<server>__<tool>` ([MCP tool name limits upstream](17-mcp-tool-name-limits-upstream.md)); an over-long one surfaces as upstream's API 400, pre-commit; documented. |
| 3 | **Mapping to the run.** One `--mcp-config` entry per enabled server, in the run's `0600` config file beside the bridge's ([Module layout and seams](13-module-layout-and-seams.md) decision 4): `{type: "http", url, headers: {Authorization: "Bearer <authorization_token>"} when given, alwaysLoad: true, timeout: <connector call timeout>}`, the timeout defaulting to 60 s and operator-configurable, so a dead connector yields an error `tool_result` the model can report instead of a turn that waits on the stall watchdog. `tool_configuration.enabled: false` → not mounted. `--allowedTools` gains `mcp__<name>` for a whole server, or one `mcp__<name>__<tool>` per entry when `allowed_tools` is set; anything else prompts and is denied under `--permission-mode default --permission-prompts none`. `default_config.defer_loading` and per-tool `configs` are accepted and ignored: with `--tools ""` there is no tool search, so a deferred tool would be unreachable. Before the first turn every declared server must read `connected` in `system/init.mcp_servers`; otherwise the turn fails pre-commit with 400 naming the server and the `init.mcp_server_errors` text (`needs-auth` included). `mcp_servers` is run-bound like `tools`: passed on every run, never part of the fingerprint, fixed on a resumed parked run. `--strict-mcp-config` stays, so the operator's own servers never load. |
| 4 | **Output rendering.** The translator synthesises the beta blocks as [Web search and built-in tools policy](08-web-search-and-built-in-tools-policy.md) synthesises server-tool blocks: a `tool_use` block named `mcp__<server>__<tool>` is relayed as `mcp_tool_use` with `name` and `server_name` split out and upstream's id kept, its `input_json_delta`s relayed as they arrive; the `user/tool_result` frame becomes one `mcp_tool_result` block (`tool_use_id`, `is_error`, text items as text blocks, other item types dropped and logged). A connector call separates two model calls exactly as a built-in does ([Streaming fidelity](09-streaming-fidelity.md) decision 2: that call's `message_delta`/`message_stop` suppressed, no park). No usage counters; the real API has none for MCP. |
| 5 | **Replay.** On a continued turn the blocks are already in upstream's transcript and match the recorded one. On a replayed turn the history renderer ([Conversation state and system prompt](10-conversation-state-and-system-prompt.md) decision 4) gains two block kinds, rendered like `tool_use`/`tool_result` with the server name carried: `<mcp_tool_use server="…" name="…">{input JSON}</mcp_tool_use>` and `<mcp_tool_result tool_use_id="…" is_error="…">…</mcp_tool_result>`. No content validation on replay. `mcp_tool_listing` and the tool-change block types are 400s naming the block, under Conversation state's rule for unsupported blocks. |
| 6 | **`count_tokens` and secrets.** `count_tokens` takes the same body, so connectors are mounted for the one-token run and their tool definitions count ([Model and parameter mapping](11-model-and-parameter-mapping.md) decision 11). The `authorization_token` lives only in the per-run `0600` file, is redacted from every log line, and is removed with the run directory at teardown. |

### Boundaries handed to other tickets

- [Process lifecycle and concurrency](19-process-lifecycle-and-concurrency.md): the connector connect wait (`alwaysLoad` blocks startup, capped by the 5 s connect timeout; `MCP_CONNECT_TIMEOUT_MS` is the knob) sits inside the startup timer; the per-server `timeout` (default 60 s) is a new operator setting beside the park TTL; the connector host list is a third (decisions 1, 3).
- [Module layout and seams](13-module-layout-and-seams.md) (resolved; comment added): `request/tools` emits connector entries and the `--allowedTools` additions; the translator gains an mcp-connector pass; `render` gains two block kinds; e2e scenario 9: a connector round trip against a real `https` MCP server (decisions 3, 4, 5).
- [Conversation state and system prompt](10-conversation-state-and-system-prompt.md) (resolved; comment added): the renderer's two new block kinds (decision 5).
- [Assemble the spec](14-assemble-spec.md): the three operator settings (host list, per-server timeout, and the beta gate's behaviour) belong in the configuration section.

### Primary sources

- `../spike/node_modules/@anthropic-ai/sdk/resources/beta/messages/messages.d.ts` (`BetaRequestMCPServerURLDefinition`, `BetaRequestMCPServerToolConfiguration`, `BetaMCPToolset`, `BetaMCPToolDefaultConfig`, `BetaMCPToolConfig`, `BetaMCPToolUseBlock`, `BetaMCPToolResultBlock`, `BetaRequestMCPToolResultBlockParam`, `BetaMCPToolUseBlockParam`, `BetaMCPToolListingBlock`).
- `../spike/node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts` (`McpHttpServerConfig`, `McpSSEServerConfig`, `McpServerToolPolicy`, server status).
- `research/messages-api-wire-contract.md` §1.1 (`mcp_servers`), §2.2; `research/cli-headless-io-contract.md` §1.3, §6; `../spike/README.md`, `../spike/runs/cli-http-happy.wire.ndjson`.
