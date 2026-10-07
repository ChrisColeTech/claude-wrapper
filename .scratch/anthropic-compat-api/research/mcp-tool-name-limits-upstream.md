# MCP tool name limits upstream (2.1.289)

Research for ticket `issues/17-mcp-tool-name-limits-upstream.md`. Date: 2026-10-04.
Upstream probed: `claude` 2.1.289 at `~/.local/share/mise/installs/claude/latest/claude` (`claude --version` → `2.1.289 (Claude Code)`, recorded in `cli-probes/q-tool-names-run1.summary.json` `version`), logged in with a Claude subscription (`apiKeySource: "none"`), model `claude-fable-5-1` (`cli-probes/q-tool-names-run1.wire.ndjson:3`).

## Verdict

**Claude Code neither truncates, aliases nor rejects long MCP tool names; it forwards `mcp__client__<name>` verbatim, and the Anthropic API rejects the whole request when that prefixed name exceeds 128 characters.** Upstream names of exactly 128 characters are accepted, called by the model with the exact name, and dispatched to the bridge server with the exact client name. The bridge prefix `mcp__client__` is **13** characters (the ticket says twelve; `printf '%s' mcp__client__ | wc -c` → 13), so the surface's effective limit for `tools[].name` is **115** characters.

Recommended rule for `tools[].name` on the Anthropic surface: `^[a-zA-Z0-9_-]{1,115}$`. Names of 116 to 128 characters are a 400 `invalid_request_error` raised by the wrapper before any run is spawned (see §5).

## 1. Method

