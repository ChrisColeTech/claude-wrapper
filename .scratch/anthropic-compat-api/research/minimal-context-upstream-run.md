# Minimal-context upstream run

Research for wayfinder ticket [16](../issues/16-minimal-context-upstream-run.md). Vocabulary: [`GLOSSARY.md`](../../../GLOSSARY.md) (upstream = the Claude Code CLI process; run = one invocation of it).

**Upstream probed:** `/home/anas/.local/share/mise/installs/claude/latest/claude`, `claude --version` = `2.1.289 (Claude Code)`, on the human's subscription (OAuth) login, 2026-10-04 19:11 to 19:15 local. Every raw transcript is in [`cli-probes/`](cli-probes/) with a `p-` prefix; `cli-probes/p-run-log.jsonl` records each run's exact argv, start time, duration, exit code and the environment variables stripped; `cli-probes/p-run-probe.harness.py` is the runner.

## Short answer

- **Floor:** with `--system-prompt ""` a run sends **493 input tokens** (about 25 of them the user's question), with **no cache write and no cache read**; a second identical run is identical (493, nothing cached, nothing read). `--system-prompt "You are a helpful assistant."` sends 503. Cost by the CLI's own estimate: $0.012 to $0.013 per run (`p1`, `p2`, `p3`).
- **Flags that matter:** `--system-prompt <text>` is what takes the spike's 4.8k down to 0.5k. `--safe-mode` and `--disable-slash-commands` change nothing in the token count once `--setting-sources=` is in force (`p5` = `p1` exactly); they only empty the `init` frame's skill and slash-command lists. `--system-prompt-snapshot off` changes nothing on a first run; on `--resume` it decides whether the flag text applies (`p6` yes, `p7` no). `--bare` is unusable on this login (`p4`, no API call).
- **Self-identification:** under every flag set the model answers that it is Claude, made by Anthropic, "built on Anthropic's Claude Agent SDK", names its model (Fable 5.1) and says it has no tools. It never says "Claude Code". The reason is visible in the persisted session: the CLI prefixes every system prompt with `"You are a Claude agent, built on Anthropic's Claude Agent SDK."` and injects model, date, environment, budget and account-email `<system-reminder>` blocks into the first user turn. An "empty" system prompt is therefore about 470 tokens of Claude Code context, not zero.

## Method

Common argv on every run (`cli-probes/p-run-log.jsonl`, `argv`):

```
claude -p --input-format stream-json --output-format stream-json --verbose --include-partial-messages \
  --tools "" --setting-sources= --strict-mcp-config --permission-mode default --permission-prompts none --max-budget-usd 1 \
  <per-probe flags>
```

- cwd: a freshly created, empty directory under the session scratchpad (`.../scratchpad/probe-16/cwd`), never the repo, so no `CLAUDE.md` loads. The `init` frame confirms `cwd` and `memory_paths` under that directory (`p1-empty-system-prompt.jsonl` L1).
- stdin: exactly one line, `{"type":"user","message":{"role":"user","content":[{"type":"text","text":"..."}]}}`, then stdin closed (`p-run-log.jsonl`, `stdin`).
- env: the parent Claude Code session's `CLAUDE*` variables were removed before spawning (`CLAUDECODE`, `CLAUDE_CODE_ENTRYPOINT`, `CLAUDE_CODE_SESSION_ID`, `CLAUDE_EFFORT`, and six more; full list in `p-run-log.jsonl`, `env_stripped`). The spike removed only four of these; a wrapper running as a server would have none of them.
- timeout: 120 s per run, SIGINT then SIGTERM then SIGKILL. No run needed it; the slowest took 9.2 s wall, `--bare` exited in 0.8 s (`p-run-log.jsonl`, `duration_s`).
- `--no-session-persistence` on every run except `p3` (persisted so `p6`/`p7` could resume it). `find ~/.claude/projects -name '<session_id>*'` found nothing for `p1`, `p2`, `p4`, `p5`; `p3` wrote a 13.5 KB transcript, copied to `cli-probes/p6-session-after-resume.transcript.jsonl` (after `p6`) and `cli-probes/p7-session-after-resume.transcript.jsonl` (after `p7`). Those two copies contain the account email the CLI injected (see Side effects).
- Self-identification prompt on `p1`-`p5`: `In one sentence: what are you, who made you, and what tools do you have available right now?`
- Numbers come from the `stream_event` `message_start` usage, `result.usage`, `result.total_cost_usd`, `system/init`, and `rate_limit_event.rate_limit_info.unifiedWindows`; line numbers below (`L<n>`) index the cited `.jsonl` file. Never passed: `--dangerously-skip-permissions`. `--bare` passed once (`p4`), not retried.

## Results

Input tokens are the `message_start` usage of the single model call each run made (every run had `num_turns: 1` and one `iterations` entry). "cost" is `result.total_cost_usd` (the CLI's own estimate; the subscription is not billed per token, the real cost is the five-hour window). Output tokens include thinking.

| Probe (file prefix in `cli-probes/`) | Per-probe flags | input / cache_creation (1h) / cache_read | output (thinking) | cost | What the model said |
| - | - | - | - | - | - |
| `p1-empty-system-prompt` | `--system-prompt "" --system-prompt-snapshot off --no-session-persistence` | **493 / 0 / 0** (L3) | 149 (79) | $0.01238 (L36) | "I'm Claude, an AI agent built by Anthropic on the Claude Agent SDK (running the Fable 5.1 model), and in this particular session I have no tools available—just the ability to converse with you in text." (L31) |
| `p2-empty-system-prompt-repeat` | identical to p1, 40 s later | **493 / 0 / 0** (L3) | 148 (72) | $0.01233 (L32) | "I'm a Claude agent built on Anthropic's Claude Agent SDK and powered by the Fable 5.1 model, made by Anthropic, and in this particular session no tools have been provided to me, so I can only respond with text." (L27) |
| `p3-helpful-assistant-persisted` | `--system-prompt "You are a helpful assistant."` (snapshot default `on`, session persisted) | **503 / 0 / 0** (L3) | 167 (78) | $0.01338 (L36) | "I'm a Claude agent built on Anthropic's Claude Agent SDK and powered by the Fable 5.1 model, made by Anthropic, and in this particular session I don't have any tools exposed to me—no file, shell, or web access—so I can only respond with text." (L31) |
| `p4-bare` | `--bare --system-prompt "" --system-prompt-snapshot off --no-session-persistence` | no API call (`duration_api_ms: 0`) | 0 | $0 | synthetic assistant message `"Not logged in · Please run /login"`, `"error":"authentication_failed"`, exit 1 (L4, L5; stderr empty) |
| `p5-safe-mode-disable-slash` | `--safe-mode --disable-slash-commands --system-prompt "" --system-prompt-snapshot off --no-session-persistence` | **493 / 0 / 0** (L3) | 148 (77) | $0.01233 (L34) | "I'm Claude, an AI agent built by Anthropic on the Claude Agent SDK (running as the model Fable 5.1), and in this particular session no tools have been made available to me—I can only read and respond with text." (L29) |
| `p6-resume-snapshot-off` | `--resume <p3> --system-prompt-snapshot off --system-prompt "You are a helpful assistant. End every reply with the word BANANA."`; prompt "In one sentence, what did I ask you before this message?" | **2 / 662 / 0** (L3) | 85 (46) | $0.03089 cumulative = p3 + $0.01751 (L23) | "You asked me to explain, in one sentence, what I am, who made me, and what tools I have available right now.\n\nBANANA" (L18) |
| `p7-resume-snapshot-on` | `--resume <p3> --system-prompt "...BANANA."` (snapshot default `on`); prompt "In one sentence, what did I ask you in my first message?" | **2 / 829 / 0** (L3) | 192 (119) | $0.05709 cumulative = p6 + $0.02620 (L32) | "In your first message, you asked me to say in one sentence what I am, who made me, and what tools I have available right now—and I'll note that the stray "BANANA" at the end of my last reply wasn't an intentional part of my answer." (L27) |

`init` frame on the normal path (`p1` L1): `tools: []`, `mcp_servers: []`, `model: claude-fable-5-1`, `permissionMode: default`, `apiKeySource: "none"`, 54 `slash_commands`, 19 `skills`, 5 `agents`, 4 builtin `plugins`. API latency `duration_api_ms`: 5429, 7371, 5562, 4837, 12338, 18230 for p1, p2, p3, p5, p6, p7.

### Measurement 1: `--system-prompt ""`

493 input tokens, `cache_creation_input_tokens: 0`, `cache_read_input_tokens: 0` on the first run (`p1` L3) and exactly the same on the second (`p2` L3). There is no cache-miss penalty of the kind the CLI contract saw with the 16k default prompt (§4, g1), because nothing is cached at all at this size: the whole 493 is billed as plain input each run. Self-identification: see table; both runs name Anthropic, the Claude Agent SDK, the model Fable 5.1, and "no tools".

### Measurement 2: `--system-prompt "You are a helpful assistant."`

503 input tokens (`p3` L3): 10 more than the empty prompt, which is the text itself. Same no-cache behaviour, same self-identification.

### Measurement 3: `--system-prompt-snapshot off` on `--resume`

- The session `p3` persisted holds a `prompt_snapshot` attachment with `systemPrompt: ["You are a helpful assistant."]`, `tools: []`, `cliPrefix: "You are a Claude agent, built on Anthropic's Claude Agent SDK."` (`p7-session-after-resume.transcript.jsonl` L12 and L15). So prompt recording is enabled on this login and version.
- `p6` (resume, `off`, new text ending "BANANA"): the new text applied (reply ends with `BANANA`, L18), the history was restored (it recalled the first question), and the resume recorded **no** new `prompt_snapshot` (transcript L18-L28 contain `user`, `total_tokens_reminder`, `budget_usd`, `thinking_drop`, `assistant`, `last-prompt`, `mode`, `cost-state` only). A wrapper that always passes `off` therefore never writes the client's system text into the session file.
- `p7` (same session, snapshot default `on`, same new text): the recorded prompt won; the reply does not end with BANANA and the model calls the earlier BANANA "stray" (L27). This matches `--help`: "every later request and resume sends the record as-is, even when a later launch passes different text".
- Token count: `off` does not change what a first run sends (`p1` 493 with `off` versus `p3` 503 with `on`, the difference being the 10-token prompt text). On resume, `p6` sent 664 (2 + 662) and `p7` 831 (2 + 829); the 167-token gap is the `p6` exchange that `p7`'s history additionally carries (thinking is dropped from history, `thinking_drop` attachment), so the snapshot setting itself did not add tokens.
- Cache: both resumes were full 1h cache **writes** with zero reads (`p6` L3, `p7` L3). `p6` could not hit anything because its system prompt differed from `p3`'s; `p7` could not because `p3` had written no cache entry (first-run `cache_creation: 0`) and `p6`'s prefix differed. Nothing here shows `off` costing a cache miss on its own; what it costs is whatever the client's system text change costs, which is inherent.

### Measurement 4: `--bare` on the subscription login

Refused without an API call, in 0.8 s, exit 1 (`p4-bare.jsonl`, `p4-bare.stderr.txt` = `exit=1`, otherwise empty). The refusal is **on stdout, not stderr**: an `init` frame with `"apiKeySource":"none"` and, notably, `"model":"claude-opus-5-5"` (the OAuth path's default is `claude-fable-5-1`), then a `system/status requesting` frame, then an `assistant` frame with `"model":"<synthetic>"`, text `"Not logged in · Please run /login"`, `"error":"authentication_failed"`, `"is_api_error_message":true`, then a `result` with `"is_error":true`, `"terminal_reason":"api_error"`, `"api_error_status":null`, `"total_cost_usd":0`, `"duration_api_ms":0`. The `--bare` init also dropped the `cc-plugin-sec-default` builtin plugin and the `schedule`, `usage-credits`, `extra-usage` commands. Consistent with `--help`: "Anthropic auth is strictly ANTHROPIC_API_KEY or apiKeyHelper via --settings (OAuth and keychain are never read)". No quota was consumed.

### Measurement 5: `--safe-mode` and `--disable-slash-commands`

No token effect: 493 / 0 / 0, identical to `p1` (`p5` L3), same cost, same self-identification (L29). The only differences are in the `init` frame (`p5` L1 versus `p1` L1): `slash_commands: []` (was 54), `skills: []` (was 19), `agents` without `statusline-setup`, `memory_paths: null`, no `terminal_slash_commands`; the four builtin `plugins` are still listed. So with `--setting-sources=` and `--system-prompt` already in force these two flags are cosmetic for the request; they are a defence against future versions putting skills into a replaced prompt, nothing more.

## Which flags matter, in order

| Flag | Effect on the request | Source |
| - | - | - |
| `--tools "" --setting-sources= --strict-mcp-config`, empty cwd | 20k (CLI contract §4, default context) to about 4.8k with the default system prompt. Not re-measured here; see the baseline note below. | spike `cli-http-happy` |
| `--system-prompt <text>` | 4.8k to 0.49k + the text. Removes the default system prompt (tool instructions, skills listing, environment sections) but not the CLI prefix line or the user-turn reminders. | `p1`, `p3` |
| `--system-prompt-snapshot off` | 0 tokens on a first run. On resume: flag text applies (`on`: recorded text applies). Prevents the session file from recording the prompt. | `p1`/`p3`, `p6`/`p7` |
| `--safe-mode`, `--disable-slash-commands` | 0 tokens. Empties `init.skills`, `init.slash_commands`. | `p5` |
| `--max-budget-usd 1` | Adds a `USD budget: $0/$1; $1 remaining` reminder to each user turn (a few tokens). | transcript L7, L22, L33 |
| `--bare` | Unusable with OAuth: no API call. | `p4` |
| `--no-session-persistence` | No transcript on disk; cannot `--resume`. | `find` results in Method |

## Side effects

1. **The system prompt is never empty.** Claude Code prepends `You are a Claude agent, built on Anthropic's Claude Agent SDK.` (`cliPrefix`, transcript L15) to whatever `--system-prompt` passes. This is where the model's "built on the Claude Agent SDK" self-description comes from. No flag in `--help` disables it on the OAuth path (`--bare` sets `CLAUDE_CODE_SIMPLE=1` but is refused; `--exclude-dynamic-system-prompt-sections` is "ignored with --system-prompt").
2. **Six `<system-reminder>` blocks ride in the first user turn** (transcript L4-L11, rendered text visible there): environment (cwd, "Is a git repository: false", platform, shell, OS version), model identity ("You are powered by the model named Fable 5.1. The exact model ID is claude-fable-5-1. Assistant knowledge cutoff is June 2026."), `<total_tokens>15000000 tokens left</total_tokens>`, the USD budget line, today's date, and **`session_context` with the account owner's email**: "The user's email address is user@example.invalid. Use it only to identify the user ... Claude Code attached this context automatically". A `credential_org` attachment (organisation UUID) is recorded but has no rendered text. On resume only `total_tokens_reminder`, `budget_usd` and `thinking_drop` are added (transcript L21-L23, L32-L34). The email injection is the one item a multi-client surface must treat as a leak risk; whether a client `system` text can suppress it was not probed.
3. **The `init` frame overstates the prompt.** On the normal path it lists 54 slash commands and 19 skills (`p1` L1) while the request is 493 tokens, which cannot contain them. Do not infer prompt content from `init`.
4. **Thinking is on by default.** Every reply carried a `thinking` block (`p1` L10) and 46 to 119 thinking tokens, 30 to 60 percent of output on these one-sentence answers (`result.usage.output_tokens_details`). Resume drops earlier thinking from history (`thinking_drop`).
5. **Cache threshold.** 493 and 503-token requests were not cached at all; 664 and 831-token requests were written to the 1-hour cache in full (`p6`, `p7` L3). So the cacheable minimum for `claude-fable-5-1` on this account lies between 504 and 664 tokens. By the CLI's cost estimates (derived: input $10/M, output $50/M, 1h cache write $20/M, which reproduce every `total_cost_usd` above to the cent), a 1h cache write costs twice a plain read, so for sub-1k prompts caching only pays if the identical prefix is hit within the hour. Below the threshold the question is moot: every run is a full, cheap read.
6. **Hooks:** no hook frames appeared in any run; `--include-hook-events` was not passed, and `--setting-sources=` keeps user hooks from loading, so this is consistent but not a test of hooks.
7. **Model default differs by auth path:** `--bare` (API-key path) reported `claude-opus-5-5`, the OAuth path `claude-fable-5-1` (`p4` L2 versus `p1` L1).

## Comparison with the spike's baselines

The ticket quotes the spike as "raw about 9.8k, SDK about 2.1k". Those figures are `result.usage` sums over the **two** model calls each spike run made (the tool call and the answer): `cache_creation 4988 = 4834 + 154` and `cache_read 4834` for the raw run, `1149 = 1013 + 136` and `1013` for the SDK run (`../spike/runs/cli-http-happy.wire.ndjson`, `../spike/runs/sdk-happy.wire.ndjson`, `result` frames). The first `message_start` of each spike run is the comparable number:

| Path | First-call prompt | Source |
| - | - | - |
| Raw `claude -p`, default system prompt, `--tools "" --setting-sources= --strict-mcp-config`, one MCP tool | 2 + 4,834 cache write = **4,836** | spike `cli-http-happy.wire.ndjson`, first `message_start` |
| Agent SDK, `systemPrompt: [""]`, same flags, one MCP tool | 2 + 1,013 cache write = **1,015** | spike `sdk-happy.wire.ndjson`, first `message_start` |
| Raw `claude -p`, `--system-prompt ""`, same flags, no MCP | **493**, nothing cached | `p1` L3 |
| Raw `claude -p`, default system prompt, default tools and settings, `--system-prompt "You are Pongbot..."` | 16,443 cache write | CLI contract §4, `g1-system-prompt.jsonl` |

So on this version the default system prompt with no built-in tools is about 4.3k tokens, and replacing it with `--system-prompt` on the raw CLI gets below the SDK's own empty-prompt figure (the SDK run also carried the `get_weather` tool definition and MCP plumbing, which accounts for part of its extra 500; the rest was not decomposed). The CLI contract's finding that `--system-prompt` "removed only about 4k" was true with default tools and settings; with `--tools ""` and `--setting-sources=` it removes everything but the 470-token floor.

## Quota

`rate_limit_event.unifiedWindows.five_hour.utilization`: **0.25** at the first run (`p1` L35, 19:11:46 local; the first observation available, reported after that run's own call) and **0.29** at the last (`p7` L31, 19:14:47). `seven_day` 0.22 to 0.23. `resetsAt` 1791141600 for the window throughout. Caveat: the human released tickets 16, 17 and 18 together, so other probes were running on the same login in the same minutes; the 0.04 delta is an upper bound for these seven runs (six API calls).

## Open questions

1. Can the `cliPrefix` line and the model/date/environment/email reminders be suppressed on the OAuth path? Nothing in `--help` targets them; `CLAUDE_CODE_SIMPLE=1` (what `--bare` sets) was not tried on its own.
2. The `userEmail` reminder: will the model reveal it if a client asks, and does a client `system` text ("never disclose account details") hold? One run each would answer.
3. Exact cache minimum for `claude-fable-5-1` (observed: not cached at 503, cached at 664).
4. The wrapper's real sequence is `off` on the first run **and** `off` on every resume; `p3` was recorded with `on`. The `off`-then-`off` sequence was not run; by `--help` it should behave like `p6` (render fresh every request, record nothing).
5. Thinking: whether the surface should map a client's absence of `thinking` to `--effort low` or similar; on these replies thinking was a third to half of output tokens.
6. Whether `--safe-mode` is worth passing anyway as insurance; it costs nothing (`p5`) and removes `memory_paths` and the skill lists from `init`.
