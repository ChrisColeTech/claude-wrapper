/**
 * `createTranslator` (spec sections 11 and 16): a run's frames in, one turn stream out. The
 * passes run in the spec's order, one file each. Internal signals pass between them; the usage sum, the last, removes them.
 * Each frame reaches the failure reader once the passes have taken it, so a failure is mapped
 * with what upstream said before the frame that triggered it.
 */
import { Frame } from '../../upstream/frames';
import { logger as defaultLogger } from '../../utils/logger';
import { createFailureReader } from '../failure';
import { createAllowlist } from './allowlist';
import { createConnectorPass } from './connector-pass';
import { createFlattener } from './flatten';
import { createMaxTokensCut } from './max-tokens-cut';
import { createParkRule } from './park';
import { chain, inOrder, Pass } from './pass';
import { createRedaction } from './redact';
import { createServerToolCalls } from './server-tool-calls';
import { createServerToolPass } from './server-tools';
import { createStopSequenceScan } from './stop-sequences';
import { createBridgePrefixStrip } from './strip-bridge-prefix';
import { createStructuredOutputBuffer } from './structured-output';
import { createSyntheticDrop } from './synthetic-drop';
import { Translator, TranslatorConfig, TranslatorLogger } from './turn-event';
import { createUsageSum } from './usage-sum';

/** Pass 6 on a `--json-schema` run; it reads frames, so it sits before the flattener. */
function structuredOutput(config: TranslatorConfig, logger: TranslatorLogger): Pass<Frame, Frame> {
  return config.structuredOutput ? createStructuredOutputBuffer(logger) : { push: frame => [frame], end: () => [] };
}

export function createTranslator(config: TranslatorConfig = {}): Translator {
  const logger = config.logger ?? defaultLogger;
  const failures = config.failures ?? createFailureReader();
  const serverTools = config.serverTools ?? createServerToolCalls();
  const frames = chain(
    chain(createSyntheticDrop(logger), structuredOutput(config, logger)), createFlattener(failures, serverTools)
  );
  const events = inOrder([
    // The flattener's park rule (c), in its own file; a cut after it drops its `park`.
    createParkRule(),
    createServerToolPass(serverTools, config.now ?? Date.now),
    createConnectorPass(logger),
    createBridgePrefixStrip(),
    // 6, the StructuredOutput buffer, reads frames: it sits before the flattener
    createMaxTokensCut(),
    createStopSequenceScan(config.stopSequences ?? []),
    createRedaction(config.redact ?? [], config.structuredOutput ? 'json' : 'text'),
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
