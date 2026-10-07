#!/usr/bin/env python3
"""Run one upstream probe. usage: run_probe.py <name> <prompt> [extra claude args...]
Writes out/<name>.jsonl (stdout), out/<name>.stderr.txt (stderr + 'exit=<code>'), appends to out/p-run-log.txt."""
import json, os, signal, subprocess, sys, time
BASE = '/tmp/claude-1000/-home-anas-Work-claude-wrapper/23127712-bc1f-4f65-ab20-57491898aa91/scratchpad/probe-16'
CWD, OUT = BASE + '/cwd', BASE + '/out'
CLI = '/home/anas/.local/share/mise/installs/claude/latest/claude'
TIMEOUT = 120
name, prompt, extra = sys.argv[1], sys.argv[2], sys.argv[3:]
args = [CLI, '-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
        '--tools', '', '--setting-sources=', '--strict-mcp-config', '--permission-mode', 'default', '--permission-prompts', 'none',
        '--max-budget-usd', '1'] + extra
assert '--dangerously-skip-permissions' not in args
env = {k: v for k, v in os.environ.items() if not k.startswith('CLAUDE')}
stripped = sorted(k for k in os.environ if k.startswith('CLAUDE'))
assert not os.listdir(CWD), 'probe cwd must be empty'
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
with open(f'{OUT}/p-run-log.txt', 'a') as log:
    log.write(json.dumps({'probe': name, 'started': started, 'duration_s': round(dur, 2), 'exit': p.returncode, 'end': how,
                          'cwd': CWD, 'argv': args, 'stdin': msg.strip(), 'env_stripped': stripped}) + '\n')
print(f'{name}: exit={p.returncode} {how} {dur:.1f}s')
