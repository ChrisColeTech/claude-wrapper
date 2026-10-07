/**
 * The Anthropic surface's routes, mounted before the OpenAI routes. Everything under
 * `/v1/messages` passes the `anthropic-version` check first. Endpoint handlers are added
 * between that check and the catch-all that answers every other path or method under
 * `/v1/messages` with 404 `not_found_error`.
 */
import { NextFunction, Request, Response, Router } from 'express';
import { SurfaceError } from './surface-error';
import { requireAnthropicVersion } from './version';

const NOT_FOUND = 'The requested resource could not be found.';

function notFound(_req: Request, _res: Response, next: NextFunction): void {
  next(new SurfaceError(404, 'not_found_error', NOT_FOUND));
}

export function createAnthropicRouter(): Router {
  const router = Router();
  router.use('/v1/messages', requireAnthropicVersion);
  router.use('/v1/messages', notFound);
  return router;
}
