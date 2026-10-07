/**
 * The conductor (spec section 16), the surface's only orchestrator: `handleMessages` plans the
 * turn, starts its run (mounting the bridge server when the turn exposes client tools), pumps the
 * frames through the translator into the sink the request asked for (SSE or JSON), and acts on
 * how the response ended. A failure before commit rejects, and the route hands the `SurfaceError`
 * to the shared error handler. A turn that did not complete (failed, rejected, or the client went
 * away) has its run interrupted and torn down (spec section 11); its `TurnSession` forgets its
 * upstream session. A turn that parked leaves its run held open in parking (spec section 7); the
 * request that answers its tool calls resumes it as a new turn of the same run.
 * `handleCountTokens` measures a request with a run of its own (spec section 12).
 */
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { AnthropicSettings } from '../../config/anthropic-settings';
import { ControlServer } from '../../upstream/control-server';
import { Runner } from '../../upstream/runner';
import { StateDirectory } from '../../upstream/state-directory';
import { Clock } from '../../utils/clock';
import { logger as defaultLogger } from '../../utils/logger';
import { Catalogue } from '../catalogue';
import { anthropicRequestId } from '../http/surface-tag';
import { mintRequestId } from '../http/request-id';
import { SurfaceError } from '../http/surface-error';
import { changedRunBound, ParkedContinuation, planTurn, resumedSession, TurnPlan } from '../request';
import { createJsonSink, createSseSink, SinkOutcome, TurnSink } from '../respond';
import { Sessions } from '../sessions';
import { createTranslator } from '../translate';
import { countTokens } from './count-tokens';
import { ConductedRun, HeldRun } from './held-run';
import { launchRun, StartingPlan } from './launch';
import { createParking, Parking } from '../scheduler/parking';
import { PumpLogger } from './run-pump';
import { TurnSession } from './turn-session';

export interface ConductorDeps {
  runner: Runner;
  catalogue: Catalogue;
  sessions: Sessions;
  clock: Clock;
  settings: AnthropicSettings;
  /** The wrapper's state directory, opened on first use. */
  stateDirectory: () => StateDirectory;
  /** The strings redaction is armed with, applied to every turn's output. */
  redact: readonly string[];
  /** Where a run's bridge server is served; started by the first run that mounts one. */
  controlServer: ControlServer;
  logger?: PumpLogger;
}

export interface Conductor {
  /** `POST /v1/messages`; rejects with the error to render when the turn fails before commit. */
  handleMessages(req: Request, res: Response): Promise<void>;
  /** `POST /v1/messages/count_tokens`; rejects with the error to render when the count fails. */
  handleCountTokens(req: Request, res: Response): Promise<void>;
}

/** One request's turn: where its answer goes. */
interface Exchange {
  req: Request;
  res: Response;
  requestId: string;
}

function withContext(logger: PumpLogger, context: object): PumpLogger {
  return {
    debug: (message, extra) => logger.debug(message, { ...context, ...(extra as object) }),
    info: (message, extra) => logger.info(message, { ...context, ...(extra as object) }),
    warn: (message, extra) => logger.warn(message, { ...context, ...(extra as object) })
  };
}

const wantsStream = (body: unknown): boolean =>
  typeof body === 'object' && body !== null && (body as { stream?: unknown }).stream === true;

const outcomeContext = (outcome: SinkOutcome): object =>
  ('error' in outcome ? { outcome: outcome.kind, errorType: outcome.error.type } : { outcome: outcome.kind });

/** The same sessions with no parked run: what a turn falls back to when its park was lost. */
const withoutParks = (sessions: Sessions): Sessions => ({
  lookup: fingerprint => sessions.lookup(fingerprint),
  record: (sessionId, fingerprint) => sessions.record(sessionId, fingerprint),
  forget: sessionId => sessions.forget(sessionId),
  parked: { get: () => undefined, put: () => undefined, remove: () => undefined }
});

/** A plan that starts a run, or null for one that resumes a parked run. */
const starting = (turn: TurnPlan): StartingPlan | null =>
  ('parked' in turn.continuation ? null : { ...turn, continuation: turn.continuation });

class SurfaceConductor implements Conductor {
  private readonly logger: PumpLogger;
  private readonly parking: Parking<HeldRun>;

  constructor(private readonly deps: ConductorDeps) {
    this.logger = deps.logger ?? defaultLogger;
    this.parking = createParking<HeldRun>({
      registry: deps.sessions.parked, clock: deps.clock, ttlMs: deps.settings.parkTtlMs, logger: this.logger
    });
  }

  async handleMessages(req: Request, res: Response): Promise<void> {
    const exchange = { req, res, requestId: anthropicRequestId(req) ?? mintRequestId() };
    const runId = randomUUID();
    const turn = this.plan(req, runId);
    const { continuation } = turn;
    if ('parked' in continuation) return this.resume(exchange, turn, continuation);
    return this.start(exchange, runId, { ...turn, continuation });
  }

