/**
 * Plays a spike recording (`tests/fixtures/upstream/spike-runs/*.wire.ndjson`) into the bridge
 * state machine: upstream's stdout frames and its MCP `tools/call`s in recorded order, at their
 * recorded times on a fake clock, with a scripted client that answers (or never answers) a set
 * time after the park, as the spike's harness did. The spike's bridge server was named `spike`;
 * its tool names are renamed to the wrapper's `client`.
 */
import * as fs from 'fs';
import * as path from 'path';
import { Frame, parseFrame } from '../../../src/upstream/frames';
import { createBridgeMachine } from '../../../src/upstream/bridge/state-machine';
import { BridgeEvent, DeliveredResult, McpToolResult, ToolUse } from '../../../src/upstream/bridge/types';
import { createFakeClock } from '../shared/fake-clock';
import { UPSTREAM_FIXTURES } from './recordings';

export type SequenceStep =
  | { atMs: number; kind: 'frame'; frame: Frame }
  | { atMs: number; kind: 'call'; toolUseId: string; name: string; args: unknown };

type WireEntry = { t_ms: number; dir: string; frame?: unknown; line?: unknown };
type JsonRpc = { method?: string; params?: { name: string; arguments?: unknown; _meta?: Record<string, unknown> } };

const toClient = (text: string): string => text.split('mcp__spike__').join('mcp__client__');

function toolsCall(message: JsonRpc | undefined, atMs: number): SequenceStep | undefined {
  if (message?.method !== 'tools/call' || !message.params) return undefined;
  const toolUseId = String(message.params._meta?.['claudecode/toolUseId']);
  return { atMs, kind: 'call', toolUseId, name: message.params.name, args: message.params.arguments };
}

/** An in-process (SDK driver) MCP call arrives as a `control_request {subtype: mcp_message}` frame. */
function sdkCall(frame: Frame, atMs: number): SequenceStep | undefined {
  if (frame.type !== 'control_request' || frame.request.subtype !== 'mcp_message') return undefined;
  return toolsCall(frame.request['message'] as JsonRpc, atMs);
}

function stepsOf(entry: WireEntry): SequenceStep[] {
  const text = entry.frame ?? entry.line;
  if (typeof text !== 'string') return [];
  if (entry.dir === 'mcp-http->server') {
    const call = toolsCall(JSON.parse(text) as JsonRpc, entry.t_ms);
    return call ? [call] : [];
  }
  if (entry.dir !== 'cli->host') return [];
  const frame = parseFrame(toClient(text));
  const call = sdkCall(frame, entry.t_ms);
  return call ? [{ atMs: entry.t_ms, kind: 'frame', frame }, call] : [{ atMs: entry.t_ms, kind: 'frame', frame }];
}

/** A spike run's frames and bridge calls, in recorded order. */
export function spikeSequence(name: string): SequenceStep[] {
  const text = fs.readFileSync(path.join(UPSTREAM_FIXTURES, 'spike-runs', `${name}.wire.ndjson`), 'utf8');
  return text.split('\n').filter(line => line.trim() !== '')
    .flatMap(line => stepsOf(JSON.parse(line) as WireEntry));
}

/**
 * The spike's own bridge trace for a run (`<name>.summary.json`), without times. The spike's
 * harness named an MCP call by upstream's prefixed name; the bridge server sees the client's
 * name, so the prefix is dropped from those events.
 */
export function spikeTrace(name: string): Record<string, unknown>[] {
  const file = path.join(UPSTREAM_FIXTURES, 'spike-runs', `${name}.summary.json`);
  const summary = JSON.parse(fs.readFileSync(file, 'utf8')) as { bridgeTrace: Record<string, unknown>[] };
  return summary.bridgeTrace.map(({ at: _at, ...event }) =>
    typeof event['name'] === 'string' ? { ...event, name: event['name'].replace(/^mcp__spike__/, '') } : event);
}

/** What the scripted client does once the bridge parks. */
export type ClientScript =
  | { deliverAfterParkMs: number; answer(toolUse: ToolUse): McpToolResult }
  | { abandonAfterParkMs: number };

export type Settled = { status: 'resolved'; value: McpToolResult } | { status: 'rejected'; reason: unknown };

export interface PlayedSequence {
  trace: BridgeEvent[];
  /** Each MCP call's settlement, by `tool_use` id, once the sequence and the client are done. */
  calls: Map<string, Promise<Settled>>;
}

type Action = { atMs: number; act: () => void };

function clientActions(machine: ReturnType<typeof createBridgeMachine>, script: ClientScript, park: BridgeEvent & { kind: 'park' }): Action {
  if ('abandonAfterParkMs' in script) {
    return { atMs: park.at + script.abandonAfterParkMs, act: () => machine.abandon('client never answered') };
  }
  const results: DeliveredResult[] = park.toolUses.map(toolUse => ({ toolUseId: toolUse.id, result: script.answer(toolUse) }));
  return { atMs: park.at + script.deliverAfterParkMs, act: () => { machine.deliver(results); } };
}

/** Plays a spike run into a fresh state machine with the scripted client. */
export function playSpikeSequence(name: string, script: ClientScript): PlayedSequence {
  const clock = createFakeClock();
  const trace: BridgeEvent[] = [];
  const pending: Action[] = [];
  const calls = new Map<string, Promise<Settled>>();
  const machine = createBridgeMachine({ clock, onEvent: event => trace.push(event) });
  const runDue = (until: number) => {
    while (pending.length > 0 && (pending[0] as Action).atMs <= until) {
      const action = pending.shift() as Action;
      clock.advance(action.atMs - clock.now());
      action.act();
    }
  };
  for (const step of spikeSequence(name)) {
    runDue(step.atMs);
    clock.advance(Math.max(0, step.atMs - clock.now()));
    const before = trace.length;
    if (step.kind === 'frame') machine.onFrame(step.frame);
    else calls.set(step.toolUseId, machine.call(step).then(
      (value): Settled => ({ status: 'resolved', value }), (reason): Settled => ({ status: 'rejected', reason })));
    const park = trace.slice(before).find((event): event is BridgeEvent & { kind: 'park' } => event.kind === 'park');
    if (park) pending.push(clientActions(machine, script, park));
  }
  runDue(Infinity);
  return { trace, calls };
}

/** A trace event without its time, for comparing with a literal or the spike's trace. */
export const withoutTime = ({ at: _at, ...event }: BridgeEvent): Record<string, unknown> => event;
