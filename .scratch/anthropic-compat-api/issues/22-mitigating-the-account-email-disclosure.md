# Mitigating the account-email disclosure

Type: grilling
Status: resolved
Blocked by: 10, 20

## Question

Upstream injects the account owner's email (and environment, model and date reminders) into every session's first turn, nothing on the subscription login removes it ([Residual upstream context and the account-email reminder](20-residual-upstream-context-and-account-email.md)), and the model quotes the email on a direct ask unless the system prompt forbids it (refused in the one run with a "never disclose" instruction). [Conversation state and system prompt](10-conversation-state-and-system-prompt.md) decision 5 makes the upstream system prompt exactly the client's text. Decide, for a surface that may serve several clients on one operator's login:

1. **Who mitigates.** (a) Nobody: document the leak and warn operators in the README and spec. (b) The wrapper prepends a fixed one-line non-disclosure instruction to every system prompt, a measured dent in decision 5's purity (about 25 tokens, and it changes what the client's `system` means). (c) Same as (b) behind an operator flag, default on or default off.
2. **Wording and placement** if (b) or (c): before or after the client's text; whether it also covers environment, model and date.
3. **Verification**: one more run per wording is cheap; the single `r4` run is thin evidence. Decide whether the spec may rely on it or a research ticket should measure refusal across a few phrasings and an adversarial ask.

Small ticket; one round. Record the answer here and, if (b) or (c), amend Conversation state decision 5 by pointer.

## Facts from research

- Disclosure and suppression measurements: `research/residual-upstream-context.md` (runs `r2` to `r6`); the injected attachments: `research/cli-probes/p7-session-after-resume.transcript.jsonl` L4-L15.
- The real API injects nothing of the kind; a pure model endpoint would not know an operator email at all.

## Answer

Resolved 2026-10-07 with the human, one grilling round of four questions, every recommendation taken under one condition: **no client compatibility may be harmed**. Checked against the SDK minimums ([wire contract](03-messages-api-wire-contract.md) §8): redaction rewrites characters inside `text_delta` and `input_json_delta` payloads only, the replacement carries no JSON-significant characters, so the Python SDK's eager partial-JSON parse and the TypeScript accumulator both see valid streams; no event, field or status changes. No instruction is added to the system prompt, so [Conversation state and system prompt](10-conversation-state-and-system-prompt.md) decision 5 stands unamended. No ADR (easy to reverse); no glossary change.

Facts new to this ticket:

- `~/.claude.json` (mode `0600`, owned by the login user) carries `oauthAccount` with `emailAddress`, `displayName`, `fullName`, `organizationName` and more, so the wrapper can learn the address without the operator typing it.
- The address appears in **seventeen** recordings, not the two transcript copies [Module layout and seams](13-module-layout-and-seams.md) decision 10 excluded: `r2-exclude-dynamic.jsonl`, `r3-baseline-disclosure.jsonl`, `r5-disable-attachments-env.jsonl`, `r6-nonessential-traffic-env.jsonl` (the model quoted it in an `assistant` text block and in `result.result`), their `.transcript.jsonl` copies plus `p6`/`p7`, `s-sdk-hooks-allowed.wire.ndjson`, and all six `../spike/runs/sdk-*.wire.ndjson` files.
- The single instruction run (`r4`) is no longer load-bearing: the mitigation does not rely on the model complying.

### Decisions

| # | Decision |
| - | - |
| 1 | **The wrapper redacts on output; no system-prompt line.** The translator's stop-sequence scanner ([Model and parameter mapping](11-model-and-parameter-mapping.md) decision 6, a hold-back of `len - 1` characters) gains a redaction pass placed right after it, covering `text_delta` payloads, `input_json_delta` payloads (client tool and StructuredOutput inputs) and therefore the structured-output text: each armed string is matched case-insensitively and replaced with `[redacted]`. On by default. This keeps the upstream system prompt exactly the client's, adds no tokens, cannot trip the billing gate that appended system text triggered for other wrappers ([Prior art](05-prior-art.md) pitfalls), and holds when a client's own prompt asks the model to reveal the address. Documented limits: paraphrase or spelling-out escapes it; the OS username inside the cwd path the environment reminder shows is a separate residual unless added to the list (decision 2). The README and the spec's residual-context section carry the warning regardless. |
| 2 | **Sources of the strings.** At startup the wrapper reads `~/.claude.json` and arms redaction with `oauthAccount.emailAddress`, `displayName` and `fullName` when present, logging that redaction is armed and with how many strings, never the values; an operator `redact` list in the wrapper's configuration adds strings (the OS username, for instance). If nothing can be read and the list is empty, the surface starts with a warning that redaction is unarmed (an API-key login has no OAuth account and may carry no email at all). |
| 3 | **Verification.** No research ticket. `r3-baseline-disclosure.jsonl` becomes a translator fixture (the quoted address in a text block comes out as `[redacted]`); e2e scenario **10** on [Module layout and seams](13-module-layout-and-seams.md) is a direct ask with redaction armed against the real CLI. |
| 4 | **Fixture scrubbing supersedes exclusion.** [Module layout and seams](13-module-layout-and-seams.md) decision 10 is amended by comment: the fixture copy scrubs every recording, replacing the address, display name and full name with placeholders (`user@example.invalid`, `Example User`), the two transcript copies included; a scrub script in `app/tests/scripts/` does it, and a test asserts that no fixture contains the live values before the suite runs. |

### Boundaries handed to other tickets

- [Module layout and seams](13-module-layout-and-seams.md) (resolved; comment added): the redaction pass in `translate/` after the stop-sequence scan; the `redact` list and the `~/.claude.json` read at the composition root; the scrub script and its guard test; e2e scenario 10 (decisions 1 to 4).
- [Conversation state and system prompt](10-conversation-state-and-system-prompt.md) (resolved; comment added): decision 5 is not amended; the residual-context qualification gains a pointer to the redaction pass.
- [Assemble the spec](14-assemble-spec.md): the residual-context section lists what redaction covers and what it cannot; the README warning; the `redact` setting joins the operator settings table on [Process lifecycle and concurrency](19-process-lifecycle-and-concurrency.md).

### Primary sources

- `research/residual-upstream-context.md` (Disclosure; runs `r2` to `r6`); `research/cli-probes/r3-baseline-disclosure.jsonl`, `r4-system-instruction-disclosure.jsonl`.
- `~/.claude.json` (`oauthAccount` keys, mode `0600`; read 2026-10-07).
- `grep -l` over `research/cli-probes/` and `../spike/runs/` for the address (2026-10-07).
