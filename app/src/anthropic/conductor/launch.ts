/**
 * Starting a run (spec sections 7, 8, 10 and 14), the one way both endpoints start one. The
 * scheduler admits the turn first (a refusal rejects before anything is spawned; a continued turn
 * waits on its session and may come back re-planned). Then the bridge server (client tools) and
 * the hook policy (web tools) are mounted on the control server when the turn needs them, the run
 * is started with its failure reader and its web calls shared by its turns' translators, and its
 * pump sends the turn's message. The run holds its slot until it has exited and every turn of it
 * has settled its session; it is released from the control server then too.
 */
import { AnthropicSettings } from '../../config/anthropic-settings';
import { createBridge } from '../../upstream/bridge';
import { ControlServer } from '../../upstream/control-server';
import { createHookPolicy } from '../../upstream/hook-policy';
import { Run, Runner } from '../../upstream/runner';
import { Clock } from '../../utils/clock';
import { createFailureReader } from '../failure';
import { messageToSend, RunContinuation, TurnPlan } from '../request';
import { Admission, Lease, Scheduler } from '../scheduler';
import { createServerToolCalls } from '../translate';
import { ConductedRun } from './held-run';
import { mountRun } from './mount-run';
import { FrameObserver, PumpLogger, pumpRun, RunPump } from './run-pump';

/** A plan that starts a run (continued or replayed), as opposed to resuming a parked one. */
export type StartingPlan = TurnPlan & { continuation: RunContinuation };

export interface LaunchDeps {
  runner: Runner;
  controlServer: ControlServer;
  clock: Clock;
  settings: AnthropicSettings;
  scheduler: Pick<Scheduler, 'admit'>;
}

/** The request a run is started for. */
export interface Launch {
  /** Its body, as the client sent it. */
  body: unknown;
  requestId: string;
  /** Names the run (its directory, its control-server routes). */
  runId: string;
}

/** The `model` the client sent (validated by the plan), for the 404 row's message. */
const requestedModel = (body: unknown, turn: TurnPlan): string => {
  const model = (body as { model?: unknown }).model;
  return typeof model === 'string' ? model : turn.model.id;
};

function startingPlan(lease: Lease): StartingPlan {
  const { continuation } = lease.plan;
  if ('parked' in continuation) throw new Error('a run was to start for a turn that answers a parked run');
  return { ...lease.plan, continuation };
}

/**
 * Admits `admission` and starts its run; no turn is attached to its pump yet. Rejects with the
 * scheduler's refusal, or with what kept the run from starting (its slot then given back).
 */
export async function launchRun(
  deps: LaunchDeps, launch: Launch, admission: Omit<Admission, 'requestId'>, log: PumpLogger
): Promise<ConductedRun> {
  const lease = await deps.scheduler.admit({ requestId: launch.requestId, ...admission });
  try {
    return await startRun(deps, launch, lease, log);
  } catch (error) {
    lease.release();
    throw error;
  }
}

async function startRun(deps: LaunchDeps, { body, runId }: Launch, lease: Lease, log: PumpLogger): Promise<ConductedRun> {
  const { clock, settings } = deps;
  const turn = startingPlan(lease);
  const bridge = turn.bridgeTools.length > 0 ? createBridge(turn.bridgeTools, { clock, logger: log }) : undefined;
  const policy = turn.hookPolicy && createHookPolicy(turn.hookPolicy, { context: { runId } });
  const mounted = await mountRun(deps.controlServer, runId, { bridge, policy }, turn.runSpec, settings.parkTtlMs);
  const observers: FrameObserver[] = [...(bridge ? [bridge] : []), ...(policy ? [policy] : []), lease];
  let pump: RunPump | undefined;
  // The retry cap's give-up fails whichever turn is attached then.
  const failures = createFailureReader({
    turn: { requestedModel: requestedModel(body, turn), systemLength: turn.system.length },
    clock, retryCapMs: settings.retryCapMs, onGiveUp: error => pump?.fail(error), logger: log
  });
  try {
    const run = deps.runner.startRun(mounted ? mounted.spec : turn.runSpec);
    pump = pumpRun(run, messageToSend(turn.continuation), {
      failures, checks: turn.startupChecks, clock, logger: log, observers,
      // A bridged run is interrupted through its bridge, which then rejects the calls waiting on it.
      ...(bridge ? { interrupt: (reason: string) => bridge.abandon(run, reason) } : {})
    });
    const atExit = schedule({ run, pump, runId, lease, log, unmount: () => mounted?.release() });
    const serverTools = createServerToolCalls(toolUseId => policy?.denialOf(toolUseId));
    return {
      runId, run, pump, failures, bridge, policy, serverTools, runBound: turn.runBound,
      structuredOutput: turn.translatorConfig.structuredOutput, plan: turn, lease, atExit
    };
  } catch (error) {
    mounted?.release();
    throw error;
  }
}

interface Started {
  run: Run;
  pump: RunPump;
  runId: string;
  lease: Lease;
  log: PumpLogger;
  /** Releases the run from the control server. */
  unmount(): void;
}

/**
 * Hands the started run to its lease. Once upstream has exited the run is unmounted and every
 * turn's exit hook runs (its session bookkeeping); only then is the run over for the scheduler.
 */
function schedule({ run, pump, runId, lease, log, unmount }: Started): (hook: () => void) => void {
  const hooks: (() => void)[] = [];
  let over = false;
  const ended = pump.done.catch(error => log.warn('Upstream run pump failed', { error: String(error) })).then(() => {
    unmount();
    over = true;
    hooks.splice(0).forEach(hook => hook());
  });
  lease.started({
    runId, ended,
    get sessionId() { return pump.sessionId; },
    fail: error => pump.fail(error),
    stop: reason => pump.stop(reason),
    kill: () => void run.kill()
  });
  return hook => (over ? hook() : void hooks.push(hook));
}
