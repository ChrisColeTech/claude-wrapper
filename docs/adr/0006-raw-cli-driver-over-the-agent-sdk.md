---
status: accepted
date: 2026-10-07
---

# Upstream is driven as a raw CLI process, not through the Agent SDK

The wrapper needs a runner that spawns Claude Code, speaks stream-json over stdio, hosts an MCP server for client tools, hosts a `PreToolUse` hook for web-tool limits, and can interrupt a run. The Agent SDK offers all of this in-process; the spike proved the raw CLI does the same with a wrapper-hosted HTTP MCP server, a command hook and a `control_request` on stdin, at equal bridge overhead and equal context cost. We decided to drive the raw CLI with `child_process.spawn`, taking `@modelcontextprotocol/sdk` as the only new runtime dependency, and to use the official `@anthropic-ai/sdk` only as a devDependency for compatibility tests. Every decision on the map is already expressed as flags, environment and frames, and the project already runs the mise-installed CLI that the user updates independently; the SDK would add three peer dependencies and a pinned CLI version, route JSON Schema through Zod unless its inner server is reached around, and put a layer we do not control between the spec's flags and the process.

## Considered options

- **Raw CLI** (chosen): full control of argv and environment, no version coupling, the spike's `bridge.mjs` and HTTP MCP server lift directly. Cost: a loopback control server, a hook client script, hand-written line framing and control-protocol matching (small), and two environment knobs (`CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT`, `MCP_TOOL_TIMEOUT`) to hold a park past the HTTP MCP idle timer.
- **Agent SDK with `pathToClaudeCodeExecutable`**: typed frames, in-process MCP and hooks, `interrupt()`. Cost: `@anthropic-ai/sdk`, `@modelcontextprotocol/sdk` and `zod` as peers plus a 235 MB bundled binary unless omitted, `sdkCompat` version ranges against a CLI that moves under mise, `extraArgs` for every flag the SDK does not model, and a high-level `McpServer` instance that must be reached into to serve schemas verbatim.

## Consequences

- The runner's interface (`startRun(spec) → Run`) is surface-neutral and mockable with recorded transcripts; the OpenAI surface could adopt it in a later effort.
- The wrapper hosts a loopback control server for the whole process lifetime; each run gets tokened MCP and hook paths, with the token in `0600` per-run files, never in argv.
- The hook is a child process per call (a thin HTTP client); its policy state lives in the wrapper.
- The stream-json control protocol is consumed directly, with the SDK's `sdk.d.ts` as its reference; `system/init.capabilities` is the feature-detection point when the CLI moves.
- Parks longer than the HTTP MCP idle default depend on the environment knob, which the e2e scenario list verifies.
