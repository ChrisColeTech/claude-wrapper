/**
 * The surface tag (spec section 2): mounted before every other middleware, it decides which
 * surface a request belongs to. A path under `/v1/messages`, or an `anthropic-version` header,
 * is the Anthropic surface; everything else is the OpenAI surface.
 *
 * An Anthropic-tagged request gets its request id here, so every response it produces,
 * success or error, carries the `request-id` header.
 */
import { NextFunction, Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { mintRequestId } from './request-id';

const requestIds = new WeakMap<Request, string>();

function belongsToAnthropicSurface(req: Request): boolean {
  const path = req.path.toLowerCase();
  return path === '/v1/messages' || path.startsWith('/v1/messages/') || req.get('anthropic-version') !== undefined;
}

/**
 * The request's `anthropic-beta` values: a comma-separated list, or the header repeated (which
 * Node joins with commas). Every value is accepted (spec section 2); only `mcp-client-2025-11-20`
 * changes anything (connectors, spec section 9).
 */
export function anthropicBetas(req: Request): string[] {
  return (req.get('anthropic-beta') ?? '').split(',').map((beta) => beta.trim()).filter(Boolean);
}

/** `anthropic-beta` is accepted, every value, and logged. */
function logBetas(req: Request, requestId: string): void {
  const betas = anthropicBetas(req);
  if (betas.length > 0) {
    logger.debug('anthropic-beta accepted', { requestId, betas });
  }
}

export function tagSurface(req: Request, res: Response, next: NextFunction): void {
  if (belongsToAnthropicSurface(req)) {
    const requestId = mintRequestId();
    requestIds.set(req, requestId);
    res.setHeader('request-id', requestId);
    logger.info('Anthropic surface request', { requestId, method: req.method, url: req.originalUrl });
    logBetas(req, requestId);
  }
  next();
}

/** The request's id when it is tagged Anthropic; `undefined` on the OpenAI surface. */
export function anthropicRequestId(req: Request): string | undefined {
  return requestIds.get(req);
}

/** The id an Anthropic answer to `req` carries: its tag's, or one minted now for an untagged request. */
export function requestIdOf(req: Request): string {
  return anthropicRequestId(req) ?? mintRequestId();
}

export function isAnthropicRequest(req: Request): boolean {
  return requestIds.has(req);
}
