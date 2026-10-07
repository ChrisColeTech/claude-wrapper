# 39: Redaction

Spec: [spec.md](../spec.md), section 6

**What to build:** The operator's account email, display name and full name never reach a client: every occurrence in text and tool-input deltas comes out as `[redacted]`, armed automatically at startup, extended by an operator list, and loudly reported when unarmed.

**Blocked by:** 29 (Plain turn end to end)

**Status:** ready-for-agent

- [ ] A redaction pass placed after the stop-sequence scan's position, over `text_delta` and `input_json_delta` payloads, case-insensitive, with a hold-back so a string split across deltas is caught; the replacement carries no JSON-significant characters
- [ ] The composition root reads the CLI's account file for `oauthAccount.emailAddress`, `displayName` and `fullName` and merges the `redact` setting; it logs that redaction is armed and with how many strings, never the values, and warns at startup when unarmed
- [ ] Unit: the baseline-disclosure recording as a golden (the quoted address comes out redacted); a split-across-deltas case; a JSON tool-input case
- [ ] E2E (flag): scenario 10, a direct ask for the account email with redaction armed
