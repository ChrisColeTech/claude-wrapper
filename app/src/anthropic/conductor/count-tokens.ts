/**
 * `count_tokens` (spec section 12): the request is planned as its Messages turn would be, and its
 * run (capped at one output token, persisting no session) is started as a turn's is, bridge server
 * and all, so the tools' definitions are counted. The run's frames go through the turn's
 * translator into the count sink, which answers at the first `message_delta`; the run is then
 * interrupted, whatever upstream would do next. A failure before that rejects with the status
 * Messages would answer. The count looks up, records and forgets no session: it continues
 * nothing, and its run writes no transcript.
 */
import { Request, Response } from 'express';
import { StateDirectory } from '../../upstream/state-directory';
import { Catalogue } from '../catalogue';
import { SurfaceError } from '../http/surface-error';
import { planCountTokens } from '../request';
import { createCountSink } from '../respond';
import { createTranslator } from '../translate';
import { launchRun, LaunchDeps, StartingPlan } from './launch';
import { PumpLogger } from './run-pump';

export interface CountDeps extends LaunchDeps {
  catalogue: Catalogue;
  stateDirectory: () => StateDirectory;
}

/** One `count_tokens` request: `runId` names its run. */
export interface CountExchange {
  req: Request;
  res: Response;
  requestId: string;
  runId: string;
}

function plan(deps: CountDeps, { req, runId }: CountExchange): StartingPlan {
  const context = { settings: deps.settings, environment: process.env, state: deps.stateDirectory(), runId };
  const planned = planCountTokens(req.body, deps.catalogue, context);
  if (planned instanceof SurfaceError) throw planned;
  const { continuation } = planned;
  if ('parked' in continuation) throw new Error('a count resumed a parked run');
  return { ...planned, continuation };
}

/**
 * Answers `exchange` with its count; rejects with the error to render when it fails before. The
 * count's run is admitted like any run (the run cap, rate-limit admission, the shutdown) but, on
 * no session, never waits on one.
 */
export async function countTokens(deps: CountDeps, exchange: CountExchange, log: PumpLogger): Promise<void> {
  const turn = plan(deps, exchange);
  const { req, requestId, runId } = exchange;
  const run = await launchRun(deps, { body: req.body, requestId, runId }, { plan: turn, replan: () => turn }, log);
  const sink = createCountSink(exchange.res);
  run.pump.attach({ translator: createTranslator({ logger: log, failures: run.failures }), sink });
  const outcome = await sink.outcome;
  run.pump.stop(`the count ended: ${outcome.kind}`);
  run.lease.release();
  log.info('Anthropic count ended', 'error' in outcome
    ? { outcome: outcome.kind, errorType: outcome.error.type }
    : { outcome: outcome.kind });
  if (outcome.kind === 'rejected') throw outcome.error;
}
