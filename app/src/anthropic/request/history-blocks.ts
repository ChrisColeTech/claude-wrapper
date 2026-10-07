/**
 * How each content block kind reads inside a replayed turn's `<conversation_history>` (spec
 * section 5). A block renders to parts: text, which joins the history's text, or a real content
 * block placed inline (media the turn carried). A kind with no entry is a 400 naming it, never
 * dropped. The tickets that bring a kind add its entry here: the web tools' blocks
 * (`history-web-blocks.ts`) and the connectors' (`history-connector-blocks.ts`).
 */
import { SurfaceError } from '../surface-error';
import { CONNECTOR_HISTORY_BLOCKS } from './history-connector-blocks';
import { attribute } from './history-markup';
import { WEB_HISTORY_BLOCKS } from './history-web-blocks';
import { ContentBlock } from './turn-plan';

export type HistoryPart = string | ContentBlock;
export type HistoryBlock = (block: ContentBlock) => HistoryPart[];

/** A tool result's content: a string as is; text blocks line by line, images as real blocks. */
function toolResultContent(content: unknown): HistoryPart[] {
  if (content === undefined || content === null) return [];
  if (typeof content === 'string') return [content];
  const items = (content as ContentBlock[]).map((item): HistoryPart => {
    if (item.type === 'text') return String(item['text']);
    if (item.type === 'image') return item;
    throw SurfaceError.invalidRequest(`messages: ${item.type} blocks in a tool_result are not supported`);
  });
  return items.flatMap((item, index) => (index === 0 ? [item] : ['\n', item]));
}

const toolUse: HistoryBlock = block => [
  `<tool_use id="${attribute(block['id'])}" name="${attribute(block['name'])}">` +
  `${JSON.stringify(block['input'] ?? {})}</tool_use>`
];

const toolResult: HistoryBlock = block => [
  `<tool_result tool_use_id="${attribute(block['tool_use_id'])}" is_error="${block['is_error'] === true}">`,
  ...toolResultContent(block['content']),
  '</tool_result>'
];

const HISTORY_BLOCKS: ReadonlyMap<string, HistoryBlock> = new Map<string, HistoryBlock>([
  ['text', block => [String(block['text'])]],
  // Signatures cannot be replayed, and a continued turn's upstream already holds its own thinking.
  ['thinking', () => []],
  ['redacted_thinking', () => []],
  ['tool_use', toolUse],
  ['tool_result', toolResult],
  // Media stay real blocks, every field as sent (a document's `title`, `context`, `citations`), so
  // the model reads them as it would have on the turn that carried them.
  ['image', block => [block]],
  ['document', block => [block]],
  ...WEB_HISTORY_BLOCKS,
  ...CONNECTOR_HISTORY_BLOCKS
]);

/** The parts `block` renders to in the history; throws the 400 for a kind with no rendering. */
export function historyParts(block: ContentBlock): HistoryPart[] {
  const render = HISTORY_BLOCKS.get(block.type);
  if (!render) throw SurfaceError.invalidRequest(`messages: ${block.type} blocks in earlier turns are not supported yet`);
  return render(block);
}
