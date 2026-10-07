# 28: Turn planning and run spec

Spec: [spec.md](../spec.md), sections 4 (basics), 6 (system prompt and isolation), 10 (spawn contract), 16 (request module)

**What to build:** A pure planner turns a text-only request into a complete turn plan: the resolved model, the normalised messages, the system prompt, and a run spec carrying the full spawn contract (argument list, child environment allowlist, per-run directory layout, fixed working directory). Golden tests pin request to plan.

**Blocked by:** 25 (Catalogue and models endpoints), 27 (Upstream runner)

**Status:** resolved

- [x] `planTurn(request, catalogue, sessions) → TurnPlan | SurfaceError` with the plan shape the spec states; sessions may be a stub that never matches, so every turn is a replayed turn until the conversation-state ticket
- [x] Validation in this ticket's scope: `model` resolved by id or alias else 404; `max_tokens` required, integer, 1 to the entry's limit, `0` rejected; `messages` non-empty, first `user`, last not `assistant` (the prefill message), no empty content or empty text block, same-role merge, string to text block; `system` as a string or text blocks joined with a blank line, empty when absent
- [x] The run spec's argument list matches the spec's table for a replayed text turn: `-p`, the four stream-json flags, `--system-prompt <text>`, `--system-prompt-snapshot off`, `--setting-sources=`, `--strict-mcp-config`, `--model <canonical id>`, `--tools ""`, an empty `--allowedTools`, `--permission-mode default --permission-prompts none`, `--max-turns 25`; no `--mcp-config` or `--settings` when nothing needs them; none of the never-used flags
- [x] The child environment is built from scratch: the base variables copied when present, `CLAUDE_CODE_MAX_OUTPUT_TOKENS=<max_tokens>`, the MCP idle and tool timeouts above the park TTL, `MCP_CONNECT_TIMEOUT_MS`, the web-search session cap; the operator's `upstream.env` merged last; `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` and `CLAUDE_CODE_SIMPLE` refused even from `upstream.env` (a startup error); no other `CLAUDE*` or `ANTHROPIC*` variable inherited
- [x] The state directory layout: one fixed, empty working directory for every run; a per-run directory for `0600` files, created before spawn and removed at teardown
- [x] The plan names the startup checks the conductor applies to `system/init`: `model` equals the canonical id; `tools` equals the expected list
- [x] The replayed-turn message for a single user message is that message's blocks verbatim (the history renderer is the conversation-state ticket's)
- [x] Unit tests: golden request to plan for the four catalogue models and their aliases, each validation 400 with its exact message, the environment allowlist against a polluted parent environment

## Comments

- Deviation: `planTurn` takes a fourth `context` argument (settings, environment, state directory, run id) alongside request, catalogue and sessions.
- Resolved by merge bef1798 on anthropic-compat-api.
