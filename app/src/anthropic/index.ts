/**
 * The Anthropic surface's composition root (spec section 16): builds the surface from its
 * injected dependencies. `createServer(deps)` calls it once per app, so every app gets its own
 * surface state. An omitted dependency gets its production default here, once the ticket that
 * owns it lands. A setting no run may use stops the wrapper here, at startup.
 */
import { Router } from 'express';
import { EnvironmentManager } from '../config/env';
import { SHIPPED_CATALOGUE_PATH, loadCatalogue } from './catalogue';
import { SurfaceDeps } from './deps';
import { createAnthropicRouter } from './http';
import { checkUpstreamEnv } from './request';

export interface AnthropicSurface {
  /** Mounted before the OpenAI routes. */
  router: Router;
}

export function createAnthropicSurface(deps: SurfaceDeps = {}): AnthropicSurface {
  const settings = EnvironmentManager.getAnthropicSettings();
  checkUpstreamEnv(settings.upstreamEnv);
  const catalogue = deps.catalogue ?? loadCatalogue(settings.cataloguePath ?? SHIPPED_CATALOGUE_PATH);
  return { router: createAnthropicRouter({ catalogue }) };
}
