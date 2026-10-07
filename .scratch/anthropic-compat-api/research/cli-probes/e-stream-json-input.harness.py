import subprocess, json, time, threading, base64, zlib, struct
CLAUDE="/home/anas/.local/share/mise/installs/claude/latest/claude"
OUT="/home/anas/Work/claude-wrapper/.scratch/anthropic-compat-api/research/cli-probes/e-stream-json-input.jsonl"
LOG="/home/anas/Work/claude-wrapper/.scratch/anthropic-compat-api/research/cli-probes/e-stream-json-input.harness.txt"
cmd=[CLAUDE,"-p","--input-format","stream-json","--output-format","stream-json","--verbose","--replay-user-messages","--tools","","--max-budget-usd","0.25","--strict-mcp-config"]
p=subprocess.Popen(cmd,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1)
lines=[]; out=open(OUT,"w"); log=open(LOG,"w"); T0=time.time()
def note(s):
    s=f"[{time.time()-T0:6.2f}s] {s}"; print(s); log.write(s+"\n"); log.flush()
def reader():
    for line in p.stdout:
        out.write(line); out.flush(); lines.append(line)
        try:
            o=json.loads(line); extra=""
            if o.get('type')=='result': extra=f"subtype={o.get('subtype')} result={str(o.get('result'))[:80]!r} num_turns={o.get('num_turns')} is_error={o.get('is_error')} errors={o.get('errors')}"
            if o.get('type')=='assistant': extra="content="+json.dumps(o['message']['content'])[:160]
            if o.get('type')=='user': extra="content="+json.dumps(o['message']['content'])[:160]
            note(f"<- type={o.get('type')} subtype={o.get('subtype')} {extra}")
        except Exception: note(f"<- NONJSON {line[:120]!r}")
threading.Thread(target=reader,daemon=True).start()
def send(obj):
    s=json.dumps(obj); note(f"-> {s[:140]}"); p.stdin.write(s+"\n"); p.stdin.flush()
def wait_result(n, timeout=60):
    t=time.time()
    while time.time()-t<timeout:
        if p.poll() is not None: note(f"process exited early rc={p.returncode}"); return False
        if sum(1 for l in lines if '"type":"result"' in l)>=n: return True
        time.sleep(0.2)
    note(f"TIMEOUT waiting for result #{n}"); return False
def chunk(t,d): return struct.pack(">I",len(d))+t+d+struct.pack(">I",zlib.crc32(t+d)&0xffffffff)
png=base64.b64encode(b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR",struct.pack(">IIBBBBB",1,1,8,2,0,0,0))+chunk(b"IDAT",zlib.compress(b"\x00\xff\x00\x00"))+chunk(b"IEND",b"")).decode()
send({"type":"user","message":{"role":"user","content":[{"type":"text","text":"Reply with the single word pong"}]}})
ok=wait_result(1)
if ok:
    note("stdin still open; sending second message with an image block")
    send({"type":"user","message":{"role":"user","content":[{"type":"image","source":{"type":"base64","media_type":"image/png","data":png}},{"type":"text","text":"What colour is this 1x1 image? Answer with one word."}]}})
    ok=wait_result(2)
if ok:
    note("sending third message: a bare tool_result block for an unknown tool_use_id")
    send({"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_01FakeFakeFakeFakeFakeFa","content":"42"}]}})
    ok=wait_result(3, timeout=45)
note("closing stdin")
try: p.stdin.close()
except Exception as e: note(f"stdin close error {e}")
try: rc=p.wait(timeout=30); note(f"process exit rc={rc} ({time.time()-T0:.2f}s after start)")
except subprocess.TimeoutExpired: note("process did not exit 30s after stdin close; killing"); p.kill(); p.wait()
note(f"stderr: {p.stderr.read()[:2000]!r}")
out.close(); log.close()
