// PROTOTYPE, THROWAWAY. Print a wire log, trimmed. Usage: node inspect.mjs runs/<name>.wire.ndjson [from_ms] [to_ms] [maxlen]
import { readFileSync } from 'node:fs';
const [file, from = 0, to = 1e9, maxlen = 320] = process.argv.slice(2);
for (const line of readFileSync(file, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  const { t_ms, dir, frame } = JSON.parse(line);
  if (t_ms < Number(from) || t_ms > Number(to)) continue;
  let label = frame;
  try { const o = JSON.parse(frame); label = `${o.type}${o.subtype ? '/' + o.subtype : ''}${o.event ? ' ' + o.event.type : ''}${o.request ? ' req:' + o.request.subtype : ''}${o.response ? ' resp:' + o.response.subtype + ' ' + JSON.stringify(o.response.response ?? o.response.error ?? '') : ''} :: ${frame.length}B :: ${frame.slice(0, Number(maxlen))}`; } catch {}
  console.log(String(t_ms).padStart(6), dir.padEnd(10), label);
}
