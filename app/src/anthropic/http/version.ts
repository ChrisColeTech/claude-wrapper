/**
 * `anthropic-version` is required under `/v1/messages` (spec section 2): `2023-06-01`, or the
 * deprecated `2023-01-01`. On `/v1/models*` its presence only selects the surface.
 */
import { NextFunction, Request, Response } from 'express';
import { SurfaceError } from '../surface-error';

const ACCEPTED_VERSIONS: readonly string[] = ['2023-06-01', '2023-01-01'];

export function requireAnthropicVersion(req: Request, _res: Response, next: NextFunction): void {
  const version = req.get('anthropic-version');

  if (version === undefined) {
    next(SurfaceError.invalidRequest('anthropic-version: header is required'));
    return;
  }
  if (!ACCEPTED_VERSIONS.includes(version)) {
    next(SurfaceError.invalidRequest(
      `anthropic-version: unknown version "${version}"; accepted values are ${ACCEPTED_VERSIONS.join(' and ')}`
    ));
    return;
  }
  next();
}
