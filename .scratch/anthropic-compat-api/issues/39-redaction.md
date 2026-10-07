# 39: Redaction

Spec: [spec.md](../spec.md), section 6

**What to build:** The operator's account email, display name and full name never reach a client: every occurrence in text and tool-input deltas comes out as `[redacted]`, armed automatically at startup, extended by an operator list, and loudly reported when unarmed.

**Blocked by:** 29 (Plain turn end to end)

**Status:** resolved

- [x] A redaction pass placed after the stop-sequence scan's position, over `text_delta` and `input_json_delta` payloads, case-insensitive, with a hold-back so a string split across deltas is caught; the replacement carries no JSON-significant characters
- [x] The composition root reads the CLI's account file for `oauthAccount.emailAddress`, `displayName` and `fullName` and merges the `redact` setting; it logs that redaction is armed and with how many strings, never the values, and warns at startup when unarmed
- [x] Unit: the baseline-disclosure recording as a golden (the quoted address comes out redacted); a split-across-deltas case; a JSON tool-input case
- [x] E2E (flag): scenario 10, a direct ask for the account email with redaction armed

## Comments

- Resolved by merge 3942a9f on anthropic-compat-api.
- The E2E criterion is ticked on the test being written (`app/tests/e2e/upstream/redaction.test.ts`, scenario 10); its run against the real CLI is still pending.
- Deviation from the criterion's "case-insensitive": matching is whole-word as well as case-insensitive (no letter, mark, digit or underscore touching either end of a match, so a short name never redacts part of another word; a JSON escape counts as a boundary).
- 2026-10-07: real-CLI run passed (`redaction.test.ts`, scenario 10, 3/3).
