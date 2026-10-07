#!/usr/bin/env python3
"""Ticket 21 probe harness (adapted from p-run-probe.harness.py; that file is unchanged).

usage: s-run-probe.harness.py <name> <WebSearch|WebFetch> <hook-mode> <prompt>
Writes out/<name>.jsonl (stdout), out/<name>.stderr.txt (stderr + 'exit=<code>'), out/<name>.harness.txt
(argv, stdin, env stripped, exit, duration), appends to out/s-run-log.jsonl; the hook logs to hooklog/<name>.jsonl.
One stream-json user message on stdin, stdin closed right after; 180 s timeout -> SIGINT, SIGTERM, SIGKILL.
Runs from an empty scratch cwd, never the repo. Never --dangerously-skip-permissions.
"""
import json, os, signal, subprocess, sys, time
BASE = '/tmp/claude-1000/-home-anas-Work-claude-wrapper/23127712-bc1f-4f65-ab20-57491898aa91/scratchpad/probe-21'
CWD, OUT, HOOKLOG, HOOK = BASE + '/cwd', BASE + '/out', BASE + '/hooklog', BASE + '/s-hook.py'
CLI = '/home/anas/.local/share/mise/installs/claude/latest/claude'
TIMEOUT = 180
name, tool, mode, prompt = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
tool_args = {'WebSearch': ['--tools', 'WebSearch', '--allowedTools', 'WebSearch'],
             'WebFetch': ['--tools', 'WebFetch', '--allowedTools', 'WebFetch(domain:*)']}[tool]
settings = {"hooks": {"PreToolUse": [{"matcher": "WebSearch|WebFetch", "hooks": [
    {"type": "command", "command": f"{HOOK} --mode {mode} --log {HOOKLOG}/{name}.jsonl", "timeout": 30}]}]}}
args = [CLI, '-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose',
        '--include-partial-messages', '--include-hook-events', '--setting-sources=', '--strict-mcp-config',
        '--permission-mode', 'default', '--permission-prompts', 'none', '--max-budget-usd', '1',
        '--no-session-persistence', '--system-prompt', '', '--system-prompt-snapshot', 'off'] + tool_args + \
       ['--settings', json.dumps(settings)]
assert '--dangerously-skip-permissions' not in args
env = {k: v for k, v in os.environ.items() if not k.startswith('CLAUDE')}
stripped = sorted(k for k in os.environ if k.startswith('CLAUDE'))
assert not os.listdir(CWD), 'probe cwd must be empty'
assert not os.path.exists(f'{HOOKLOG}/{name}.jsonl'), 'hook log for this name already exists'
msg = json.dumps({"type": "user", "message": {"role": "user", "content": [{"type": "text", "text": prompt}]}}) + '\n'
t0 = time.time(); started = time.strftime('%Y-%m-%dT%H:%M:%S%z')
out_f = open(f'{OUT}/{name}.jsonl', 'wb'); err_f = open(f'{OUT}/{name}.stderr.txt', 'wb')
p = subprocess.Popen(args, cwd=CWD, env=env, stdin=subprocess.PIPE, stdout=out_f, stderr=err_f)
p.stdin.write(msg.encode()); p.stdin.flush(); p.stdin.close()
how = 'exited'
try:
    p.wait(timeout=TIMEOUT)
except subprocess.TimeoutExpired:
    how = 'timeout:SIGINT'; p.send_signal(signal.SIGINT)
    try: p.wait(timeout=10)
    except subprocess.TimeoutExpired:
        how = 'timeout:SIGTERM'; p.terminate()
        try: p.wait(timeout=5)
        except subprocess.TimeoutExpired: how = 'timeout:SIGKILL'; p.kill(); p.wait()
dur = time.time() - t0
out_f.close(); err_f.write(f'exit={p.returncode}\n'.encode()); err_f.close()
rec = {'probe': name, 'started': started, 'duration_s': round(dur, 2), 'exit': p.returncode, 'end': how,
       'cwd': CWD, 'argv': args, 'stdin': msg.strip(), 'env_stripped': stripped, 'hook_log': f'{HOOKLOG}/{name}.jsonl'}
with open(f'{OUT}/s-run-log.jsonl', 'a') as log: log.write(json.dumps(rec) + '\n')
with open(f'{OUT}/{name}.harness.txt', 'w') as h: h.write(json.dumps(rec, indent=1) + '\n')
print(f'{name}: exit={p.returncode} {how} {dur:.1f}s')
