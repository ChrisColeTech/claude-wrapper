/**
 * The wrapper's shutdown drains the Anthropic surface first (spec section 14): new requests get
 * 529, streams in flight their error, every upstream run goes down the teardown ladder, and what
 * is left at the drain's deadline is SIGKILLed. It runs before the HTTP server closes, since
 * closing waits for the streams the drain ends.
 */
import { SIGNAL_CONFIG } from '../config/constants';
import { ISignalHandler } from './signals';

/** Beyond the drain's own deadline: the SIGKILLed runs' exits. */
export const SURFACE_DRAIN_MARGIN_MS = 5_000;

/** Registers `drain` (the surface's shutdown, bounded at `drainMs`) as the shutdown's first step. */
export function registerSurfaceDrain(handler: ISignalHandler, drain: () => Promise<void>, drainMs: number): void {
  handler.registerShutdownStep({
    step: SIGNAL_CONFIG.SHUTDOWN_STEPS.DRAIN_ANTHROPIC_SURFACE,
    name: 'Drain the Anthropic surface',
    action: drain,
    timeout: drainMs + SURFACE_DRAIN_MARGIN_MS
  });
}
