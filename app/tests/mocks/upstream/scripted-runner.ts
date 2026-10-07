/**
 * A runner whose runs the test drives by hand: each `startRun` goes through the real run core
 * with a scripted process (`scripted-process.ts`), so the test pushes upstream's frames and exit
 * when it chooses and reads back everything the surface wrote to stdin (user messages,
 * interrupts) and whether it closed stdin.
 */
import { createRun } from '../../../src/upstream/runner/run';
import { Runner, RunSpec } from '../../../src/upstream/runner';
import { Clock, systemClock } from '../../../src/utils/clock';
import { createScriptedProcess, ScriptedProcess } from './scripted-process';

export interface ScriptedRun {
  spec: RunSpec;
  process: ScriptedProcess;
}

export interface ScriptedRunner extends Runner {
  /** The next run the surface starts (already started ones resolve at once, in order). */
  nextRun(): Promise<ScriptedRun>;
}

export function createScriptedRunner(clock: Clock = systemClock): ScriptedRunner {
  const started: ScriptedRun[] = [];
  const waiting: ((run: ScriptedRun) => void)[] = [];
  return {
    startRun(spec) {
      const process = createScriptedProcess();
      const run = createRun(process.start, { timers: spec.timers, clock });
      const entry = { spec, process };
      const waiter = waiting.shift();
      if (waiter) waiter(entry);
      else started.push(entry);
      return run;
    },
    nextRun: () => new Promise(resolve => {
      const entry = started.shift();
      if (entry) resolve(entry);
      else waiting.push(resolve);
    })
  };
}
