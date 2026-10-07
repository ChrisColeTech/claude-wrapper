/**
 * A request answering a parked run (spec sections 4.2, 5 and 7; ADR 0001). When the last user
 * message heads with `tool_result` blocks and one of them names a parked run's `tool_use` id, the
 * request continues that run: its results go to the run's bridge server and nothing is rendered.
 * Correlation is by the ids alone, so edits to the earlier history are ignored. The answer must
 * be the whole of that park: an id of the run left without a result is the real API's 400 (the run
 * stays parked), a result naming an id the parked call never made is the real API's 400 too, and
 * content after the results is a 400, since a held-open run can only take tool results. Results
 * that name no parked run (its TTL expired, the wrapper restarted) are a lost park: the turn is
 * replayed, the caller notes it.
 */
import { ToolResultBlock } from '../../upstream/bridge';
import { SurfaceError } from '../http/surface-error';
import { ParkedRuns } from '../sessions';
import { ClientMessage } from './validate-messages';
import { ContentBlock, NormalisedMessage, ParkedContinuation } from './turn-plan';

export type ParkedAnswer = ParkedContinuation | { lostPark: string[] };

type BlockPath = { message: number; block: number };

const IGNORED = new Set(['thinking', 'redacted_thinking']);
const isToolResult = (block: ContentBlock): boolean => block.type === 'tool_result';

/**
 * Where each block of the normalised last user message sits in the client's messages: the
 * trailing user messages, merged, less the blocks normalisation drops (messages left empty by
 * that vanish, so they neither end the run nor count).
 */
function tailPaths(messages: readonly ClientMessage[]): { paths: BlockPath[]; before: number } {
  const paths: BlockPath[][] = [];
  let index = messages.length - 1;
  for (; index >= 0; index -= 1) {
    const message = messages[index] as ClientMessage;
    const blocks = typeof message.content === 'string' ? [{ type: 'text' }] : message.content;
    const kept = blocks.flatMap((block, position) => (IGNORED.has(block.type) ? [] : [{ message: index, block: position }]));
    if (kept.length === 0) continue;
    if (message.role === 'assistant') break;
    paths.unshift(kept);
  }
  return { paths: paths.flat(), before: Math.max(index, 0) };
}

const pathOf = (paths: BlockPath[], position: number): string => {
  const path = paths[position];
  return path ? `messages.${path.message}.content.${path.block}` : 'messages';
};

function checkAnswer(
  toolUseIds: readonly string[], answered: string[], tail: ContentBlock[], clientMessages: readonly ClientMessage[]
): void {
  const { paths, before } = tailPaths(clientMessages);
  const missing = toolUseIds.filter(id => !answered.includes(id));
  if (missing.length > 0) {
    throw SurfaceError.invalidRequest(`messages.${before}: \`tool_use\` ids were found without \`tool_result\` blocks ` +
      `immediately after: ${missing.join(', ')}. Each \`tool_use\` block must have a corresponding \`tool_result\` ` +
      'block in the next message.');
  }
  const unexpected = answered.findIndex(id => !toolUseIds.includes(id));
  if (unexpected >= 0) {
    throw SurfaceError.invalidRequest(`${pathOf(paths, unexpected)}: unexpected \`tool_use_id\` found in ` +
      `\`tool_result\` blocks: ${answered[unexpected]}. Each \`tool_result\` block must have a corresponding ` +
      '`tool_use` block in the previous message.');
  }
  const after = answered.length;
  if (after < tail.length) {
    throw SurfaceError.invalidRequest(`${pathOf(paths, after)}: "${tail[after]?.type}" blocks after the tool_result ` +
      'blocks are not supported on this surface when the results answer a parked tool call; send them in the next turn');
  }
}

/**
 * The parked run the last user message answers, or the ids of a lost park, or null when it opens
 * with no `tool_result`. `messages` is normalised and ends with a user message.
 */
export function parkedAnswer(
  messages: readonly NormalisedMessage[], clientMessages: readonly ClientMessage[], parked: ParkedRuns
): ParkedAnswer | null {
  const tail = messages[messages.length - 1]?.content ?? [];
  const firstOther = tail.findIndex(block => !isToolResult(block));
  const head = firstOther < 0 ? tail : tail.slice(0, firstOther);
  if (head.length === 0) return null;
  const ids = head.map(block => String(block['tool_use_id']));
  const run = ids.map(id => parked.get(id)).find(found => found !== undefined);
  if (!run) return { lostPark: ids };
  checkAnswer(run.toolUseIds, ids, tail, clientMessages);
  return { parked: run, results: head as unknown as ToolResultBlock[] };
}
