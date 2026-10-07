/**
 * Starting a turn's run (spec sections 7, 8, 10 and 14): the bridge server (client tools) and the
 * hook policy (web tools) mounted on the control server when the turn needs them, the run started,
 * its failure reader, its web calls shared by its turns' translators, and its pump sending the
 * turn's message. The run is released from the control server once it has exited.
 */
import { AnthropicSettings } from '../../config/anthropic-settings';
import { createBridge } from '../../upstream/bridge';
import { ControlServer } from '../../upstream/control-server';
import { createHookPolicy } from '../../upstream/hook-policy';
import { Runner } from '../../upstream/runner';
import { Clock } from '../../utils/clock';
import { createFailureReader } from '../failure';
import { messageToSend, RunContinuation, TurnPlan } from '../request';
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
}

/** The `model` the client sent (validated by the plan), for the 404 row's message. */
const requestedModel = (body: unknown, turn: TurnPlan): string => {
  const model = (body as { model?: unknown }).model;
  return typeof model === 'string' ? model : turn.model.id;
};

/** Starts the run of `turn`, whose request body is `body`; no turn is attached to its pump yet. */
export async function launchRun(
  deps: LaunchDeps, body: unknown, runId: string, turn: StartingPlan, log: PumpLogger
): Promise<ConductedRun> {
  const { clock, settings } = deps;
  const bridge = turn.bridgeTools.length > 0 ? createBridge(turn.bridgeTools, { clock, logger: log }) : undefined;
  const policy = turn.hookPolicy && createHookPolicy(turn.hookPolicy, { context: { runId } });
  const mounted = await mountRun(deps.controlServer, runId, { bridge, policy }, turn.runSpec, settings.parkTtlMs);
  const observers: FrameObserver[] = [...(bridge ? [bridge] : []), ...(policy ? [policy] : [])];
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
    void pump.done.catch(error => log.warn('Upstream run pump failed', { error: String(error) }))
      .then(() => mounted?.release());
    const serverTools = createServerToolCalls(toolUseId => policy?.denialOf(toolUseId));
    return {
      runId, run, pump, failures, bridge, policy, serverTools, runBound: turn.runBound,
      structuredOutput: turn.translatorConfig.structuredOutput
    };
  } catch (error) {
    mounted?.release();
    throw error;
  }
}
