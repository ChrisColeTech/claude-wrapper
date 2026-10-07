/**
 * `count_tokens` (spec section 12): the request is planned as its Messages turn would be, and its
 * run (capped at one output token, persisting no session) is started as a turn's is, bridge server
 * and all, so the tools' definitions are counted. The run's frames go through the turn's
 * translator into the count sink, which answers at the first `message_delta`; the run is then
 * interrupted, whatever upstream would do next. A failure before that rejects with the status
 * Messages would answer. The count looks up, records and forgets no session: it continues
 * nothing, and its run writes no transcript.
 */
import { Catalogue } from '../catalogue';
import { planCountTokens } from '../request';
import { createCountSink } from '../respond';
import { SurfaceError } from '../surface-error';
import { createTranslator } from '../translate';
import { ConductorLogger, Exchange, outcomeContext, planContext, PlanningDeps } from './context';
import { launchRun, LaunchDeps, startingPlan } from './launch';

export interface CountDeps extends LaunchDeps, PlanningDeps {
  catalogue: Catalogue;
}

/**
 * Answers `exchange` with its count, measured by the run `runId`; rejects with the error to render
 * when it fails before. The count's run is admitted like any run (the run cap, rate-limit
 * admission, the shutdown) but, on no session, never waits on one.
 */
export async function countTokens(deps: CountDeps, exchange: Exchange, runId: string, log: ConductorLogger): Promise<void> {
  const planned = planCountTokens(exchange.req.body, deps.catalogue, planContext(deps, exchange.req, runId));
  if (planned instanceof SurfaceError) throw planned;
  const turn = startingPlan(planned);
  const run = await launchRun(deps, exchange, runId, { plan: turn, replan: () => turn }, log);
  const sink = createCountSink(exchange.res);
  run.pump.attach({ translator: createTranslator({ logger: log, failures: run.failures }), sink });
  const outcome = await sink.outcome;
  run.pump.stop(`the count ended: ${outcome.kind}`);
  run.lease.release();
  log.info('Anthropic count ended', outcomeContext(outcome));
  if (outcome.kind === 'rejected') throw outcome.error;
}
