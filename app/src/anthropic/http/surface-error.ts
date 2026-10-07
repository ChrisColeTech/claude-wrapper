/**
 * The one error type the Anthropic surface throws from anywhere in its pipeline (spec section 13).
 * The shared error handler renders it as `{type: "error", error: {type, message}, request_id}`.
 */

/** The `error.type` values the surface emits (the real API's set, minus the ones it never sends). */
export type SurfaceErrorType =
  | 'invalid_request_error'
  | 'authentication_error'
  | 'not_found_error'
  | 'request_too_large'
  | 'rate_limit_error'
  | 'api_error'
  | 'timeout_error'
  | 'overloaded_error';

export interface SurfaceErrorOptions {
  /**
   * `false` renders `x-should-retry: false`; `true` leaves the header off so the SDK's own
   * retry rules apply. Defaults to `true` for 429 and 5xx, `false` for every other status;
   * set `false` explicitly for the non-retryable 500s (operator-side failures, for instance).
   */
  retryable?: boolean;
}

export class SurfaceError extends Error {
  readonly status: number;
  readonly type: SurfaceErrorType;
  readonly retryable: boolean;

  constructor(status: number, type: SurfaceErrorType, message: string, options: SurfaceErrorOptions = {}) {
    super(message);
    this.name = 'SurfaceError';
    this.status = status;
    this.type = type;
    this.retryable = options.retryable ?? (status === 429 || status >= 500);
  }

  /** 400 `invalid_request_error`: the client must fix the request. */
  static invalidRequest(message: string): SurfaceError {
    return new SurfaceError(400, 'invalid_request_error', message);
  }
}
