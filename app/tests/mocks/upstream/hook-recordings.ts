/**
 * The hook probes' logs (`cli-probes/s-*.hooklog.jsonl`): one line per `PreToolUse` call upstream
 * made, holding the hook's stdin exactly as upstream wrote it and the reply the probe's hook
 * printed (upstream acted on each as the research recorded).
 */
import * as fs from 'fs';
import * as path from 'path';
import { UPSTREAM_FIXTURES } from './recordings';

export interface RecordedHookCall {
  /** The hook's stdin: `{hook_event_name, tool_name, tool_input, tool_use_id, session_id, ...}`. */
  stdin: Record<string, unknown> & { tool_name: string; tool_use_id: string; tool_input: Record<string, unknown> };
  /** The probe hook's reply, parsed; `undefined` when it printed nothing. */
  reply: unknown;
}

/** The calls of `cli-probes/<probe>.hooklog.jsonl`, in order. */
export function recordedHookCalls(probe: string): RecordedHookCall[] {
  const text = fs.readFileSync(path.join(UPSTREAM_FIXTURES, 'cli-probes', `${probe}.hooklog.jsonl`), 'utf8');
  return text.split('\n').filter(line => line.trim() !== '').map(line => {
    const entry = JSON.parse(line) as { stdin: RecordedHookCall['stdin']; stdout: string };
    return { stdin: entry.stdin, reply: entry.stdout === '' ? undefined : JSON.parse(entry.stdout) };
  });
}
