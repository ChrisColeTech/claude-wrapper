/**
 * `GET /v1/models` and `GET /v1/models/{id}` over the catalogue (spec section 3). The surface
 * is negotiated by mounting order: these routes run before the OpenAI routes and pass a request
 * on unless it carries `anthropic-version`, so the header-less listing stays the OpenAI one and
 * the header-less retrieve stays unserved.
 */
import { NextFunction, Request, Response, Router } from 'express';
import { Catalogue, ModelPageRequest } from '../catalogue';
import { SurfaceError } from '../surface-error';
import { isAnthropicRequest } from './surface-tag';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 1000;
const CURSORS = { after_id: 'afterId', before_id: 'beforeId' } as const;

function anthropicOnly(req: Request, _res: Response, next: NextFunction): void {
  if (isAnthropicRequest(req)) {
    next();
  } else {
    next('route');
  }
}

function parseLimit(value: unknown): number | SurfaceError {
  if (value === undefined) return DEFAULT_LIMIT;
  const limit = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
  if (limit >= 1 && limit <= MAX_LIMIT) return limit;
  return SurfaceError.invalidRequest(`limit: must be an integer from 1 to ${MAX_LIMIT}`);
}

/** The page the query asks for; a cursor must name a model the catalogue serves. */
function parsePageRequest(query: Request['query'], catalogue: Catalogue): ModelPageRequest | SurfaceError {
  const limit = parseLimit(query['limit']);
  if (limit instanceof SurfaceError) return limit;
  const page: ModelPageRequest = { limit };

  for (const [parameter, key] of Object.entries(CURSORS)) {
    const value = query[parameter];
    if (value === undefined) continue;
    if (typeof value !== 'string') return SurfaceError.invalidRequest(`${parameter}: must be a single model id`);
    if (!catalogue.resolve(value)) return SurfaceError.invalidRequest(`${parameter}: no model "${value}" in the catalogue`);
    page[key] = value;
  }
  return page;
}

export function createModelsRouter(catalogue: Catalogue): Router {
  const router = Router();

  router.get('/v1/models', anthropicOnly, (req, res, next) => {
    const page = parsePageRequest(req.query, catalogue);
    if (page instanceof SurfaceError) {
      next(page);
      return;
    }
    res.json(catalogue.list(page));
  });

  router.get('/v1/models/:modelId', anthropicOnly, (req, res, next) => {
    const name = req.params['modelId'] ?? '';
    const model = catalogue.resolve(name);
    if (!model) {
      next(SurfaceError.of('not_found_error', `model: ${name}`));
      return;
    }
    res.json(model);
  });

  return router;
}
