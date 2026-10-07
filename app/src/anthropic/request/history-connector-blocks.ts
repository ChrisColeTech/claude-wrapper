/**
 * The connector blocks in a replayed turn's history (spec sections 5 and 9), rendered like
 * `tool_use` and `tool_result` with the server carried: `mcp_tool_use` as
 * `<mcp_tool_use server="…" name="…">{input JSON}</mcp_tool_use>` and `mcp_tool_result` as
 * `<mcp_tool_result tool_use_id="…" is_error="…">…</mcp_tool_result>` holding its text (a string,
 * or its text blocks line by line). The blocks are taken exactly as the client sent them, never
 * validated: a missing field renders empty.
 */
import { attribute } from './history-markup';
import { ContentBlock } from './turn-plan';

const resultText = (content: unknown): string => {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.filter(item => typeof item === 'object' && item !== null && item.type === 'text')
    .map(item => String(item.text ?? '')).join('\n');
};

const mcpToolUse = (block: ContentBlock): string[] => [
  `<mcp_tool_use server="${attribute(block['server_name'])}" name="${attribute(block['name'])}">` +
  `${JSON.stringify(block['input'] ?? {})}</mcp_tool_use>`
];

const mcpToolResult = (block: ContentBlock): string[] => [
  `<mcp_tool_result tool_use_id="${attribute(block['tool_use_id'])}" is_error="${block['is_error'] === true}">` +
  `${resultText(block['content'])}</mcp_tool_result>`
];

export const CONNECTOR_HISTORY_BLOCKS: readonly [string, (block: ContentBlock) => string[]][] = [
  ['mcp_tool_use', mcpToolUse],
  ['mcp_tool_result', mcpToolResult]
];
