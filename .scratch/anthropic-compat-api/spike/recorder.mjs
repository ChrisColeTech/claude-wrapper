// PROTOTYPE, THROWAWAY. Frame recorder for the ticket 06 spike.
import { appendFileSync, writeFileSync, mkdirSync } from 'node:fs';

export function createRecorder(name) {
  mkdirSync('runs', { recursive: true });
  const wirePath = `runs/${name}.wire.ndjson`;
  const summaryPath = `runs/${name}.summary.json`;
  writeFileSync(wirePath, '');
  const t0 = Date.now();
  const marks = [];
  const rec = {
    t0,
    wirePath,
    summaryPath,
    ms: () => Date.now() - t0,
    wire(dir, frame) { appendFileSync(wirePath, JSON.stringify({ t_ms: Date.now() - t0, dir, frame }) + '\n'); },
    mark(label, extra = {}) { const m = { t_ms: Date.now() - t0, label, ...extra }; marks.push(m); console.log(`[+${String(m.t_ms).padStart(6)}ms] ${label}`, Object.keys(extra).length ? JSON.stringify(extra) : ''); return m; },
    marks,
    summary(obj) { const s = { name, recorded_at: new Date(t0).toISOString(), marks, ...obj }; writeFileSync(summaryPath, JSON.stringify(s, null, 2)); console.log(`summary -> ${summaryPath}`); return s; },
  };
  return rec;
}

// Tap a spawned child's stdio so every NDJSON line in both directions lands
// in the wire log. Used for the SDK path (the SDK owns the protocol) and the
// raw CLI path alike.
export function tapChild(child, rec) {
  const origWrite = child.stdin.write.bind(child.stdin);
  child.stdin.write = (chunk, ...rest) => { for (const l of String(chunk).split('\n')) if (l.trim()) rec.wire('host->cli', l); return origWrite(chunk, ...rest); };
  const origEnd = child.stdin.end.bind(child.stdin);
  child.stdin.end = (...a) => { rec.wire('host->cli', '<stdin EOF>'); return origEnd(...a); };
  let buf = '';
  child.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (l.trim()) rec.wire('cli->host', l); } });
  child.stderr.on('data', (d) => rec.wire('cli-stderr', String(d)));
  child.on('exit', (c, s) => { rec.wire('proc', `<exit code=${c} signal=${s}>`); rec.mark('process exit', { code: c, signal: s }); });
  return child;
}

// Strip variables that only exist because this spike runs inside a Claude
// Code session; the real wrapper will not have them.
export function childEnv() {
  const env = { ...process.env };
  for (const k of ['CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CODE_SSE_PORT', 'CLAUDE_AGENT_SDK_VERSION']) delete env[k];
  return env;
}
