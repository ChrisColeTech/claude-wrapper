/**
 * The Anthropic surface's HTTP layer: the surface tag and a request's id and betas, the surface
 * error's renderer, the body parser, the credential check, the routes and the static OpenAPI
 * document. `api/server.ts` and the shared error handler wire these in; the conductor reads a
 * request's id and betas through it. The error type itself is its own module (`../surface-error`).
 */
export { tagSurface, isAnthropicRequest, anthropicBetas, requestIdOf } from './surface-tag';
export { renderAnthropicError, toSurfaceError } from './render-error';
export { parseAnthropicBody } from './body';
export { createAnthropicAuth } from './credentials';
export { createAnthropicRouter } from './router';
export { ANTHROPIC_OPENAPI_PATH, serveAnthropicOpenApi } from './openapi';
