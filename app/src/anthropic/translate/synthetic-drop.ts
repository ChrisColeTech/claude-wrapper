/**
 * Pass 1, synthetic-frame drop (spec section 11): only the translator's inputs go on
 * (`stream_event`, `user`, `system/api_retry`, `result`). An `assistant` frame is never an input;
 * one whose `message.model` is `"<synthetic>"` is upstream's error prose, whose status and type
 * come from `result` instead, and is logged as dropped. `rate_limit_event`, `tool_progress`,
 * `system/status`, hook and unknown frames (`system/thinking_tokens` among them) are not inputs.
 */
import { Frame } from '../../upstream/frames';
import { Pass } from './pass';
import { TranslatorLogger } from './turn-event';

const SYNTHETIC_MODEL = '<synthetic>';

function isInput(frame: Frame): boolean {
  switch (frame.type) {
    case 'stream_event':
    case 'user':
    case 'result':
      return true;
    case 'system':
      return frame.subtype === 'api_retry';
    default:
      return false;
  }
}

export function createSyntheticDrop(logger: TranslatorLogger): Pass<Frame, Frame> {
  return {
    push(frame) {
      if (frame.type === 'assistant' && frame.message.model === SYNTHETIC_MODEL) {
        logger.debug('Synthetic assistant frame dropped from the turn stream');
      }
      return isInput(frame) ? [frame] : [];
    },
    end: () => []
  };
}
