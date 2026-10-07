/**
 * The client credential gate on Anthropic-tagged requests (spec section 2). With the wrapper's
 * `API_KEY` configured, `x-api-key: <key>` or `Authorization: Bearer <key>` is accepted,
 * compared in constant time; without it the surface is open. The credential is a gate only:
 * it never reaches upstream.
 */
import { createHash, timingSafeEqual } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { AuthMiddlewareOptions } from '../../auth/middleware';
import { SurfaceError } from '../surface-error';

const MISSING = 'Missing API key: send it in the x-api-key header or as Authorization: Bearer <key>.';
const INVALID = 'Invalid API key.';

function presentedCredentials(req: Request): string[] {
  const bearer = /^Bearer\s+(\S+)\s*$/i.exec(req.get('authorization') ?? '')?.[1];
  return [req.get('x-api-key'), bearer].filter((value): value is string => !!value);
}

/** Equal-length digests, so neither the key's content nor its length shows in the timing. */
function matches(presented: string, expected: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(presented), digest(expected));
}

/** Takes the same options as the OpenAI surface's `createAuthMiddleware`. */
export function createAnthropicAuth(
  options: AuthMiddlewareOptions = {}
): (req: Request, res: Response, next: NextFunction) => void {
  const { skipPaths = [], apiKey } = options;

  return (req, _res, next) => {
    if (!apiKey || skipPaths.some((path) => req.path.startsWith(path))) {
      next();
      return;
    }
    const presented = presentedCredentials(req);
    if (presented.length === 0) {
      next(SurfaceError.of('authentication_error', MISSING));
      return;
    }
    if (!presented.some((credential) => matches(credential, apiKey))) {
      next(SurfaceError.of('authentication_error', INVALID));
      return;
    }
    next();
  };
}
