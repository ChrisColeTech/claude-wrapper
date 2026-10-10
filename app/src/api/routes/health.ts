import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/error';
import * as packageJson from '../../../package.json';

/** The package name without its npm scope: the service stays `claude-wrapper` under whichever scope it ships. */
const serviceName = packageJson.name.replace(/^@[^/]+\//, '');

/**
 * `GET /health`: the service's identity and the time, plus whatever `details` adds at each call
 * (the Anthropic surface's scheduler counts, from `createServer`).
 */
export function createHealthRouter(details: () => object = () => ({})): Router {
  const router = Router();

  router.get('/health', asyncHandler(async (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      service: serviceName,
      version: packageJson.version,
      description: packageJson.description,
      timestamp: new Date().toISOString(),
      ...details()
    });
  }));

  return router;
}

export default createHealthRouter();
