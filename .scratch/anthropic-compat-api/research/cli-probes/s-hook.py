#!/usr/bin/env python3
"""Ticket 21 PreToolUse command hook (WebSearch|WebFetch).

usage (as the `command` of a settings hook): s-hook.py --mode <mode> --log <path>

Reads the hook JSON from stdin, appends one JSON line {n, t, stdin, stdout, exit} to <path>,
prints the hook output for the mode on stdout and exits 0 (JSON decides, per the hooks reference).
The call ordinal n is kept in <path>.count under an flock so parallel hook processes don't race.

modes
  allowed-then-deny  n == 1: updatedInput = tool_input + {"allowed_domains": ["github.com"]}, no permissionDecision
                     n >= 2: permissionDecision deny, reason "max_uses reached"
  blocked-allow      n <= 2: permissionDecision allow + updatedInput = tool_input + {"blocked_domains": ["github.com"]}
                     n >= 3: deny "max_uses reached"
  fetch-hostlist     WebFetch: host of tool_input.url in ALLOW_HOSTS -> empty stdout (normal permission flow)
                     otherwise deny "url_not_allowed: host <h> is not in allowed_domains"; n >= 3: deny "max_uses reached"
"""
import fcntl, json, os, sys, time
from urllib.parse import urlsplit

ALLOW_HOSTS = {"example.com"}
DOMAIN = "github.com"

args = sys.argv[1:]
mode = args[args.index("--mode") + 1]
log = args[args.index("--log") + 1]

raw = sys.stdin.read()
try:
    data = json.loads(raw)
except Exception:
    data = None

with open(log + ".count", "a+") as cf:
    fcntl.flock(cf, fcntl.LOCK_EX)
    cf.seek(0)
    n = int(cf.read().strip() or 0) + 1
    cf.seek(0); cf.truncate(); cf.write(str(n)); cf.flush()
    fcntl.flock(cf, fcntl.LOCK_UN)

tool_input = (data or {}).get("tool_input") or {}
tool_name = (data or {}).get("tool_name")

def deny(reason):
    return {"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": reason}}

out = None
if mode == "allowed-then-deny":
    if n == 1:
        out = {"hookSpecificOutput": {"hookEventName": "PreToolUse", "updatedInput": {**tool_input, "allowed_domains": [DOMAIN]}}}
    else:
        out = deny("max_uses reached")
elif mode == "blocked-allow":
    if n <= 2:
        out = {"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "allow", "updatedInput": {**tool_input, "blocked_domains": [DOMAIN]}}}
    else:
        out = deny("max_uses reached")
elif mode == "fetch-hostlist":
    if n >= 3:
        out = deny("max_uses reached")
    else:
        host = (urlsplit(str(tool_input.get("url", ""))).hostname or "").lower()
        if host in ALLOW_HOSTS:
            out = None  # no decision: continue through the normal permission flow (tests the WebFetch(domain:*) allow rule)
        else:
            out = deny(f"url_not_allowed: host {host} is not in allowed_domains")
else:
    out = deny(f"hook misconfigured: unknown mode {mode}")

stdout = json.dumps(out) if out is not None else ""
with open(log, "a") as lf:
    lf.write(json.dumps({"n": n, "t": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "mode": mode, "tool_name": tool_name,
                         "stdin": data if data is not None else raw, "stdout": stdout, "exit": 0}) + "\n")
if stdout:
    sys.stdout.write(stdout)
sys.exit(0)
