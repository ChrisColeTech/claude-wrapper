# 32: Images and documents

Spec: [spec.md](../spec.md), section 4.3

**What to build:** Base64 images and base64, text and content-sourced documents, with titles, context and citations, reach the model on both continued and replayed turns; citations stream to the client; the all-or-none citations rule's 400 relays with the API's message.

**Blocked by:** 31 (Conversation state)

**Status:** resolved

- [x] `image` base64 and `document` base64 PDF, text and content sources pass through to upstream's user message unchanged, including `title`, `context` and `citations: {enabled}`
- [x] The renderer includes history images and documents as real blocks beside the history text
- [x] `citations_delta` events relay to the client and accumulate into the non-streaming `Message`
- [x] Upstream's 400 for mixed citation settings relays with the API's message
- [x] Unit: renderer goldens with media; a translator golden from the pass-through recordings; integration through the SDK with an image and a PDF against the replay runner
- [x] E2E (flag): one image and one PDF against the real CLI, the model quoting the known content

## Comments

- Resolved by merge 5518bab on anthropic-compat-api.
- The E2E criterion is ticked on the test being written (`app/tests/e2e/upstream/media.test.ts`); its run against the real CLI is still pending.
- The mixed-citations 400 relays upstream's message verbatim, so it names upstream's message index (for example `messages.9`), not the index in the client's request.
