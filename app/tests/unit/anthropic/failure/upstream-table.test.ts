/**
 * The upstream failure table (spec section 13, ADR 0005), one test per row: an upstream signal
 * in, the surface error out (HTTP status, `error.type`, message, `x-should-retry`). Signals
 * mirror the recordings: `API Error: <status> <message>` synthetic text, `result` fields, the
 * category enum shared by `system/api_retry` and the synthetic frame.
 */
import { mapUpstreamFailure, UpstreamSignal } from '../../../../src/anthropic/failure';

const shape = (signal: UpstreamSignal, context = {}) => {
  const error = mapUpstreamFailure(signal, context);
  return { status: error.status, type: error.type, message: error.message, retryable: error.retryable };
};

describe('upstream failure table: fix the request', () => {
  it('maps api_error_status 400 to 400 invalid_request_error with the text after "API Error: 400 "', () => {
    expect(shape({ apiErrorStatus: 400, category: 'unknown',
      text: 'API Error: 400 Unable to download the file. Please verify the URL and try again.' })).toEqual({
      status: 400, type: 'invalid_request_error', retryable: false,
      message: 'Unable to download the file. Please verify the URL and try again.'
    });
  });

  it('maps category invalid_request to 400 invalid_request_error', () => {
    expect(shape({ category: 'invalid_request', text: 'API Error: 400 tools.4.custom.name: too long' })).toEqual({
      status: 400, type: 'invalid_request_error', message: 'tools.4.custom.name: too long', retryable: false
    });
  });

  it('maps api_error_status 404 and model_not_found to 404 not_found_error naming the requested model', () => {
    const cliProse = "There's an issue with the selected model (zzz). It may not exist or you may not have access to it.";
    const expected = { status: 404, type: 'not_found_error', message: 'model: zzz', retryable: false };

    expect(shape({ apiErrorStatus: 404, text: cliProse }, { requestedModel: 'zzz' })).toEqual(expected);
    expect(shape({ category: 'model_not_found' }, { requestedModel: 'zzz' })).toEqual(expected);
  });

  it('maps api_error_status 413 to 413 request_too_large with the text after "API Error: 413 "', () => {
    expect(shape({ apiErrorStatus: 413, text: 'API Error: 413 Request exceeds the maximum size' })).toEqual({
      status: 413, type: 'request_too_large', message: 'Request exceeds the maximum size', retryable: false
    });
  });

  it('keeps any other 4xx status as invalid_request_error with the text after "API Error: <status> "', () => {
    expect(shape({ apiErrorStatus: 422, text: 'API Error: 422 Unprocessable thing' })).toEqual({
      status: 422, type: 'invalid_request_error', message: 'Unprocessable thing', retryable: false
    });
  });

  it("relays the billing-gate 400 as 400 invalid_request_error with upstream's message verbatim", () => {
    const gate = 'Third-party apps now draw from extra usage, not plan limits. Visit claude.ai to turn it on.';

    expect(shape({ apiErrorStatus: 400, category: 'unknown', text: `API Error: 400 ${gate}` })).toEqual({
      status: 400, type: 'invalid_request_error', message: gate, retryable: false
    });
  });
});

describe('upstream failure table: retry later', () => {
  it('maps rate_limit and 429 to 429 rate_limit_error with retry-after when known', () => {
    const limited = mapUpstreamFailure({ category: 'rate_limit' }, { retryAfter: 120 });

    expect(shape({ apiErrorStatus: 429, text: 'API Error: 429 Too many requests' })).toEqual({
      status: 429, type: 'rate_limit_error', message: 'Too many requests', retryable: true
    });
    expect(limited).toMatchObject({ status: 429, type: 'rate_limit_error', message: 'Upstream rate limit reached',
      retryable: true, retryAfter: 120 });
    expect(mapUpstreamFailure({ category: 'rate_limit' }).retryAfter).toBeUndefined();
  });

  it('maps overloaded and 529 to 529 overloaded_error', () => {
    expect(shape({ category: 'overloaded' })).toEqual({
      status: 529, type: 'overloaded_error', message: 'Upstream overloaded', retryable: true
    });
    expect(shape({ apiErrorStatus: 529, text: 'API Error: 529 Overloaded' })).toEqual({
      status: 529, type: 'overloaded_error', message: 'Overloaded', retryable: true
    });
  });

  it('maps server_error, 500 and any other 5xx to 500 api_error', () => {
    const expected = { status: 500, type: 'api_error', message: 'Internal server error', retryable: true };

    expect(shape({ apiErrorStatus: 500, text: 'API Error: 500 Internal server error' })).toEqual(expected);
    expect(shape({ apiErrorStatus: 503, text: 'API Error: 503 Internal server error' })).toEqual(expected);
    expect(shape({ category: 'server_error', text: 'Internal server error' })).toEqual(expected);
    expect(shape({ category: 'server_error' }).message).toBe('Upstream server error');
  });

  it('maps api_error_status 504 to 504 timeout_error', () => {
    expect(shape({ apiErrorStatus: 504, text: 'API Error: 504 Gateway timeout' })).toEqual({
      status: 504, type: 'timeout_error', message: 'Gateway timeout', retryable: true
    });
  });
});

