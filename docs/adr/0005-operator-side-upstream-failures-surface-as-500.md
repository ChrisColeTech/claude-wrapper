---
status: accepted
date: 2026-10-07
---

# Operator-side upstream failures surface as 500, never as 401 or 402

The Anthropic surface has two credential layers: the client's optional wrapper key, checked by the wrapper, and the Claude Code login upstream runs on, owned by whoever operates the wrapper. When upstream's login is missing, expired, not allowed for the organisation, on hold or out of billing, the Messages API behind it answers 401, 402 or 403 and the CLI retries for minutes. We decided that the surface maps every such failure to **500 `api_error`** with `x-should-retry: false` and a message naming the upstream login or billing, and reserves 401 `authentication_error` for the client's own key. More generally, upstream failures are mapped by what the client should do (fix the request, retry later, or stop and tell the operator), not by relaying upstream's status. We chose this over status passthrough because a 401 would send the client debugging a key the wrapper had just accepted, and over 503 because the SDKs give 500 the same retry treatment and the real API documents no 503.

## Considered options

- **Map by the client's remedy** (chosen): request-shaped failures keep their 4xx with the API's own message, capacity failures keep 429/529/500 so the SDKs back off, operator-side failures become 500 with retries switched off.
- **Relay upstream's status**: faithful to the API behind the CLI, but 401/402 are statements about the wrong credential on this surface.
- **Custom status or type** for operator-side failures: nothing the SDKs would classify; 500 `api_error` is the documented type they already handle.

## Consequences

- Deterministic `api_retry` categories interrupt the run at first sight instead of waiting out the 60 s cap; the CLI's own ten-retry loop never runs on the surface.
- The message, not the status, tells the client whose problem it is; the spec words those messages.
- The surface never forwards the client's credential upstream, so the two layers cannot be confused by design.
- The billing-gate 400 ("Third-party apps now draw from extra usage") stays a 400 with upstream's text, because it is triggered by request content, but is never retried.
