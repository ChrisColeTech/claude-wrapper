/**
 * `retry-after` for a 429 (spec section 13): the whole seconds until the rate-limit window
 * resets, known only when upstream's last `rate_limit_event` reported `rejected`. A reset that is
 * already past is not known.
 */
import { RateLimitFrame } from '../../upstream/frames';

export function retryAfterSeconds(info: RateLimitFrame['rate_limit_info'] | undefined, nowMs: number): number | undefined {
  if (info?.status !== 'rejected' || typeof info.resetsAt !== 'number') return undefined;
  const seconds = Math.ceil(info.resetsAt - nowMs / 1000);
  return seconds > 0 ? seconds : undefined;
}
