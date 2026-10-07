# 43: Documentation

Spec: [spec.md](../spec.md), section 17

**What to build:** An operator can read how to use and run the Anthropic surface, and a client can browse its contract.

**Blocked by:** 32 (Images and documents), 35 (Web search and web fetch), 37 (Structured output), 38 (count_tokens), 39 (Redaction), 41 (Connectors), 42 (Process lifecycle and concurrency)

**Status:** resolved

- [x] README: the surface, pointing an SDK at it, the four endpoints, and the operator warning (residual context and self-identification, the account-email disclosure and redaction's limits, the connector default and host list, the auth stance as the operator's own choice with `upstream.env`)
- [x] The architecture API reference gains the surface's endpoints and points at the OpenAPI document
- [x] A static OpenAPI document for the four endpoints, added to the Swagger UI's definition picker without editing the existing Swagger definition
- [x] The spec's known-deviations list reproduced in the README
- [x] A short runbook: the settings table with defaults, how to run the e2e scenarios behind the flag, how to re-scrub fixtures

## Comments

- Resolved by merge 2c56413 on anthropic-compat-api.
- Deviation: the HTTP layer makes a sixth change to an existing file, where spec section 16 counts five. `mountDocs` in `app/src/api/server.ts` now serves the surface's OpenAPI document and gives the Swagger UI a definition picker (one definition per surface), hiding only the top bar's logo. The existing Swagger definition file is still not edited.
- Added to the operator warning, beyond the criterion's list: web fetch downloads the URL from the machine the wrapper runs on, the only domain limits are the ones the client sends, and there is no operator setting to limit it.
- Fixed on the branch (`15a9ef8b`): three real-CLI e2e scenarios had stopped compiling once the plan's continuation became a union, so ts-jest refused them and `test:e2e` and `test:ci` failed even with `UPSTREAM_E2E` unset; the harness now hands them the first message. `disk-retention.test.ts` also left its first server listening, which kept `test:ci` from exiting. With `UPSTREAM_E2E` unset, `test:e2e` now skips all 15 real-CLI suites (only `health.test.ts` runs) and `test:ci` passes 178 suites and exits.
