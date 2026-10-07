/**
 * The turn stream (spec section 11): the Messages API events of one turn, with the control
 * signals inline in the same ordered stream. Both sinks consume it.
 */
import { Frame, JsonObject, StreamEvent } from '../../upstream/frames';
import { DenialCode, WebTool } from '../../upstream/hook-policy';
import { FailureReader } from '../failure';
import { SurfaceError } from '../surface-error';

/** One Messages API streaming event; the SSE sink writes it as the SSE event of the same name. */
export type ApiEvent = StreamEvent;

/** The turn failed: before commit it is an HTTP error, after commit one SSE `error` event. */
export interface FailSignal {
  type: 'fail';
  error: SurfaceError;
}

/**
 * The turn parked (spec section 7): the call's `message_stop` has just been relayed, and the run
 * stays held open until a request answers these client `tool_use` ids. Always the turn's last event.
 */
export interface ParkSignal {
  type: 'park';
  toolUseIds: string[];
}

/** Why the surface cut the turn (spec section 12, ADR 0004). */
export type CutReason = 'max_tokens' | 'stop_sequence';

/**
 * The surface ended the turn itself at an output limit: the turn's `message_stop` has been
 * emitted just before it, and nothing follows. The conductor interrupts the run, so upstream does
 * not go on generating, and forgets its upstream session.
 */
export interface CutSignal {
  type: 'cut';
  reason: CutReason;
}

/**
 * Internal to the translator: a later model call's `message_start`, which the flattener
 * suppresses, kept for the passes that read each call's usage (the stop-sequence estimate).
 */
export interface CallStartSignal {
  type: 'call_start';
  usage: JsonObject;
}

/**
 * Internal to the translator: usage the turn's final `message_delta` adds to its own (a model call
 * whose `message_delta` the flattener suppressed; a server tool's request counts).
 */
export interface UsageSignal {
  type: 'usage';
  usage: JsonObject;
}

/**
 * A call upstream runs itself and the model continues after: one of its built-in web tools, or a
 * connector's tool (`mcp__<server>__<tool>`, spec section 9).
 */
export type UpstreamCall = WebTool | 'connector';

/**
 * Internal to the translator: upstream's result for a call it ran itself (a built-in web tool, a
 * connector), its surface block at `index`. The server-tool pass turns a web tool's into the API's
 * result block, the connector pass a connector's.
 */
export interface ServerToolResultSignal {
  type: 'server_tool_result';
  index: number;
  tool: UpstreamCall;
  /** Upstream's `tool_use` id, as the call's `tool_use` block named it. */
  toolUseId: string;
  /** Upstream's `tool_result` block: what the model received. */
  block: JsonObject;
  /** The `user` frame's `tool_use_result`: the tool's own output. */
  toolUseResult: unknown;
}

/** Signals the passes pass to each other; the usage-sum pass, the last, removes every one. */
export type InternalSignal = CallStartSignal | UsageSignal | ServerToolResultSignal;

/** The control signals carried inline in the turn stream (internal ones never leave the translator). */
export type ControlSignal = FailSignal | ParkSignal | CutSignal | InternalSignal;

/** An API event or a control signal. */
export type TurnEvent = ApiEvent | ControlSignal;

const CONTROL_SIGNALS: ReadonlySet<string> = new Set<ControlSignal['type']>(
  ['fail', 'park', 'cut', 'call_start', 'usage', 'server_tool_result']
);

const INTERNAL_SIGNALS: ReadonlySet<string> = new Set<InternalSignal['type']>(['call_start', 'usage', 'server_tool_result']);

/** A signal no pass after the translator ever sees. */
export function isInternalSignal(event: TurnEvent): event is InternalSignal {
  return INTERNAL_SIGNALS.has(event.type);
}

/** A control signal, which no sink writes as an event. */
export function isControlSignal(event: TurnEvent): event is ControlSignal {
  return CONTROL_SIGNALS.has(event.type);
}

export interface TranslatorLogger {
  debug(message: string, context?: unknown): void;
}

export interface TranslatorConfig {
  /** Dropped fields and frames are logged here at debug; defaults to the wrapper's logger. */
  logger?: TranslatorLogger;
  /**
   * The run's failure reader: the translator feeds it every frame and fails the turn with its
   * errors. Defaults to one of its own, without the retry cap or the client's model.
   */
  failures?: FailureReader;
  /**
   * The armed strings (spec section 6): each is replaced with `[redacted]` in text and tool-input
   * deltas. Not run-bound, so every turn gets the surface's list; none redacts nothing.
   */
  redact?: readonly string[];
  /**
   * The request's `stop_sequences` (spec section 12): the turn is cut at the first one the text
   * completes. Not run-bound, so each turn brings its own; none scans nothing.
   */
  stopSequences?: readonly string[];
  /**
   * The run was started with `--json-schema` (spec section 12): its `StructuredOutput` call is the
   * answer, as one JSON text block, and prose text blocks are dropped. Run-bound: a turn that
   * resumes a held-open run takes the run's value, not its own request's.
   */
  structuredOutput?: boolean;
  /**
   * The calls the run's upstream ran itself (web tools, connectors), across its turns: a parked
   * run's next turn may get the result of a call the turn before it made, and the hook's denials
   * are read here. Defaults to the translator's own, which knows only this turn's calls and no denial.
   */
  serverTools?: ServerToolCalls;
  /** The wrapper's time, for a fetch result's `retrieved_at`; defaults to the system clock. */
  now?: () => number;
}

/** The calls a run's upstream runs itself (spec sections 8 and 9), shared by the translators of its turns. */
export interface ServerToolCalls {
  /** Upstream announced a call of `tool` under `toolUseId`. */
  note(toolUseId: string, tool: UpstreamCall): void;
  /** What a call ran, if the run announced it. */
  toolOf(toolUseId: string): UpstreamCall | undefined;
  /** The code the wrapper's hook denied the call with, if it did. */
  denialOf(toolUseId: string): DenialCode | undefined;
}

export interface Translator {
  /** Feed every frame of the run, in order; returns the turn events it produces, in order. */
  push(frame: Frame): TurnEvent[];
  /** The frames have ended: whatever a pass still holds. */
  end(): TurnEvent[];
}
