/**
 * A client's `tool_result` in the form the bridge server returns it to upstream (spec section
 * 4.3, section 7): a string or `text` block becomes MCP text, a base64 `image` block MCP image
 * content, `is_error` becomes `isError`. Validation has refused every other block type before
 * a result reaches the bridge, so one arriving here is a programming error.
 */
import { DeliveredResult, McpContent, ToolResultBlock, ToolResultContent } from './types';

function toMcpItem(block: ToolResultContent): McpContent {
  if (block.type === 'text') return { type: 'text', text: block.text };
  if (block.type === 'image' && block.source.type === 'base64') {
    return { type: 'image', data: block.source.data, mimeType: block.source.media_type };
  }
  throw new TypeError(`a tool_result ${String((block as { type?: unknown }).type)} block cannot reach the bridge server`);
}

export function toMcpContent(content: ToolResultBlock['content']): McpContent[] {
  if (content === undefined) return [];
  if (typeof content === 'string') return [{ type: 'text', text: content }];
  return content.map(toMcpItem);
}

export function toDeliveredResult(block: ToolResultBlock): DeliveredResult {
  return { toolUseId: block.tool_use_id, result: { content: toMcpContent(block.content), isError: block.is_error === true } };
}
