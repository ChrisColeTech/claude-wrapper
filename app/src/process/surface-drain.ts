/**
 * The wrapper process and its Anthropic surface (spec section 14). The surface starts with the
 * wrapper (its transcript sweeps), and the wrapper's shutdown drains it first: new requests get
 * 529, streams in flight their error, every upstream run goes down the teardown ladder, and what
 * is left at the drain's deadline is SIGKILLed. The drain runs before the HTTP server closes,
 * since closing waits for the streams the drain ends. The CLI and the daemon wire it the same way.
 */
import { SIGNAL_CONFIG } from '../config/constants';
import { EnvironmentManager } from '../config/env';
import { ISignalHandler } from './signals';

/** Beyond the drain's own deadline: the SIGKILLed runs' exits. */
export const SURFACE_DRAIN_MARGIN_MS = 5_000;

/** What the wrapper process does with its app's Anthropic surface (`anthropicSurfaceOf(app)`). */
export interface SurfaceLifecycle {
  start(): void;
  shutdown(): Promise<void>;
}

/** Registers `drain` (the surface's shutdown, bounded at `drainMs`) as the shutdown's first step. */
export function registerSurfaceDrain(handler: ISignalHandler, drain: () => Promise<void>, drainMs: number): void {
  handler.registerShutdownStep({
    step: SIGNAL_CONFIG.SHUTDOWN_STEPS.DRAIN_ANTHROPIC_SURFACE,
    name: 'Drain the Anthropic surface',
    action: drain,
    timeout: drainMs + SURFACE_DRAIN_MARGIN_MS
  });
}

/** The wrapper has started: starts `surface`, and drains it first at shutdown, within the drain setting. */
export function attachAnthropicSurface(handler: ISignalHandler, surface: SurfaceLifecycle): void {
  surface.start();
  registerSurfaceDrain(handler, () => surface.shutdown(), EnvironmentManager.getAnthropicSettings().shutdownDrainMs);
}
