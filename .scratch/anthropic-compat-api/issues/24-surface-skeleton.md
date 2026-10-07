# 24: Surface skeleton: tag, envelope, version header, credentials, request ids, body limit

Spec: [spec.md](../spec.md), sections 2, 13 (envelope), 15 (settings)

**What to build:** An Anthropic SDK pointed at the wrapper gets the Anthropic error envelope with a request id for every failure the surface can detect before upstream exists: bad JSON, a missing or unknown `anthropic-version`, a wrong or missing key, an unknown path under `/v1/messages`, a body over 32 MB. The OpenAI surface answers exactly as before. The Anthropic settings block exists with every default from the spec's operator settings table.

**Blocked by:** 23 (App factory prefactor)

**Status:** resolved

- [x] A surface-tag middleware runs first: a path under `/v1/messages`, or `anthropic-version` present, tags the request Anthropic; everything else OpenAI
- [x] The shared error handler, its JSON-parse branch and the auth middleware render by the tag: Anthropic-tagged responses are `{type: "error", error: {type, message}, request_id}` with a `request-id` header; OpenAI-tagged responses are byte-for-byte today's
- [x] One surface error type `{status, type, message, retryable}` renders through the handler; a stray wrapper error on an Anthropic-tagged request maps by status (4xx to `invalid_request_error` with that status, 5xx to 500 `api_error`); `x-should-retry: false` on every 4xx
- [x] `anthropic-version` missing on `/v1/messages*` is 400 naming the header; `2023-06-01` and `2023-01-01` accepted; any other value 400 quoting it
- [x] With `API_KEY` set, `x-api-key` or `Authorization: Bearer` is accepted with a constant-time compare; missing or wrong is 401 `authentication_error` in the Anthropic envelope; without `API_KEY` the surface is open; the OpenAI surface stays Bearer-only
- [x] `anthropic-beta` values are accepted and logged at debug
- [x] Anthropic paths accept bodies up to 32 MB; above is 413 `request_too_large`; invalid JSON or a wrong content type is 400 `invalid_request_error`
- [x] Any other path or method under `/v1/messages` is 404 `not_found_error` with "The requested resource could not be found."
- [x] `request-id: req_<24 base62>` on every Anthropic-tagged response regardless of debug mode, logged with the request
- [x] The Anthropic settings block carries every row of the spec's operator settings table with its default (park TTL, fingerprint expiry and capacity, retry cap, ping, catalogue path, connector host list and call timeout, the three timers, run cap, continued-turn wait, shutdown drain, max-turns, `upstream.env`, `redact`), loaded through the existing configuration module
- [x] The official TypeScript SDK is a devDependency; integration tests drive every case above through it and assert the SDK's error classes (`BadRequestError`, `AuthenticationError`, `NotFoundError`) and `request_id`
- [x] Regression tests prove the OpenAI surface's error bodies, auth behaviour and `/v1/models` listing are unchanged
- [x] The five wiring points named in the spec are the only edits to existing files, each file staying under the size rules

## Comments

- Resolved by merge 3d12d65 on anthropic-compat-api.
- Follow-up (merge 30d64fd): on the Anthropic surface the credential check now runs before the 32 MB body parser, so a missing or wrong key is refused before the body is read; the OpenAI surface's order (body parsed, then the Bearer check) is unchanged.