  handleCountTokens(req: Request, res: Response): Promise<void> {
    const runId = randomUUID();
    const log = withContext(this.logger, { requestId: anthropicRequestId(req) ?? mintRequestId(), runId });
    return countTokens(this.deps, { req, res, runId }, log);
  }

  private plan(req: Request, runId: string, sessions = this.deps.sessions): TurnPlan {
    const context = { settings: this.deps.settings, environment: process.env, state: this.deps.stateDirectory(), runId };
    const planned = planTurn(req.body, this.deps.catalogue, sessions, context);
    if (planned instanceof SurfaceError) throw planned;
    return planned;
  }

  private sinkFor({ req, res, requestId }: Exchange): TurnSink {
    if (!wantsStream(req.body)) return createJsonSink(res);
    return createSseSink(res, { requestId, clock: this.deps.clock, pingIntervalMs: this.deps.settings.pingIntervalMs });
  }

  private session(turn: TurnPlan, log: PumpLogger, resumed = resumedSession(turn.continuation)): TurnSession {
    return new TurnSession({
      sessions: this.deps.sessions, transcript: turn.messages, logger: log, ...(resumed === undefined ? {} : { resumed })
    });
  }

  private async start(exchange: Exchange, runId: string, turn: StartingPlan): Promise<void> {
    const log = withContext(this.logger, { requestId: exchange.requestId, runId });
    if (turn.lostPark) {
      log.info('Lost park: no parked run holds these tool results; the turn is replayed', { toolUseIds: turn.lostPark });
    }
    const session = this.session(turn, log);
    // The session records the answer as the client got it, redacted: that is what it echoes back.
    const sink = session.relay(this.sinkFor(exchange));
    const run = await launchRun(this.deps, exchange.req.body, runId, turn, log);
    await this.serveTurn(run, turn, session, sink, log);
  }

  /** Hands the results to the parked run and serves its next turn; a park that will not take them is lost. */
  private async resume(exchange: Exchange, turn: TurnPlan, answer: ParkedContinuation): Promise<void> {
    const delivery = this.parking.deliver(answer.parked, answer.results);
    if (delivery.status !== 'resumed') {
      this.logger.warn('The parked run did not take the tool results',
        { requestId: exchange.requestId, runId: answer.parked.runId, status: delivery.status });
      const runId = randomUUID();
      const replayed = starting(this.plan(exchange.req, runId, withoutParks(this.deps.sessions)));
      if (!replayed) throw new Error('a plan without parked runs resumed one');
      return this.start(exchange, runId, replayed);
    }
    const held = delivery.run;
    const log = withContext(this.logger, { requestId: exchange.requestId, runId: held.runId });
    const ignored = changedRunBound(held.conducted.runBound, turn.runBound);
    if (ignored.length > 0) log.debug('Run-bound parameters ignored on a resuming turn', { parameters: ignored });
    log.info('Parked run resumed', { sessionId: held.sessionId, toolUseIds: held.toolUseIds });
    const session = this.session(turn, log, held.sessionId);
    await this.serveTurn(held.conducted, turn, session, session.relay(this.sinkFor(exchange)), log);
  }

  /**
   * Serves one turn of `run` to its sink and acts on how it ended: done, parked, or ended early.
   * The turn's own request sets what is not run-bound (its stop sequences).
   */
  private async serveTurn(
    run: ConductedRun, turn: TurnPlan, session: TurnSession, sink: TurnSink, log: PumpLogger
  ): Promise<void> {
    const parked: { on?: string[] } = {};
    const translator = createTranslator({ logger: log, failures: run.failures, redact: this.deps.redact, ...turn.translatorConfig });
    run.pump.attach({ translator, sink, observers: [session], onPark: toolUseIds => { parked.on = toolUseIds; } });
    void run.pump.done.catch(() => undefined).then(() => session.exited());
    const outcome = await sink.outcome;
    const held = outcome.kind === 'completed' ? this.park(run, parked.on, log) : undefined;
    if (held) session.parked();
    session.settled(outcome);
    log.info('Anthropic turn ended', { ...outcomeContext(outcome), ...(held ? { parkedOn: held.toolUseIds } : {}) });
    if (!held && (outcome.kind !== 'completed' || parked.on)) run.pump.stop(`the turn ended: ${outcome.kind}`);
    if (outcome.kind === 'rejected') throw outcome.error;
  }

  /** Holds `run` open on the ids its turn parked on; a run with no bridge cannot be resumed. */
  private park(run: ConductedRun, toolUseIds: string[] | undefined, log: PumpLogger): HeldRun | undefined {
    if (!toolUseIds || !run.bridge) return undefined;
    const held = new HeldRun(run, run.bridge, toolUseIds, { forget: id => this.deps.sessions.forget(id), logger: log });
    this.parking.park(held);
    return held;
  }
}

export function createConductor(deps: ConductorDeps): Conductor {
  return new SurfaceConductor(deps);
}
