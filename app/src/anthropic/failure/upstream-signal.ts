/**
 * What upstream said about a failure, gathered from its frames (spec section 13), and what the
 * surface knows beside it. The upstream failure table maps one to a surface error.
 */

/**
 * The failure category: one enum shared by `system/api_retry.error` and the synthetic
 * assistant frame's `error`. A value outside it is read as `unknown`.
 */
export type UpstreamCategory =
  | 'authentication_failed'
  | 'oauth_org_not_allowed'
  | 'account_on_hold'
  | 'billing_error'
  | 'rate_limit'
  | 'overloaded'
  | 'invalid_request'
  | 'model_not_found'
  | 'server_error'
  | 'max_output_tokens'
  | 'cloud_credential_error'
  | 'unknown';

/**
 * The categories that interrupt the run at first sight: retrying cannot help, so upstream's own
 * retry loop never runs on the surface (ADR 0005). The others wait for the retry cap.
 */
export const DETERMINISTIC_CATEGORIES: ReadonlySet<string> = new Set<UpstreamCategory>([
  'authentication_failed', 'oauth_org_not_allowed', 'account_on_hold', 'billing_error', 'invalid_request',
  'model_not_found', 'cloud_credential_error'
]);

/** Each field is one source; the table reads them in precedence order. */
export interface UpstreamSignal {
  /** `result.api_error_status`: the status the API answered with. Wins over everything else. */
  apiErrorStatus?: number | null;
  /** The synthetic frame's `error`, else the last `system/api_retry`'s. */
  category?: string;
  /** Upstream's prose: the synthetic frame's text, else `result.result`. */
  text?: string;
  /** A failed `result`'s subtype and `errors`. */
  subtype?: string;
  errors?: string[] | null;
  /** How the process ended, when it ended with no `result`. The last resort. */
  exit?: { code: number | null; signal: string | null };
}

export interface FailureContext {
  /** The client's `model`, which the 404 row names. */
  requestedModel?: string;
  /** Seconds until upstream's rate-limit window resets, when known: `retry-after` on the 429 row. */
  retryAfter?: number;
}
