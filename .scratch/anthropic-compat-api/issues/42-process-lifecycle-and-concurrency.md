# 42: Process lifecycle and concurrency

Spec: [spec.md](../spec.md), section 14

**What to build:** The wrapper stays healthy under load and across restarts: a run cap answers 529 at once, upstream's rate-limit rejection answers 429 with `retry-after` before any spawn, one upstream session never runs two runs at once, every early end descends one teardown ladder, shutdown drains cleanly, disk use is bounded, and `/health` shows the counts.

**Blocked by:** 34 (Client tools round trip), 40 (Upstream failure mapping)

**Status:** resolved

- [x] The scheduler: `admit(plan) → Lease | SurfaceError` (the run cap over active plus parked, default 4, parked never evicted; rate-limit admission from the last `rate_limit_event`; a per-session mutex with a FIFO queue and re-plan after acquisition; the continued-turn wait for the previous exit up to 10 s then SIGKILL), `Lease.release()`, `registerParked(run)`, `shutdown(deadline)`
- [x] The teardown ladder for every early end: interrupt, `result` 5 s, close stdin, exit 2 s, SIGTERM 5 s, SIGKILL; a run ended before `result` is an error turn
- [x] Shutdown: 529 for newcomers, the SSE error "server shutting down" for streams, parked runs interrupted and rejected, every run down the ladder in parallel, the drain bounded at 15 s
- [x] Disk: orphan transcripts deleted at start, an hourly sweep of files older than the expiry, per-run directories removed at teardown
- [x] The active-lifetime timer excludes park time; `--max-turns` hits are post-commit 500s
- [x] `/health` gains the scheduler's counts (active, parked, queued per session, last rate-limit state); every timer firing, cap rejection, kill and sweep logged with the request id and upstream session id; connector and control-server tokens never logged
- [x] Unit with a fake clock and the replay runner: cap, admission, mutex and re-plan, the ladder, shutdown; integration through the SDK: 529 at the cap, 429 after a rejected rate-limit event
- [x] E2E (flag): shutdown with one parked and one streaming run leaves no child process

## Comments

- Resolved by merge 8809cb5 on anthropic-compat-api.
- The E2E criterion is ticked on the test being written (`app/tests/e2e/upstream/shutdown.test.ts`); its run against the real CLI is still pending.
- Ticket 31's fast-follow-up gap is closed: a clean turn records its session at response end, and an error `result` undoes that.
- The scheduler lives in the anthropic package (`app/src/anthropic/scheduler/`), not in upstream as spec section 16 lists it.
- The public `/health` now always has an `anthropic` key, including the upstream session ids of sessions with queued turns.
- `wrapper --stop` still waits only 10 s for the process to exit, while the shutdown drain can take 15 s.
- Follow-up (branch impl/followups): the public `/health` shows aggregate counts only (active, parked, total queued, last rate-limit state); upstream session ids are gone from it and stay in the log.
- 2026-10-07: real-CLI run passed (`shutdown.test.ts`: two runs drained in 1131 ms, no child left).
