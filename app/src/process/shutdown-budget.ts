/**
 * How long the wrapper's whole shutdown may take before it is forced: the default, or the steps'
 * own timeouts end to end when longer (the Anthropic surface's drain may take its whole drain
 * setting, spec section 14).
 */
import { PROCESS_CONFIG } from '../config/constants';

export function shutdownBudgetMs(steps: readonly { timeout?: number }[]): number {
  const total = steps.reduce((sum, step) => sum + (step.timeout ?? 0), 0);
  return Math.max(PROCESS_CONFIG.DEFAULT_SHUTDOWN_TIMEOUT_MS, total);
}