describe('upstream failure table: operator-side', () => {
  const login = /^The upstream Claude Code login failed \((.+)\)\. The wrapper's operator must fix it; your API key and request are not the cause\.$/;
  const billing = /^The upstream Claude Code account has a billing problem \((.+)\)\. The wrapper's operator must fix it; your API key and request are not the cause\.$/;

  it.each([
    [{ category: 'authentication_failed', text: 'Not logged in · Please run /login' }, 'authentication_failed'],
    [{ category: 'oauth_org_not_allowed' }, 'oauth_org_not_allowed'],
    [{ category: 'cloud_credential_error' }, 'cloud_credential_error'],
    [{ apiErrorStatus: 401, category: 'authentication_failed' }, 'authentication_failed, HTTP 401'],
    [{ apiErrorStatus: 403 }, 'HTTP 403'],
    [{ text: 'Not logged in · Please run /login' }, 'not logged in']
  ])('maps %j to a non-retryable 500 api_error naming the upstream login', (signal: UpstreamSignal, detail) => {
    const mapped = shape(signal);

    expect(mapped).toEqual({ status: 500, type: 'api_error', message: expect.stringMatching(login), retryable: false });
    expect(login.exec(mapped.message)?.[1]).toBe(detail);
  });

  it.each([
    [{ category: 'account_on_hold' }, 'account_on_hold'],
    [{ category: 'billing_error' }, 'billing_error'],
    [{ apiErrorStatus: 402 }, 'HTTP 402']
  ])('maps %j to a non-retryable 500 api_error naming the upstream billing', (signal: UpstreamSignal, detail) => {
    const mapped = shape(signal);

    expect(mapped).toEqual({ status: 500, type: 'api_error', message: expect.stringMatching(billing), retryable: false });
    expect(billing.exec(mapped.message)?.[1]).toBe(detail);
  });
});

describe('upstream failure table: other', () => {
  it("maps max_output_tokens to a non-retryable 500 api_error with upstream's prose", () => {
    const prose = "API Error: Claude's response exceeded the 100 output token maximum. To configure this behavior, set the CLAUDE_CODE_MAX_OUTPUT_TOKENS environment variable.";

    expect(shape({ category: 'max_output_tokens', text: prose })).toEqual({
      status: 500, type: 'api_error', message: prose, retryable: false
    });
  });

  it("maps unknown without api_error_status to a retryable 500 api_error with upstream's prose", () => {
    expect(shape({ category: 'unknown', text: 'API Error: Connection error.' })).toEqual({
      status: 500, type: 'api_error', message: 'API Error: Connection error.', retryable: true
    });
    expect(shape({ category: 'verification_required', text: 'odd' })).toEqual({
      status: 500, type: 'api_error', message: 'odd', retryable: true
    });
  });

  it.each(['error_max_turns', 'error_max_budget_usd', 'error_max_structured_output_retries', 'error_during_execution'])(
    'maps result.subtype %s to a non-retryable 500 api_error with errors[] joined, else the subtype', subtype => {
      expect(shape({ subtype, errors: ['Reached maximum budget ($0.25)', 'second'] })).toEqual({
        status: 500, type: 'api_error', message: 'Reached maximum budget ($0.25); second', retryable: false
      });
      expect(shape({ subtype, errors: null })).toEqual({
        status: 500, type: 'api_error', message: subtype, retryable: false
      });
    });

  it('maps a process exit with no result to a retryable 500 api_error naming the exit code', () => {
    expect(shape({ exit: { code: 1, signal: null } })).toEqual({
      status: 500, type: 'api_error', message: 'upstream exited with code 1', retryable: true
    });
    expect(shape({ exit: { code: null, signal: 'SIGTERM' } }).message).toBe('upstream exited with code 143 (SIGTERM)');
  });
});

describe('upstream failure table: source precedence', () => {
  it('takes api_error_status over the category', () => {
    expect(shape({ apiErrorStatus: 400, category: 'overloaded', text: 'API Error: 400 bad' }).status).toBe(400);
  });

  it('takes the category over result.subtype', () => {
    expect(shape({ category: 'overloaded', subtype: 'error_during_execution' }).status).toBe(529);
  });

  it('takes result.subtype over the process exit', () => {
    expect(shape({ subtype: 'error_max_turns', exit: { code: 1, signal: null } }).message).toBe('error_max_turns');
  });

  it("falls back to upstream's text for an errored success result that names nothing", () => {
    expect(shape({ subtype: 'success', text: 'something odd' })).toEqual({
      status: 500, type: 'api_error', message: 'something odd', retryable: true
    });
  });
});
