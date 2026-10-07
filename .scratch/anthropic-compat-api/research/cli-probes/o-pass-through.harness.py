#!/usr/bin/env python3
"""Ticket 18 probe: which image/document block sources does Claude Code forward upstream
when they arrive as --input-format stream-json user content?

Usage: python3 o-pass-through.harness.py <run-name> [start-index] [--set run1|run2] [--dry-run]
  run-name     e.g. o-pass-through-run1 ; outputs <PROBES>/<run-name>.jsonl, .stderr.txt, .harness.txt
  start-index  0-based index into MESSAGES to start from (for a second run after a 400 ended the first)
One upstream run, stdin held open, one user message per block source, cheapest first; each message
waits for its own `result` frame before the next is sent; stdin closed at the end; 120 s per-message
timeout -> SIGINT, then SIGTERM, then SIGKILL. Runs from an empty scratch cwd, never the repo.
"""
import subprocess, json, time, threading, base64, sys, os, signal

CLAUDE = "/home/anas/.local/share/mise/installs/claude/latest/claude"
PROBES = "/home/anas/Work/claude-wrapper/.scratch/anthropic-compat-api/research/cli-probes"
SCRATCH = "/tmp/claude-1000/-home-anas-Work-claude-wrapper/23127712-bc1f-4f65-ab20-57491898aa91/scratchpad/probe-18"
CWD = os.path.join(SCRATCH, "cwd")           # empty directory: no CLAUDE.md, no project settings
PDF_PATH = os.path.join(SCRATCH, "tangerine.pdf")
IMAGE_URL = "https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png"  # 800x600 PNG, dice
PDF_URL = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"                      # 1 page, text "Dummy PDF file"
PER_MESSAGE_TIMEOUT = 120
PERMISSION_MODE = os.environ.get("PROBE_PERMISSION_MODE", "default")

def make_pdf(text):
    """Minimal valid one-page PDF (Helvetica, one Tj) with a correct xref table."""
    stream = f"BT /F1 24 Tf 72 700 Td ({text}) Tj ET".encode()
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"); offsets = []
    for i, o in enumerate(objs, 1):
        offsets.append(len(out)); out += f"{i} 0 obj\n".encode() + o + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objs)+1}\n".encode() + b"0000000000 65535 f \n"
    for off in offsets: out += f"{off:010d} 00000 n \n".encode()
    out += f"trailer\n<< /Size {len(objs)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return bytes(out)

pdf_bytes = make_pdf("The codeword is tangerine-7")
open(PDF_PATH, "wb").write(pdf_bytes)
PDF_B64 = base64.b64encode(pdf_bytes).decode()

