/**
 * The surface-side rows for a run the runner ended itself (spec sections 13 and 14): a timer
 * firing is a 504 `timeout_error`, a CLI that could not be started is a non-retryable 500, and a
 * stdout line over the ceiling is a 500 `api_error`.
 */
import { RunFailureReason } from '../../upstream/runner';
import { SurfaceError } from '../http/surface-error';

export function runFailureError(reason: RunFailureReason): SurfaceError {
  switch (reason.kind) {
    case 'timeout':
      return new SurfaceError(504, 'timeout_error', `upstream timed out (${reason.timer} timer)`);
    case 'spawn_failed':
      return new SurfaceError(500, 'api_error', 'upstream could not be started', { retryable: false });
    case 'line_too_long':
      return new SurfaceError(500, 'api_error', `upstream wrote a line over ${reason.limitBytes} bytes`);
  }
}
