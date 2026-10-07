/**
 * Serves a fresh app on an ephemeral loopback port and hands out official SDK clients
 * pointed at it. One harness per test; `close()` in `afterEach`.
 */
import Anthropic, { ClientOptions } from '@anthropic-ai/sdk';
import { once } from 'events';
import { AddressInfo } from 'net';
import { createServer } from '../../../src/api/server';
import { SurfaceDeps } from '../../../src/anthropic/deps';

export interface SurfaceHarness {
  baseURL: string;
  /** An SDK client with `apiKey: 'test-key'` and `maxRetries: 0`; `options` override both. */
  client(options?: ClientOptions): Anthropic;
  close(): Promise<void>;
}

export async function startSurface(deps: SurfaceDeps = {}): Promise<SurfaceHarness> {
  const server = createServer(deps).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  const baseURL = `http://127.0.0.1:${port}`;

  return {
    baseURL,
    client: (options = {}) => new Anthropic({ baseURL, apiKey: 'test-key', maxRetries: 0, ...options }),
    close: () => new Promise<void>((resolve, reject) => {
      server.closeAllConnections();
      server.close((error) => (error ? reject(error) : resolve()));
    })
  };
}

/** Awaits `promise`, expecting it to reject; returns the rejection for assertions. */
export async function rejectionOf(promise: Promise<unknown>): Promise<InstanceType<typeof Anthropic.APIError>> {
  try {
    await promise;
  } catch (error) {
    return error as InstanceType<typeof Anthropic.APIError>;
  }
  throw new Error('expected the request to fail, but it succeeded');
}

export interface AnthropicErrorEnvelope {
  type: 'error';
  error: { type: string; message: string };
  request_id: string;
}

/**
 * The parsed error body the SDK attached to `error`. (The TS SDK's own `message` is the
 * status followed by the whole body as JSON, so assert on this instead.)
 */
export function envelopeOf(error: InstanceType<typeof Anthropic.APIError>): AnthropicErrorEnvelope {
  return error.error as AnthropicErrorEnvelope;
}

/** `request-id` / `request_id` format: `req_` and 24 base62 characters. */
export const REQUEST_ID = /^req_[0-9A-Za-z]{24}$/;
