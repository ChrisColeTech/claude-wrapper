/**
 * The spike's recorded client-tool runs as the surface would see them: the spike named its bridge
 * server `spike`, so every `mcp__spike__` becomes the wrapper's `mcp__client__`. `cli-http-happy`
 * is the production driver's shape (raw CLI, HTTP MCP): one `get_weather` call, parked, then the
 * answer. `sdk-parallel` parks on two `get_weather` calls in one message (the SDK driver's control
 * traffic replays as frames the surface ignores). Both ran on `claude-fable-5-1`.
 */
import * as fs from 'fs';
import * as path from 'path';
import { Frame, parseFrame } from '../../../src/upstream/frames';
import { parseRecording, Recording } from '../../../src/upstream/runner';
import { UPSTREAM_FIXTURES } from '../upstream/recordings';

export const SINGLE_CALL = 'spike-runs/cli-http-happy.wire.ndjson';
export const PARALLEL_CALLS = 'spike-runs/sdk-parallel.wire.ndjson';

/** The tool both runs declared, as the client declares it. */
export const GET_WEATHER = {
  name: 'get_weather',
  description: 'Get the current weather for a city. Returns a JSON object.',
  input_schema: { type: 'object', properties: { city: { type: 'string', description: 'City name, e.g. Paris' } }, required: ['city'] }
};

type WireEntry = { t_ms: number; dir: string; frame?: unknown };
type Recorded = { type: string; message?: { content?: { type: string; id?: string; input?: unknown; tool_use_id?: string }[] } };

const renamed = (name: string): string =>
  fs.readFileSync(path.join(UPSTREAM_FIXTURES, name), 'utf8').split('mcp__spike__').join('mcp__client__');

/** The recording for the replay runner. */
export const clientToolRecording = (name: string): Recording => parseRecording(renamed(name));

/** What upstream wrote on stdout, parsed straight from the file. */
function stdout(name: string): Recorded[] {
  return renamed(name).split('\n').filter(line => line.trim() !== '')
    .map(line => JSON.parse(line) as WireEntry)
    .filter(entry => entry.dir === 'cli->host' && typeof entry.frame === 'string')
    .map(entry => JSON.parse(entry.frame as string) as Recorded);
}

/** The stdout frames as a run yields them. */
export const clientToolFrames = (name: string): Frame[] => stdout(name).map(value => parseFrame(JSON.stringify(value)));

/** The `tool_use` blocks of the recorded `assistant` frames, in order: the oracle for ids and inputs. */
export function recordedToolUses(name: string): { id: string; input: unknown }[] {
  return stdout(name).filter(frame => frame.type === 'assistant')
    .flatMap(frame => frame.message?.content ?? []).filter(block => block.type === 'tool_use')
    .map(block => ({ id: String(block.id), input: block.input }));
}

/** The final answer's text in the recording. */
export function recordedAnswer(name: string): string {
  const texts = stdout(name).filter(frame => frame.type === 'assistant')
    .flatMap(frame => frame.message?.content ?? []).filter(block => block.type === 'text')
    .map(block => (block as { text?: string }).text ?? '');
  return texts[texts.length - 1] ?? '';
}

/** Every frame up to and including the first `message_stop`: the parked turn's part of the run. */
export function untilFirstStop(frames: Frame[]): Frame[] {
  const stop = frames.findIndex(frame => frame.type === 'stream_event' && frame.event.type === 'message_stop');
  return frames.slice(0, stop + 1);
}
