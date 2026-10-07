/**
 * What a turn does to its upstream session (spec sections 5 and 14, ADR 0002). A turn whose whole
 * message reached the client records the session at once under the fingerprint of the transcript
 * exchanged (the request's messages plus the message the client got), before upstream's `result`,
 * so a client's next turn finds it however fast it comes. Until the run has exited the record is
 * pending: the scheduler holds a continued turn on the session until then (upstream has written
 * its transcript by its `result`) and re-plans it after. A turn is an error turn on any other end
 * (a rejection, a post-commit failure, a disconnect, a cut) and when its pending record is undone
 * by an error `result` or a run that ended before its `result`: the session is forgotten at once,
 * so the client's retry is a replayed turn, and forgotten again once the run has exited, since
 * upstream writes its transcript up to its exit. A turn that parks hands its run on and decides
 * nothing.
 */
import { Frame, isCleanResult, ResultFrame } from '../../upstream/frames';
import { fingerprint, NormalisedMessage } from '../request';
import { accumulate, SinkOutcome, TurnSink } from '../respond';
import { Sessions } from '../sessions';
import { ApiEvent, isControlSignal, TurnEvent } from '../translate';
import { ConductorLogger } from './context';
import { FrameObserver } from './run-pump';

export interface UpstreamSessionKeeperOptions {
  sessions: Sessions;
  /** The request's normalised messages: the transcript before the answer. */
  transcript: readonly NormalisedMessage[];
  /** The session a continued turn resumes. */
  resumed?: string;
  logger: ConductorLogger;
}

export class UpstreamSessionKeeper implements FrameObserver {
  private readonly events: ApiEvent[] = [];
  private sessionId: string | undefined;
  private outcome: SinkOutcome | undefined;
  /** `null`: the run ended without one. */
  private result: ResultFrame | null | undefined;
  private decision: 'record' | 'forget' | 'parked' | undefined;

  constructor(private readonly options: UpstreamSessionKeeperOptions) {}

  /** `sink`, with every event it is given also kept here: the answer the client got. */
  relay(sink: TurnSink): TurnSink {
    return {
      push: (event: TurnEvent) => {
        if (event.type === 'cut') this.cut();
        else if (!isControlSignal(event)) this.events.push(event);
        sink.push(event);
      },
      outcome: sink.outcome
    };
  }

  onFrame(frame: Frame): void {
    if (frame.type === 'system' && frame.subtype === 'init') this.sessionId ??= frame.session_id;
    if (frame.type !== 'result' || this.result !== undefined) return;
    this.sessionId ??= frame.session_id;
    this.result = frame;
    this.decide();
  }

  /** How the response ended. */
  settled(outcome: SinkOutcome): void {
    this.outcome = outcome;
    this.decide();
  }

  /**
   * The turn parked (spec section 7): nothing is recorded or forgotten for it. Its run, and with it
   * the upstream session, passes to the turn that resumes it, or to the park's abandonment.
   */
  parked(): void {
    this.decision ??= 'parked';
  }

  /** Upstream has exited. */
  exited(): void {
    const forgotBefore = this.decision === 'forget';
    this.result ??= null;
    this.decide();
    if (forgotBefore) this.forget();
  }

  /** A recorded turn stays open to an error `result` or a missing one, which undo its record. */
  private decide(): void {
    if (this.decision === 'forget' || this.decision === 'parked') return;
    const { outcome, result } = this;
    if (outcome && outcome.kind !== 'completed') return this.errorTurn(outcome.kind);
    if (result === null) return this.errorTurn('no result');
    if (result && !isCleanResult(result)) return this.errorTurn('error result');
    if (outcome && this.decision === undefined) this.record();
  }

  /**
   * The surface cut the turn at an output limit (ADR 0004): upstream holds more than the client
   * got, or is about to, so the turn is an error turn whatever `result` says.
   */
  private cut(): void {
    if (this.decision === undefined) this.errorTurn('cut');
  }

  private record(): void {
    this.decision = 'record';
    // A turn that resumes a parked run saw the run's `system/init` go by in the turn before it.
    const sessionId = this.sessionId ?? this.options.resumed;
    if (sessionId === undefined) return this.errorTurn('no session id');
    let answer: NormalisedMessage;
    try {
      answer = { role: 'assistant', content: accumulate(this.events).content as NormalisedMessage['content'] };
    } catch {
      return this.errorTurn('unreadable answer');
    }
    this.options.sessions.record(sessionId, fingerprint([...this.options.transcript, answer]));
    this.options.logger.debug('Upstream session recorded',
      { sessionId, continued: this.options.resumed !== undefined, pending: this.result === undefined });
  }

  private errorTurn(reason: string): void {
    this.decision = 'forget';
    const ids = this.sessionIds();
    if (ids.length > 0) this.options.logger.info('Upstream session forgotten', { sessionIds: ids, reason });
    this.forget();
  }

  private forget(): void {
    this.sessionIds().forEach(id => this.options.sessions.forget(id));
  }

  private sessionIds(): string[] {
    return [...new Set([this.options.resumed, this.sessionId].filter((id): id is string => id !== undefined))];
  }
}
