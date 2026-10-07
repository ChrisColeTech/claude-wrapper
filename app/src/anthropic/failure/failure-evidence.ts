/**
 * What a run's frames have said about a failure so far (spec section 13): the last synthetic
 * assistant frame (upstream's error prose and its category), the `system/api_retry` still
 * pending (no model call has produced a frame since), and the last `rate_limit_event`. A frame
 * from a new model call makes the earlier failure history.
 */
import { ApiRetryFrame, Frame, RateLimitFrame } from '../../upstream/frames';
import { UpstreamSignal } from './upstream-signal';

const SYNTHETIC_MODEL = '<synthetic>';

interface SyntheticError {
  text: string;
  category: string | undefined;
}

function syntheticText(content: unknown): string {
  if (!Array.isArray(content)) return '';
  return content
    .map(block => (block as { type?: unknown; text?: unknown }))
    .filter(block => block.type === 'text' && typeof block.text === 'string')
    .map(block => block.text as string)
    .join('');
}

export class FailureEvidence {
  private synthetic: SyntheticError | undefined;
  private pendingRetry: ApiRetryFrame | undefined;
  private rateLimitInfo: RateLimitFrame['rate_limit_info'] | undefined;

  observe(frame: Frame): void {
    switch (frame.type) {
      case 'assistant':
        if (frame.message.model === SYNTHETIC_MODEL && frame.parent_tool_use_id == null) {
          this.synthetic = { text: syntheticText(frame.message.content), category: frame.error };
        }
        return;
      case 'system':
        if (frame.subtype === 'api_retry') this.pendingRetry = frame;
        return;
      case 'stream_event':
        if (frame.parent_tool_use_id != null) return;
        this.pendingRetry = undefined;
        this.synthetic = undefined;
        return;
      case 'rate_limit_event':
        this.rateLimitInfo = frame.rate_limit_info;
        return;
      default:
        return;
    }
  }

  /** The last `system/api_retry` no model call has answered yet. */
  get retry(): ApiRetryFrame | undefined {
    return this.pendingRetry;
  }

  /** The last `rate_limit_event`'s `rate_limit_info`. */
  get rateLimit(): RateLimitFrame['rate_limit_info'] | undefined {
    return this.rateLimitInfo;
  }

  /** The category and prose upstream gave: the synthetic frame's, else the pending api_retry's category. */
  signal(): Pick<UpstreamSignal, 'category' | 'text'> {
    const category = this.synthetic?.category ?? this.pendingRetry?.error;
    const text = this.synthetic?.text;
    return { ...(category ? { category } : {}), ...(text ? { text } : {}) };
  }
}
