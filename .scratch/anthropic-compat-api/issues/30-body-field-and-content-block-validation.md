# 30: Body-field and content-block validation

Spec: [spec.md](../spec.md), sections 4.1, 4.2, 4.3, 12 (ignored fields)

**What to build:** Every remaining rule of the request contract not owned by a feature ticket is enforced before any spawn with the real API's wording, and the ignored fields are accepted and relayed where the spec says, so a client learns about an unsupported feature at once instead of getting an answer that ignored it.

**Blocked by:** 29 (Plain turn end to end)

**Status:** resolved

- [x] 400 with the stated messages: `temperature` other than absent or `1.0`, `top_p` below `0.99`, `top_k` present; `container`; any unknown top-level field and the beta-only fields (`context_management`, `speed`, `fallbacks`, `output_format`, `output_config.task_budget`) with "Extra inputs are not permitted"; `role: "system"` inside `messages`; `stop_sequences` not a non-empty array of non-empty strings (the scan itself is the output-limits ticket's); `service_tier` outside its enum
- [x] Content blocks: `image` with a `url` source, `document` with a `url` source, `file` sources, `search_result`, `mcp_tool_listing` and the tool-change blocks are 400 naming the block type; `thinking` and `redacted_thinking` in history dropped; `cache_control` anywhere ignored
- [x] Accepted and ignored: `metadata`, `service_tier` (upstream's value relayed in `usage.service_tier`), `inference_geo` (relayed in `usage.inference_geo`), `diagnostics` (response `diagnostics: null`)
- [x] `tool_choice`: `any` and `tool` are 400 with the real API's message on every model; `disable_parallel_tool_use` ignored (`none` and the tools themselves are the client-tools ticket's)
- [x] Server tool types the surface cannot serve are 400 naming the type; a web tool carrying both domain lists is 400
- [x] One file per validation concern under the size rules; a unit test per rule; integration tests through the SDK for a sample of each class, asserting `BadRequestError` and the message

## Comments

- Interim 400 for ticket 36 to lift: a valid `stop_sequences` list passes validation, then is refused with `stop_sequences: not supported on this surface yet` (`plan-turn.ts`, `validateParameters`) until the output-limits scan honours it.
- Interim 400 for ticket 41 to lift: `mcp_servers` is left out of `KNOWN_FIELDS` in `validate-extra-fields.ts`, so it is `mcp_servers: Extra inputs are not permitted` until the connectors ticket adds it with its gate.
- Interim 400 for ticket 41 to lift: a `mcp_toolset` tool is `tools.N: tool type "mcp_toolset" is not supported on this surface` (`validate-server-tools.ts`) until the connectors ticket adds it.
- Resolved by merge 5d9037e on anthropic-compat-api.
