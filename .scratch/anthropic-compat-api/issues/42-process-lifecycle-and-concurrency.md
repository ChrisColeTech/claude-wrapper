# 42: Process lifecycle and concurrency

Spec: [spec.md](../spec.md), section 14

**What to build:** The wrapper stays healthy under load and across restarts: a run cap answers 529 at once, upstream's rate-limit rejection answers 429 with `retry-after` before any spawn, one upstream session never runs two runs at once, every early end descends one teardown ladder, shutdown drains cleanly, disk use is bounded, and `/health` shows the counts.

**Blocked by:** 34 (Client tools round trip), 40 (Upstream failure mapping)

**Status:** ready-for-agent

- [ ] The scheduler: `admit(plan) → Lease | SurfaceError` (the run cap over active plus parked, default 4, parked never evicted; rate-limit admission from the last `rate_limit_event`; a per-session mutex with a FIFO queue and re-plan after acquisition; the continued-turn wait for the previous exit up to 10 s then SIGKILL), `Lease.release()`, `registerParked(run)`, `shutdown(deadline)`
- [ ] The teardown ladder for every early end: interrupt, `result` 5 s, close stdin, exit 2 s, SIGTERM 5 s, SIGKILL; a run ended before `result` is an error turn
- [ ] Shutdown: 529 for newcomers, the SSE error "server shutting down" for streams, parked runs interrupted and rejected, every run down the ladder in parallel, the drain bounded at 15 s
- [ ] Disk: orphan transcripts deleted at start, an hourly sweep of files older than the expiry, per-run directories removed at teardown
- [ ] The active-lifetime timer excludes park time; `--max-turns` hits are post-commit 500s
- [ ] `/health` gains the scheduler's counts (active, parked, queued per session, last rate-limit state); every timer firing, cap rejection, kill and sweep logged with the request id and upstream session id; connector and control-server tokens never logged
- [ ] Unit with a fake clock and the replay runner: cap, admission, mutex and re-plan, the ladder, shutdown; integration through the SDK: 529 at the cap, 429 after a rejected rate-limit event
- [ ] E2E (flag): shutdown with one parked and one streaming run leaves no child process
