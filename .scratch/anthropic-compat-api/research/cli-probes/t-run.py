import json, os, subprocess, sys, time, signal
S = os.path.dirname(os.path.abspath(__file__))
CLAUDE = os.path.expanduser("~/.local/share/mise/installs/claude/latest/claude")
COMMON = ["-p","--input-format","stream-json","--output-format","stream-json","--verbose","--include-partial-messages",
          "--tools","","--setting-sources=","--strict-mcp-config","--permission-mode","default","--permission-prompts","none",
          "--max-budget-usd","1","--no-session-persistence","--system-prompt","","--system-prompt-snapshot","off"]
PROBES = [
  ("A-max-output-100", ["--model","claude-fable-5-1"], {"CLAUDE_CODE_MAX_OUTPUT_TOKENS":"100"}, "Write a 400-word essay about tangerines."),
  ("B-alias-sonnet-effort-low", ["--model","sonnet","--effort","low"], {}, "Reply with the single word pong."),
  ("C-json-schema-stream", ["--model","claude-fable-5-1","--json-schema",'{"type":"object","properties":{"word":{"type":"string"}},"required":["word"]}'], {}, "Reply with the word pong."),
]
env = {k:v for k,v in os.environ.items() if not k.startswith("CLAUDE")}
for name, flags, extra, prompt in PROBES:
    e = dict(env); e.update(extra)
    cwd = os.path.join(S, "cwd"); os.makedirs(cwd, exist_ok=True)
    out = open(os.path.join(S, name + ".jsonl"), "w"); err = open(os.path.join(S, name + ".stderr.txt"), "w")
    t0 = time.time()
    p = subprocess.Popen([CLAUDE] + COMMON + flags, cwd=cwd, env=e, stdin=subprocess.PIPE, stdout=out, stderr=err, text=True)
    p.stdin.write(json.dumps({"type":"user","message":{"role":"user","content":[{"type":"text","text":prompt}]}}) + "\n"); p.stdin.close()
    try:
        rc = p.wait(timeout=75)
    except subprocess.TimeoutExpired:
        p.send_signal(signal.SIGINT)
        try: rc = p.wait(timeout=10)
        except subprocess.TimeoutExpired: p.kill(); rc = p.wait()
    out.close(); err.close()
    print(f"{name}: exit={rc} wall={time.time()-t0:.1f}s")
