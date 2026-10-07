# Conversation state and system prompt

Type: grilling
Status: resolved
Blocked by: 01, 02

## Question

How does a stateless `messages[]` history become upstream input each turn?

1. **History rendering**: replay the whole history into one prompt per turn (how are assistant turns, tool blocks, and multi-block content rendered so the model treats them as its own prior turns?), or map the client's conversation onto an upstream session and send only the new messages (needs a stable key, such as a hash of the history prefix as `CoreWrapper` does for system prompts today; what happens when the client edits history?).
2. **System prompt**: `--system-prompt` (replaces Claude Code's default, making upstream behave like a plain model) vs `--append-system-prompt`; how `system` as an array of blocks is joined. Consider the prior-art pitfall: since late September 2026 some wrappers get a server-side 400 "Third-party apps now draw from extra usage" that users bisected to appended system-prompt content ([Prior art](05-prior-art.md), pitfalls); the choice here may interact with it.
3. **Prompt transport**: stdin vs argument vs `--input-format stream-json`; the current `echo '...' |` approach breaks on quotes and large prompts.
4. **Consecutive same-role messages, empty content, and `cache_control`** handling.
5. Whether the wrapper-session extras (`/v1/sessions`, `session_id`) get any Anthropic-side equivalent at all.
6. **Images and documents**: image blocks reach upstream only through `--input-format stream-json` user content (probe-proven); PDF/document blocks were not probed. Decide whether images are supported (which fixes the transport), and whether unsupported block types return 400 or are dropped.

Record the chosen model on this ticket; if upstream sessions are reused across turns, that is ADR territory.

## Facts from research

- `-p` loads the user's whole `~/.claude` config, about 20k prompt tokens per run (1-hour cache). `--system-prompt` removes only ~4k of that, the model still self-identifies as Claude Code, and it forces a cache miss every turn; `--append-system-prompt` is cheap. On `--resume` the system prompt is frozen from the first turn unless `--system-prompt-snapshot off` ([CLI contract](02-cli-headless-io-contract.md) §4). A separate research ticket, [Minimal-context upstream run](16-minimal-context-upstream-run.md), asks how far that 20k can be cut.
- Stdin can be held open with one turn per stream-json message and a stable `session_id`; a prompt argument is text-only; close the child's stdin when the prompt is an argument or every run waits 3 s. Wrapper-minted `--session-id` UUIDs, `--resume` from any directory, `--fork-session`, and `--no-session-persistence` all work; a persisted session is ~115 KB on disk (§3, §5).
- The real API allows consecutive same-role messages and requires the first message to be `user` ([wire contract](03-messages-api-wire-contract.md) §1).

## Facts from the spike (2026-10-04)

From [Spike: round-trip one client tool call through upstream](06-spike-client-tool-round-trip.md).

- `--resume` of a session whose last turn was a parked-then-interrupted client tool call works: upstream had already closed the dangling `tool_use` with a rejection `tool_result` and a "[Request interrupted by user for tool use]" user text, so the API accepted the transcript; the next turn's result as user prose gave a coherent answer ("Based on the result you provided…"), one model call, `cache_read_input_tokens 1072`. If upstream sessions are reused across turns, that rejection text is what the model sees in its history.
- With identical flags (`--tools "" --setting-sources= --strict-mcp-config`, empty cwd, no CLAUDE.md, 2.1.289) the Agent SDK run carried about 2.1k prompt tokens and the raw `-p` run about 9.8k. The difference is the system prompt: the SDK's `initialize` frame sent `systemPrompt: [""]`, i.e. the SDK defaults to an **empty** system prompt where `-p` keeps Claude Code's default. The model answered normally in both. Lead for question 2 and for [Minimal-context upstream run](16-minimal-context-upstream-run.md): `--system-prompt ""` on the raw CLI may reach the same floor; what it does to self-identification is unmeasured.
- Both drivers took the prompt as a `stream-json` user message on stdin; no quoting or size issue.

## Decided in Tool bridge strategy (2026-10-04)

- The bridge needs a run to survive only while parked. Whether the run also serves the following ordinary turns (close after `end_turn`, or keep it as the conversation's run) is this ticket's decision.
- The history renderer must render past `tool_use`/`tool_result` pairs as history; the same path is the fall-through when a `tool_result` names ids with no parked run (TTL, restart).
- `tool_result` content is text and image only until this ticket decides whether `document` blocks are supported in user content at all.
- Edits to earlier history on the turn that resumes a parked run are ignored by design (decision 11). See [Tool bridge strategy](07-tool-bridge-strategy.md).

## Answer

Resolved 2026-10-04 with the human, one grilling round, every recommendation taken. Recorded as [ADR 0002](../../../docs/adr/0002-conversations-continue-an-upstream-session-by-fingerprint.md). Vocabulary added to `GLOSSARY.md`: fingerprint, continued turn, replayed turn.

### Decisions

| # | Decision |
| - | - |
| 1 | **Continuity model: continue the upstream session.** A request is matched to the upstream session that produced its last assistant message and only the new user message is sent (a *continued turn*). Upstream's own transcript is the history: real assistant turns, the bridge's real `tool_use`/`tool_result` pairs, thinking with signatures. When nothing matches, a fresh run receives the history rendered into the prompt (a *replayed turn*). The replayed turn is also the lost-park fall-through of [Tool bridge strategy](07-tool-bridge-strategy.md) decision 6. |
| 2 | **Run lifetime.** A run ends after `end_turn`. The upstream session is persisted, and the next continued turn starts a new run with `--resume <session_id>`. A run is held open only while parked. A hot cache of idle processes is outside the first spec. Measured: spawn to `system/init` 0.7 to 1.0 s (spike); resume restores the full history including tool calls; `--mcp-config`, `--model` and all other flags are passed again on every run. |
| 3 | **Matching rule.** Per upstream session the wrapper records the normalised transcript exchanged so far: the client's messages as normalised (decision 8) plus the assistant message the wrapper returned. A request continues session S iff normalised `messages[0..n-1]` equals S's transcript exactly and the tail is exactly one user message carrying no `tool_result` block. Not in the key: `system` (sent fresh every run), `model` (`--model` on every run), `tools` (bridge server re-mounted per run; a stale `tool_use` in history is legal API-side). Everything else (edited or truncated history, regenerate, multi-message tail, wrapper restart, map expiry) is a replayed turn. The map lives in memory; an entry expires after 24 h idle (configurable) and expiry deletes upstream's transcript file. No `--fork-session` on a shorter prefix in the first spec. |
| 4 | **Rendering a replayed turn.** One stream-json user message. It opens with a `<conversation_history>` block of `<turn role="user\|assistant">` children: text verbatim; `tool_use` as `<tool_use id="…" name="…">{input JSON}</tool_use>`; `tool_result` as `<tool_result tool_use_id="…" is_error="true\|false">…</tool_result>`; images as real `image` blocks inline (the content array mixes text and image blocks); `thinking` and `redacted_thinking` dropped; server-tool replay blocks as [Web search and built-in tools policy](08-web-search-and-built-in-tools-policy.md) decides. The block carries one sentence stating that these are the earlier turns of this conversation and that the assistant turns are the model's own, so the system prompt stays exactly the client's. The final user message's blocks follow verbatim. |
| 5 | **System prompt: replace.** The upstream system prompt is exactly the client's `system`: a string as-is, text blocks joined with a blank line, empty when absent (`--system-prompt` on the raw CLI, `systemPrompt` on the Agent SDK). `--system-prompt-snapshot off` on every run so the current turn's text applies on resume. No wrapper preamble. The raw CLI's token floor with an empty replacement is [Minimal-context upstream run](16-minimal-context-upstream-run.md)'s measurement and an input to [Module layout and seams](13-module-layout-and-seams.md); on the SDK driver it is measured free (about 2.1k tokens). The billing-gate facts in the map's Notes are recorded without a stance. |
| 6 | **Config isolation.** `--setting-sources=` (empty), `--strict-mcp-config`, run from one wrapper-owned empty directory so every upstream session lands in a single project dir under `~/.claude/projects/`. `~/.claude` is inherited only for credentials and session storage: no CLAUDE.md, skills, plugins, hooks or user permission defaults reach a run. Tool and permission flags are [Web search and built-in tools policy](08-web-search-and-built-in-tools-policy.md)'s. |
| 7 | **Transport.** `child_process.spawn` with no shell: `-p --input-format stream-json --output-format stream-json --verbose --include-partial-messages`. The turn is one `user` message carrying the normalised content-block array; stdin is closed after the turn's `result` unless the turn parked. The child environment is passed through unchanged; curating it belongs to [Process lifecycle and concurrency](19-process-lifecycle-and-concurrency.md). |
| 8 | **Normalisation and validation.** Table below; applied before fingerprinting and rendering. |
| 9 | **Images and documents.** `image` with a base64 source: supported on both paths (history images are rendered as real blocks). `image` with a `url` source and `document` blocks with base64 PDF or text sources: passed through to upstream if [Image and document block pass-through upstream](18-image-and-document-pass-through-upstream.md) shows upstream forwards them, otherwise 400. `file` sources (Files API is out of scope), `search_result`, `document` `content`/`url` sources unless the same probe clears them, and any block upstream drops or substitutes: 400 `invalid_request_error` naming the block type. Nothing is dropped silently. Size limits are forwarded; upstream's API error maps through [Error envelope and auth](12-error-envelope-and-auth.md). |
| 10 | **Wrapper sessions.** No Anthropic-side equivalent. `/v1/sessions` and the `session_id` body field stay on the OpenAI surface; `metadata.user_id` is accepted and ignored; upstream sessions are invisible to clients. No path collision, so the conflict rule is not triggered. |
| 11 | **ADR 0002** recorded (link above). Run lifetime is a consequence in it, not its own ADR. |
| 12 | **Vocabulary** adopted: fingerprint, continued turn, replayed turn. |
| 13 | **Probe batch released** by the human: [Minimal-context upstream run](16-minimal-context-upstream-run.md), [MCP tool name limits upstream](17-mcp-tool-name-limits-upstream.md) and the new [Image and document block pass-through upstream](18-image-and-document-pass-through-upstream.md) fired as one research pass on 2026-10-04. |

### Normalisation and validation (decision 8)

| Input | Rule |
| - | - |
| Consecutive same-role messages | merged into one message (real API semantics) |
| String content | one `text` block |
| First message not `user` | 400 `invalid_request_error` |
| Last message `assistant` (prefill) | 400 with the API's text: "This model does not support assistant message prefill. The conversation must end with a user message." |
| Empty `content: []` or an empty text block | 400 (API: text `minLength` 1) |
| `role: "system"` inside `messages` | 400 (model-gated feature with no upstream path) |
| `cache_control` anywhere | accepted, ignored |
| `thinking` / `redacted_thinking` in history | accepted, dropped: continued turns never need them, replayed turns cannot carry signatures |
| `tool_use` in assistant history, `tool_result` at the head of the last user message | bridge when a park matches ([Tool bridge strategy](07-tool-bridge-strategy.md) decisions 3, 4), else a replayed turn (decision 6) |
| `server_tool_use`, `web_search_tool_result` replay blocks | accepted; rendered form per [Web search and built-in tools policy](08-web-search-and-built-in-tools-policy.md) |

Exact error strings and the envelope belong to [Error envelope and auth](12-error-envelope-and-auth.md).

### Boundaries handed to other tickets

- [Streaming fidelity](09-streaming-fidelity.md): every turn is its own run, so a continued turn's `message_start`…`message_stop` come from the resumed run and a `system/init` opens every run. Per-turn usage comes from `message_delta.usage` / `result.usage`, never from `total_cost_usd` or `modelUsage`, which include totals restored on resume.
- [Model and parameter mapping](11-model-and-parameter-mapping.md): `--model` on every run including resume (the model may change mid-conversation); `metadata.user_id` accepted and ignored; the usage caveat above.
- [Error envelope and auth](12-error-envelope-and-auth.md): the 400 cases in decisions 8 and 9.
- [Module layout and seams](13-module-layout-and-seams.md): one process per turn plus parked ones. Three seams fall out: a pure normaliser and fingerprint, a pure history renderer, and the session map (state with expiry). Runner requirements added to the bridge's: `--resume`, `--system-prompt` with `--system-prompt-snapshot off`, `--setting-sources=`, a fixed cwd. The replacement system prompt is free on the SDK driver and unmeasured on raw until ticket 16 reports.
- [Web search and built-in tools policy](08-web-search-and-built-in-tools-policy.md): the renderer needs a rendered form for `server_tool_use`/`web_search_tool_result` replay blocks; tools are re-mounted per run so a turn's `tools[]` alone decides that run's WebSearch and bridge configuration; there is no wrapper preamble, so any guidance to the model about search goes in-band or not at all.
- [Process lifecycle and concurrency](19-process-lifecycle-and-concurrency.md) (graduated from fog by this decision): timeouts, caps, teardown, child environment, disk retention beyond the 24 h map expiry.
- [Minimal-context upstream run](16-minimal-context-upstream-run.md): now also measures `--system-prompt ""` under the decided flags, and self-identification.
- [Image and document block pass-through upstream](18-image-and-document-pass-through-upstream.md): new research ticket, decides which sources decision 9 supports.

### Primary sources

CLI facts: [CLI headless I/O contract](02-cli-headless-io-contract.md) §3 to §5 (stream-json input, images, system prompt, snapshot, sessions). Context sizes and startup timings: [Spike](06-spike-client-tool-round-trip.md), `../spike/runs/*.summary.json`. Prior-art rendering and pitfalls: [Prior art](05-prior-art.md), the Anthropic-surface projects and "Operational pitfalls". API message rules: [wire contract](03-messages-api-wire-contract.md) §1.

## Facts found after resolution (2026-10-04, [Minimal-context upstream run](16-minimal-context-upstream-run.md))

- Decision 5 holds and is cheap on the raw CLI too: `--system-prompt ""` with the decision 6 and 7 flags sends 493 input tokens per run, `"You are a helpful assistant."` 503. `--system-prompt-snapshot off` adds nothing and is required for new system text to apply on `--resume` (default `on` ignores it, measured).
- Decision 6 needs no `--safe-mode` or `--disable-slash-commands`; they change zero tokens once `--setting-sources=` and `--tools ""` are set.
- **Qualification of "exactly the client's system".** Upstream prepends `You are a Claude agent, built on Anthropic's Claude Agent SDK.` to whatever `--system-prompt` passes and injects six `<system-reminder>` blocks into the first user turn of a session (environment incl. cwd, model identity and knowledge cutoff, remaining token budget, USD budget, date, and `session_context` carrying the account owner's email); on resume only the budget and token reminders recur. The model therefore self-identifies as "Claude, built on Anthropic's Claude Agent SDK" and knows the operator's email. The spec must document this residual context as a known deviation from a pure model endpoint, and the email as a disclosure risk on a multi-client surface. Whether `CLAUDE_CODE_SIMPLE=1` or a client `system` instruction suppresses either is [Residual upstream context and the account-email reminder](20-residual-upstream-context-and-account-email.md), unfired.

## Facts found after resolution (2026-10-04, [Image and document block pass-through upstream](18-image-and-document-pass-through-upstream.md))

- **Decision 9 resolved.** Supported in user content on both paths: `image` with `base64`; `document` with `base64` PDF, `text` and `content` sources, including `title`, `context` and `citations: {enabled}` (citations must be enabled on every document block in the upstream history or none, else the API 400s; the citation arrives only as a `stream_event` `citations_delta`, which is [Streaming fidelity](09-streaming-fidelity.md)'s to relay). 400 `invalid_request_error` naming the block type: `image`/`url`, `document`/`url` (forwarded by the CLI, rejected by the API with "Unable to download the file" on every host tried), `file` sources, `search_result`. The renderer for replayed turns includes document blocks as real blocks, like images.
- **Error turns and the fingerprint map (implied by decision 3, flagged for the human).** An API 400 leaves the rejected user message in upstream's transcript with no assistant reply, and the run's `result` is `subtype: success` with `is_error: true`. A turn that ends in an upstream error therefore does not update the session's recorded transcript, and its upstream session is forgotten (entry dropped, transcript deleted) so the client's retry is a replayed turn rather than a resume onto a dangling message. The alternative, `--resume-session-at` the last good message, is a later refinement.

## Facts found after resolution (2026-10-04, [Residual upstream context and the account-email reminder](20-residual-upstream-context-and-account-email.md))

The residual context (prefix sentence plus environment, model, date and account-email reminders) cannot be removed on the subscription login: every documented knob either does nothing, drops only the budget reminders, refuses the login, or silently changes the model. The model quotes the account email on a direct ask unless the system prompt forbids it. Decision 5 ("exactly the client's system") therefore leaves the disclosure to the client's own instructions; whether the wrapper adds a non-disclosure line of its own is [Mitigating the account-email disclosure](22-mitigating-the-account-email-disclosure.md).

## Comments

- 2026-10-07, from [MCP connector passthrough](15-mcp-connector-passthrough.md) decision 5: decision 4's replayed-turn renderer gains two block kinds, `<mcp_tool_use server="…" name="…">` and `<mcp_tool_result tool_use_id="…" is_error="…">`, rendered like `tool_use`/`tool_result`. `mcp_servers` joins `tools` in the "not in the key" list of decision 3.
- 2026-10-07, from [Mitigating the account-email disclosure](22-mitigating-the-account-email-disclosure.md): decision 5 ("exactly the client's `system`") is **not** amended; the account-email disclosure is mitigated by output redaction in the translator, so the residual-context qualification above should point there rather than to a system-prompt instruction.
