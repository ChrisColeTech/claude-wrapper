/**
 * The turn stream (spec section 11): the Messages API events of one turn, with the control
 * signals inline in the same ordered stream. Both sinks consume it.
 */
import { Frame, StreamEvent } from '../../upstream/frames';
import { FailureReader } from '../failure';
import { SurfaceError } from '../http/surface-error';

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

/** A control signal, inline in the turn stream. The output-limit ticket adds `cut`. */
export type ControlSignal = FailSignal | ParkSignal;

/** An API event or a control signal. */
export type TurnEvent = ApiEvent | ControlSignal;

export const isControlSignal = (event: TurnEvent): event is ControlSignal => event.type === 'fail' || event.type === 'park';

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
}

export interface Translator {
  /** Feed every frame of the run, in order; returns the turn events it produces, in order. */
  push(frame: Frame): TurnEvent[];
  /** The frames have ended: whatever a pass still holds. */
  end(): TurnEvent[];
}
