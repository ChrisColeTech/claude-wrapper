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

/** An API event or a control signal. The client-tool and output-limit tickets add `park` and `cut`. */
export type TurnEvent = ApiEvent | FailSignal;

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
