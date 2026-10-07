# Destination and target clients

Type: grilling
Status: resolved
Blocked by: none

## Question

The map was charted from the brief without a live grilling round, so the destination rests on assumptions that need the human's confirmation or correction before the downstream decisions settle on them:

1. **Additive, not a replacement.** The brief says "also offers an Anthropic compatible API instead". Assumed: add the Anthropic surface next to the OpenAI surface, same server, same port, same optional API-key protection. Correct?
2. **Fidelity target.** Assumed: the official Anthropic SDKs (`@anthropic-ai/sdk`, `anthropic` for Python) and tools built on them must work unmodified by pointing `ANTHROPIC_BASE_URL` at the wrapper. Which concrete clients matter most? (Claude Code itself pointed at the wrapper? Cline/Roo/Kilo? OpenCode? aider? LangChain/LlamaIndex Anthropic adapters? Custom scripts?) The answer decides how strictly the surface must validate and which response fields must be present.
3. **Feature ambition.** The brief says "as many features as you can including websearch and tool calling". Assumed priority: client tools, streaming, web search, system prompts and multi-turn, model mapping, real usage reporting; then thinking, structured outputs, images, MCP passthrough. Is anything a must-have or a don't-care?
4. **Local agent powers.** Should the Anthropic surface ever let a request run Claude Code's built-in Bash/Edit/Read tools on the host (an "agent mode"), or must it behave as a pure model endpoint by default? Assumed: pure by default, opt-in later. This is an HTTP endpoint, so the security stance matters.
5. **Destination shape.** Assumed: the map ends at a locked spec (`.scratch/anthropic-compat-api/spec.md`) and implementation is a separate effort. Or should this map carry execution too?

Recommended answers are the assumptions above. Record the confirmed destination in the map and update `GLOSSARY.md` if any term shifts.

## Answer

Resolved 2026-10-04 with the human (grilling round, answers given in chat).

1. **Additive, with a conflict rule.** The Anthropic surface is added next to the OpenAI surface on the same server, port, and optional API key. Where the two surfaces collide (same path or shared middleware whose wire shapes differ), **the Anthropic approach wins**. Known collision points, to be settled under this rule: the `GET /v1/models` response shape (ticket 11), the error envelope emitted by the shared error handler and the auth header check (ticket 12).
2. **Fidelity target: official SDKs unmodified.** The TypeScript and Python Anthropic SDKs, pointed at the wrapper via `ANTHROPIC_BASE_URL`, must work without changes. No specific downstream client was named; the spec tests against the SDKs.
3. **Feature priority confirmed**: client tools, streaming, web search, system prompts and multi-turn, model mapping, real usage reporting; then thinking, structured outputs, images, MCP passthrough.
4. **Pure model endpoint by default.** Not answered explicitly (four answers to five questions); the recommendation stands: no request may run Claude Code's Bash/Edit/Read tools on the host. An opt-in "agent mode" server flag is out of the first spec and recorded under Out of scope on the map.
5. **Spec only.** The map ends at `.scratch/anthropic-compat-api/spec.md`; `/to-tickets` and `/implement-spec` take over.

No glossary term shifted.
