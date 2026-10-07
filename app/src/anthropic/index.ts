/**
 * The Anthropic surface's composition root (spec section 16): builds the surface from its
 * injected dependencies. `createServer(deps)` calls it once per app, so every app gets its own
 * surface state. An omitted dependency gets its production default here, once the ticket that
 * owns it lands. A setting no run may use stops the wrapper here, at startup, and redaction is
 * armed here from the CLI's account file and the `redact` setting.
 */
import { Router } from 'express';
import { EnvironmentManager } from '../config/env';
import { AnthropicSettings } from '../config/anthropic-settings';
import { cliAccountFile } from '../upstream/account-file';
import { createSpawnRunner } from '../upstream/runner';
import { processStateDirectory, StateDirectory } from '../upstream/state-directory';
import { createTranscriptStore, upstreamProjectDirectory } from '../upstream/transcripts';
import { Clock, systemClock } from '../utils/clock';
import { SHIPPED_CATALOGUE_PATH, loadCatalogue } from './catalogue';
import { createConductor } from './conductor';
import { SurfaceDeps } from './deps';
import { createAnthropicRouter } from './http';
import { armRedaction } from './redaction';
import { checkUpstreamEnv } from './request';
import { createSessions, Sessions } from './sessions';

export interface AnthropicSurface {
  /** Mounted before the OpenAI routes. */
  router: Router;
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
  const conductor = createConductor({
    runner: deps.runner ?? createSpawnRunner({ clock }),
    catalogue,
    sessions: deps.sessions ?? defaultSessions(settings, clock, stateDirectory),
    clock,
    settings,
    stateDirectory,
    redact
  });
  return { router: createAnthropicRouter({ catalogue, messages: (req, res) => conductor.handleMessages(req, res) }) };
}
