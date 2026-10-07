/**
 * The surface's static OpenAPI document (spec sections 16 and 17): the contract of its four
 * endpoints, written by hand against the code, never generated. Served at
 * `ANTHROPIC_OPENAPI_PATH` and listed in the Swagger UI's definition picker beside the OpenAI
 * surface's `/swagger.json`, whose definition is not edited.
 */
import { Request, Response } from 'express';
import document from './openapi.json';

/** Under `/docs`, so the auth middleware's skip list makes it public, as `/swagger.json` is. */
export const ANTHROPIC_OPENAPI_PATH = '/docs/anthropic-openapi.json';

export function serveAnthropicOpenApi(_req: Request, res: Response): void {
  res.json(document);
}
