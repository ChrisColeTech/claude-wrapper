/**
 * The startup checks on `system/init` (spec sections 3 and 10): upstream must run the canonical
 * model and expose exactly the expected tools, else the turn fails before commit. A mismatch is
 * the operator's environment (a model-switching variable, a stray tool), so retrying cannot help.
 */
import { SystemInitFrame } from '../../upstream/frames';
import { SurfaceError } from '../http/surface-error';
import { StartupChecks } from '../request';

const operatorSide = (message: string): SurfaceError =>
  new SurfaceError(500, 'api_error', message, { retryable: false });

const listed = (names: string[]): string => (names.length > 0 ? names.join(', ') : 'none');

export function startupError(init: SystemInitFrame, checks: StartupChecks): SurfaceError | null {
  if (init.model !== checks.model) {
    return operatorSide(`upstream started model ${init.model} instead of ${checks.model}`);
  }
  const tools = Array.isArray(init.tools) ? init.tools : [];
  const unexpected = tools.filter(tool => !checks.tools.includes(tool));
  const missing = checks.tools.filter(tool => !tools.includes(tool));
  if (unexpected.length > 0 || missing.length > 0) {
    return operatorSide(`upstream's tools differ from the turn's: unexpected ${listed(unexpected)}; missing ${listed(missing)}`);
  }
  return null;
}
