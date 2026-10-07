/**
 * The Anthropic surface's composition root (spec section 16): builds the surface from its
 * injected dependencies. `createServer(deps)` calls it once per app, so every app gets its own
 * surface state. An omitted dependency gets its production default here, and the wrapper's
 * environment is read here and handed on. A setting no run may use stops the wrapper here, at
 * startup, and redaction is armed here from the CLI's account file and the `redact` setting. The
 * surface's scheduler is built here too: its counts are what `/health` shows. The surface's
 * `start` (the wrapper's start) begins the transcript sweeps; its `shutdown` stops them, drains
 * the scheduler, then closes the control server.
 */
import { Router } from 'express';
import { EnvironmentManager } from '../config/env';
import { cliAccountFile } from '../upstream/account-file';
import { createControlServer } from '../upstream/control-server';
import { createSpawnRunner } from '../upstream/runner';
import { systemClock } from '../utils/clock';
import { SHIPPED_CATALOGUE_PATH, loadCatalogue } from './catalogue';
import { createConductor, HeldRun } from './conductor';
import { SurfaceDeps } from './deps';
import { createAnthropicRouter } from './http';
import { armRedaction } from './redaction';
import { checkUpstreamEnv } from './request';
import { createScheduler, SchedulerCounts } from './scheduler';
import { surfaceState } from './surface-state';

export interface AnthropicSurface {
  /** Mounted before the OpenAI routes. */
  router: Router;
  /** The scheduler's counts, for `/health`. */
  health(): SchedulerCounts;
  /**
   * The wrapper has started (the CLI or the daemon, never a test app by default): the state
   * directory is opened, the transcripts an earlier process left are deleted and the hourly sweep
   * begins. Injected sessions have nothing to sweep.
   */
  start(): void;
  /**
   * Refuses new turns and drains every run within `deadlineMs` (the shutdown-drain setting by
   * default), SIGKILLing what is left, then closes the control server.
   */
  shutdown(deadlineMs?: number): Promise<void>;
}

export function createAnthropicSurface(deps: SurfaceDeps = {}): AnthropicSurface {
  const settings = EnvironmentManager.getAnthropicSettings();
  checkUpstreamEnv(settings.upstreamEnv);
  const environment = process.env;
  const catalogue = deps.catalogue ?? loadCatalogue(settings.cataloguePath ?? SHIPPED_CATALOGUE_PATH);
  const clock = deps.clock ?? systemClock;
  const redact = armRedaction({ accountFile: deps.accountFile ?? cliAccountFile(settings.upstreamEnv), extra: settings.redact });
  const { stateDirectory, sessions, retention } = surfaceState(deps, settings, clock, environment);
  const scheduler = createScheduler<HeldRun>({ settings, clock, registry: sessions.parked });
  // Listens from the first turn that mounts a bridge server; the shutdown closes it.
  const controlServer = deps.controlServer ?? createControlServer();
  const conductor = createConductor({
    runner: deps.runner ?? createSpawnRunner({ clock }),
    catalogue, sessions, clock, settings, environment, stateDirectory, redact, controlServer, scheduler
  });
  return {
    router: createAnthropicRouter({
      catalogue,
      messages: (req, res) => conductor.handleMessages(req, res),
      countTokens: (req, res) => conductor.handleCountTokens(req, res)
    }),
    health: () => scheduler.counts(),
    start: () => retention?.start(),
    async shutdown(deadlineMs) {
      retention?.stop();
      await scheduler.shutdown(deadlineMs);
      await controlServer.close();
    }
  };
}
