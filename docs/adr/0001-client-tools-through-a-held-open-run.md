---
status: accepted
date: 2026-10-04
---

# Client tools run through a held-open upstream run

The Anthropic surface must end a turn with `stop_reason: tool_use` and take the client's `tool_result` on the next, stateless HTTP request, while upstream (the Claude Code CLI) wants to run its own loop to completion and silently drops `tool_result` blocks written to its stdin. We decided that the wrapper hosts a **bridge server** (an MCP server) that exposes the client's tools to upstream; when upstream calls one, the handler blocks, the turn is **parked** (ended with upstream's own `tool_use` message and stream events), and the run stays **held open** until a request arrives whose `tool_result` ids match, which resolves the handler and continues the same run. We chose this because it is the only design that gives the model a genuine `tool_result`, passes upstream's ids and stream events through unchanged, and adds under 10 ms per hop (measured in the spike under `.scratch/anthropic-compat-api/spike/`).

## Considered options

- **Held-open run** (chosen).
- **Replay run**: a fresh run per turn, history re-rendered as prose, the model asked to emit a structured tool call that the wrapper parses. What the OpenAI surface does today. No genuine `tool_use`, fragile parsing, history grows as text.
- **Hybrid**: real MCP tools for the current turn, interrupt once the call is captured, `--resume` the session on the next turn with the result as user text. Measured to work, but the transcript keeps upstream's rejection text and the model answers "Based on the result you provided".

## Consequences

- A parked run is a live subprocess (about 230 MB) per outstanding client tool round trip, bounded by a park TTL (default 10 minutes).
- Teardown must **interrupt the run before rejecting the handler**. Any other order hands upstream an error result and the model retries: an MCP timeout cost 3 model calls and closing stdin cost 4 in the spike.
- Upstream runs one assistant message's tool calls one at a time, so the surface parks as soon as the message is complete, returns every `tool_use` block, and keeps **pre-delivered results** for calls upstream has not asked for yet.
- Correlation is by upstream's `tool_use` ids alone. A lost park (TTL, restart) falls through to a fresh run with history replayed; edits to earlier history on the resuming turn are ignored.
- The bridge server serves the client's JSON Schema verbatim, never through Zod, and its per-call timeout must exceed the park TTL so upstream never times out first.
- Which upstream driver hosts the bridge (Agent SDK in-process server or raw CLI with an HTTP MCP server) is a separate decision; both satisfy the requirements above.
