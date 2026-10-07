# MCP tool name limits upstream

Type: research
Status: resolved
Blocked by: none

## Question

The Anthropic API accepts client tool names matching `^[a-zA-Z0-9_-]{1,128}$`. Under the bridge decided in [Tool bridge strategy](07-tool-bridge-strategy.md) every client tool reaches upstream as `mcp__client__<name>`, thirteen characters longer (the body originally said twelve; corrected on resolution). Does Claude Code 2.1.289 accept, truncate, alias or reject MCP tool names at the long end, and does the model still call them by the right name? Measure with one run: a bridge server listing tools whose names are 64, 100 and 128 characters (plus one with `-`), read `system/init.tools` and the `tool_use.name` the model emits, and check `permission_denials`. The spec needs the answer to set the validation rule for `tools[].name` on the surface (accept all 128, or 400 above some length).

Not fired automatically: it costs one upstream run on the human's subscription. It can ride along with [Minimal-context upstream run](16-minimal-context-upstream-run.md) when that is released, using the spike harness in `../spike/`.

Write findings to `.scratch/anthropic-compat-api/research/mcp-tool-name-limits-upstream.md`, citing the run.

## Released (2026-10-04)

Released by the human on 2026-10-04 with [Minimal-context upstream run](16-minimal-context-upstream-run.md) and [Image and document block pass-through upstream](18-image-and-document-pass-through-upstream.md). The bridge server in `../spike/mcp-http-server.mjs` (raw CLI driver) or the SDK scenario in `../spike/spike.mjs` can list the long-named tools; one run. Hygiene as on ticket 18. Also record whether the model called the right name when two tools differ only beyond the 64th character.

## Answer

Resolved 2026-10-04 against `claude` 2.1.289, two runs (one $0 API rejection, one $0.158 round trip; five-hour window 0.26 → 0.27). Findings with per-tool table and citations: [MCP tool name limits upstream](../research/mcp-tool-name-limits-upstream.md); raw frames, server log and harness in `../research/cli-probes/q-tool-names-*`.

**Verdict.** Claude Code neither truncates, aliases nor rejects: `system/init.tools` listed every served name verbatim, including a 141-character `mcp__client__len128_…` (`q-tool-names-run1.wire.ndjson:3`). The Anthropic API then rejected the whole request, `API Error: 400 tools.4.custom.name: String should have at most 128 characters`, `result.api_error_status: 400`, `total_cost_usd: 0`, exit 1 (`run1.wire.ndjson:5-7`). Without that name, upstream names of 77, 113 and exactly 128 characters, a hyphenated name, and two names identical for their first 64 client characters were each called by the model with the exact `tool_use.name`, received by the bridge server with the exact client name and matching `claudecode/toolUseId`, with `permission_denials: []` (`q-tool-names-run2.*`). The limit is the API's 128, inclusive, applied to the prefixed name.

**Correction.** The prefix `mcp__client__` is 13 characters, not twelve, so the surface's ceiling is 115.

**Recommended rule.** `tools[].name` must match `^[a-zA-Z0-9_-]{1,115}$`. Names of 116 to 128 characters are a 400 `invalid_request_error` raised by the wrapper before any run is spawned, message `tools.<i>.custom.name: String should have at most 115 characters` with `<i>` the client's index (upstream's own 400 indexes its alphabetically re-sorted tool list, not the client's). No aliasing or mapping; `-` and long shared prefixes need nothing.
