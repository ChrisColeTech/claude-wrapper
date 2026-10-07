# Assemble the spec

Type: task
Status: resolved
Blocked by: 01, 07, 08, 09, 10, 11, 12, 13, 15, 19, 22

## Question

Nothing left to decide: synthesise the closed tickets into `.scratch/anthropic-compat-api/spec.md` with the `/to-spec` skill (problem, solution, user stories, implementation decisions, testing decisions, out of scope), in `GLOSSARY.md` vocabulary, respecting any ADRs recorded on the way, triaged `ready-for-agent`. Reaching this closes the map.

## Answer

Resolved 2026-10-07 by the agent alone (task ticket, no grilling round). The spec is written at [spec.md](../spec.md), triaged `ready-for-agent`. The `/to-spec` slash command was not invocable from the agent's side, so the spec was written by hand to that skill's template (Problem Statement, Solution, User Stories, Implementation Decisions, Testing Decisions, Out of Scope, Further Notes); the seam check the skill asks for was taken as already done with the human on [Module layout and seams](13-module-layout-and-seams.md). Every statement in the spec restates a closed ticket's answer; **no new decision was made**. Compatibility check: the spec restates each ticket's own check against the SDK minimums and adds no wire change of its own. The document was scanned for the account email, display name and git handle before saving; none is present.

### What the spec holds

| Section | Source tickets |
| - | - |
| Problem, solution, out of scope | the map's Destination, Notes and Out of scope; [Destination and target clients](01-destination-and-target-clients.md) |
| 72 user stories (client, operator, maintainer) | every closed ticket |
| 1 Standing rules | 01 |
| 2 Endpoints, headers, credentials | [Error envelope and auth headers](12-error-envelope-and-auth.md), [Model and parameter mapping](11-model-and-parameter-mapping.md) decision 2 |
| 3 Catalogue | 11 decisions 1 to 3 |
| 4 Request contract (field table, normalisation, content blocks, tools) | 11, [Conversation state](10-conversation-state-and-system-prompt.md), [Tool bridge](07-tool-bridge-strategy.md), [Web search policy](08-web-search-and-built-in-tools-policy.md), 17, 18 |
| 5 Conversation state | 10, ADR 0002 |
| 6 System prompt, residual context, redaction | 10 decision 5, 16, 20, [Mitigating the account-email disclosure](22-mitigating-the-account-email-disclosure.md) |
| 7 Tool bridge | 07, 06, ADR 0001 |
| 8 Server tools | 08, 21 |
| 9 Connectors | [MCP connector passthrough](15-mcp-connector-passthrough.md) |
| 10 Spawn contract (argv, environment, files, init checks, never-flags) | 10, 08, 11 decision 13, [Module layout](13-module-layout-and-seams.md), [Process lifecycle](19-process-lifecycle-and-concurrency.md), ADR 0006 |
| 11 Turn stream (eleven passes, flattening, shapes, commit, ping, failures) | [Streaming fidelity](09-streaming-fidelity.md), ADR 0003, plus the passes from 11, 15, 22 |
| 12 Output limits and model-side parameters | 11, ADR 0004 |
| 13 Errors (both mapping tables) | 12, ADR 0005 |
| 14 Process lifecycle | 19 |
| 15 Operator settings table | 19, plus the `redact` row from 22 |
| 16 Module layout and interfaces | 13 with the 15, 19 and 22 comments |
| 17 Documentation | the map's Docs fog item, graduated here; 22 decision 1, 13 decision 9 |
| Testing decisions (three layers, scrub and guard, e2e scenarios 1 to 10 verbatim) | 13 decision 10 and comments, 22 decision 4 |
| Further notes: deviations list, unverified mechanics, reconciliations, environment and auth facts, sources | 09 (unverified assumption), 11, 12 decision 7, 19 decision 9, 15 decision 1, the map's Notes |

### Reconciliations recorded in the spec

Five places where two closed decisions had to be read together; each is stated in the spec's "Reconciliations made while assembling" and none changes a decision: the `permission_denials` check runs when `result` arrives and logs, since the response has closed at `message_stop` (08 meets 09); the expected `system/init.tools` list includes `StructuredOutput` on a `--json-schema` run (08 meets the 11 probe fact); `tool_result` content stays text and image because no ticket extended the bridge's MCP mapping to documents (07 decision 10 meets 10 and 18); `MCP_CONNECT_TIMEOUT_MS` has a constraint but no fixed value (19 meets 15); the bridge server is mounted when the turn exposes client tools (10's "per run").

### Glossary

Two terms added under Conversation, both already in use across tickets 09, 11, 12, 19 and ADRs 0003 and 0004 without an entry: **commit** (the first relayed `message_start`, after which failures are SSE `error` events) and **cut** (a turn the surface ends itself at an output limit). No ADR: the spec records decisions, it makes none.

### Map

The Decisions-so-far line for this ticket is added; the last fog item (Docs) graduated into the spec's section 17; **the map is closed**.

### Boundaries handed to what follows

- `/to-tickets` from the spec: the fixture copy and scrub with its guard test is its own ticket ([Module layout and seams](13-module-layout-and-seams.md) decision 10, [Mitigating the account-email disclosure](22-mitigating-the-account-email-disclosure.md) decision 4); the catalogue's initial JSON is captured from the real API's listing at implementation time ([Model and parameter mapping](11-model-and-parameter-mapping.md) decision 3); the documentation deliverables of section 17; the e2e scenarios are run by hand behind a flag, never in CI.
- Nothing to any other map ticket; none remains open.

### Primary sources

The `## Answer` sections of tickets 01, 07, 08, 09, 10, 11, 12, 13, 15, 19 and 22 (with their `## Decided in …` and `## Comments` amendments), the research tickets 02 to 06, 16 to 18, 20 and 21, ADRs 0001 to 0006, `GLOSSARY.md` and the map.
