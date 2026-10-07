# 25: Catalogue and models endpoints

Spec: [spec.md](../spec.md), section 3

**What to build:** `models.list()` and `models.retrieve("sonnet")` work through the SDK and return the models the surface serves, with capabilities honest to the surface. Without the `anthropic-version` header, `GET /v1/models` returns today's OpenAI listing untouched.

**Blocked by:** 24 (Surface skeleton: tag, envelope, version header, credentials, request ids, body limit)

**Status:** ready-for-agent

- [ ] A catalogue JSON ships with the wrapper at an operator-overridable path: one entry per model in `ModelInfo` shape plus `aliases[]`; initial content is the four models and aliases the spec names; `display_name`, `created_at`, `max_input_tokens` and `max_tokens` captured from the real API's listing (`null` where unsourceable); capabilities exactly as the spec states (honest to the surface)
- [ ] `load(path)`, `resolve(name)` by id or alias returning the entry with its canonical id, `list(page)` honouring `limit`, `after_id`, `before_id`
- [ ] `GET /v1/models` with the header returns `{data (newest first), first_id, last_id, has_more: false}`; `GET /v1/models/{id}` resolves id or alias to the entry under its canonical id, else 404 `not_found_error`
- [ ] Negotiation by mounting order: the Anthropic models route passes OpenAI-tagged requests on; the existing OpenAI models route is not edited; `GET /v1/models/{id}` without the header stays unserved
- [ ] Unit tests for resolve, list and paging; integration tests through the SDK (`models.list`, `models.retrieve` by id and alias, unknown id) and a regression test for the header-less listing
