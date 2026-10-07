/**
 * The Anthropic branch of the shared error handler (spec section 13): any error reaching an
 * Anthropic-tagged request is rendered as `{type: "error", error: {type, message}, request_id}`.
 */
import { Request, Response } from 'express';
import { AppError } from '../../utils/errors';
import { SurfaceError } from './surface-error';
import { anthropicRequestId } from './surface-tag';
import { mintRequestId } from './request-id';

/** The HTTP status a stray error carries (the wrapper's `AppError.statusCode`, or `status`), else 500. */
function strayStatus(error: unknown): number {
  const { statusCode, status } = (error ?? {}) as { statusCode?: unknown; status?: unknown };
  const candidate = typeof statusCode === 'number' ? statusCode : status;
  return typeof candidate === 'number' && candidate >= 400 && candidate < 600 ? candidate : 500;
}

/**
 * Any error as the surface error it renders as. A stray error (one of the wrapper's own classes,
 * or anything else) maps by status: 4xx is `invalid_request_error` with that status, 5xx is
 * 500 `api_error`. Only the wrapper's own errors show their message on a 5xx.
 */
export function toSurfaceError(error: unknown): SurfaceError {
  if (error instanceof SurfaceError) {
    return error;
  }
  const status = strayStatus(error);
  if (status < 500) {
    return new SurfaceError(status, 'invalid_request_error', error instanceof Error ? error.message : String(error));
  }
  return new SurfaceError(500, 'api_error', error instanceof AppError ? error.message : 'Internal server error');
}

export function renderAnthropicError(error: unknown, req: Request, res: Response): void {
  const surfaceError = toSurfaceError(error);
  const requestId = anthropicRequestId(req) ?? mintRequestId();

  res.setHeader('request-id', requestId);
  if (!surfaceError.retryable) {
    res.setHeader('x-should-retry', 'false');
  }
  res.status(surfaceError.status).json({
    type: 'error',
    error: { type: surfaceError.type, message: surfaceError.message },
    request_id: requestId
  });
}
