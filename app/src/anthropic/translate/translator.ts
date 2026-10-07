/**
 * `createTranslator` (spec sections 11 and 16): a run's frames in, one turn stream out. The
 * passes run in the spec's order, one file each; the ones this surface does not have yet are
 * marked where they go. Each frame reaches the failure reader once the passes have taken it, so
 * a failure is mapped with what upstream said before the frame that triggered it.
 */
import { Frame } from '../../upstream/frames';
import { logger as defaultLogger } from '../../utils/logger';
import { createFailureReader } from '../failure';
import { createAllowlist } from './allowlist';
import { createFlattener } from './flatten';
import { createMaxTokensCut } from './max-tokens-cut';
import { chain, inOrder, Pass } from './pass';
import { createRedaction } from './redact';
import { createStopSequenceScan } from './stop-sequences';
import { createStructuredOutputBuffer } from './structured-output';
import { createSyntheticDrop } from './synthetic-drop';
import { Translator, TranslatorConfig, TranslatorLogger } from './turn-event';

/** Pass 6 on a `--json-schema` run; it reads frames, so it sits before the flattener. */
function structuredOutput(config: TranslatorConfig, logger: TranslatorLogger): Pass<Frame, Frame> {
  return config.structuredOutput ? createStructuredOutputBuffer(logger) : { push: frame => [frame], end: () => [] };
}

export function createTranslator(config: TranslatorConfig = {}): Translator {
  const logger = config.logger ?? defaultLogger;
  const failures = config.failures ?? createFailureReader();
  const frames = chain(chain(createSyntheticDrop(logger), structuredOutput(config, logger)), createFlattener(failures));
  const events = inOrder([
    // 3 server-tool pass, 4 connector pass, 5 bridge prefix strip (6, the StructuredOutput buffer, reads frames)
    createMaxTokensCut(),
    createStopSequenceScan(config.stopSequences ?? []),
    createRedaction(config.redact ?? [], config.structuredOutput ? 'json' : 'text'),
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
