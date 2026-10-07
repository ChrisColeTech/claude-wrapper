/**
 * The upstream failure table of spec section 13, as data (ADR 0005): each row says what the
 * client should do through the HTTP status, `error.type`, the message and `x-should-retry`. Two
 * lookups pick a row: by `api_error_status`, and by the failure category.
 */
import { SurfaceErrorType } from '../http/surface-error';
import { UpstreamCategory } from './upstream-signal';

/** Where a row's message comes from. */
export type MessageRule =
  /** The API's own message (after `API Error: <status> `), else upstream's prose, else `otherwise`. */
  | { from: 'api'; otherwise: string }
  /** `model: <the client's model>`. */
  | { from: 'model' }
  /** Names the upstream login or billing as the operator's to fix. */
  | { from: 'operator'; problem: 'login' | 'billing' }
  /** Upstream's prose verbatim, else `otherwise`. */
  | { from: 'prose'; otherwise: string }
  /** `result.errors` joined, else the subtype. */
  | { from: 'errors' }
  /** `upstream exited with code N`. */
  | { from: 'exit' };

export interface FailureRow {
  /** The HTTP status; `null` keeps upstream's own status (the other-4xx row). */
  status: number | null;
  type: SurfaceErrorType;
  message: MessageRule;
  /** `false` renders `x-should-retry: false`; absent leaves the SDKs' own retry rules. */
  retryable?: false;
}

const api = (otherwise: string): MessageRule => ({ from: 'api', otherwise });

export const UPSTREAM_FAILURE_ROWS = {
  // Fix the request.
  invalidRequest: {
    status: 400, type: 'invalid_request_error', message: api('Upstream rejected the request'), retryable: false
  },
  modelNotFound: { status: 404, type: 'not_found_error', message: { from: 'model' }, retryable: false },
  requestTooLarge: {
    status: 413, type: 'request_too_large', message: api('Upstream rejected the request as too large'), retryable: false
  },
  otherClientError: {
    status: null, type: 'invalid_request_error', message: api('Upstream rejected the request'), retryable: false
  },
  /** "Third-party apps now draw from extra usage…": upstream's message as is, never retried. */
  billingGate: {
    status: 400, type: 'invalid_request_error', message: api('Upstream rejected the request'), retryable: false
  },
  // Retry later.
  rateLimit: { status: 429, type: 'rate_limit_error', message: api('Upstream rate limit reached') },
  overloaded: { status: 529, type: 'overloaded_error', message: api('Upstream overloaded') },
  serverError: { status: 500, type: 'api_error', message: api('Upstream server error') },
  timeout: { status: 504, type: 'timeout_error', message: api('Upstream timed out') },
  // Operator-side.
  login: { status: 500, type: 'api_error', message: { from: 'operator', problem: 'login' }, retryable: false },
  billing: { status: 500, type: 'api_error', message: { from: 'operator', problem: 'billing' }, retryable: false },
  // Other.
  maxOutputTokens: {
    status: 500, type: 'api_error', message: { from: 'prose', otherwise: 'Upstream exceeded its output token maximum' },
    retryable: false
  },
  unknown: { status: 500, type: 'api_error', message: { from: 'prose', otherwise: 'Upstream failed' } },
  resultSubtype: { status: 500, type: 'api_error', message: { from: 'errors' }, retryable: false },
  exit: { status: 500, type: 'api_error', message: { from: 'exit' } }
} satisfies Record<string, FailureRow>;

export type UpstreamRowName = keyof typeof UPSTREAM_FAILURE_ROWS;

const STATUS_ROWS: Readonly<Record<number, UpstreamRowName>> = {
  400: 'invalidRequest', 401: 'login', 402: 'billing', 403: 'login', 404: 'modelNotFound', 413: 'requestTooLarge',
  429: 'rateLimit', 500: 'serverError', 504: 'timeout', 529: 'overloaded'
};

const CATEGORY_ROWS: Readonly<Record<UpstreamCategory, UpstreamRowName>> = {
  invalid_request: 'invalidRequest',
  model_not_found: 'modelNotFound',
  rate_limit: 'rateLimit',
  overloaded: 'overloaded',
  server_error: 'serverError',
  authentication_failed: 'login',
  oauth_org_not_allowed: 'login',
  cloud_credential_error: 'login',
  account_on_hold: 'billing',
  billing_error: 'billing',
  max_output_tokens: 'maxOutputTokens',
  unknown: 'unknown'
};

/** The row for an `api_error_status` (400 to 599): listed, else other 4xx, else other 5xx. */
export function rowForStatus(status: number): UpstreamRowName {
  return STATUS_ROWS[status] ?? (status < 500 ? 'otherClientError' : 'serverError');
}

/** The row for a category; one outside the enum reads as `unknown`. */
export function rowForCategory(category: string): UpstreamRowName {
  return Object.prototype.hasOwnProperty.call(CATEGORY_ROWS, category)
    ? CATEGORY_ROWS[category as UpstreamCategory]
    : 'unknown';
}
