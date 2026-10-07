/**
 * One run, pumped from start to exit (spec sections 7, 11 and 14). The first turn's user message
 * goes in; every frame reaches the run's own observers (a bridge) as it arrives, the startup
 * checks run on `system/init`, and stdin is closed once `result` is in. The frames go through the
 * attached turn's translator into its sink. A turn that parks is detached: the run is held open,
 * the frames that arrive meanwhile are kept, and the turn that resumes the run is attached and
 * given them first. The frames are read to the end after the response has ended, so `result` and
 * the exit are logged without the client waiting for them. A run that ends before the turn did
 * fails the turn, mapped by the run's failure reader: at once when the runner ended the run (a
 * timer, an oversized line), else once upstream has exited. A turn the translator cut at an
 * output limit stops the run. This is the run's only reader of its frames.
 */
import { Frame, ResultFrame, SystemInitFrame } from '../../upstream/frames';
import { Run, RunFailure, UserMessage } from '../../upstream/runner';
import { Clock } from '../../utils/clock';
import { FailureReader } from '../failure';
import { SurfaceError } from '../surface-error';
import { StartupChecks } from '../request';
import { TurnSink } from '../respond';
import { createTeardown, Teardown } from '../scheduler';
import { Translator, TurnEvent } from '../translate';
import { ConductorLogger } from './context';
import { startupError } from './startup-checks';

/** Sees every frame of the run, in order, before the translator does. */
export interface FrameObserver {
  onFrame(frame: Frame): void;
}

/** One turn's share of the run: its frames go through `translator` into `sink`. */
export interface TurnFeed {
  /** Built with the run's failure reader. */
  translator: Translator;
  sink: TurnSink;
  /** The turn's own readers of its frames (its session bookkeeping). */
  observers?: readonly FrameObserver[];
  /** The turn parked on these client `tool_use` ids; the run is held open, detached from it. */
  onPark?(toolUseIds: string[]): void;
}

export interface PumpOptions {
  /** The run's failure reader: maps a run that ends before the turn did, and is stopped at exit. */
  failures: FailureReader;
  checks: StartupChecks;
  clock: Clock;
  /** Carries the request id; never given the run spec. */
  logger: ConductorLogger;
  /** The run's own readers of every frame, as it arrives, a turn attached or not (its bridge). */
  observers?: readonly FrameObserver[];
  /**
   * Interrupts the run on an early end; defaults to `run.interrupt()`. A bridged run interrupts
   * through its bridge, which then rejects the tool calls waiting on it.
   */
  interrupt?: (reason: string) => Promise<unknown>;
}

export interface RunPump {
  /** Gives the run's frames to `turn` from now on, those that arrived while no turn was attached first. */
  attach(turn: TurnFeed): void;
  /** Fails the attached turn (ignored once its sink has settled), else the next one attached. */
  fail(error: SurfaceError): void;
  /** The run ends early: down the teardown ladder (interrupt unless `result` is in, stdin closed, signals). */
  stop(reason?: string): void;
  /** Settles once upstream has exited and the exit is logged. */
  readonly done: Promise<void>;
  /** Upstream's session id from `system/init`; undefined until it arrives. */
  readonly sessionId: string | undefined;
}

class Pump implements RunPump {
  readonly done: Promise<void>;
  private init: SystemInitFrame | undefined;
  private sawResult = false;
  private readonly teardown: Teardown;
  private turn: TurnFeed | undefined;
  /** Frames that arrived while no turn was attached (the run parked), for the turn that resumes it. */
  private readonly held: Frame[] = [];
  /** A failure while no turn was attached, for the next one (a run that failed while parked has none). */
  private failure: SurfaceError | undefined;

  constructor(private readonly run: Run, message: UserMessage, private readonly options: PumpOptions) {
    run.send(message).catch((error: Error) =>
      options.logger.debug("Upstream did not take the turn's message", { error: error.message }));
    this.teardown = createTeardown(run, {
      clock: options.clock, ...(options.interrupt ? { interrupt: options.interrupt } : {})
    });
    this.done = this.pump();
  }

