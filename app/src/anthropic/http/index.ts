/**
 * The Anthropic surface's HTTP layer: the surface tag, the surface error type and its renderer,
 * the body parser, the credential check, the routes and the static OpenAPI document. `api/server.ts`
 * and the shared error handler wire these in; nothing else of the surface is visible to them.
 */
export { SurfaceError } from './surface-error';
export type { SurfaceErrorType, SurfaceErrorOptions } from './surface-error';
export { tagSurface, isAnthropicRequest, anthropicRequestId } from './surface-tag';
export { renderAnthropicError, toSurfaceError } from './render-error';
export { parseAnthropicBody } from './body';
export { createAnthropicAuth } from './credentials';
export { createAnthropicRouter } from './router';
export { ANTHROPIC_OPENAPI_PATH, serveAnthropicOpenApi } from './openapi';
