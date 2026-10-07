/**
 * `createTranslator` (spec sections 11 and 16): a run's frames in, one turn stream out. The
 * passes run in the spec's order, one file each; the ones this surface does not have yet are
 * marked where they go. Internal signals pass between them; the usage sum, the last, removes them. Each frame reaches the failure reader once the passes have taken it, so
 * a failure is mapped with what upstream said before the frame that triggered it.
 */
import { logger as defaultLogger } from '../../utils/logger';
import { createFailureReader } from '../failure';
import { createAllowlist } from './allowlist';
import { createFlattener } from './flatten';
import { createMaxTokensCut } from './max-tokens-cut';
import { createParkRule } from './park';
import { chain, inOrder } from './pass';
import { createRedaction } from './redact';
import { createServerToolCalls } from './server-tool-calls';
import { createServerToolPass } from './server-tools';
import { createStopSequenceScan } from './stop-sequences';
import { createBridgePrefixStrip } from './strip-bridge-prefix';
import { createSyntheticDrop } from './synthetic-drop';
import { Translator, TranslatorConfig } from './turn-event';
import { createUsageSum } from './usage-sum';

export function createTranslator(config: TranslatorConfig = {}): Translator {
  const logger = config.logger ?? defaultLogger;
  const failures = config.failures ?? createFailureReader();
  const serverTools = config.serverTools ?? createServerToolCalls();
  const frames = chain(createSyntheticDrop(logger), createFlattener(failures, serverTools));
  const events = inOrder([
    // The flattener's park rule (c), in its own file; a cut after it drops its `park`.
    createParkRule(),
    createServerToolPass(serverTools, config.now ?? Date.now),
    // 4 connector pass
    createBridgePrefixStrip(),
    // 6 StructuredOutput buffer
    createMaxTokensCut(),
    createStopSequenceScan(config.stopSequences ?? []),
    createRedaction(config.redact ?? []),
    createAllowlist(logger),
    createUsageSum()
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
