/**
 * `createTranslator` (spec sections 11 and 16): a run's frames in, one turn stream out. The
 * passes run in the spec's order, one file each; the ones this surface does not have yet are
 * marked where they go. Each frame reaches the failure reader once the passes have taken it, so
 * a failure is mapped with what upstream said before the frame that triggered it.
 */
import { logger as defaultLogger } from '../../utils/logger';
import { createFailureReader } from '../failure';
import { createAllowlist } from './allowlist';
import { createFlattener } from './flatten';
import { chain, inOrder } from './pass';
import { createRedaction } from './redact';
import { createSyntheticDrop } from './synthetic-drop';
import { Translator, TranslatorConfig } from './turn-event';

export function createTranslator(config: TranslatorConfig = {}): Translator {
  const logger = config.logger ?? defaultLogger;
  const failures = config.failures ?? createFailureReader();
  const frames = chain(createSyntheticDrop(logger), createFlattener(failures));
  const events = inOrder([
    // 3 server-tool pass, 4 connector pass, 5 bridge prefix strip, 6 StructuredOutput buffer,
    // 7 max_tokens cut, 8 stop-sequence scan
    createRedaction(config.redact ?? []),
    createAllowlist(logger)
    // 11 usage sum
  ]);
  const passes = chain(frames, events);
  return {
    push(frame) {
      const produced = passes.push(frame);
      failures.observe(frame);
      return produced;
    },
    end: () => passes.end()
  };
}
