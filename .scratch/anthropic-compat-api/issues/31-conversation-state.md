# 31: Conversation state

Spec: [spec.md](../spec.md), section 5, ADR 0002

**What to build:** A multi-turn conversation through the SDK: the second request with an unchanged history is a continued turn that resumes upstream's session and sends only the new message; an edited history, a regenerate, a restart or an expired entry is a replayed turn with the history rendered into the prompt; a turn that fails forgets its session.

**Blocked by:** 29 (Plain turn end to end)

**Status:** ready-for-agent

- [ ] Normalise and fingerprint: the canonical transcript per the normalisation table, hashed; `system`, `model`, `tools` and `mcp_servers` excluded from the key
- [ ] The sessions module: `lookup`, `record`, `forget`, a 24 h idle expiry and a 1,000-entry capacity (both configurable), LRU eviction as a forget, transcript deletion on forget; a parked-run registry slot for the client-tools ticket
- [ ] Matching rule: continue when normalised `messages[0..n-1]` equals the recorded transcript and the tail is one user message with no `tool_result`; the plan carries `--resume <session id>`; the recorded transcript is extended with the returned assistant message when the turn ends cleanly
- [ ] The replayed-turn renderer: one user message opening with the `<conversation_history>` block of `<turn>` children as the spec states for text, `tool_use` and `tool_result`, with the one-sentence self-description, then the final user message's blocks verbatim; extension points for the block kinds later tickets add
- [ ] Error-turn eviction: an upstream error, a cut, a post-commit failure, a mid-stream disconnect or a run ended before `result` forgets the session
- [ ] A wrapper restart replays every conversation's next turn (orphan transcript deletion at start is the lifecycle ticket's)
- [ ] Unit tests: fingerprint stability and exclusions, matching rule cases (edit, truncate, regenerate, multi-message tail), expiry and capacity with a fake clock, renderer goldens
- [ ] Integration: a three-turn conversation through the SDK against the replay runner where turn two resumes and an edited turn three replays
- [ ] E2E (flag): a continued turn against the real CLI; the resumed run's usage shows cache reads and the model refers to its own earlier answer