NO_ATTACH = " If you received no attachment with this message, say so explicitly."
QUOTE = "Quote the codeword from the document attached to this message, in one sentence."
def msg(blocks): return {"type": "user", "message": {"role": "user", "content": blocks}}
MESSAGES = [
    ("document/text", msg([
        {"type": "document", "source": {"type": "text", "media_type": "text/plain", "data": "The codeword is marigold-3"}},
        {"type": "text", "text": QUOTE + NO_ATTACH}])),
    ("document/content", msg([
        {"type": "document", "source": {"type": "content", "content": [{"type": "text", "text": "The codeword is cobalt-9"}]}},
        {"type": "text", "text": QUOTE + NO_ATTACH}])),
    ("document/base64-pdf", msg([
        {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": PDF_B64}},
        {"type": "text", "text": "Quote the codeword from the PDF attached to this message, in one sentence." + NO_ATTACH}])),
    ("image/url", msg([
        {"type": "image", "source": {"type": "url", "url": IMAGE_URL}},
        {"type": "text", "text": "Describe the image attached to this message in one sentence. If you received no image with this message, say so explicitly."}])),
    ("document/url-pdf", msg([
        {"type": "document", "source": {"type": "url", "url": PDF_URL}},
        {"type": "text", "text": "Quote the text of the PDF attached to this message, in one sentence." + NO_ATTACH}])),
    ("document/text+title+context+citations", msg([
        {"type": "document", "source": {"type": "text", "media_type": "text/plain", "data": "The codeword is saffron-5"},
         "title": "Saffron memo", "context": "An internal memo supplied for the probe.", "citations": {"enabled": True}},
        {"type": "text", "text": "Quote the codeword from the document attached to this message, in one sentence, and name the document's title." + NO_ATTACH}])),
]

CITE = {"enabled": True}
DESCRIBE = "Describe the image attached to this message in one sentence. If you received no image with this message, say so explicitly."
# Run 2 (fresh session): isolate title/context/citations as the sole document, then retry URL sources on other hosts,
# including the URLs Anthropic's own docs use as examples. The 14-page model card is sent only if every URL block before it failed.
MESSAGES2 = [
    ("document/text+title+context+citations (sole document)", msg([
        {"type": "document", "source": {"type": "text", "media_type": "text/plain", "data": "The codeword is saffron-5"},
         "title": "Saffron memo", "context": "An internal memo supplied for the probe.", "citations": CITE},
        {"type": "text", "text": "Quote the codeword from the document attached to this message, in one sentence, and name the document's title." + NO_ATTACH}])),
    ("image/url (Anthropic docs example: Wikimedia JPEG)", msg([
        {"type": "image", "source": {"type": "url", "url": "https://upload.wikimedia.org/wikipedia/commons/a/a7/Camponotus_flavomarginatus_ant.jpg"}},
        {"type": "text", "text": DESCRIBE}])),
    ("image/url (GitHub raw PNG)", msg([
        {"type": "image", "source": {"type": "url", "url": "https://raw.githubusercontent.com/github/explore/main/topics/python/python.png"}},
        {"type": "text", "text": DESCRIBE}])),
    ("document/url (pdfobject.com sample.pdf, 1 page; citations enabled to match message 0)", msg([
        {"type": "document", "source": {"type": "url", "url": "https://pdfobject.com/pdf/sample.pdf"}, "citations": CITE},
        {"type": "text", "text": "Quote the first sentence of the PDF attached to this message." + NO_ATTACH}])),
    ("document/url (Anthropic docs example PDF, 14 pages; CONDITIONAL: only if every URL block above failed)", msg([
        {"type": "document", "source": {"type": "url", "url": "https://assets.anthropic.com/m/1cd9d098ac3e6467/original/Claude-3-Model-Card-October-Addendum.pdf"}, "citations": CITE},
        {"type": "text", "text": "State the title of the PDF attached to this message, in one sentence." + NO_ATTACH}]), "only_if_all_prior_url_failed"),
]
MESSAGE_SETS = {"run1": MESSAGES, "run2": MESSAGES2}
_set = sys.argv[sys.argv.index("--set") + 1] if "--set" in sys.argv else "run1"
MESSAGES = MESSAGE_SETS[_set]

cmd = [CLAUDE, "-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose",
       "--include-partial-messages", "--replay-user-messages", "--tools", "", "--setting-sources=",
       "--strict-mcp-config", "--permission-mode", PERMISSION_MODE, "--permission-prompts", "none",
       "--max-budget-usd", "1", "--no-session-persistence"]

args = [a for i, a in enumerate(sys.argv[1:], 1) if not a.startswith("--") and sys.argv[i-1] != "--set"]
run_name = args[0] if args else "o-pass-through-run1"
start = int(args[1]) if len(args) > 1 else 0
if "--dry-run" in sys.argv:
    print("argv:", json.dumps(cmd)); print("cwd:", CWD, "contents:", os.listdir(CWD))
    for i, entry in enumerate(MESSAGES):
        label, m = entry[0], entry[1]; s = json.dumps(m); print(f"[{i}] {label} ({len(s)} bytes): {s[:260]}{'...' if len(s) > 260 else ''}")
    sys.exit(0)

OUT = os.path.join(PROBES, run_name + ".jsonl"); ERR = os.path.join(PROBES, run_name + ".stderr.txt"); LOG = os.path.join(PROBES, run_name + ".harness.txt")
out = open(OUT, "w"); err = open(ERR, "w"); log = open(LOG, "w"); T0 = time.time()
frames = []; results = []; lock = threading.Lock()
def note(s):
    s = f"[{time.time()-T0:7.2f}s] {s}"; print(s, flush=True); log.write(s + "\n"); log.flush()

note(f"claude --version: {subprocess.run([CLAUDE, '--version'], capture_output=True, text=True).stdout.strip()}")
note(f"argv: {json.dumps(cmd)}"); note(f"cwd: {CWD} (contents: {os.listdir(CWD)})"); note(f"run {run_name}, message set {_set}, starting at message index {start}")
p = subprocess.Popen(cmd, cwd=CWD, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1)

sent = {}  # index -> content sent (for echo comparison)
cur = {"i": None}
def reader():
    for line in p.stdout:
        out.write(line); out.flush()
        try: o = json.loads(line)
        except Exception: note(f"<- NONJSON {line[:200]!r}"); continue
        with lock: frames.append((cur["i"], o))
        t = o.get("type"); st = o.get("subtype"); extra = ""
        if t == "system": extra = json.dumps({k: v for k, v in o.items() if k in ("model", "permissionMode", "tools", "message", "status", "error", "retry_attempt", "max_retries", "delay_ms", "cwd")})[:300]
        elif t == "stream_event":
            ev = o.get("event", {}); et = ev.get("type")
            if et == "message_start": extra = "message_start usage=" + json.dumps(ev["message"].get("usage")) + f" ttft_ms={o.get('ttft_ms')}"
            elif et in ("message_delta",): extra = "message_delta " + json.dumps(ev.get("delta")) + " usage=" + json.dumps(ev.get("usage"))
            else: continue
        elif t == "user":
            c = o["message"]["content"]; same = (c == sent.get(cur["i"]))
            extra = f"ECHO identical_to_sent={same} content=" + json.dumps(c)[:220]
        elif t == "assistant": extra = "content=" + json.dumps(o["message"]["content"])[:400] + " usage=" + json.dumps(o["message"].get("usage"))
        elif t == "result":
            extra = json.dumps({k: o.get(k) for k in ("is_error", "api_error_status", "num_turns", "total_cost_usd", "errors", "result", "stop_reason", "result_index")})[:700]
            with lock: results.append(o)
        elif t == "rate_limit_event": extra = json.dumps(o.get("rate_limit_info", {}).get("unifiedWindows"))
        note(f"<- [{cur['i']}] type={t} subtype={st} {extra}")
def err_reader():
    for line in p.stderr: err.write(line); err.flush()
threading.Thread(target=reader, daemon=True).start(); threading.Thread(target=err_reader, daemon=True).start()

def send(i, label, obj):
    cur["i"] = i; sent[i] = obj["message"]["content"]; s = json.dumps(obj)
    note(f"-> [{i}] {label} ({len(s)} bytes): {s[:200]}"); p.stdin.write(s + "\n"); p.stdin.flush()
def wait_result(n, timeout):
    t = time.time()
    while time.time() - t < timeout:
        with lock: have = len(results)
        if have >= n: return True
        if p.poll() is not None: note(f"process exited early rc={p.returncode}"); return False
        time.sleep(0.2)
    note(f"TIMEOUT {timeout}s waiting for result #{n}; sending SIGINT"); p.send_signal(signal.SIGINT)
    try: p.wait(10); note(f"exited after SIGINT rc={p.returncode}")
    except subprocess.TimeoutExpired:
        note("still alive 10s after SIGINT; SIGTERM"); p.terminate()
        try: p.wait(10); note(f"exited after SIGTERM rc={p.returncode}")
        except subprocess.TimeoutExpired: note("still alive 10s after SIGTERM; SIGKILL"); p.kill(); p.wait()
    return False

ok = True; n = 0
for i in range(start, len(MESSAGES)):
    if p.poll() is not None: note(f"process already exited rc={p.returncode}; not sending message {i}"); ok = False; break
    label, m = MESSAGES[i][0], MESSAGES[i][1]; cond = MESSAGES[i][2] if len(MESSAGES[i]) > 2 else None
    if cond == "only_if_all_prior_url_failed":
        prior = [r for r in results]  # one result per message sent so far
        url_fail = [bool(r.get("is_error")) for r in prior[1:]]  # messages 1.. are the URL blocks
        if not (url_fail and all(url_fail)): note(f"skipping message {i} ({label}): a prior URL block succeeded ({url_fail})"); continue
        note(f"all prior URL blocks failed ({url_fail}); sending the conditional message {i}")
    send(i, label, m); n += 1
    ok = wait_result(n, PER_MESSAGE_TIMEOUT)
    if not ok: note(f"run ended during message {i} ({label}); a second run should start at index {i+1}"); break
    r = results[-1]
    if r.get("is_error") or r.get("api_error_status"): note(f"message {i} ({label}) ended with an error result; continuing if the process is alive")
    time.sleep(0.3)
note("closing stdin")
try: p.stdin.close()
except Exception as e: note(f"stdin close error {e}")
try: rc = p.wait(timeout=30); note(f"process exit rc={rc}")
except subprocess.TimeoutExpired:
    note("no exit 30s after stdin close; SIGINT"); p.send_signal(signal.SIGINT)
    try: rc = p.wait(10)
    except subprocess.TimeoutExpired: p.terminate(); rc = p.wait(10) if p.poll() is None else p.returncode
    note(f"process exit rc={rc}")
time.sleep(0.5); err.write(f"\nexit={p.returncode}\n"); err.close(); out.close()

note("---- summary ----")
by_msg = {}
for i, o in frames: by_msg.setdefault(i, []).append(o)
for i in sorted(k for k in by_msg if k is not None):
    label = MESSAGES[i][0]; fs = by_msg[i]
    starts = [f["event"]["message"]["usage"] for f in fs if f.get("type") == "stream_event" and f["event"].get("type") == "message_start"]
    texts = [b.get("text") for f in fs if f.get("type") == "assistant" for b in f["message"]["content"] if b.get("type") == "text"]
    res = [f for f in fs if f.get("type") == "result"]; sysf = [f.get("subtype") for f in fs if f.get("type") == "system"]
    echo = [f["message"]["content"] == sent.get(i) for f in fs if f.get("type") == "user"]
    rl = [f["rate_limit_info"]["unifiedWindows"]["five_hour"]["utilization"] for f in fs if f.get("type") == "rate_limit_event"]
    note(f"[{i}] {label}: message_start usage={starts} | assistant text={texts} | result={[{k: r.get(k) for k in ('subtype','is_error','api_error_status','errors','total_cost_usd')} for r in res]} | system subtypes={sysf} | echo identical={echo} | five_hour={rl}")
log.close()
