# Minimal-context upstream run

Type: research
Status: resolved
Blocked by: none

## Question

Each `-p` run loads about 20k prompt tokens of default Claude Code context from `~/.claude` (CLAUDE.md files, skills, settings, MCP servers), and `--system-prompt` removes only ~4k of it while forcing a cache miss ([CLI contract](02-cli-headless-io-contract.md) §4, probes g1/g2). For a surface that wants to behave like a plain model endpoint, how far can that be cut, and at what cost? Measure, with the fewest probes possible (each consumes the subscription's five-hour window), the `message_start` input token count and cache behaviour for combinations of: `--setting-sources ""` (or a minimal list), `--safe-mode`, `--strict-mcp-config`, `--tools ""`, `--disable-slash-commands`, running from an empty directory, `--system-prompt` with and without `--system-prompt-snapshot off`, and whether `--bare` is usable at all on a subscription login (its help text says auth is API key only). Report the token floor reachable, which flags matter, and any behavioural side effects (hooks, skills, model self-identification).

Not fired automatically: the charting-time probes already used about 0.6 of the five-hour window on 2026-10-04. Fire when the human says so.

Write findings to `.scratch/anthropic-compat-api/research/minimal-context-upstream-run.md`, citing the probe for each number.

## Lead from the spike (2026-10-04)

Still not fired. From [Spike: round-trip one client tool call through upstream](06-spike-client-tool-round-trip.md), same machine, 2.1.289, empty cwd, no CLAUDE.md, `--tools "" --setting-sources= --strict-mcp-config`:

- Raw `claude -p`: about 9.8k prompt tokens on the first call (`cache_read 4834 + cache_creation 4988`). So `--setting-sources=` plus `--tools ""` already roughly halves the 20k the research measured.
- Agent SDK with default options: about 2.1k (`cache_read 1013 + cache_creation 1149`). Its `initialize` frame sent `systemPrompt: [""]`, so the remaining 7.7k on the raw path is Claude Code's default system prompt. The model answered the weather prompts normally in both.
- What this ticket still has to measure: whether `--system-prompt ""` (or `--system-prompt-file /dev/null`) on the raw CLI reaches the same floor without the cache-miss penalty the research saw, what `--safe-mode` and `--disable-slash-commands` add, self-identification under each, and `--bare` on a subscription login. Each probe now costs about 0.2 to 0.5 percent of the five-hour window with these flags, far less than the 20k-token probes did.

## Added by Conversation state and system prompt (2026-10-04)

Released by the human on 2026-10-04, together with [MCP tool name limits upstream](17-mcp-tool-name-limits-upstream.md) and [Image and document block pass-through upstream](18-image-and-document-pass-through-upstream.md), as one research pass.

The surface's flags are now decided (decisions 5 to 7 on that ticket): `--system-prompt <client text>` replacing the default, `--system-prompt-snapshot off`, `--setting-sources=`, `--strict-mcp-config`, `--tools ""`, an empty wrapper-owned cwd, `-p --input-format stream-json`. Measure under exactly those flags:

1. `--system-prompt ""` (empty replacement): `message_start` input tokens, cache behaviour on a second run, and what the model says when asked what it is and what tools it has (self-identification).
2. `--system-prompt "You are a helpful assistant."` as the realistic case.
3. Whether `--system-prompt-snapshot off` changes the token count or cache behaviour on a `--resume` run.
4. `--bare` on the subscription login (expected: refused; confirm the exact stderr).
5. `--safe-mode` and `--disable-slash-commands` only if they still add anything once `--setting-sources=` is in force.

Compare against the spike's baselines (raw about 9.8k, SDK about 2.1k, same flags minus the system-prompt ones). Hygiene as on ticket 18.

## Answer

Resolved 2026-10-04 on 2.1.289, seven runs, findings with every number cited in [research/minimal-context-upstream-run.md](../research/minimal-context-upstream-run.md); raw frames in `research/cli-probes/p*`.

- **Floor:** `--system-prompt ""` with the decided flags sends **493 input tokens** per run (about 25 are the user's question), nothing cached, nothing read, and a second identical run is identical; `--system-prompt "You are a helpful assistant."` sends 503. About $0.012 per run by the CLI's estimate. The spike's "9.8k / 2.1k" were two-call sums; its first calls were 4,836 (raw) and 1,015 (SDK), so the raw CLI with `--system-prompt` now beats the SDK's empty-prompt figure.
- **Flags that matter:** `--system-prompt <text>` does all the work beyond the spike's set. `--system-prompt-snapshot off` adds no tokens; on `--resume` it makes the flag text apply (default `on` reuses the recorded prompt and ignores new text) and stops the session file recording the prompt. `--safe-mode` and `--disable-slash-commands` change zero tokens (only the `init` lists). `--bare` is refused on the OAuth login with no API call: stdout carries a synthetic `"Not logged in · Please run /login"` assistant frame with `error: authentication_failed`, exit 1, stderr empty.
- **Self-identification:** always "Claude, made by Anthropic, built on Anthropic's Claude Agent SDK, model Fable 5.1, no tools"; never "Claude Code". Cause: the CLI prepends `You are a Claude agent, built on Anthropic's Claude Agent SDK.` to any `--system-prompt` and injects model, date, environment, budget and **account-email** `<system-reminder>` blocks into the first user turn. Thinking is on by default. Five-hour window 0.25 to 0.29 across the pass (shared with tickets 17 and 18).
