/**
 * A loopback HTTP server for sink tests: each request's response goes to a sink the test builds,
 * and the test reads the response as a client would (`fetch`), incrementally.
 */
import { once } from 'events';
import { createServer, ServerResponse } from 'http';
import { AddressInfo } from 'net';

export interface SinkServer<T> {
  url: string;
  /** The sink built for the next request, with its response. */
  nextSink(): Promise<{ sink: T; res: ServerResponse }>;
  close(): Promise<void>;
}

export async function startSinkServer<T>(build: (res: ServerResponse) => T): Promise<SinkServer<T>> {
  const waiting: ((built: { sink: T; res: ServerResponse }) => void)[] = [];
  const built: { sink: T; res: ServerResponse }[] = [];
  const server = createServer((_req, res) => {
    const entry = { sink: build(res), res };
    const waiter = waiting.shift();
    if (waiter) waiter(entry);
    else built.push(entry);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/`,
    nextSink: () => new Promise(resolve => {
      const entry = built.shift();
      if (entry) resolve(entry);
      else waiting.push(resolve);
    }),
    close: () => new Promise<void>(resolve => {
      server.closeAllConnections();
      server.close(() => resolve());
    })
  };
}

/** Reads a response body as text, chunk by chunk. */
export function bodyReader(response: Response): { until(match: (text: string) => boolean): Promise<string>; rest(): Promise<string> } {
  const reader = (response.body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  let text = '';
  const until = async (match: (text: string) => boolean): Promise<string> => {
    while (!match(text)) {
      const { value, done } = await reader.read();
      if (done) return text;
      text += decoder.decode(value, { stream: true });
    }
    return text;
  };
  return { until, rest: () => until(() => false) };
}

/** The SSE events in `text`, as `{event, data}` with `data` parsed. */
export function sseEvents(text: string): { event: string; data: unknown }[] {
  return text.split('\n\n').filter(block => block.trim() !== '').map(block => {
    const lines = block.split('\n');
    const event = (lines.find(line => line.startsWith('event: ')) ?? '').slice('event: '.length);
    const data = lines.filter(line => line.startsWith('data: ')).map(line => line.slice('data: '.length)).join('\n');
    return { event, data: JSON.parse(data) };
  });
}
