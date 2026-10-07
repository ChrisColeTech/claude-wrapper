/**
 * What a turn does to its upstream session (spec section 5, ADR 0002). A turn that ends cleanly
 * (the whole message reached the client, and upstream's `result` is a success, which is when
 * upstream has written its transcript) records the session under the fingerprint of the
 * transcript exchanged: the request's messages plus the message the client got. Any other end
 * (a rejection, a post-commit failure, a disconnect, an error `result`, a run that ended before
 * its `result`) is an error turn: the session is forgotten at once, so the client's retry is a
 * replayed turn, and forgotten again once the run has exited, since upstream writes its
 * transcript up to its exit. A turn that parks hands its run on and decides nothing.
 */
import { Frame, ResultFrame } from '../../upstream/frames';
import { fingerprint, NormalisedMessage } from '../request';
import { accumulate, SinkEvent, SinkOutcome, TurnSink } from '../respond';
import { Sessions } from '../sessions';
import { ApiEvent } from '../translate';
import { FrameObserver, PumpLogger } from './run-pump';

export interface TurnSessionOptions {
  sessions: Sessions;
  /** The request's normalised messages: the transcript before the answer. */
  transcript: readonly NormalisedMessage[];
  /** The session a continued turn resumes. */
  resumed?: string;
  logger: PumpLogger;
}

const isClean = (result: ResultFrame) => result.subtype === 'success' && result.is_error === false;

export class TurnSession implements FrameObserver {
  private readonly events: ApiEvent[] = [];
  private sessionId: string | undefined;
  private outcome: SinkOutcome | undefined;
  /** `null`: the run ended without one. */
  private result: ResultFrame | null | undefined;
  private decision: 'record' | 'forget' | 'parked' | undefined;

  constructor(private readonly options: TurnSessionOptions) {}

  /** `sink`, with every event it is given also kept here: the answer the client got. */
  relay(sink: TurnSink): TurnSink {
    return {
      push: (event: SinkEvent) => {
        // The output-limits ticket's `cut` makes this an error turn here.
        if (event.type !== 'fail') this.events.push(event);
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

  private decide(): void {
    if (this.decision !== undefined) return;
    const { outcome, result } = this;
    if (outcome && outcome.kind !== 'completed') return this.errorTurn(outcome.kind);
    if (result === null) return this.errorTurn('no result');
    if (result && !isClean(result)) return this.errorTurn('error result');
    if (outcome && result) this.record();
  }

  private record(): void {
    this.decision = 'record';
    const { sessionId } = this;
    if (sessionId === undefined) return this.errorTurn('no session id');
    let answer: NormalisedMessage;
    try {
      answer = { role: 'assistant', content: accumulate(this.events).content as NormalisedMessage['content'] };
    } catch {
      return this.errorTurn('unreadable answer');
    }
    this.options.sessions.record(sessionId, fingerprint([...this.options.transcript, answer]));
    this.options.logger.debug('Upstream session recorded', { sessionId, continued: this.options.resumed !== undefined });
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
