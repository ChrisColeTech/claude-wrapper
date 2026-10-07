/**
 * The Anthropic surface's composition root (spec section 16): builds the surface from its
 * injected dependencies. `createServer(deps)` calls it once per app, so every app gets its own
 * surface state. An omitted dependency gets its production default here, once the ticket that
 * owns it lands. A setting no run may use stops the wrapper here, at startup, and redaction is
 * armed here from the CLI's account file and the `redact` setting.
 */
import { Router } from 'express';
import { EnvironmentManager } from '../config/env';
import { cliAccountFile } from '../upstream/account-file';
import { createSpawnRunner } from '../upstream/runner';
import { processStateDirectory, StateDirectory } from '../upstream/state-directory';
import { systemClock } from '../utils/clock';
import { SHIPPED_CATALOGUE_PATH, loadCatalogue } from './catalogue';
import { createConductor } from './conductor';
import { Sessions, SurfaceDeps } from './deps';
import { createAnthropicRouter } from './http';
import { armRedaction } from './redaction';
import { checkUpstreamEnv } from './request';

export interface AnthropicSurface {
  /** Mounted before the OpenAI routes. */
  router: Router;
}

/** Until conversation state lands, no turn continues an upstream session: every turn is replayed. */
const NO_SESSIONS: Sessions = { lookup: () => null, record: () => undefined, forget: () => undefined };

function stateDirectoryFrom(deps: SurfaceDeps): () => StateDirectory {
  const injected = deps.stateDirectory;
  return injected ? () => injected : processStateDirectory;
}

export function createAnthropicSurface(deps: SurfaceDeps = {}): AnthropicSurface {
  const settings = EnvironmentManager.getAnthropicSettings();
  checkUpstreamEnv(settings.upstreamEnv);
  const catalogue = deps.catalogue ?? loadCatalogue(settings.cataloguePath ?? SHIPPED_CATALOGUE_PATH);
  const clock = deps.clock ?? systemClock;
  const redact = armRedaction({ accountFile: deps.accountFile ?? cliAccountFile(settings.upstreamEnv), extra: settings.redact });
  const conductor = createConductor({
    runner: deps.runner ?? createSpawnRunner({ clock }),
    catalogue,
    sessions: deps.sessions ?? NO_SESSIONS,
    clock,
    settings,
    stateDirectory: stateDirectoryFrom(deps),
    redact
  });
  return { router: createAnthropicRouter({ catalogue, messages: (req, res) => conductor.handleMessages(req, res) }) };
}
