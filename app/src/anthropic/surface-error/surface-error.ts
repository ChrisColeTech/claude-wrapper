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
  /** Seconds the client should wait before retrying: rendered as `retry-after` (spec section 13). */
  retryAfter?: number;
}

/** The status each type is answered with, unless a row of the error tables says otherwise. */
const STATUS_OF: Readonly<Record<SurfaceErrorType, number>> = {
  invalid_request_error: 400,
  authentication_error: 401,
  not_found_error: 404,
  request_too_large: 413,
  rate_limit_error: 429,
  api_error: 500,
  timeout_error: 504,
  overloaded_error: 529
};

export class SurfaceError extends Error {
  readonly status: number;
  readonly type: SurfaceErrorType;
  readonly retryable: boolean;
  readonly retryAfter: number | undefined;

  constructor(status: number, type: SurfaceErrorType, message: string, options: SurfaceErrorOptions = {}) {
    super(message);
    this.name = 'SurfaceError';
    this.status = status;
    this.type = type;
    this.retryable = options.retryable ?? (status === 429 || status >= 500);
    this.retryAfter = options.retryAfter;
  }

  /** An error of `type` with that type's usual status (400, 401, 404, 413, 429, 500, 504, 529). */
  static of(type: SurfaceErrorType, message: string, options: SurfaceErrorOptions = {}): SurfaceError {
    return new SurfaceError(STATUS_OF[type], type, message, options);
  }

  /** 400 `invalid_request_error`: the client must fix the request. */
  static invalidRequest(message: string): SurfaceError {
    return SurfaceError.of('invalid_request_error', message);
  }
}
