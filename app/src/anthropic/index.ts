/**
 * The Anthropic surface's composition root (spec section 16): builds the surface from its
 * injected dependencies. `createServer(deps)` calls it once per app, so every app gets its own
 * surface state. An omitted dependency gets its production default here, once the ticket that
 * owns it lands. A setting no run may use stops the wrapper here, at startup, and redaction is
 * armed here from the CLI's account file and the `redact` setting. The surface's scheduler is
 * built here too: its counts are what `/health` shows, and the surface's `shutdown` drains it and
 * then closes the control server.
 */
import { Router } from 'express';
import { EnvironmentManager } from '../config/env';
import { AnthropicSettings } from '../config/anthropic-settings';
import { cliAccountFile } from '../upstream/account-file';
import { createControlServer } from '../upstream/control-server';
import { createSpawnRunner } from '../upstream/runner';
import { processStateDirectory, StateDirectory } from '../upstream/state-directory';
import { createTranscriptStore, upstreamProjectDirectory } from '../upstream/transcripts';
import { Clock, systemClock } from '../utils/clock';
import { SHIPPED_CATALOGUE_PATH, loadCatalogue } from './catalogue';
import { createConductor, HeldRun } from './conductor';
import { SurfaceDeps } from './deps';
import { createAnthropicRouter } from './http';
import { armRedaction } from './redaction';
import { checkUpstreamEnv } from './request';
import { createScheduler, SchedulerCounts } from './scheduler';
import { createSessions, Sessions } from './sessions';

export interface AnthropicSurface {
  /** Mounted before the OpenAI routes. */
  router: Router;
  /** The scheduler's counts, for `/health`. */
  health(): SchedulerCounts;
  /**
   * Refuses new turns and drains every run within `deadlineMs` (the shutdown-drain setting by
   * default), SIGKILLing what is left, then closes the control server.
   */
  shutdown(deadlineMs?: number): Promise<void>;
}

function stateDirectoryFrom(deps: SurfaceDeps): () => StateDirectory {
  const injected = deps.stateDirectory;
  return injected ? () => injected : processStateDirectory;
}

/**
 * An empty fingerprint map (a restart forgets every conversation). Forgetting deletes upstream's
 * transcript where a run's child keeps it: its `HOME` is the wrapper's unless `upstream.env` sets
 * one (or `CLAUDE_CONFIG_DIR`), its working directory the state directory's.
 */
function defaultSessions(settings: AnthropicSettings, clock: Clock, state: () => StateDirectory): Sessions {
  const childEnv = { HOME: process.env['HOME'], ...settings.upstreamEnv };
  return createSessions({
    clock,
    capacity: settings.fingerprintCapacity,
    expiryMs: settings.fingerprintExpiryMs,
    transcripts: createTranscriptStore(() => upstreamProjectDirectory(state().cwd, childEnv))
  });
}

export function createAnthropicSurface(deps: SurfaceDeps = {}): AnthropicSurface {
  const settings = EnvironmentManager.getAnthropicSettings();
  checkUpstreamEnv(settings.upstreamEnv);
  const catalogue = deps.catalogue ?? loadCatalogue(settings.cataloguePath ?? SHIPPED_CATALOGUE_PATH);
  const clock = deps.clock ?? systemClock;
  const stateDirectory = stateDirectoryFrom(deps);
  const redact = armRedaction({ accountFile: deps.accountFile ?? cliAccountFile(settings.upstreamEnv), extra: settings.redact });
  const sessions = deps.sessions ?? defaultSessions(settings, clock, stateDirectory);
  const scheduler = createScheduler<HeldRun>({ settings, clock, registry: sessions.parked });
  // Listens from the first turn that mounts a bridge server; the shutdown closes it.
  const controlServer = deps.controlServer ?? createControlServer();
  const conductor = createConductor({
    runner: deps.runner ?? createSpawnRunner({ clock }),
    catalogue, sessions, clock, settings, stateDirectory, redact, controlServer, scheduler
  });
  return {
    router: createAnthropicRouter({
      catalogue,
      messages: (req, res) => conductor.handleMessages(req, res),
      countTokens: (req, res) => conductor.handleCountTokens(req, res)
    }),
    health: () => scheduler.counts(),
    async shutdown(deadlineMs) {
      await scheduler.shutdown(deadlineMs);
      await controlServer.close();
    }
  };
}
