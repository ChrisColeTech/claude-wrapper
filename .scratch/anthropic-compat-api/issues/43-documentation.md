# 43: Documentation

Spec: [spec.md](../spec.md), section 17

**What to build:** An operator can read how to use and run the Anthropic surface, and a client can browse its contract.

**Blocked by:** 32 (Images and documents), 35 (Web search and web fetch), 37 (Structured output), 38 (count_tokens), 39 (Redaction), 41 (Connectors), 42 (Process lifecycle and concurrency)

**Status:** ready-for-agent

- [ ] README: the surface, pointing an SDK at it, the four endpoints, and the operator warning (residual context and self-identification, the account-email disclosure and redaction's limits, the connector default and host list, the auth stance as the operator's own choice with `upstream.env`)
- [ ] The architecture API reference gains the surface's endpoints and points at the OpenAPI document
- [ ] A static OpenAPI document for the four endpoints, added to the Swagger UI's definition picker without editing the existing Swagger definition
- [ ] The spec's known-deviations list reproduced in the README
- [ ] A short runbook: the settings table with defaults, how to run the e2e scenarios behind the flag, how to re-scrub fixtures
