import json, os, subprocess, time, signal
S = os.path.dirname(os.path.abspath(__file__))
CLAUDE = os.path.expanduser("~/.local/share/mise/installs/claude/latest/claude")
COMMON = ["-p","--input-format","stream-json","--output-format","stream-json","--verbose","--include-partial-messages",
          "--setting-sources=","--strict-mcp-config","--permission-mode","default","--permission-prompts","none",
          "--max-budget-usd","1","--no-session-persistence","--system-prompt","","--system-prompt-snapshot","off"]
Q = "What is 17*23? Think it through, then answer with just the number."
PROBES = [
  ("D-haiku-baseline", ["--tools","","--model","haiku"], {}, Q),
  ("E-haiku-disable-thinking", ["--tools","","--model","haiku"], {"CLAUDE_CODE_DISABLE_THINKING":"1"}, Q),
  ("G-haiku-max-thinking-1024", ["--tools","","--model","haiku"], {"MAX_THINKING_TOKENS":"1024"}, Q),
  ("W-websearch-cap-300", ["--tools","WebSearch","--allowedTools","WebSearch","--model","claude-fable-5-1"], {"CLAUDE_CODE_MAX_OUTPUT_TOKENS":"300"},
   "Search the web for the current population of Iceland and answer in one sentence."),
]
env = {k:v for k,v in os.environ.items() if not k.startswith("CLAUDE")}
for name, flags, extra, prompt in PROBES:
    e = dict(env); e.update(extra)
    cwd = os.path.join(S, "cwd"); os.makedirs(cwd, exist_ok=True)
    out = open(os.path.join(S, name + ".jsonl"), "w"); err = open(os.path.join(S, name + ".stderr.txt"), "w")
    t0 = time.time()
    p = subprocess.Popen([CLAUDE] + COMMON + flags, cwd=cwd, env=e, stdin=subprocess.PIPE, stdout=out, stderr=err, text=True)
    p.stdin.write(json.dumps({"type":"user","message":{"role":"user","content":[{"type":"text","text":prompt}]}}) + "\n"); p.stdin.close()
    try: rc = p.wait(timeout=100)
    except subprocess.TimeoutExpired:
        p.send_signal(signal.SIGINT)
        try: rc = p.wait(timeout=10)
        except subprocess.TimeoutExpired: p.kill(); rc = p.wait()
    out.close(); err.close()
    print(f"{name}: exit={rc} wall={time.time()-t0:.1f}s")
