/**
 * The conductor (spec section 16), the surface's only orchestrator: `handleMessages` plans the
 * turn, starts its run, pumps the frames through the translator into the sink the request asked
 * for (SSE or JSON), and acts on how the response ended. A failure before commit rejects, and
 * the route hands the `SurfaceError` to the shared error handler. A turn that did not complete
 * (failed, rejected, or the client went away) has its run interrupted and torn down (spec
 * section 11); its `TurnSession` forgets its upstream session.
 */
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { AnthropicSettings } from '../../config/anthropic-settings';
import { Runner } from '../../upstream/runner';
import { StateDirectory } from '../../upstream/state-directory';
import { Clock } from '../../utils/clock';
import { logger as defaultLogger } from '../../utils/logger';
import { Catalogue } from '../catalogue';
import { createFailureReader, FailureReader } from '../failure';
import { anthropicRequestId } from '../http/surface-tag';
import { mintRequestId } from '../http/request-id';
import { SurfaceError } from '../http/surface-error';
import { messageToSend, planTurn, resumedSession, TurnPlan } from '../request';
import { createJsonSink, createSseSink, SinkOutcome, TurnSink } from '../respond';
import { Sessions } from '../sessions';
import { createTranslator } from '../translate';
import { PumpLogger, pumpRun } from './run-pump';
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
  logger?: PumpLogger;
}

export interface Conductor {
  /** `POST /v1/messages`; rejects with the error to render when the turn fails before commit. */
  handleMessages(req: Request, res: Response): Promise<void>;
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

/** The `model` the client sent (validated by the plan), for the 404 row's message. */
const requestedModel = (body: unknown, turn: TurnPlan): string => {
  const model = (body as { model?: unknown }).model;
  return typeof model === 'string' ? model : turn.model.id;
};

const outcomeContext = (outcome: SinkOutcome): object =>
  ('error' in outcome ? { outcome: outcome.kind, errorType: outcome.error.type } : { outcome: outcome.kind });

export function createConductor(deps: ConductorDeps): Conductor {
  const logger = deps.logger ?? defaultLogger;

  function sinkFor(req: Request, res: Response, requestId: string): TurnSink {
    if (!wantsStream(req.body)) return createJsonSink(res);
    return createSseSink(res, { requestId, clock: deps.clock, pingIntervalMs: deps.settings.pingIntervalMs });
  }

  /** The run's failure reader; the retry cap fails the turn through `sink`. */
  function failureReader(req: Request, turn: TurnPlan, sink: TurnSink, log: PumpLogger): FailureReader {
    return createFailureReader({
      turn: { requestedModel: requestedModel(req.body, turn), systemLength: turn.system.length },
      clock: deps.clock,
      retryCapMs: deps.settings.retryCapMs,
      onGiveUp: error => sink.push({ type: 'fail', error }),
      logger: log
    });
  }

  function plan(req: Request, runId: string): TurnPlan {
    const context = { settings: deps.settings, environment: process.env, state: deps.stateDirectory(), runId };
    const planned = planTurn(req.body, deps.catalogue, deps.sessions, context);
    if (planned instanceof SurfaceError) throw planned;
    return planned;
  }

  function trackSession(turn: TurnPlan, log: PumpLogger): TurnSession {
    const resumed = resumedSession(turn.continuation);
    return new TurnSession({
      sessions: deps.sessions, transcript: turn.messages, logger: log, ...(resumed === undefined ? {} : { resumed })
    });
  }

  return {
    async handleMessages(req, res) {
      const requestId = anthropicRequestId(req) ?? mintRequestId();
      const runId = randomUUID();
      const turn = plan(req, runId);
      const log = withContext(logger, { requestId, runId });
      const session = trackSession(turn, log);
      // The session records the answer as the client got it, redacted: that is what it echoes back.
      const sink = session.relay(sinkFor(req, res, requestId));
      const failures = failureReader(req, turn, sink, log);
      const pump = pumpRun(deps.runner.startRun(turn.runSpec), messageToSend(turn.continuation), {
        translator: createTranslator({ logger: log, failures, redact: deps.redact, ...turn.translatorConfig }),
        failures, sink, checks: turn.startupChecks, clock: deps.clock, logger: log, observers: [session]
      });
      pump.done.catch(error => log.warn('Upstream run pump failed', { error: String(error) }))
        .then(() => session.exited());

      const outcome = await sink.outcome;
      session.settled(outcome);
      log.info('Anthropic turn ended', outcomeContext(outcome));
      if (outcome.kind !== 'completed') pump.stop();
      if (outcome.kind === 'rejected') throw outcome.error;
    }
  };
}
