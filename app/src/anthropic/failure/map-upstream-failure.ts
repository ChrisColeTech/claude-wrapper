/**
 * `mapUpstreamFailure` (spec section 13): picks the upstream failure table's row by source
 * precedence (`api_error_status`, then the category, then `result.subtype`, then the process
 * exit) and words its message. The API's own message is the text after `API Error: <status> `.
 */
import { constants } from 'os';
import { SurfaceError } from '../http/surface-error';
import {
  FailureRow, MessageRule, rowForCategory, rowForStatus, UPSTREAM_FAILURE_ROWS, UpstreamRowName
} from './upstream-table';
import { FailureContext, UpstreamSignal } from './upstream-signal';

const API_ERROR = /^API Error: \d{3} ([\s\S]*)$/;
const BILLING_GATE = /Third-party apps now draw from extra usage/i;
const NOT_LOGGED_IN = /^Not logged in\b/i;
const OPERATOR_SUFFIX = "The wrapper's operator must fix it; your API key and request are not the cause.";

/** `api_error_status` when it is an HTTP error status, else undefined. */
function apiStatus(signal: UpstreamSignal): number | undefined {
  const status = signal.apiErrorStatus;
  return typeof status === 'number' && Number.isInteger(status) && status >= 400 && status <= 599 ? status : undefined;
}

const textOf = (signal: UpstreamSignal): string | undefined => (signal.text ? signal.text : undefined);

/** The billing-gate 400 ("Third-party apps now draw from extra usage…"): relayed, never retried. */
export function isBillingGate(signal: UpstreamSignal): boolean {
  const status = apiStatus(signal);
  return (status === undefined || status === 400) && BILLING_GATE.test(textOf(signal) ?? '');
}

/** The table row for `signal`, by source precedence. */
export function upstreamRow(signal: UpstreamSignal): UpstreamRowName {
  const status = apiStatus(signal);
  if (isBillingGate(signal)) return 'billingGate';
  if (status !== undefined) return rowForStatus(status);
  if (signal.category) return rowForCategory(signal.category);
  if (NOT_LOGGED_IN.test(textOf(signal) ?? '')) return 'login';
  if (signal.subtype && signal.subtype !== 'success') return 'resultSubtype';
  if (signal.exit) return 'exit';
  return 'unknown';
}

/** The API's own message: the text after `API Error: <status> `, else the whole text. */
export function apiMessage(text: string): string {
  return API_ERROR.exec(text)?.[1] ?? text;
}

function operatorMessage(problem: 'login' | 'billing', signal: UpstreamSignal): string {
  const status = apiStatus(signal);
  const detail = [signal.category, status === undefined ? undefined : `HTTP ${status}`]
    .filter(Boolean).join(', ') || 'not logged in';
  const what = problem === 'login'
    ? 'The upstream Claude Code login failed'
    : 'The upstream Claude Code account has a billing problem';
  return `${what} (${detail}). ${OPERATOR_SUFFIX}`;
}

/** `upstream exited with code N`; a signal is named with its shell-style code (SIGTERM is 143). */
export function exitMessage(exit: { code: number | null; signal: string | null } | undefined): string {
  if (exit?.code != null) return `upstream exited with code ${exit.code}`;
  const signal = exit?.signal;
  if (!signal) return 'upstream exited';
  const number = (constants.signals as Record<string, number | undefined>)[signal];
  if (number === undefined) return `upstream was ended by ${signal}`;
  return `upstream exited with code ${128 + number} (${signal})`;
}

function messageOf(rule: MessageRule, signal: UpstreamSignal, context: FailureContext): string {
  const text = textOf(signal);
  switch (rule.from) {
    case 'api':
      return text === undefined ? rule.otherwise : apiMessage(text);
    case 'prose':
      return text ?? rule.otherwise;
    case 'model':
      return `model: ${context.requestedModel ?? 'unknown'}`;
    case 'operator':
      return operatorMessage(rule.problem, signal);
    case 'errors':
      return signal.errors && signal.errors.length > 0 ? signal.errors.join('; ') : (signal.subtype ?? 'error');
    case 'exit':
      return exitMessage(signal.exit);
  }
}

/** The surface error for an upstream failure; `context` supplies the client's model and `retry-after`. */
export function mapUpstreamFailure(signal: UpstreamSignal, context: FailureContext = {}): SurfaceError {
  const name = upstreamRow(signal);
  const row: FailureRow = UPSTREAM_FAILURE_ROWS[name];
  const status = row.status ?? apiStatus(signal) ?? 400;
  const retryAfter = name === 'rateLimit' ? context.retryAfter : undefined;
  return new SurfaceError(status, row.type, messageOf(row.message, signal, context), {
    ...(row.retryable === false ? { retryable: false } : {}),
    ...(retryAfter === undefined ? {} : { retryAfter })
  });
}
