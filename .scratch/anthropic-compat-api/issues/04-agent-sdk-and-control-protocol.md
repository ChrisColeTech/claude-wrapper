# Agent SDK and the stream-json control protocol

Type: research
Status: resolved
Blocked by: none

## Question

Is the `@anthropic-ai/claude-agent-sdk` package a better upstream driver than shelling out to the CLI, and how does it bridge client-defined tools? The tool bridge is the hardest decision on this map, and the SDK already solves a version of it for in-process tools. Resolve from primary sources: the Agent SDK docs (code.claude.com/docs/en/agent-sdk), the npm package source (install into the scratchpad; read `sdk.mjs` and `sdk.d.ts`), and the CLI's behaviour. Needed facts:

1. **How the SDK drives the CLI**: does it spawn the same `claude` binary or a bundled one, with which flags (`--input-format stream-json --output-format stream-json`, others)? Can it be pointed at the user's installed binary?
2. **In-process MCP tools**: how `createSdkMcpServer` and `tool()` work on the wire. Document the control protocol over stdin/stdout (`control_request`/`control_response`, `mcp_message`, `initialize`, `can_use_tool`, `hook_callback`, `interrupt`, `set_permission_mode`, `set_model`): message shapes, ordering, and whether a tool handler can block for an arbitrarily long time (long enough for an HTTP round trip to a client and back).
3. **Streaming input mode**: how several user messages are sent into one run, how a run idles between them, and how it is ended.
4. **`canUseTool` and hooks**: can the host intercept a built-in tool call (for example WebSearch) before and after execution and see its input and result?
5. **Sessions**: `resume`, `forkSession`, `continue`, `persistSession`, and session ids.
6. **Auth**: does the SDK pick up the CLI's existing subscription login (OAuth/keychain) or require `ANTHROPIC_API_KEY`? Quote the docs and any terms that bear on using a Claude subscription through the SDK or the CLI from another program.
7. **Partial messages**: does the SDK expose `includePartialMessages` and the raw API `stream_event`s?
8. **Costs of adoption**: package size, Node version, how it pins the CLI version, and whether it can coexist with the user's `mise`-installed CLI.

If you run the SDK, at most three probes, one-line prompts, from the scratchpad directory, never with permissions bypassed.

Write findings to `.scratch/anthropic-compat-api/research/agent-sdk-and-control-protocol.md`, citing the doc URL or source file for each claim.

## Answer

- The SDK (`@anthropic-ai/claude-agent-sdk@0.3.289`) is a thin driver: it spawns a `claude` subprocess with `--output-format stream-json --verbose --input-format stream-json` (never `-p`) plus flags derived from options, and talks newline-delimited JSON over stdio. By default it runs a bundled 246 MB native binary (2.1.289, pinned to the package version); `pathToClaudeCodeExecutable` points it at any binary, and two probes ran the mise-installed 2.1.284 successfully.
- Client-tool bridging has a ready-made channel: `createSdkMcpServer`/`tool()` register in-process MCP servers announced in the first `initialize` control request (not `--mcp-config`); each call arrives as `{"type":"control_request","request_id","request":{"subtype":"mcp_message","server_name","message":<JSON-RPC tools/call>}}` with `_meta["claudecode/toolUseId"]` = the `tool_use` block id, and the host replies `{"type":"control_response","response":{"subtype":"success","request_id","response":{"mcp_response":<JSON-RPC result>}}}`.
- Blocking: the SDK has no handler deadline; the CLI's per-call limit is the server `timeout` (>= 1000 ms) else `MCP_TOOL_TIMEOUT` else a default the 2.1.284 binary sets to 1e8 ms (~28 h; the env-vars page says 10 min, the MCP page says ~28 h); sdk servers have no idle timer; the run has no top-level timeout. An 8 s block was waited out silently.
- Other control subtypes (CLI->SDK: `can_use_tool`, `hook_callback`, `mcp_message`, `elicitation`; SDK->CLI: `initialize`, `interrupt`, `set_permission_mode`, `set_model`, `mcp_set_servers`, ...) share the same envelope; `control_cancel_request` withdraws one.
- Streaming input: a string prompt is written as one `user` line; an `AsyncIterable` keeps stdin open, each message starts a turn, one `result` per turn, `session_state_changed idle` between turns; stdin EOF ends the run (CLI exited ~1 s later). `canUseTool`/hooks/in-process servers also keep stdin open for a string prompt until the run ends.
- Built-in tools are fully visible: `assistant` tool_use blocks and `user` tool_result (+ `tool_use_result`) frames, and `PreToolUse`/`PostToolUse` hooks with `tool_input`/`tool_response` (default 600 s hook timeout; hooks can rewrite input/output). `canUseTool` fires only when the permission flow reaches a prompt and has no deadline.
- Sessions: `resume`, `continue`, `forkSession`, `persistSession`, `sessionId`, `resumeSessionAt` map to `--resume=`, `--continue`, `--fork-session`, `--no-session-persistence`, `--session-id=`, `--resume-session-at=`; ids appear on `system/init` and every frame; transcripts under `~/.claude/projects/<encoded-cwd>/*.jsonl`.
- Auth: the SDK sets no credential; the CLI applies its precedence list (API key env > ... > `/login` subscription OAuth). Probe: with no key env the run used the subscription login (`apiKeySource: "none"`, `rate_limit_event` frames). Docs/terms: Agent SDK use is under the Commercial Terms; the legal page says OAuth is "intended exclusively for purchasers of ... subscription plans ... for ordinary use of Claude Code and other native Anthropic applications", developers "should use API key authentication", third parties may not "route requests through Free, Pro, or Max plan credentials on behalf of their users", while an end user may sign in to the unmodified binary with their own subscription; the support article says SDK/`claude -p`/third-party use "still draw from your subscription's usage limits".
- Partial messages: `includePartialMessages` -> `--include-partial-messages`; `stream_event` frames wrap raw Messages API events (`message_start` ... `message_stop`).
- Cost: 5.3 MB ESM package, Node >= 18, peers `@anthropic-ai/sdk`, `@modelcontextprotocol/sdk`, `zod@4` (287 MB node_modules incl. the 235 MB binary); coexists with the mise CLI via `pathToClaudeCodeExecutable`; one subprocess (~230 MB idle) per held run.
- Not determined: the CLI's upper clamp on the MCP timeout (`Sm`); which `MCP_TOOL_TIMEOUT` default doc is current; blocks longer than 8 s; why stream-json works without `-p`.

Full findings: .scratch/anthropic-compat-api/research/agent-sdk-and-control-protocol.md