  get sessionId(): string | undefined {
    return this.init?.session_id;
  }

  attach(turn: TurnFeed): void {
    this.turn = turn;
    if (this.failure) turn.sink.push({ type: 'fail', error: this.failure });
    this.failure = undefined;
    this.held.splice(0).forEach(frame => this.toTurn(frame));
  }

  fail(error: SurfaceError): void {
    if (this.turn) this.turn.sink.push({ type: 'fail', error });
    else this.failure ??= error;
  }

  stop(reason = 'the turn ended early'): void {
    this.teardown.descend(reason);
  }

  private async pump(): Promise<void> {
    try {
      for await (const frame of this.run.frames) this.onFrame(frame);
      if (this.turn) this.relay(this.turn, this.turn.translator.end());
    } catch (error) {
      if (!(error instanceof RunFailure)) this.abandon(error);
      else this.ended(error);
    }
    const exit = await this.run.exited;
    this.options.failures.stop();
    this.fail(this.options.failures.errorFor({ kind: 'exit', exit }));
    this.options.logger.info('Upstream run exited',
      { sessionId: this.sessionId, code: exit.code, signal: exit.signal, failure: exit.failure });
  }

  /** The runner ended the run itself (a timer fired, a line was too long): the turn fails at once. */
  private ended({ reason }: RunFailure): void {
    this.options.logger.warn('Upstream run ended by the runner', { sessionId: this.sessionId, reason });
    this.fail(this.options.failures.errorFor({ kind: 'run_failure', reason }));
  }

  private onFrame(frame: Frame): void {
    this.options.observers?.forEach(observer => observer.onFrame(frame));
    if (frame.type === 'system' && frame.subtype === 'init' && !this.init) this.onInit(frame);
    this.toTurn(frame);
    if (frame.type === 'result' && !this.sawResult) this.onResult(frame);
  }

  /** Through the attached turn's translator into its sink; held while the run is parked. */
  private toTurn(frame: Frame): void {
    const { turn } = this;
    if (!turn) {
      this.held.push(frame);
      return;
    }
    turn.observers?.forEach(observer => observer.onFrame(frame));
    this.relay(turn, turn.translator.push(frame));
  }

  /**
   * The turn's events into its sink. At `park` (always its last) the turn is detached and told; a
   * `cut` ends the turn at once, so the run is interrupted before upstream calls the model again.
   */
  private relay(turn: TurnFeed, events: TurnEvent[]): void {
    for (const event of events) {
      if (event.type === 'park') {
        this.turn = undefined;
        turn.onPark?.(event.toolUseIds);
        continue;
      }
      turn.sink.push(event);
      if (event.type === 'cut') this.stop('the turn was cut');
    }
  }

  private onInit(init: SystemInitFrame): void {
    this.init = init;
    this.options.logger.info('Upstream run started', { sessionId: init.session_id, model: init.model });
    const error = startupError(init, this.options.checks);
    if (error) this.fail(error);
  }

  private onResult(result: ResultFrame): void {
    this.sawResult = true;
    this.options.logger.info('Upstream result', {
      sessionId: result.session_id, subtype: result.subtype, isError: result.is_error,
      stopReason: result.stop_reason, numTurns: result.num_turns, durationMs: result.duration_ms
    });
    this.teardown.resultIn();
  }

  /** A fault in the wrapper itself: fail the turn and stop the run. */
  private abandon(error: unknown): void {
    this.options.logger.warn('Turn abandoned on an internal error', { error: String(error) });
    this.fail(SurfaceError.of('api_error', 'Internal server error'));
    this.stop();
  }
}

/** Sends `message` and pumps the run's frames until upstream exits; attach the turn to feed it. */
export function pumpRun(run: Run, message: UserMessage, options: PumpOptions): RunPump {
  return new Pump(run, message, options);
}
