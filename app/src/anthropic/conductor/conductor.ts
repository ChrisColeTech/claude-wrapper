/**
 * The conductor (spec section 16), the surface's only orchestrator: `handleMessages` plans the
 * turn, starts its run (mounting the bridge server when the turn exposes client tools), pumps the
 * frames through the translator into the sink the request asked for (SSE or JSON), and acts on
 * how the response ended. Every run is admitted by the scheduler first (spec section 14), whose
 * refusal (529, 429) rejects like any failure before commit, and the route hands the
 * `SurfaceError` to the shared error handler. A turn that did not complete (failed, rejected, or
 * the client went away) has its run sent down the teardown ladder; its `TurnSession` forgets its
 * upstream session. A turn that parked leaves its run held open in the scheduler (spec section 7);
 * the request that answers its tool calls resumes it as a new turn of the same run. A turn that
 * ends without parking releases its lease, so the next turn on its session may go once the run has
 * exited. `handleCountTokens` measures a request with a run of its own (spec section 12).
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
import { anthropicBetas, anthropicRequestId } from '../http/surface-tag';
import { mintRequestId } from '../http/request-id';
import { SurfaceError } from '../http/surface-error';
import { changedRunBound, ParkedContinuation, planTurn, resumedSession, TurnPlan } from '../request';
import { createJsonSink, createSseSink, TurnSink } from '../respond';
import { Scheduler } from '../scheduler';
import { Sessions } from '../sessions';
import { createTranslator } from '../translate';
import { outcomeContext, wantsStream, withContext, withoutParks } from './context';
import { countTokens } from './count-tokens';
import { ConductedRun, HeldRun } from './held-run';
import { launchRun } from './launch';
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
  /** Admits every run and holds the parked ones. */
  scheduler: Scheduler<HeldRun>;
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

class SurfaceConductor implements Conductor {
  private readonly logger: PumpLogger;

  constructor(private readonly deps: ConductorDeps) {
    this.logger = deps.logger ?? defaultLogger;
  }

  async handleMessages(req: Request, res: Response): Promise<void> {
    const exchange = { req, res, requestId: anthropicRequestId(req) ?? mintRequestId() };
    const runId = randomUUID();
    const turn = this.plan(req, runId);
    const { continuation } = turn;
    if ('parked' in continuation) return this.resume(exchange, turn, continuation);
    return this.start(exchange, runId, turn);
  }

  handleCountTokens(req: Request, res: Response): Promise<void> {
    const requestId = anthropicRequestId(req) ?? mintRequestId();
    const runId = randomUUID();
    return countTokens(this.deps, { req, res, requestId, runId }, withContext(this.logger, { requestId, runId }));
  }

  private plan(req: Request, runId: string, sessions = this.deps.sessions): TurnPlan {
    const context = {
      settings: this.deps.settings, environment: process.env, state: this.deps.stateDirectory(), runId, betas: anthropicBetas(req)
    };
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

  /** Admits the turn's run (re-planned if it waited on its session), starts it and serves the turn. */
  private async start(exchange: Exchange, runId: string, planned: TurnPlan, sessions = this.deps.sessions): Promise<void> {
    const { req, requestId } = exchange;
    const log = withContext(this.logger, { requestId, runId });
    const replan = () => this.plan(req, runId, sessions);
    const run = await launchRun(this.deps, { body: req.body, requestId, runId }, { plan: planned, replan }, log);
    const turn = run.plan;
    if (turn.lostPark) {
      log.info('Lost park: no parked run holds these tool results; the turn is replayed', { toolUseIds: turn.lostPark });
    }
    const session = this.session(turn, log);
    // The session records the answer as the client got it, redacted: that is what it echoes back.
    await this.serveTurn(run, turn, session, session.relay(this.sinkFor(exchange)), log);
  }

  /** Hands the results to the parked run and serves its next turn; a park that will not take them is lost. */
  private async resume(exchange: Exchange, turn: TurnPlan, answer: ParkedContinuation): Promise<void> {
    // The run exists already: the shutdown and the rate limit can refuse its turn, the run cap cannot.
    await this.deps.scheduler.admit({ requestId: exchange.requestId, plan: turn, replan: () => turn });
    const delivery = this.deps.scheduler.deliver(answer.parked, answer.results);
    if (delivery.status !== 'resumed') {
      this.logger.warn('The parked run did not take the tool results',
        { requestId: exchange.requestId, runId: answer.parked.runId, status: delivery.status });
      const runId = randomUUID();
      const sessions = withoutParks(this.deps.sessions);
      return this.start(exchange, runId, this.plan(exchange.req, runId, sessions), sessions);
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
   * The turn's own request sets what is not run-bound (its stop sequences); the run, what is.
   */
  private async serveTurn(
    run: ConductedRun, turn: TurnPlan, session: TurnSession, sink: TurnSink, log: PumpLogger
  ): Promise<void> {
    const parked: { on?: string[] } = {};
    const translator = createTranslator({
      logger: log, failures: run.failures, redact: this.deps.redact, serverTools: run.serverTools,
      now: () => this.deps.clock.now(), ...turn.translatorConfig, structuredOutput: run.structuredOutput
    });
    run.pump.attach({ translator, sink, observers: [session], onPark: toolUseIds => { parked.on = toolUseIds; } });
    run.atExit(() => session.exited());
    const outcome = await sink.outcome;
    const held = outcome.kind === 'completed' ? this.park(run, parked.on, log) : undefined;
    if (held) session.parked();
    session.settled(outcome);
    log.info('Anthropic turn ended', { ...outcomeContext(outcome), ...(held ? { parkedOn: held.toolUseIds } : {}) });
    if (!held && (outcome.kind !== 'completed' || parked.on)) run.pump.stop(`the turn ended: ${outcome.kind}`);
    if (!held) run.lease.release();
    if (outcome.kind === 'rejected') throw outcome.error;
  }

  /** Holds `run` open on the ids its turn parked on; a run with no bridge cannot be resumed. */
  private park(run: ConductedRun, toolUseIds: string[] | undefined, log: PumpLogger): HeldRun | undefined {
    if (!toolUseIds || !run.bridge) return undefined;
    const held = new HeldRun(run, run.bridge, toolUseIds, { forget: id => this.deps.sessions.forget(id), logger: log });
    this.deps.scheduler.registerParked(held);
    return held;
  }
}

export function createConductor(deps: ConductorDeps): Conductor {
  return new SurfaceConductor(deps);
}
