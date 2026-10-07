/**
 * The scheduler on its own, for tests: a scheduler on a fake clock with a quiet logger, plans
 * that start a fresh run or continue a session, and hand-driven runs and parked runs whose ends
 * the test decides.
 */
import { SurfaceError } from '../../../src/anthropic/surface-error';
import { TurnPlan } from '../../../src/anthropic/request';
import {
  createScheduler, HeldOpen, ScheduledRun, Scheduler, SchedulerSettings
} from '../../../src/anthropic/scheduler';
import { ANTHROPIC_SETTING_DEFAULTS } from '../../../src/config/anthropic-settings';
import { DeliverOutcome, ToolResultBlock } from '../../../src/upstream/bridge';
import { FakeClock } from '../shared/fake-clock';
import { planDefault } from './plan-context';
import { memorySessions } from './sessions';

const FRESH = planDefault({ model: 'fable', max_tokens: 64, messages: [{ role: 'user', content: 'Say hi.' }] }) as TurnPlan;

/** A replayed turn: starts a fresh run, on no session. */
export const freshPlan = (): TurnPlan => FRESH;

/** A continued turn on `sessionId`. */
export const continuedPlan = (sessionId: string): TurnPlan =>
  ({ ...FRESH, continuation: { resume: sessionId, message: { role: 'user', content: [{ type: 'text', text: 'Again.' }] } } });

/** A turn that answers a parked run. */
export const parkedPlan = (run: HeldOpen): TurnPlan =>
  ({ ...FRESH, continuation: { parked: run, results: [{ type: 'tool_result', tool_use_id: run.toolUseIds[0] ?? '' }] } });

export interface SchedulerLog {
  info: jest.Mock;
  warn: jest.Mock;
}

export const quietLog = (): SchedulerLog => ({ info: jest.fn(), warn: jest.fn() });

export function schedulerOn(
  clock: FakeClock, settings: Partial<SchedulerSettings> = {}, logger: SchedulerLog = quietLog()
): Scheduler {
  return createScheduler({
    settings: { ...ANTHROPIC_SETTING_DEFAULTS, ...settings },
    clock,
    registry: memorySessions(clock).sessions.parked,
    logger
  });
}

/** A started run the test ends by hand; it notes what the scheduler did to it. */
export interface FakeRun extends ScheduledRun {
  sessionId: string | undefined;
  readonly failed: SurfaceError[];
  readonly stopped: string[];
  kills: number;
  end(): void;
}

export function fakeRun(runId = 'run-1', sessionId?: string): FakeRun {
  let end: () => void = () => undefined;
  const run: FakeRun = {
    runId, sessionId, failed: [], stopped: [], kills: 0,
    ended: new Promise<void>(resolve => { end = resolve; }),
    end: () => end(),
    fail: error => { run.failed.push(error); },
    stop: reason => { run.stopped.push(reason); },
    kill: () => { run.kills += 1; }
  };
  return run;
}

/** A parked run whose park every result completes; notes its abandonments. */
export interface FakeHeldRun extends HeldOpen {
  readonly abandoned: string[];
  exit(): void;
}

export function heldRun(toolUseIds: string[], runId = 'run-parked'): FakeHeldRun {
  let exit: () => void = () => undefined;
  const abandoned: string[] = [];
  return {
    runId, toolUseIds, abandoned,
    exited: new Promise<void>(resolve => { exit = resolve; }),
    exit: () => exit(),
    async abandon(reason) { abandoned.push(reason); },
    deliver: (_results: ToolResultBlock[]): DeliverOutcome => ({ status: 'resumed' })
  };
}

/** Whether `promise` has settled once pending callbacks have run (it is left as it is). */
export async function hasSettled(promise: Promise<unknown>): Promise<boolean> {
  let settled = false;
  promise.then(() => { settled = true; }, () => { settled = true; });
  await new Promise(resolve => setImmediate(resolve));
  return settled;
}
