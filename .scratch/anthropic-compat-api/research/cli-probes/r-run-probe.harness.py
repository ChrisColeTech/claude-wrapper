#!/usr/bin/env python3
"""Run one upstream probe for ticket 20 (adapted from p-run-probe.harness.py; base flags per the ticket).
usage: r-run-probe.harness.py <name> <prompt> [ENV:KEY=VAL ...] [SYS:<system prompt text>] [extra claude args...]
Writes out/<name>.jsonl (stdout), out/<name>.stderr.txt (stderr + 'exit=<code>'), appends to out/r-run-log.jsonl,
and, when the session persisted, copies ~/.claude/projects/<cwd-slug>/<session_id>.jsonl to out/<name>.transcript.jsonl."""
import glob, json, os, shutil, signal, subprocess, sys, time
BASE = '/tmp/claude-1000/-home-anas-Work-claude-wrapper/23127712-bc1f-4f65-ab20-57491898aa91/scratchpad/probe-20'
CWD, OUT = BASE + '/cwd', BASE + '/out'
CLI = '/home/anas/.local/share/mise/installs/claude/latest/claude'
TIMEOUT = 120
name, prompt, rest = sys.argv[1], sys.argv[2], sys.argv[3:]
env_added = dict(a[4:].split('=', 1) for a in rest if a.startswith('ENV:'))
sys_prompt = next((a[4:] for a in rest if a.startswith('SYS:')), '')
extra = [a for a in rest if not a.startswith(('ENV:', 'SYS:'))]
args = [CLI, '-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
        '--tools', '', '--setting-sources=', '--strict-mcp-config', '--permission-mode', 'default', '--permission-prompts', 'none',
        '--max-budget-usd', '1', '--system-prompt', sys_prompt, '--system-prompt-snapshot', 'off'] + extra
assert '--dangerously-skip-permissions' not in args and '--bare' not in args
env = {k: v for k, v in os.environ.items() if not k.startswith('CLAUDE')}
stripped = sorted(k for k in os.environ if k.startswith('CLAUDE'))
env.update(env_added)
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
session_id, transcript = None, None
try:
    for line in open(f'{OUT}/{name}.jsonl'):
        d = json.loads(line)
        if d.get('type') == 'system' and d.get('subtype') == 'init': session_id = d.get('session_id'); break
except Exception: pass
if session_id:
    slug = CWD.replace('/', '-')
    hits = glob.glob(os.path.expanduser(f'~/.claude/projects/{slug}/{session_id}.jsonl')) or \
           glob.glob(os.path.expanduser(f'~/.claude/projects/*/{session_id}.jsonl'))
    if hits: transcript = f'{OUT}/{name}.transcript.jsonl'; shutil.copyfile(hits[0], transcript)
with open(f'{OUT}/r-run-log.jsonl', 'a') as log:
    log.write(json.dumps({'probe': name, 'started': started, 'duration_s': round(dur, 2), 'exit': p.returncode, 'end': how,
                          'cwd': CWD, 'argv': args, 'stdin': msg.strip(), 'env_stripped': stripped, 'env_added': env_added,
                          'session_id': session_id, 'transcript_copied_from': hits[0] if session_id and hits else None}) + '\n')
print(f'{name}: exit={p.returncode} {how} {dur:.1f}s session={session_id} transcript={transcript}')
