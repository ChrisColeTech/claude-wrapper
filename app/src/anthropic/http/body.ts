/**
 * The JSON body parser for Anthropic-tagged requests (spec section 2): bodies up to 32 MB, as
 * the real API (one base64 image would overflow the OpenAI surface's 100 kB default). Mounted
 * ahead of the global `express.json()`, which then skips a body already parsed here.
 */
import express, { NextFunction, Request, Response } from 'express';
import { SurfaceError } from './surface-error';
import { isAnthropicRequest } from './surface-tag';

const parseJson = express.json({ limit: '32mb' });

function asSurfaceError(error: unknown): SurfaceError {
  const parserType = (error as { type?: unknown }).type;
  if (parserType === 'entity.too.large') {
    return new SurfaceError(413, 'request_too_large', 'Request exceeds the maximum size of 32 MB.');
  }
  if (parserType === 'entity.parse.failed') {
    return SurfaceError.invalidRequest('Request body is not valid JSON.');
  }
  return SurfaceError.invalidRequest(`Could not read the request body: ${(error as Error).message}`);
}

export function parseAnthropicBody(req: Request, res: Response, next: NextFunction): void {
  if (!isAnthropicRequest(req)) {
    next();
    return;
  }
  // `false`: a body with a missing or non-JSON content type; `null`: no body at all
  if (req.is('application/json') === false) {
    next(SurfaceError.invalidRequest('Request body must be sent with content-type: application/json.'));
    return;
  }
  parseJson(req, res, (error?: unknown) => {
    next(error === undefined ? undefined : asSurfaceError(error));
  });
}
