# 26: Fixture recordings: copy, scrub, guard test

Spec: [spec.md](../spec.md), Testing Decisions

**What to build:** Every recorded upstream transcript from the research probes and the spike is available to the test suites as a fixture, with the operator's account email, display name and full name replaced by placeholders, and the suite refuses to run if any fixture still carries a live value.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A scrub script in the test scripts directory copies the recordings (the research probe recordings and their transcript copies, the spike's wire recordings) into an upstream subdirectory of the fixtures directory, replacing the account email with `user@example.invalid` and the display and full names with `Example User`; the live values are read from the CLI's account file at scrub time and never hard-coded
- [ ] The script is idempotent and re-runnable when new recordings are added
- [ ] A guard test runs before the unit suite and fails if any fixture contains the live values read from the account file; it skips with a notice when no account file exists
- [ ] A fixture index (one line per recording: name, what it shows, which spec section) so later tickets pick fixtures by name
- [ ] The seventeen recordings known to carry the address are verified scrubbed, including every SDK spike run

## Comments

- 2026-10-07, before the planning commit: the address was replaced with `user@example.invalid` in place in every file under `.scratch/` that carried it, so no committed source carries a live value. That was 20 files, not 17: the seventeen recordings plus `issues/20-*.md`, `research/minimal-context-upstream-run.md` and `research/residual-upstream-context.md`. The display name and full name appeared nowhere. The script still has to read the live values from the account file and scrub, because new recordings will arrive unscrubbed.
- The address can be split across streaming deltas. In `r2-exclude-dynamic.jsonl`, `r3-baseline-disclosure.jsonl`, `r5-disable-attachments-env.jsonl` and `r6-nonessential-traffic-env.jsonl` it arrived in two or three `text_delta` chunks, so a plain string replace misses it. The scrub, and the guard test, must join the delta text of each stream before searching. Rewrite the first chunk's fragment as the placeholder and empty the fragments in the later chunks. That keeps the delta count and every line's JSON intact. The SDK wire recordings carry each frame as a JSON string inside a `frame` field, so the scrub has to decode one level of nesting.
