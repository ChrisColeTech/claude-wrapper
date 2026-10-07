/**
 * The recorded web-tool runs (`cli-probes/t7-*` and the `s-*` hook probes) as the translator's
 * oracle: the calls the model made (`assistant` frames), what each call returned (`user` frames
 * with `tool_use_result`), the probe hook's denials (its log), and a translator wired as a run
 * would wire it: the run's web calls, the hook's denials, the wrapper's clock.
 */
import { createTranslator, TurnEvent } from '../../../src/anthropic/translate';
import { createServerToolCalls } from '../../../src/anthropic/translate/server-tool-calls';
import { Frame, JsonObject } from '../../../src/upstream/frames';
import { DenialCode } from '../../../src/upstream/hook-policy';
import { recordedHookCalls } from '../upstream/hook-recordings';
import { recordedFrames, recordedStdout } from '../upstream/recordings';

/** The recordings with partial messages, each with the code the wrapper's hook would have denied with. */
export const WEB_RECORDINGS: readonly { name: string; denialCode?: DenialCode }[] = [
  { name: 't7-websearch-cap-300' },
  { name: 's-websearch-allowed-then-deny', denialCode: 'max_uses_exceeded' },
  { name: 's-websearch-blocked-allow' },
  { name: 's-webfetch-hostlist', denialCode: 'url_not_allowed' }
];

/** Wed, 07 Oct 2026 12:00:00 UTC: the wrapper's time in these tests. */
export const NOW = Date.UTC(2026, 9, 7, 12);

type Recorded = JsonObject & { type: string; message?: { content?: JsonObject[] }; tool_use_result?: unknown };

const stdoutOf = (name: string): Recorded[] => recordedStdout(`cli-probes/${name}.jsonl`) as Recorded[];

export const webFrames = (name: string): Frame[] => recordedFrames(`cli-probes/${name}.jsonl`);

/** The `tool_use` blocks the model wrote, in order. */
export function recordedCalls(name: string): { id: string; name: string; input: JsonObject }[] {
  return stdoutOf(name).filter(frame => frame.type === 'assistant')
    .flatMap(frame => frame.message?.content ?? []).filter(block => block['type'] === 'tool_use')
    .map(block => ({ id: String(block['id']), name: String(block['name']), input: block['input'] as JsonObject }));
}

/** Each call's `tool_result` block and the frame's `tool_use_result`, by `tool_use_id`. */
export function recordedResults(name: string): Map<string, { block: JsonObject; toolUseResult: unknown }> {
  const results = new Map<string, { block: JsonObject; toolUseResult: unknown }>();
  for (const frame of stdoutOf(name).filter(each => each.type === 'user')) {
    for (const block of frame.message?.content ?? []) {
      if (block['type'] === 'tool_result') results.set(String(block['tool_use_id']), { block, toolUseResult: frame.tool_use_result });
    }
  }
  return results;
}

/** The final `result` frame. */
export const recordedResult = (name: string): Recorded & { usage: JsonObject } =>
  stdoutOf(name).find(frame => frame.type === 'result') as Recorded & { usage: JsonObject };

/** The calls the probe's hook denied, with the code the wrapper's own hook would have used. */
export function recordedDenials(name: string, code: DenialCode | undefined): Map<string, DenialCode> {
  if (!code) return new Map();
  const denied = recordedHookCalls(name).filter(call => JSON.stringify(call.reply ?? {}).includes('"deny"'));
  return new Map(denied.map(call => [call.stdin.tool_use_id, code]));
}

/** Every frame through one translator wired like a run's; `denials` stand in for the hook's. */
export function translateWeb(frames: Frame[], denials: Map<string, DenialCode> = new Map()): TurnEvent[] {
  const translator = createTranslator({
    logger: { debug: () => undefined }, serverTools: createServerToolCalls(id => denials.get(id)), now: () => NOW
  });
  return [...frames.flatMap(frame => translator.push(frame)), ...translator.end()];
}
