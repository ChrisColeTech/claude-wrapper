/**
 * The host side of the stream-json control protocol: each `control_request` gets a fresh id,
 * and upstream's `control_response` echoing that id settles it. Unmatched responses are ignored.
 */
import { randomUUID } from 'crypto';
import { ControlResponse } from '../frames';

export interface ControlRequest {
  /** The stdin line to write. */
  line: string;
  response: Promise<ControlResponse>;
  /** The line never reached upstream. */
  abandon(error: Error): void;
}

export interface ControlChannel {
  open(subtype: string): ControlRequest;
  /** Returns whether the response answered a pending request. */
  settle(response: ControlResponse): boolean;
  rejectAll(error: Error): void;
}

type Pending = { resolve: (response: ControlResponse) => void; reject: (error: Error) => void };

export function createControlChannel(): ControlChannel {
  const pending = new Map<string, Pending>();

  return {
    open(subtype) {
      const requestId = randomUUID();
      const response = new Promise<ControlResponse>((resolve, reject) => {
        pending.set(requestId, { resolve, reject });
      });
      const line = JSON.stringify({ type: 'control_request', request_id: requestId, request: { subtype } }) + '\n';
      const abandon = (error: Error): void => {
        pending.get(requestId)?.reject(error);
        pending.delete(requestId);
      };
      return { line, response, abandon };
    },
    settle(response) {
      const waiter = pending.get(response.request_id);
      if (!waiter) return false;
      pending.delete(response.request_id);
      waiter.resolve(response);
      return true;
    },
    rejectAll(error) {
      pending.forEach(waiter => waiter.reject(error));
      pending.clear();
    }
  };
}
