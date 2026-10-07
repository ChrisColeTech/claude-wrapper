/**
 * The error a turn fails with when the run ended before the turn did (spec sections 13 and 14):
 * a runner failure (a timer, an oversized line, a spawn that failed) or an exit with no `result`.
 * The upstream-failure ticket owns the whole table; these are the rows a plain turn can reach.
 */
import { RunExit } from '../../upstream/runner';
import { SurfaceError } from '../http/surface-error';

export function runEndError(exit: RunExit): SurfaceError {
  const { failure } = exit;
  switch (failure?.kind) {
    case 'timeout':
      return new SurfaceError(504, 'timeout_error', `upstream timed out (${failure.timer} timer)`);
    case 'spawn_failed':
      return new SurfaceError(500, 'api_error', 'upstream could not be started', { retryable: false });
    case 'line_too_long':
      return new SurfaceError(500, 'api_error', `upstream wrote a line over ${failure.limitBytes} bytes`);
    default:
      return new SurfaceError(500, 'api_error', exit.signal
        ? `upstream was ended by ${exit.signal}`
        : `upstream exited with code ${exit.code}`);
  }
}
