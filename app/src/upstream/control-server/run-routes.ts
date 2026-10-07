/**
 * The per-run paths and their tokens: `/runs/<id>/mcp` and `/runs/<id>/hook`, each answering
 * only to `Authorization: Bearer <the run's token>`, compared in constant time.
 */
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { IncomingMessage } from 'http';

export type RunEndpointName = 'mcp' | 'hook';

export interface RunRoute {
  runId: string;
  endpoint: RunEndpointName;
}

export const RUN_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const RUN_PATH = /^\/runs\/([A-Za-z0-9_-]{1,128})\/(mcp|hook)$/;

/** The run and endpoint a request path names, else `undefined`; the query string is ignored. */
export function matchRunPath(url: string | undefined): RunRoute | undefined {
  const match = RUN_PATH.exec((url ?? '').split('?')[0] as string);
  return match ? { runId: match[1] as string, endpoint: match[2] as RunEndpointName } : undefined;
}

/** 256 random bits, base64url. */
export function mintToken(): string {
  return randomBytes(32).toString('base64url');
}

const digest = (value: string): Buffer => createHash('sha256').update(value).digest();

/** Equal-length digests, so neither the token's content nor its length shows in the timing. */
export function presentsToken(req: IncomingMessage, token: string): boolean {
  const presented = /^Bearer\s+(\S+)\s*$/i.exec(req.headers.authorization ?? '')?.[1];
  return presented !== undefined && timingSafeEqual(digest(presented), digest(token));
}
