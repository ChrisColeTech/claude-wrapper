/**
 * Rate-limit admission (spec sections 13 and 14): upstream's last `rate_limit_event`, from any
 * run, is kept. After it reported `rejected`, every request until its `resetsAt` is refused with
 * 429 `rate_limit_error` and `retry-after`, before any run starts; a later event replaces it, and
 * a rejection that names no reset time refuses nothing. `allowed_warning` is logged.
 */
import { RateLimitFrame } from '../../upstream/frames';
import { Clock } from '../../utils/clock';
import { Logger } from '../../utils/logger';
import { mapUpstreamFailure, retryAfterSeconds } from '../failure';
import { SurfaceError } from '../surface-error';
import { SchedulerCounts } from './types';

type RateLimitInfo = RateLimitFrame['rate_limit_info'];

/** Whose run reported the event, for its log line. */
export interface RateLimitSource {
  requestId: string;
  sessionId: string | undefined;
}

export class RateLimitGate {
  private last: RateLimitInfo | undefined;

  constructor(private readonly clock: Clock, private readonly logger: Pick<Logger, 'info' | 'warn'>) {}

  observe(info: RateLimitInfo, source: RateLimitSource): void {
    this.last = info;
    const context = { ...source, status: info.status, resetsAt: info.resetsAt, rateLimitType: info.rateLimitType };
    if (info.status === 'allowed_warning') this.logger.warn('Upstream rate limit warning', context);
    if (info.status === 'rejected') {
      this.logger.warn('Upstream rate limit reached: requests refused until it resets', context);
    }
  }

  /** The 429 a request gets now, if any. */
  refusal(): SurfaceError | undefined {
    const retryAfter = retryAfterSeconds(this.last, this.clock.now());
    return retryAfter === undefined ? undefined : mapUpstreamFailure({ category: 'rate_limit' }, { retryAfter });
  }

  state(): SchedulerCounts['rateLimit'] {
    const info = this.last;
    if (!info) return null;
    return {
      status: info.status,
      ...(info.resetsAt === undefined ? {} : { resetsAt: info.resetsAt }),
      ...(info.rateLimitType === undefined ? {} : { rateLimitType: info.rateLimitType })
    };
  }
}
