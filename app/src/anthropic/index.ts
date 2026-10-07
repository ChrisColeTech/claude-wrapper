/**
 * The Anthropic surface's composition root (spec section 16): builds the surface from its
 * injected dependencies. `createServer(deps)` calls it once per app, so every app gets its own
 * surface state. An omitted dependency gets its production default here, once the ticket that
 * owns it lands.
 */
import { Router } from 'express';
import { SurfaceDeps } from './deps';
import { createAnthropicRouter } from './http';

export interface AnthropicSurface {
  /** Mounted before the OpenAI routes. */
  router: Router;
}

export function createAnthropicSurface(_deps: SurfaceDeps = {}): AnthropicSurface {
  return { router: createAnthropicRouter() };
}
