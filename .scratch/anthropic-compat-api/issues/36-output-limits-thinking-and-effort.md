# 36: Output limits, thinking and effort

Spec: [spec.md](../spec.md), section 12, ADR 0004

**What to build:** `max_tokens` binds with the real API's response shape, `stop_sequences` end the turn at the first match, thinking is accepted per model as the real API accepts it with Haiku's thinking switched as asked, and `output_config.effort` reaches upstream.

**Blocked by:** 31 (Conversation state)

**Status:** ready-for-agent

- [ ] The `max_tokens` cut: a relayed call's `message_delta {stop_reason: "max_tokens"}` closes the turn; the `cut` control signal makes the conductor interrupt and forget the session; later frames are ignored
- [ ] The stop-sequence scan over `text_delta` only, holding back the longest sequence minus one character and flushing at `content_block_stop`; on a match the text before it is relayed, the open block closed, `message_delta {stop_reason: "stop_sequence", stop_sequence}` emitted with the estimated `output_tokens`, then `message_stop`, interrupt and forget
- [ ] `thinking`: 5.x entries accept `adaptive` only, with the real API's messages for the rest; Haiku absent or `disabled` sets `CLAUDE_CODE_DISABLE_THINKING=1`, `enabled` sets `MAX_THINKING_TOKENS` after the budget checks; `display` ignored
- [ ] `output_config.effort` validated against the entry's capability and passed as `--effort`
- [ ] `result` never overrides a relayed `stop_reason`
- [ ] Unit: a translator golden for the output-cap recording (four capped calls become one cut turn), stop sequences split across deltas, the hold-back flush; planning tests for thinking and effort per model
- [ ] E2E (flag): scenario 2 (`MAX_THINKING_TOKENS` under a binding budget on Haiku), scenario 3 (`CLAUDE_CODE_DISABLE_THINKING=1` on a 5.x model), scenario 4 (the interrupt racing the auto-continuation after a cut, at most one extra capped call observed)
