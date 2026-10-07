# Anthropic surface runbook

How to configure and run the Anthropic surface, how to run its real-CLI scenarios, and how to re-scrub its test fixtures. The [README](../README.md#anthropic-surface) says what the surface is and carries the operator warning; the contract is the OpenAPI document at `/docs/anthropic-openapi.json`, also offered in the Swagger UI at `/docs` (pick "Anthropic surface").

## Settings

Every setting is an environment variable, read when the wrapper builds its app at start: restart the wrapper to change one. Durations are milliseconds. An invalid value logs a warning that names the variable (never the value) and keeps the default.

| Variable | Default | What it controls |
| - | - | - |
| `CLAUDE_WRAPPER_PARK_TTL_MS` | `600000` (10 min) | How long a turn parked on client tool calls waits for its `tool_result` blocks. On expiry the run is interrupted and reclaimed, and a later request carrying those results is served as a replayed turn. Upstream's MCP tool timeouts are set 60 s above it. |
| `CLAUDE_WRAPPER_FINGERPRINT_EXPIRY_MS` | `86400000` (24 h) | How long an idle conversation stays resumable. When it expires its upstream transcript is deleted, and the hourly sweep deletes any transcript older than this. |
| `CLAUDE_WRAPPER_FINGERPRINT_CAPACITY` | `1000` | Conversations remembered. Beyond it the least recently used one is forgotten. |
| `CLAUDE_WRAPPER_RETRY_CAP_MS` | `60000` (60 s) | How long a run may sit in upstream's retry loop (rate limit, overload, server error) without starting a new model call. Then the turn fails with that error. Login, billing and invalid-request errors fail at once. |
| `CLAUDE_WRAPPER_PING_INTERVAL_MS` | `15000` (15 s) | Idle time before a streamed turn gets an SSE `ping`. |
| `CLAUDE_WRAPPER_CATALOGUE_PATH` | unset: the shipped `catalogue/models.json` | A replacement model catalogue, in the shipped file's shape (`{"models": [<ModelInfo> plus "aliases"]}`). Ids and aliases must be unique. A file that cannot be read or is malformed stops the wrapper at start. |
| `CLAUDE_WRAPPER_CONNECTOR_HOSTS` | empty: connectors off | Comma-separated hosts that a client's `mcp_servers` may name: `host` or `host:port`, matched case-insensitively; `*` allows every host. Read the README's operator warning first. |
| `CLAUDE_WRAPPER_CONNECTOR_TIMEOUT_MS` | `60000` (60 s) | Timeout of one connector tool call. A connector that stops answering then gives the model an error result to report, instead of stalling the turn. |
| `CLAUDE_WRAPPER_STARTUP_TIMEOUT_MS` | `20000` (20 s) | Spawn to upstream's `system/init`, including each connector's connect wait (`MCP_CONNECT_TIMEOUT_MS` and `MCP_TIMEOUT`, both pinned at 5 s). |
| `CLAUDE_WRAPPER_STALL_TIMEOUT_MS` | `90000` (90 s) | Longest silence allowed between two upstream frames. A parked run's heartbeats count as frames. |
| `CLAUDE_WRAPPER_RUN_LIFETIME_MS` | `1800000` (30 min) | A run's active lifetime, park time excluded. |
| `CLAUDE_WRAPPER_MAX_RUNS` | `4` | Upstream runs in existence, active and parked together, `count_tokens` runs included. A request beyond it gets 529 `overloaded_error` at once; there is no queue. A run is a Claude Code process of roughly 230 to 260 MB. |
| `CLAUDE_WRAPPER_CONTINUED_TURN_WAIT_MS` | `10000` (10 s) | How long a continued turn waits for the previous run on its conversation to exit before killing it, whether that run is streaming or parked (a parked run's tool calls are rejected first). The waiting turn holds no run slot. |
| `CLAUDE_WRAPPER_SHUTDOWN_DRAIN_MS` | `15000` (15 s) | How long shutdown waits for runs to end before killing the rest. |
| `CLAUDE_WRAPPER_MAX_TURNS` | `25` | Upstream's `--max-turns` per run, a runaway guard. Hitting it ends the turn with 500 `api_error`. |
| `CLAUDE_WRAPPER_UPSTREAM_ENV` | `{}` | A JSON object of strings, merged last into every run's environment (below). |
| `CLAUDE_WRAPPER_REDACT` | empty | Comma-separated strings to redact from output, beside the account email, display name and full name, which are armed automatically. |
| `CLAUDE_WRAPPER_WEB_FETCH_PUBLIC_ONLY` | `true` | Keeps web fetch off your network: Claude Code fetches from the wrapper's machine, so a `web_fetch` call whose URL host is not a public address is denied, and the client gets `url_not_allowed`. Not public: loopback, private, link-local, unique-local, unspecified and the other special ranges (IPv4, IPv6 and IPv4-mapped), `localhost` and names under it, and a name that resolves to any of those or does not resolve. Names are resolved with the wrapper machine's resolver when the hook decides the call. `false` (or `0`) lets a fetch reach any address. Limits: Claude Code follows same-host redirects itself, unseen by the hook, and resolves the name again when it fetches, so the check holds at decision time only. See the README's operator warning. |

Timer firings (startup, stall, lifetime) answer 504 `timeout_error` before the response has started, or an SSE `error` event of that type after.

The surface also reads these existing variables:

| Variable | Default | What it controls |
| - | - | - |
| `API_KEY` | unset: open | The wrapper's client key (also `--api-key`). Clients send it as `x-api-key` or `Authorization: Bearer`. It never reaches upstream. |
| `CLAUDE_COMMAND` | unset: `claude` on the run's `PATH` | The Claude Code binary. It is spawned without a shell, so this is a path only, with no arguments. |
| `XDG_STATE_HOME` | `~/.local/state` | Where the state directory lives: `$XDG_STATE_HOME/claude-wrapper`, used only when the value is an absolute path. |

### `CLAUDE_WRAPPER_UPSTREAM_ENV`

A run's environment is built from scratch. From the wrapper's own environment it copies only `HOME`, `PATH`, `LANG`, `LC_ALL`, `TZ`, `TMPDIR` and the proxy variables (`HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`, and their lowercase forms). No `CLAUDE*` or `ANTHROPIC*` variable is inherited, so a stale `CLAUDE_CODE_OAUTH_TOKEN` in the wrapper's environment cannot silently override the login upstream uses.

This map is where an explicit credential or login goes:

```bash
# An API key instead of the logged-in account
CLAUDE_WRAPPER_UPSTREAM_ENV='{"ANTHROPIC_API_KEY": "<your key>"}'
# A long-lived OAuth token
CLAUDE_WRAPPER_UPSTREAM_ENV='{"CLAUDE_CODE_OAUTH_TOKEN": "<your token>"}'
# A separate Claude Code configuration directory, logged in on its own
CLAUDE_WRAPPER_UPSTREAM_ENV='{"CLAUDE_CONFIG_DIR": "/srv/claude-wrapper/claude"}'
```

Redaction reads its account values from `.claude.json` in that `CLAUDE_CONFIG_DIR`, else in `HOME`, so it follows the login you choose here.

- The map is merged after the variables the surface sets, so it can override them. Leave out `CLAUDE_CODE_MAX_OUTPUT_TOKENS`, `MAX_THINKING_TOKENS`, `CLAUDE_CODE_DISABLE_THINKING` and the MCP timeouts: the surface sets these per request.
- `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` (it silently switches the model) and `CLAUDE_CODE_SIMPLE` (it refuses the subscription login) are refused: the wrapper does not start if the map sets either.
- A value that is not a JSON object of strings logs a warning and is ignored. The warning never echoes the value.

## Files on disk

- **State directory**: `~/.local/state/claude-wrapper` by default. `cwd/` is the one empty working directory every run uses, and `runs/` holds one directory per live run (mode `0700`) with its system prompt, MCP config, hook settings and hook endpoint files (mode `0600`). The control-server token and any connector `authorization_token` exist only in those files, and each run's directory is removed when the run ends. The wrapper opens the state directory when it starts: it empties `cwd/` and deletes everything in `runs/`. **Run one wrapper process per state directory**, because a second process would delete the first one's live runs.
- **Upstream transcripts**: Claude Code keeps each conversation's transcript under `~/.claude/projects/<the state cwd path, with each non-alphanumeric character as "-">/` (under `CLAUDE_CONFIG_DIR` instead when `CLAUDE_WRAPPER_UPSTREAM_ENV` sets one). Forgetting a conversation deletes its transcript. That happens on expiry, eviction, an error turn or a cut. When the wrapper starts, before it serves a turn, every transcript left there by an earlier process is deleted, and from then an hourly sweep deletes any transcript older than the expiry. `count_tokens` runs write none.

## Watching it

- `GET /health` gains an `anthropic` key: `{active, parked, maxRuns, queued, rateLimit}`. `queued` is the number of turns waiting on their conversation's previous run, over every conversation. `rateLimit` is the last `rate_limit_event` upstream reported (`status`, `resetsAt`, `rateLimitType`), or null. `/health` is public, so anyone who can reach the port sees these counts. It shows counts only, never an upstream session id; the log has the session ids.
- The log carries the request id (the `request-id` header clients see) beside upstream's session id. It records every run start and exit, timer firing, cap rejection, park, park expiry, kill, sweep and forgotten session. At start it logs `Redaction armed` with the number of strings (never the values), or a warning that redaction is unarmed. Connector tokens and the control-server token are never logged.

## Shutdown

On SIGTERM or SIGINT (and on `wrapper --stop`) the surface drains before the server closes. New requests get 529 `overloaded_error`. Streams in flight end with an SSE `error` event, `server shutting down`. Parked runs are interrupted. Every run goes down the teardown ladder (interrupt, close, SIGTERM, SIGKILL), and whatever is left after `CLAUDE_WRAPPER_SHUTDOWN_DRAIN_MS` is killed. `wrapper --stop` waits only 10 s for the process to exit, so with stuck runs it can report a failed stop while the drain finishes.

The conversation map lives in memory: after a restart, every conversation's next turn is a replayed turn: still served, by a fresh run with the history rendered into its prompt.

## Running the real-CLI scenarios

The scenarios under `app/tests/e2e/upstream/` drive the operator's real Claude Code: the CLI, a login, and network access. They are behind one flag, `UPSTREAM_E2E=1`. Without the flag every scenario is skipped, which is the default and always the case in CI.

**None of them has been run yet.** They were written with their tickets and never run against the real CLI. Expect the first run to find problems, and see "Unproven on the real CLI" below.

**Every scenario spends subscription quota** (or API credit, with an API key in `CLAUDE_WRAPPER_UPSTREAM_ENV`), because each one makes real model calls through Anthropic's API.

Run one file, or one scenario of a file with `-t`, from the repository root:

```bash
UPSTREAM_E2E=1 npm --prefix app run test:e2e -- tests/e2e/upstream/plain-turn.test.ts
UPSTREAM_E2E=1 npm --prefix app run test:e2e -- tests/e2e/upstream/client-tools.test.ts -t 'scenario 6'
UPSTREAM_E2E=1 npm --prefix app run test:e2e -- tests/e2e/upstream        # all of them
```

**`npm --prefix app run test:ci` with `UPSTREAM_E2E=1` runs them too.** `test:ci` matches every test file, and the flag turns off the guard that otherwise blocks the real CLI in tests. Under `test:ci`, scenario 10 runs with redaction unarmed (the CI config hides the account file), so it fails. Run scenario 10 with `test:e2e`.

| File | Scenario (spec numbering) | Model calls | Reaches, beyond Anthropic's API |
| - | - | - | - |
| `plain-run.test.ts` | the runner alone: one planned run | 1 | |
| `plain-turn.test.ts` | a plain turn through the surface, `create` and `stream` | 2 | |
| `bridge-run.test.ts` | one client tool through the bridge server, raw run | 2 | |
| `client-tools.test.ts` | the SDK's tool loop; **6**: a park longer than five minutes (`-t 'scenario 6'`) | 2 + 2 | |
| `conversation.test.ts` | a continued turn on upstream's session | 2 | |
| `media.test.ts` | a base64 image and PDF, in the message and in replayed history | 2 | |
| `thinking.test.ts` | **2**: `MAX_THINKING_TOKENS` on Haiku 4.5; **3**: `CLAUDE_CODE_DISABLE_THINKING` on a 5.x model | 4, each up to 16,000 output tokens: the costliest file | |
| `max-tokens-cut.test.ts` | **4**: the interrupt racing upstream's auto-continuation after a `max_tokens` cut | 2 capped at 48 tokens, plus at most 1 more each | |
| `count-tokens.test.ts` | **5**: `count_tokens` end to end | 7 one-token counts + 1 short turn | |
| `structured-output.test.ts` | `parse()`, streaming, a refused schema (no model call), a continued turn without a format | 4 | |
| `web-tools.test.ts` | search with `allowed_domains`, a fetch; **7**: the hook client round trip (`-t 'scenario 7'`) | 3 turns, plus upstream's side call per search or fetch | the web, through search; `https://example.com/`, fetched from this machine |
| `connectors.test.ts` | **9**: a connector round trip, and the not-connected path | 1 to 2, plus the start of 1 | `https://mcp.deepwiki.com/mcp` (DeepWiki's public MCP server, no token), from this machine; the not-connected path tries `https://127.0.0.1:9/mcp` |
| `redaction.test.ts` | **10**: a direct ask for the account email with redaction armed (needs an OAuth login) | 2 | |
| `failure-after-content.test.ts` | **1**: a model call failing after it streamed content | 2 | a loopback proxy, set as upstream's `ANTHROPIC_BASE_URL`, that forwards to `https://api.anthropic.com` and breaks the first streamed response |
| `shutdown.test.ts` | the wrapper's shutdown with a parked and a streaming run (Linux or macOS: it reads `ps`) | 2, the second interrupted | |

Scenario 8 (a live 429 and an expired OAuth login) cannot be triggered on demand. Record it when it happens, following "Recording an observed failure" in `app/tests/fixtures/upstream/README.md`.

Optional variables:

| Variable | Default | Used by |
| - | - | - |
| `CLAUDE_COMMAND` | `claude` on `PATH` | every file |
| `UPSTREAM_E2E_MODEL` | `claude-haiku-4-5-20251001` | every file but `thinking`; `redaction` suggests `claude-fable-5-1`, the model its fixture was recorded on |
| `UPSTREAM_E2E_5X_MODEL` | `claude-sonnet-5-5` | `thinking` (scenario 3), `count-tokens` |
| `UPSTREAM_E2E_PARK_MS` | `330000` (5.5 min) | `client-tools` (scenario 6) |
| `UPSTREAM_E2E_RECORD_DIR` | unset (`failure-after-content`: a temp directory) | `thinking`, `connectors`, `failure-after-content`: writes each run's frames there |
| `UPSTREAM_E2E_FAULT` | an SSE `overloaded_error` | `failure-after-content`: `cut` drops the connection instead |
| `UPSTREAM_E2E_CONNECTOR_URL`, `_NAME`, `_TOKEN`, `_PROMPT` | DeepWiki, `deepwiki`, none, a DeepWiki question | `connectors` |
| `UPSTREAM_E2E_DEAD_CONNECTOR_URL` | `https://127.0.0.1:9/mcp` | `connectors` (not-connected path) |

Each scenario runs in a temporary state directory, and the harness removes it and the transcripts upstream wrote for it.

**Unproven on the real CLI**, and so the first places to look when a scenario fails:

- An empty `--allowedTools` (`plain-run`).
- A comma-joined `--allowedTools` with `WebFetch(domain:*)`, `--settings` given a file path, and the quoted hook command (`web-tools`).
- A whole-server `--allowedTools mcp__<server>` rule, and whether a dead connector shows as not connected within the 20 s startup timer or turns into a 504 (`connectors`).
- Whether Claude Code honours `ANTHROPIC_BASE_URL` on a subscription login. If not, scenario 1 reports that the proxy saw no request; put an API key in `CLAUDE_WRAPPER_UPSTREAM_ENV`.
- That the schema the test uses is one the CLI refuses at startup, and whether a format turn's session can continue without a format (`structured-output`).

## Re-scrubbing fixtures

Recorded Claude Code runs under `app/tests/fixtures/upstream/` must never carry the operator's account email, display name or full name, which upstream writes into every session. The fixtures hold placeholders instead: `user@example.invalid` and `Example User`. Before the unit, integration and `test:ci` runs, a guard reads the live values from the CLI's account file and refuses to run the suite if any fixture still carries one. Matching ignores case and is whole-word. A value split across streamed text deltas counts, and so does one inside a wire log's frame string. With no account file, the guard skips with a notice.

Re-scrub after saving any new recording: e2e output from `UPSTREAM_E2E_RECORD_DIR`, an observed failure, or a fresh probe.

1. Save the recording under `app/tests/fixtures/upstream/<group>/`.
2. Run the scrub from the repository root:

   ```bash
   npm --prefix app run fixtures:scrub
   npm --prefix app run fixtures:scrub -- --account-file <path to another .claude.json>
   ```

   It reads the live values from `~/.claude.json` (or the file given), replaces them in place, and also re-copies the planning recordings from `.scratch/anthropic-compat-api/`. It writes only files that changed and then runs the guard. It prints file names and counts, never the values. It exits 1 when there is no account file with an OAuth account. Where a value was split across deltas, the placeholder lands whole in the first chunk and the later chunks are left empty.
3. Add one row per new file to the index in `app/tests/fixtures/upstream/README.md`. The index test fails on a fixture without a row.
4. Commit the scrubbed recording and its row together.

The scrub knows only the account's email and names. Before committing, check a new recording for anything else private, such as a connector `authorization_token` or an internal URL. Turn-stream goldens that change deliberately are regenerated with `UPDATE_TURN_STREAM_GOLDENS=1` on the golden test that owns them.
