/**
 * The Anthropic surface's routes, mounted before the OpenAI routes. The models routes serve
 * the catalogue to requests carrying `anthropic-version` and pass the rest on. Everything under
 * `/v1/messages` passes the `anthropic-version` check first. Endpoint handlers are added
 * between that check and the catch-all that answers every other path or method under
 * `/v1/messages` with 404 `not_found_error`.
 */
import { NextFunction, Request, Response, Router } from 'express';
import { Catalogue } from '../catalogue';
import { createModelsRouter } from './models';
import { SurfaceError } from '../surface-error';
import { requireAnthropicVersion } from './version';

const NOT_FOUND = 'The requested resource could not be found.';

/** An endpoint handler: a rejection is an error the shared error handler renders. */
export type SurfaceHandler = (req: Request, res: Response) => Promise<void>;

export interface AnthropicRoutes {
  catalogue: Catalogue;
  /** `POST /v1/messages`. */
  messages: SurfaceHandler;
  /** `POST /v1/messages/count_tokens`. */
  countTokens: SurfaceHandler;
}

function notFound(_req: Request, _res: Response, next: NextFunction): void {
  next(SurfaceError.of('not_found_error', NOT_FOUND));
}

const route = (handler: SurfaceHandler) => (req: Request, res: Response, next: NextFunction): void => {
  handler(req, res).catch(next);
};

export function createAnthropicRouter({ catalogue, messages, countTokens }: AnthropicRoutes): Router {
  const router = Router();
  router.use(createModelsRouter(catalogue));
  router.use('/v1/messages', requireAnthropicVersion);
  router.post('/v1/messages', route(messages));
  router.post('/v1/messages/count_tokens', route(countTokens));
  router.use('/v1/messages', notFound);
  return router;
}