- **Harness**: `cli-probes/q-tool-names.harness.mjs`, a standalone script (not the spike's `spike.mjs`) that imports the MCP SDK 1.32.0 from the spike's `node_modules` by absolute path, hosts a low-level `Server` + `StreamableHTTPServerTransport` named `client` serving JSON Schema verbatim (as [Tool bridge strategy](../issues/07-tool-bridge-strategy.md) decision 8 requires), spawns the CLI, records every stdin/stdout/stderr frame to `*.wire.ndjson`, every MCP HTTP request and `tools/list`/`tools/call` to `*.mcp-server.ndjson`, and a digest to `*.summary.json`.
- **Tools served** (names, lengths and prefixed lengths in `cli-probes/q-tool-names-run1.wire.ndjson:1`, the `meta` line): each with `input_schema` `{"type":"object","properties":{"label":{"type":"string"}},"required":["label"]}`, a description "Call this when asked to call the N-character tool …", `_meta: {"anthropic/alwaysLoad": true}`; handlers return `ok:<first 12 chars>` immediately.

  | key | client name | client length | upstream length (`mcp__client__` + name) |
  | - | - | - | - |
  | len064 | `len064_012345678901234567890123456789012345678901234567890123456` | 64 | 77 |
  | len100 | `len100_012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012` | 100 | 113 |
  | len115 | `len115_012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567` | 115 | **128** |
  | len128 | `len128_0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890` | 128 | **141** |
  | hyphen | `has-hyphens-in-name` | 19 | 32 |
  | twinA | `twin_shared_prefix_012345678901234567890123456789012345678901234_alpha` | 70 | 83 |
  | twinB | `twin_shared_prefix_012345678901234567890123456789012345678901234_bravo` | 70 | 83 |

  len115 is an addition to the ticket's 64/100/128 so one run could pin the boundary at an upstream length of exactly 128. twinA and twinB share their first 64 characters (first 77 once prefixed).
- **argv** (`cli-probes/q-tool-names-run1.summary.json` `args`): `-p --input-format stream-json --output-format stream-json --verbose --include-partial-messages --tools "" --setting-sources= --strict-mcp-config --permission-mode default --permission-prompts none --max-budget-usd 1 --no-session-persistence --mcp-config '{"mcpServers":{"client":{"type":"http","url":"http://127.0.0.1:<port>/mcp","alwaysLoad":true}}}' --allowedTools <comma list of the full mcp__client__ names>`. Run from the empty scratch cwd `…/scratchpad/probe-17/cwd`, never the repo; `CLAUDECODE`, `CLAUDE_CODE_ENTRYPOINT`, `CLAUDE_CODE_SSE_PORT`, `CLAUDE_AGENT_SDK_VERSION` stripped from the child env; own 180 s cap (SIGINT, then SIGTERM after 10 s); never `--dangerously-skip-permissions`.
- **Prompt** (`cli-probes/q-tool-names-run1.wire.ndjson:2`, one stream-json user message): "You have N tools from the "client" MCP server. Call each of the following tools exactly once, with input {"label": "x"}, all in a single response. Then reply with exactly the word: done", followed by the numbered list of full `mcp__client__…` names.
- **Two runs**, both on 2026-10-04: run 1 with all seven tools (`PROBE_MAX_LEN` default 128), run 2 with `PROBE_MAX_LEN=115`, which drops len128 and nothing else.

## 2. Run 1: the 141-character upstream name makes the API reject the request

`cli-probes/q-tool-names-run1.wire.ndjson` (7 lines), `q-tool-names-run1.mcp-server.ndjson`, `q-tool-names-run1.summary.json`.

- `system/init` (`run1.wire.ndjson:3`): `tools` lists all seven names **exactly**, including the 141-character `mcp__client__len128_…890` (per-name lengths 32, 77, 113, 128, 141, 83, 83, confirmed with `jq`), `mcp_servers: [{"name":"client","status":"connected","source":"dynamic"}]`, `mcp_server_errors: null`. No truncation, no alias, no rejection by Claude Code itself. Upstream re-sorted the list alphabetically (`has-hyphens…`, `len064…`, `len100…`, `len115…`, `len128…`, `twin…_alpha`, `twin…_bravo`), although the server listed them in the order `len064, len100, len115, len128, has-hyphens, twinA, twinB` (`run1.mcp-server.ndjson`, `tools/list served`).
- The model was never reached. The first API call failed and upstream emitted an `assistant` frame whose only content is the text `API Error: 400 tools.4.custom.name: String should have at most 128 characters` (`run1.wire.ndjson:5`), then `result` with `subtype: "success"`, `is_error: true`, `api_error_status: 400`, `stop_reason: "stop_sequence"`, `num_turns: 1`, `total_cost_usd: 0`, `usage` all zeros, `permission_denials: []` (`run1.wire.ndjson:6`), and exited with code 1 after stdin EOF (`run1.wire.ndjson:7`). stderr empty (`q-tool-names-run1.stderr.txt`). No `rate_limit_event` was emitted (frame types: one `system/init`, one `system/status`, one `assistant`, one `result`).
- `tools.4` in the API's message is the index in upstream's **sorted** `init.tools` order, where index 4 is `len128` (141 characters); in the client's own list it was index 3. Only one served name exceeded 128 characters, so the attribution is unambiguous regardless of order.
- The 128-character upstream name (`len115`) was in the same request and was not named by the error, so the API's limit is inclusive: at most 128 characters is accepted, 129 and up is not (141 observed).

## 3. Run 2: every name up to 128 upstream characters works end to end

`cli-probes/q-tool-names-run2.wire.ndjson` (67 lines), `q-tool-names-run2.mcp-server.ndjson` (21 lines), `q-tool-names-run2.summary.json`.

- `system/init` (`run2.wire.ndjson:3`): six names, all exact (`q-tool-names-run2.summary.json` `table[].initTools` = `exact` for every row), same `mcp_servers` status `connected`, `mcp_server_errors: null`.
- The model emitted all six `tool_use` blocks in **one** assistant message (`msg_011CfhQvG5JEEnvnTCRWXQvm`, `message_delta stop_reason: tool_use` at `run2.wire.ndjson:53`), then `done` in the second (`run2.wire.ndjson:66` `result.result: "done"`). Upstream dispatched the six MCP calls one at a time, as [Tool bridge strategy](../issues/07-tool-bridge-strategy.md) decision 4 describes.
- `result` (`run2.wire.ndjson:66`): `subtype: "success"`, `is_error: false`, `api_error_status: null`, `stop_reason: "end_turn"`, `num_turns: 7`, `permission_denials: []`, `total_cost_usd: 0.1575545`, `duration_ms: 6832`. Exit code 0 (`run2.wire.ndjson:67`). stderr empty.

### Per-tool table (run 2 unless stated)

| key | client length | upstream length | appears in `init.tools` as | called by the model as (`tool_use.name`) | received by the server as (`tools/call` `params.name`) | `tool_result.is_error` | denied? |
| - | - | - | - | - | - | - | - |
| len064 | 64 | 77 | exact (`run2.wire.ndjson:3`) | exact, 77 chars, `toolu_011miMHdG2F7bnPP9HwyuDs7` (`run2.wire.ndjson:16`) | exact client name, 64 chars, same `claudecode/toolUseId` (`run2.mcp-server.ndjson:11`) | false (`run2.wire.ndjson:21`) | no |
| len100 | 100 | 113 | exact (`:3`) | exact, 113 chars, `toolu_01KoHS3EwLsQ8TtfySAYauoe` (`:23`) | exact, 100 chars (`mcp-server:13`) | false (`:28`) | no |
| len115 | 115 | **128** | exact (`:3`) | exact, 128 chars, `toolu_01HPq129BiQ2dj3W6xadQPgd` (`:30`) | exact, 115 chars (`mcp-server:15`) | false (`:34`) | no |
| len128 | 128 | **141** | exact, run 1 only (`run1.wire.ndjson:3`) | never: API 400 before the model (`run1.wire.ndjson:5`) | never (`run1.mcp-server.ndjson` has no `tools/call`) | n/a | n/a (`permission_denials: []`, `run1.wire.ndjson:6`) |
| hyphen | 19 | 32 | exact (`:3`) | exact, `toolu_01P54WsQ9z8w9WyT4kW2QkLt` (`:37`) | exact `has-hyphens-in-name` (`mcp-server:17`) | false (`:41`) | no |
| twinA | 70 | 83 | exact (`:3`) | exact `…_alpha`, `toolu_019AhjQ9HXaB11MbST19KVkS` (`:44`) | exact `…_alpha` (`mcp-server:19`) | false (`:48`) | no |
| twinB | 70 | 83 | exact (`:3`) | exact `…_bravo`, `toolu_01FowMDUF3ojCBBbTZeZg9nt` (`:51`) | exact `…_bravo` (`mcp-server:21`) | false (`:56`) | no |

- **Twins**: the model called `…_alpha` and `…_bravo` as two distinct `tool_use` blocks with distinct ids, and the server received `_alpha` for the `_alpha` block's id and `_bravo` for the `_bravo` block's id (`run2.mcp-server.ndjson:19,21`, `_meta["claudecode/toolUseId"]`). Names identical for the first 64 (client) / 77 (upstream) characters are not confused anywhere in the chain.
- **Hyphen**: `-` passes through Claude Code, the API, the model and `--allowedTools` matching unchanged.
- **`--allowedTools` at 128 characters**: `permission_denials` is empty with the full 128-character name in the allow list, so permission matching is not length-limited below the API's limit.

## 4. Quota and cost

- Run 1: `total_cost_usd: 0`, no `rate_limit_event` emitted (the request was rejected before any model call; `run1.summary.json` `five_hour_before`/`after`: null).
- Run 2: `rate_limit_event` `unifiedWindows.five_hour.utilization` **0.26** after the first model call (`run2.wire.ndjson:55`) and **0.27** after the second (`run2.wire.ndjson:65`); `seven_day` 0.22 → 0.23. Cost by the CLI's estimate $0.158 for 2 model calls (`run2.wire.ndjson:66`). No earlier frame in the run carries utilisation, so 0.26 is the best "before" the run itself provides; the spike README recorded 0.07 at the end of ticket 06's runs earlier today, so the intervening tickets 16 and 18 account for the rest.
- Aside for [Minimal-context upstream run](../issues/16-minimal-context-upstream-run.md): with `--tools "" --setting-sources=` and six MCP tools the first `message_start` carried `cache_creation_input_tokens: 5738`, `input_tokens: 2` (`run2.wire.ndjson:5`).

## 5. Recommended validation rule for `tools[].name` on the surface

1. **Regex** `^[a-zA-Z0-9_-]{1,115}$`, i.e. the real API's `^[a-zA-Z0-9_-]{1,128}$` ([Messages API wire contract](messages-api-wire-contract.md) §"Client tool") with the maximum lowered by the 13-character bridge prefix `mcp__client__` (decision 8 fixes the server name `client`). 115 + 13 = 128, the longest upstream name run 2 proved end to end; 128 + 13 = 141 is what the API rejected in run 1.
2. **Reject before spawning.** A name of 116 to 128 characters is valid for the real API but can never be served by this surface; return 400 `invalid_request_error` with a message in the API's own form, `tools.<i>.custom.name: String should have at most 115 characters`, where `<i>` is the index in the client's `tools` array. Letting upstream fail instead costs a spawned process, an MCP handshake, an exit code 1 and a `result` whose `tools.4` index refers to upstream's alphabetically sorted list, not the client's order (§2).
3. **Everything else unchanged**: names of 1 to 115 characters from the API's alphabet, including `-`, need no mapping, no aliasing and no collision check beyond what the real API already requires (duplicate names, not probed here); the model and the bridge both see and return the exact name.
4. **If 115 is ever too tight**, the only lever is the bridge server name: the limit is `128 - len("mcp__<server>__")`. Renaming `client` would reopen decision 8 and is not recommended on this evidence.

## Probe file index

All under `cli-probes/`: `q-tool-names.harness.mjs` (the probe script, run as `node q-tool-names.harness.mjs run1` and `PROBE_MAX_LEN=115 node q-tool-names.harness.mjs run2` from the scratchpad), `q-tool-names-run1.wire.ndjson` / `.mcp-server.ndjson` / `.summary.json` / `.stderr.txt` (seven tools, API 400), `q-tool-names-run2.wire.ndjson` / `.mcp-server.ndjson` / `.summary.json` / `.stderr.txt` (six tools, full round trip). Wire lines are `{t_ms, dir, frame}` with `dir` one of `meta`, `host->cli`, `cli->host`, `cli-stderr`, `proc`; `frame` is the raw NDJSON line as a string.
