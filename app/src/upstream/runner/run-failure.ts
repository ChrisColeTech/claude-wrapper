/**
 * Why the runner ended a run itself: a timer fired, a stdout line was over the ceiling, or the
 * process could not be started. Thrown from `Run.frames`, and recorded on `RunExit.failure`.
 */
import { RunFailureReason } from './types';

function describe(reason: RunFailureReason): string {
  switch (reason.kind) {
    case 'timeout':
      return `upstream ${reason.timer} timer fired`;
    case 'line_too_long':
      return `upstream wrote a line over ${reason.limitBytes} bytes`;
    case 'spawn_failed':
      return `upstream could not be started: ${reason.message}`;
  }
}

export class RunFailure extends Error {
  readonly reason: RunFailureReason;

  constructor(reason: RunFailureReason) {
    super(describe(reason));
    this.name = 'RunFailure';
    this.reason = reason;
  }
}
