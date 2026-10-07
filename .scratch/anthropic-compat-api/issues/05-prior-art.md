# Prior art: Anthropic surfaces over Claude Code

Type: research
Status: resolved
Blocked by: none

## Question

How have existing open-source projects exposed an Anthropic-compatible (or OpenAI-compatible) HTTP API on top of Claude Code, and what did each do about the tool bridge, streaming, and sessions? Sources are the projects' own repositories (code and READMEs, issues), not blog posts. Search GitHub for projects wrapping Claude Code or the Agent SDK as an API server (names to start from, verify they exist: claude-code-api, claude-code-proxy, claude-max-api-proxy, claude-code-openai-wrapper, ccproxy, anthropic-proxy variants, and anything newer). For each project worth recording:

1. Which surface(s) it offers and whether official SDKs work against it.
2. How it drives upstream (CLI subprocess, Agent SDK, `--input-format stream-json`).
3. **Tool bridge**: how client tools are handled (prompt engineering, MCP bridge, SDK tools, not at all) and whether tool results on the next turn work.
4. **Streaming**: real passthrough vs simulated chunking.
5. **Conversation state**: replay full history vs upstream sessions; how system prompts are passed.
6. **Web search**: whether it works and how it is surfaced.
7. Known pitfalls recorded in issues (shell escaping, timeouts, concurrency, auth or terms complaints, model names).

Keep it to the five or so most informative projects. The deliverable is a comparison table plus the two or three design lessons that matter most for the tool bridge.

Write findings to `.scratch/anthropic-compat-api/research/prior-art.md`, citing repo URLs and file paths for each claim.

## Answer

Resolved 2026-10-04. Fifteen projects surveyed (eleven read in depth), all from their own repositories and issue trackers; nothing was run.

1. **Real client tool calling with `tool_result` round trips has been solved, but only three times, all on the OpenAI surface, all through the Agent SDK's in-process MCP server**: openchamber/opencode-claude (★51, active), mazamaka/claudegate and cramt/claude-sub-proxy. Each registers client tools as SDK MCP tools whose handler awaits a promise or future, ends the HTTP turn with `tool_calls` while the upstream run stays blocked on the MCP response, and resolves the promise from the next HTTP request so the same run continues ("The CLI is happy to wait: it is blocked on an MCP response", claudegate). Nothing in their code or issues mentions the CLI itself timing out a parked call; the only timeouts are the wrappers' own (10 min to 1 h).
2. **Nobody has done it on an Anthropic `/v1/messages` surface, and nobody has done it while driving the raw CLI.** The three Anthropic-surface projects (AntonioAEMartins, MehdiMohseni82, jackhax) all run an **ended run**: placeholder MCP handler, harvest `tool_use`, kill or exhaust the run, replay history as prose next turn. The only CLI-driven attempt (AntonioAEMartins: stdio MCP child via `--mcp-config`) had to end the run because its handler cannot reach the wrapper's pending request; the CLI fed the placeholder back and started a second model call (#1). LiteLLM's `claude_code` harness declares `custom_tools=False`.
3. **Streaming**: AntonioAEMartins proves verbatim passthrough of upstream `stream_event` as Anthropic SSE works with `--include-partial-messages` (genuine `index`, `input_json_delta`, `stop_reason`); thhuang emits the named sequence for one text block; MehdiMohseni82 synthesises events when tools are present. RichardAtCT's `/v1/messages` never streams.
4. **Conversation state**: most replay history as text (`Human:`/`Assistant:`, `<previous_response>`, `[called tool …]`); openchamber (per-chat `resume`, fork on revert), wende (`--resume` with delta-by-count) and LiteLLM (`--resume`) use upstream sessions.
5. **Web search**: only MehdiMohseni82 maps `web_search_YYYYMMDD` to built-in `WebSearch`, and its capture loop appears to return the `WebSearch` `tool_use` instead of the answer. Everyone else disables built-ins or leaves them ungated.
6. **Pitfalls**: a server-side billing gate since late Sept 2026 returns 400 "Third-party apps now draw from extra usage" when appended system-prompt content is classified as a third-party app (openchamber #33, pi-packages #883), while Anthropic's article still says the metering change is paused; argv prompts hit E2BIG (RichardAtCT #3) and Windows shell escaping (wende); JSON Schema → Zod conversions emptied or narrowed tool schemas in four projects (AntonioAEMartins #5, openchamber #12); built-in `tool_use` forwarded to clients causes agentic loops (wende).

Design lessons: (a) hold the run open with the tool handler in the wrapper's own process (SDK control protocol or a wrapper-hosted MCP server in `--mcp-config`), with per-run TTL, stall watchdog and teardown that interrupts before rejecting; (b) key the pending-run map on upstream's own `toolu_…` ids and serve the client's JSON Schema verbatim; (c) disable built-ins when client tools are present and let the `mcp__` prefix separate client calls (park) from built-in calls such as WebSearch (continue), synthesising `message_delta`/`message_stop` on park.

Full findings: .scratch/anthropic-compat-api/research/prior-art.md
