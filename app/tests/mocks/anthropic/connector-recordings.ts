/**
 * The connector recordings (`tests/fixtures/upstream/e2e-runs/connector-*`: e2e scenario 9 against
 * DeepWiki's public MCP server, Claude Code 2.1.291, Haiku 4.5) as the translator's oracle: the
 * calls the model made (`assistant` frames), what each returned (`user` frames), upstream's
 * `result`, and a translator wired as a run wires it. `connectorRequest` declares a connector as a
 * client does.
 */
import { createTranslator, TurnEvent } from '../../../src/anthropic/translate';
import { createServerToolCalls } from '../../../src/anthropic/translate/server-tool-calls';
import { Frame, JsonObject } from '../../../src/upstream/frames';
import { recordedFrames, recordedStdout } from '../upstream/recordings';

/** One call of connector `deepwiki`, after a text block; its result came back as a string. */
export const ROUND_TRIP = 'e2e-runs/connector-round-trip.jsonl';
/** A connector nothing answers at, named `dead`: upstream reported it `failed`. */
export const NOT_CONNECTED = 'e2e-runs/connector-not-connected.jsonl';
/** The model both recordings ran on: a request must name it, or the startup check fails the turn. */
export const RECORDED_MODEL = 'claude-haiku-4-5-20251001';

/** Each fixture with its connector's name. */
export const CONNECTOR_RECORDINGS: readonly { name: string; server: string }[] = [
  { name: ROUND_TRIP, server: 'deepwiki' }
];

/** The beta value that unlocks connectors. */
export const MCP_BETA = 'mcp-client-2025-11-20';

/** The two request fields that mount connector `server` at `url`. */
export function connectorRequest(server: string, url = `https://${server}.example.com/mcp`): { mcp_servers: JsonObject[]; tools: JsonObject[] } {
  return {
    mcp_servers: [{ type: 'url', url, name: server }],
    tools: [{ type: 'mcp_toolset', mcp_server_name: server }]
  };
}

type Recorded = JsonObject & { type: string; message?: { content?: JsonObject[] } };

const stdoutOf = (name: string): Recorded[] => recordedStdout(name) as Recorded[];

export const connectorFrames = (name: string): Frame[] => recordedFrames(name);

/** The `tool_use` blocks the model wrote, in order. */
export function recordedCalls(name: string): { id: string; name: string; input: unknown }[] {
  return stdoutOf(name).filter(frame => frame.type === 'assistant')
    .flatMap(frame => frame.message?.content ?? []).filter(block => block['type'] === 'tool_use')
    .map(block => ({ id: String(block['id']), name: String(block['name']), input: block['input'] }));
}

/** The `tool_result` blocks upstream wrote back, in the order they arrived. */
export function recordedToolResults(name: string): JsonObject[] {
  return stdoutOf(name).filter(frame => frame.type === 'user')
    .flatMap(frame => frame.message?.content ?? []).filter(block => block['type'] === 'tool_result');
}

/** The final `result` frame. */
export const recordedResult = (name: string): Recorded & { usage: JsonObject } =>
  stdoutOf(name).find(frame => frame.type === 'result') as Recorded & { usage: JsonObject };

/** The text of the model's last text block: the answer after the calls. */
export function recordedAnswer(name: string): string {
  const texts = stdoutOf(name).filter(frame => frame.type === 'assistant')
    .flatMap(frame => frame.message?.content ?? []).filter(block => block['type'] === 'text');
  return String(texts[texts.length - 1]?.['text'] ?? '');
}

/** Every frame through one translator wired like a run's. */
export function translateConnector(frames: Frame[], debug: jest.Mock = jest.fn(), redact: string[] = []): TurnEvent[] {
  const translator = createTranslator({ logger: { debug }, serverTools: createServerToolCalls(), now: () => 0, redact });
  return [...frames.flatMap(frame => translator.push(frame)), ...translator.end()];
}
