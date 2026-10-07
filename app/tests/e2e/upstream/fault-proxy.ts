/**
 * A loopback proxy in front of the Messages API for e2e scenario 1 (a model call failing after
 * it has streamed content). Upstream's `ANTHROPIC_BASE_URL` points at it; every request goes on
 * to the real API unchanged, except the first streaming `POST /v1/messages` whose body carries
 * `marker`: that response is relayed event by event up to and including its first
 * `content_block_delta`, then broken, either with an SSE `error` event (`overloaded_error`, the
 * shape the API itself sends mid-stream) or by dropping the connection. Upstream's retry, and
 * every other call, passes untouched.
 */
import { once } from 'events';
import * as http from 'http';
import * as https from 'https';
import { AddressInfo } from 'net';

export type FaultMode = 'error_event' | 'cut';

export interface FaultProxyOptions {
  /** Only a request whose body contains it is broken (keeps upstream's side calls intact). */
  marker: string;
  mode?: FaultMode;
  /** The real API's origin. */
  target?: string;
}

export interface FaultProxy {
  /** For `ANTHROPIC_BASE_URL`. */
  url: string;
  /** `POST /v1/messages` requests seen, faulted or not. */
  messagesRequests(): number;
  /** Whether a response has been broken yet. */
  faulted(): boolean;
  close(): Promise<void>;
}

const OVERLOADED = 'event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}\n\n';

function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** Relays whole SSE events; after the first `content_block_delta` breaks the response per `mode`. */
function relayThenBreak(from: http.IncomingMessage, to: http.ServerResponse, mode: FaultMode): void {
  let pending = '';
  from.setEncoding('utf8');
  from.on('data', (text: string) => {
    if (to.writableEnded || to.destroyed) return;
    pending += text;
    for (let end = pending.indexOf('\n\n'); end >= 0; end = pending.indexOf('\n\n')) {
      const event = pending.slice(0, end + 2);
      pending = pending.slice(end + 2);
      to.write(event);
      if (!/^event: content_block_delta$/m.test(event)) continue;
      from.destroy();
      if (mode === 'cut') to.destroy();
      else to.end(OVERLOADED);
      return;
    }
  });
  from.on('end', () => { if (!to.writableEnded) to.end(pending); });
}

export async function startFaultProxy(options: FaultProxyOptions): Promise<FaultProxy> {
  const { marker, mode = 'error_event', target = 'https://api.anthropic.com' } = options;
  let messages = 0;
  let faulted = false;

  const server = http.createServer(async (req, res) => {
    const body = await readBody(req);
    const isMessages = req.method === 'POST' && /^\/v1\/messages(\?|$)/.test(req.url ?? '');
    if (isMessages) messages += 1;
    const breakIt = isMessages && !faulted && body.toString('utf8').includes(marker);
    const url = new URL(req.url ?? '/', target);
    const headers: http.OutgoingHttpHeaders = { ...req.headers, host: url.host, 'content-length': body.length };
    delete headers['accept-encoding'];
    const client = url.protocol === 'http:' ? http : https;
    const forward = client.request(url, { method: req.method ?? 'GET', headers }, upstream => {
      res.writeHead(upstream.statusCode ?? 502, upstream.headers);
      const streaming = String(upstream.headers['content-type'] ?? '').includes('text/event-stream');
      if (!breakIt || !streaming) {
        upstream.pipe(res);
        return;
      }
      faulted = true;
      relayThenBreak(upstream, res, mode);
    });
    forward.on('error', error => res.destroy(error));
    forward.end(body);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    messagesRequests: () => messages,
    faulted: () => faulted,
    close: () => new Promise(resolve => {
      server.closeAllConnections();
      server.close(() => resolve());
    })
  };
}
