---
status: accepted
date: 2026-10-04
---

# Conversations continue an upstream session matched by transcript fingerprint

The Anthropic surface is stateless: every request carries the whole `messages[]` history and nothing identifies the conversation (no session header, because the official SDKs must work unmodified). Upstream (the Claude Code CLI) is stateful: each run persists a session that `--resume` restores with its real assistant turns, `tool_use`/`tool_result` pairs and thinking. We decided that the wrapper keeps a **fingerprint** of every conversation it has served (the normalised transcript it exchanged, keyed to the upstream session id) and, when a request's history matches one exactly and ends in a single new user message, serves a **continued turn**: a new run with `--resume` that sends only that message. When nothing matches (first turn, edited history, lost park, restart, expiry) it serves a **replayed turn**: a fresh run with the history rendered into the prompt. We chose this because it gives the model a history that is genuinely its own, charges a turn only for its new tokens plus cache reads, and reuses the fall-through the tool bridge already needs (ADR 0001); replay alone re-sends every turn's history as new user text and yields answers that treat the conversation as quoted material (the spike's hybrid run: "Based on the result you provided").

## Considered options

- **Continue by fingerprint, replay as the fall-through** (chosen).
- **Replay every turn**: a fresh run with the history rendered as text, what the prior-art Anthropic surfaces do. No state, but the model sees its past replies as quoted text, every turn re-sends the whole history, and tool and thinking blocks cannot be real.
- **Continue by a client-supplied key** (header, `metadata.user_id`, extra body field): breaks unmodified SDKs or conflates one user's parallel conversations. Rejected.
- **Keep the process alive between turns**: same fidelity, lower latency, but about 230 MB per idle conversation. Left as an optimisation outside the first spec.

## Consequences

- A run ends after `end_turn`; the only held-open runs are parked ones (ADR 0001). A continued turn pays a process start (0.7 to 1.0 s measured) and a prompt-cache read.
- Upstream sessions persist on disk (about 115 KB each) under one wrapper-owned project directory. The fingerprint map is in memory, expires after 24 hours idle, and expiry deletes the transcript. A wrapper restart makes every conversation's next turn a replayed turn.
- The fingerprint's normalisation (same-role merge, string to text block, thinking dropped, `cache_control` ignored) is a compatibility surface. Changing it invalidates every live fingerprint, which costs one replayed turn per conversation and nothing else.
- `system`, `model` and `tools` are not part of the key: the system prompt is sent fresh on every run (`--system-prompt-snapshot off`), `--model` and `--mcp-config` are passed on every run.
- The upstream system prompt is exactly the client's `system` (replaced, not appended), so a replayed turn's history block must describe itself inside the user message rather than rely on a wrapper preamble.
- A regenerate or an edit of earlier history is a replayed turn, not a fork. `--fork-session` on a shorter matching prefix is a possible later refinement.
