/**
 * The tool bridge's state machine, lifted from the spike (`spike/bridge.mjs`) with its behaviour
 * unchanged: announce, message complete, call, deliver, abandon. Pure: no I/O, no process.
 *
 * Two facts from the spike's live runs shape it. Upstream runs one assistant message's
 * `tool_use` blocks one at a time (the MCP call for block 2 waits for block 1's handler), so the
 * machine parks as soon as the message is complete with at least one client call announced, and
 * holds results the client delivers for calls upstream has not made yet (pre-delivered). And a
 * `tools/call` may arrive before the assistant frame that announces its id; it simply waits.
 * Built-in tools (anything outside `mcp__client__`) never park.
 *
 * Two additions. The frame handler the spike kept in its harness lives here (`frame-input.ts`).
 * And `deliver` takes a request's whole set of results and delivers all or none (the spike
 * delivered one at a time), so a partial answer or a stray id leaves the park untouched.
 */
import { Frame } from '../frames';
import { Clock, systemClock } from '../../utils/clock';
import { mapFrame } from './frame-input';
import {
  BridgeCall, BridgeEvent, BridgeEventListener, CLIENT_TOOL_PREFIX, DeliveredResult, DeliverOutcome, McpToolResult
} from './types';

type Phase = 'idle' | 'running' | 'parked' | 'abandoned' | 'done';
type Waiting = { resolve(result: McpToolResult): void; reject(error: Error): void };
type Announced = { name: string; input: unknown };
type EventBody = BridgeEvent extends infer E ? E extends BridgeEvent ? Omit<E, 'at'> : never : never;

export interface BridgeMachineOptions {
  clock?: Clock;
  onEvent?: BridgeEventListener;
}

export interface BridgeMachine {
  /** Feeds one upstream frame: `system/init`, the assistant's `tool_use` blocks, the message's end, `result`. */
  onFrame(frame: Frame): void;
  /** Upstream invoked a client tool; settles with the client's result, or rejects on `abandon`. */
  call(request: BridgeCall): Promise<McpToolResult>;
  /** The client's results for the parked message, all or nothing (see `DeliverOutcome`). */
  deliver(results: DeliveredResult[]): DeliverOutcome;
  /** Rejects every waiting call. The run must already be interrupted (the bridge's `abandon`). */
  abandon(reason: string): void;
}

class Machine implements BridgeMachine {
  private phase: Phase = 'idle';
  private assistantMessageDone = false;
  private readonly announced = new Map<string, Announced>();
  private readonly waiting = new Map<string, Waiting>();
  private readonly predelivered = new Map<string, McpToolResult>();
  private readonly delivered = new Set<string>();

  constructor(private readonly clock: Clock, private readonly listener: BridgeEventListener) {}

  onFrame(frame: Frame): void {
    const input = mapFrame(frame);
    if (input.kind === 'turn_started') this.turnStarted();
    else if (input.kind === 'tool_uses') input.toolUses.forEach(toolUse => this.assistantToolUse(toolUse));
    else if (input.kind === 'message_complete') this.assistantMessageComplete(input.stopReason);
    else if (input.kind === 'turn_ended') this.turnEnded();
  }

  call({ toolUseId, name }: BridgeCall): Promise<McpToolResult> {
    const early = !this.announced.has(toolUseId) && !this.predelivered.has(toolUseId);
    const pre = this.predelivered.get(toolUseId);
    if (pre) {
      this.predelivered.delete(toolUseId);
      this.trace({ kind: 'mcp_call_served_from_predelivered', toolUseId, name });
      return Promise.resolve(pre);
    }
    const promise = new Promise<McpToolResult>((resolve, reject) => this.waiting.set(toolUseId, { resolve, reject }));
    this.trace({ kind: 'mcp_call_registered', toolUseId, name, early });
    this.maybePark();
    return promise;
  }

  deliver(results: DeliveredResult[]): DeliverOutcome {
    const ids = results.map(result => result.toolUseId);
    const unknownIds = this.phase === 'parked' ? ids.filter(id => !this.announced.has(id)) : ids;
    if (unknownIds.length > 0) {
      unknownIds.forEach(toolUseId => this.trace({ kind: 'client_result_unknown', toolUseId }));
      return { status: 'unknown', unknownIds };
    }
    const stillMissing = this.missing(ids);
    if (stillMissing.length > 0) return { status: 'partial', stillMissing };
    results.forEach(result => this.clientResult(result));
    this.maybeResume();
    return { status: 'resumed' };
  }

  abandon(reason: string): void {
    this.phase = 'abandoned';
    for (const [toolUseId, waiting] of this.waiting) {
      waiting.reject(new Error(`abandoned: ${reason}`));
      this.trace({ kind: 'pending_rejected', toolUseId });
    }
    this.waiting.clear();
    this.predelivered.clear();
    this.announced.clear();
    this.delivered.clear();
    this.trace({ kind: 'abandoned', reason });
  }

  private turnStarted(): void {
    this.phase = 'running';
    this.assistantMessageDone = false;
    this.trace({ kind: 'turn_started' });
  }

  private assistantToolUse({ id, name, input }: { id: string; name: string; input: unknown }): void {
    if (!name.startsWith(CLIENT_TOOL_PREFIX)) {
      this.trace({ kind: 'builtin_tool_use', id, name });
      return;
    }
    const clientName = name.slice(CLIENT_TOOL_PREFIX.length);
    this.announced.set(id, { name: clientName, input });
    this.trace({ kind: 'client_tool_use_announced', id, name: clientName });
    this.maybePark();
  }

  private assistantMessageComplete(stopReason: string): void {
    this.assistantMessageDone = true;
    this.trace({ kind: 'assistant_message_complete', stopReason });
    this.maybePark();
  }

  private turnEnded(): void {
    this.phase = 'done';
    this.trace({ kind: 'turn_ended' });
  }

  /** Delivered to a waiting call, or held until upstream asks. */
  private clientResult({ toolUseId, result }: DeliveredResult): void {
    const waiting = this.waiting.get(toolUseId);
    if (waiting) {
      this.waiting.delete(toolUseId);
      waiting.resolve(result);
      this.trace({ kind: 'client_result_delivered_to_waiting_handler', toolUseId, isError: result.isError });
    } else {
      this.predelivered.set(toolUseId, result);
      this.trace({ kind: 'client_result_predelivered', toolUseId, isError: result.isError });
    }
    this.delivered.add(toolUseId);
  }

  private missing(ids: string[]): string[] {
    return [...this.announced.keys()].filter(id => !ids.includes(id) && !this.delivered.has(id));
  }

  private maybePark(): void {
    if (this.phase !== 'running' || !this.assistantMessageDone || this.announced.size === 0) return;
    this.phase = 'parked';
    const toolUses = [...this.announced.entries()].map(([id, { name, input }]) => ({ id, name, input }));
    this.trace({ kind: 'park', toolUses });
  }

  /** Resumes once every announced call has its result, delivered or held. */
  private maybeResume(): void {
    if (this.phase !== 'parked') return;
    for (const id of this.announced.keys()) if (!this.delivered.has(id)) return;
    this.phase = 'running';
    this.assistantMessageDone = false;
    this.announced.clear();
    this.delivered.clear();
    this.trace({ kind: 'resumed' });
  }

  private trace(event: EventBody): void {
    this.listener({ at: this.clock.now(), ...event } as BridgeEvent);
  }
}

export function createBridgeMachine(options: BridgeMachineOptions = {}): BridgeMachine {
  return new Machine(options.clock ?? systemClock, options.onEvent ?? (() => undefined));
}
