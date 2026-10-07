# Image and document block pass-through upstream

Type: research
Status: resolved
Blocked by: none

## Question

Which user content block sources does Claude Code 2.1.289 forward to the API when they arrive in a `--input-format stream-json` user message? Known: a base64 `image` block reaches the model ([CLI contract](02-cli-headless-io-contract.md) §3, probe e). Unknown, and needed by [Conversation state and system prompt](10-conversation-state-and-system-prompt.md) decision 9:

1. `image` with `source: {type: "url", url}`.
2. `document` with `source: {type: "base64", media_type: "application/pdf", data}` (a one-page PDF with a known sentence).
3. `document` with `source: {type: "text", media_type: "text/plain", data}`.
4. `document` with `source: {type: "url", url}` (a public PDF).
5. `document` with `source: {type: "content", content: [{type: "text", text}]}`.
6. Optional, if cheap: `title`, `context` and `citations: {enabled: true}` on a document block.

For each, record: whether the model saw the content (ask it to quote the known sentence or describe the image), whether the CLI substituted a text note (the SDK docs say a missing or malformed `source` becomes a text note and the session continues), whether the API returned a 400 (`system/api_retry` or `result.api_error_status`), the `message_start` input tokens, and the exact frames. Use the fewest runs: one run with stdin held open, one user message per block type, is enough; a 400 on one message may end the run, so order them cheapest-first and be ready for a second run.

Hygiene: run from a scratch directory, never the repo; `--tools "" --setting-sources= --strict-mcp-config --permission-mode default --permission-prompts none --max-budget-usd 1 --no-session-persistence`; close stdin at the end; own timeout; never `--dangerously-skip-permissions`. The spike's `../spike/spike.mjs` and `recorder.mjs` show the pattern (`node spike.mjs` scenarios build the exact argv). Note `claude --version` on the findings.

Decision rule this feeds (Conversation state decision 9): a source upstream forwards is supported on the surface; a source upstream drops, substitutes or that the API rejects is a 400 `invalid_request_error` naming the block type.

Released by the human on 2026-10-04 together with [Minimal-context upstream run](16-minimal-context-upstream-run.md) and [MCP tool name limits upstream](17-mcp-tool-name-limits-upstream.md).

Write findings to `.scratch/anthropic-compat-api/research/image-and-document-pass-through.md`, citing the run for each number, and save the raw frames beside it under `research/cli-probes/` with an `o-` prefix.

## Answer

Probed on `claude` 2.1.289, two streaming-input runs (eleven user messages, every echo byte-identical, no substitution, no `api_retry`). Findings with per-claim probe citations: [research/image-and-document-pass-through.md](../research/image-and-document-pass-through.md); raw frames and harness: `research/cli-probes/o-pass-through-run1.jsonl`, `o-pass-through-run2.jsonl`, `o-pass-through.harness.py`.

Forwarded and seen by the model (supported on the surface):

- `document` / `base64` PDF (quoted `tangerine-7`), `document` / `text` (`marigold-3`), `document` / `content` (`cobalt-9`), plus `title`, `context` and `citations: {enabled: true}` on a document (model named the title; the API streamed a `citations_delta`). Together with `image` / `base64` from probe e.
- Caveat: citations must be enabled on all document blocks across the whole upstream history or none (API 400 otherwise), and the citation arrives only in `stream_event` frames; the CLI's `assistant` frame has `citations: []` and `result.result` holds only the last text block.

Forwarded by the CLI but rejected by the API, so a 400 `invalid_request_error` naming the block type under decision 9:

- `image` / `url` and `document` / `url`: every attempt (six URLs, five hosts, including the PDF URL in Anthropic's own docs) returned `400 Unable to download the file`, no model call. Likely the URL fetcher is unavailable on Claude Code's API path; re-check with the run-2 message set if URL support ever matters.

Side observations: a 400 does not end the run (the process keeps serving stdin), its `result` has `subtype: "success"` with `is_error: true` and `api_error_status: 400`, and the rejected user message stays in the upstream history (`messages.9` in the citations error). Quota: five-hour utilisation 0.28 before, 0.33 after; CLI cost estimate $0.24 across both runs.
