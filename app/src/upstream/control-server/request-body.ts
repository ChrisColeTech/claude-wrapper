/**
 * Reads a request's JSON body with a size bound. An empty body is `undefined`.
 */
import { IncomingMessage } from 'http';

/** The bound the MCP SDK's own transport applies to a POST it reads itself. */
export const MAX_BODY_BYTES = 4 * 1024 * 1024;

export type BodyResult = { ok: true; body: unknown } | { ok: false; status: 400 | 413 };

export async function readJsonBody(req: IncomingMessage, limit = MAX_BODY_BYTES): Promise<BodyResult> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) return { ok: false, status: 413 };
    chunks.push(chunk as Buffer);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (text.trim() === '') return { ok: true, body: undefined };
  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, status: 400 };
  }
}
