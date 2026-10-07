/**
 * The content blocks a message may carry (spec sections 4.2 and 4.3). Nothing is dropped
 * silently: a block upstream would drop or substitute, or the API rejects, is a 400 naming the
 * block type at the client's own indices. Served: text, base64 images, documents with a base64,
 * text or content source, tool results holding text and base64 images, and the history blocks
 * replayed exactly as sent. URL sources (the API behind upstream cannot download them), `file`
 * sources (no Files API), `search_result`, `mcp_tool_listing`, the tool-change blocks and every
 * other type are rejected. What a served block carries beyond this is its feature ticket's.
 */
import { SurfaceError } from '../http/surface-error';
import { Body, fieldInvalid, fieldRequired, isObject } from './field-errors';
import { ClientMessage } from './validate-messages';

const SERVED_BLOCKS: ReadonlySet<string> = new Set([
  'text', 'image', 'document', 'tool_use', 'tool_result', 'thinking', 'redacted_thinking',
  'server_tool_use', 'web_search_tool_result', 'web_fetch_tool_result', 'mcp_tool_use', 'mcp_tool_result'
]);

const SERVED_SOURCES: { readonly [block: string]: readonly string[] } = {
  image: ['base64'],
  document: ['base64', 'text', 'content']
};

const SOURCE_REASONS: { readonly [source: string]: string } = {
  url: ': upstream cannot download them; send the data as base64',
  file: ': there is no Files API'
};

const notSupported = (path: string, what: string): SurfaceError =>
  SurfaceError.invalidRequest(`${path}: ${what} are not supported on this surface`);

function validateSource(block: Body, type: string, path: string): void {
  const source = block['source'];
  if (source === undefined) throw fieldRequired(`${path}.source`);
  if (!isObject(source)) throw fieldInvalid(`${path}.source`, 'a valid dictionary');
  const sourceType = source['type'];
  if (sourceType === undefined) throw fieldRequired(`${path}.source.type`);
  if (typeof sourceType !== 'string') throw fieldInvalid(`${path}.source.type`, 'a valid string');
  if (!SERVED_SOURCES[type]?.includes(sourceType)) {
    const reason = Object.hasOwn(SOURCE_REASONS, sourceType) ? SOURCE_REASONS[sourceType] : '';
    throw notSupported(path, `"${type}" blocks with a "${sourceType}" source${reason}`);
  }
}

function typeOf(item: unknown, path: string): string {
  if (!isObject(item)) throw fieldInvalid(path, 'a valid dictionary');
  const type = item['type'];
  if (type === undefined) throw fieldRequired(`${path}.type`);
  if (typeof type !== 'string') throw fieldInvalid(`${path}.type`, 'a valid string');
  return type;
}

/** A tool result carries text and base64 images only: the bridge hands upstream MCP text and image content. */
function validateToolResultContent(content: unknown, path: string): void {
  if (content === undefined || content === null || typeof content === 'string') return;
  if (!Array.isArray(content)) throw fieldInvalid(path, 'a valid string or a list of content blocks');
  content.forEach((item: unknown, index) => {
    const itemPath = `${path}.${index}`;
    const type = typeOf(item, itemPath);
    if (type === 'image') validateSource(item as Body, type, itemPath);
    else if (type !== 'text') throw notSupported(itemPath, `"${type}" blocks inside a tool_result`);
  });
}

/** A tool result names the call it answers and says whether it is an error: the bridge server passes both on. */
function validateToolResult(block: Body, path: string): void {
  const id = block['tool_use_id'];
  if (id === undefined) throw fieldRequired(`${path}.tool_use_id`);
  if (typeof id !== 'string') throw fieldInvalid(`${path}.tool_use_id`, 'a valid string');
  const isError = block['is_error'];
  if (isError !== undefined && isError !== null && typeof isError !== 'boolean') {
    throw fieldInvalid(`${path}.is_error`, 'a valid boolean');
  }
  validateToolResultContent(block['content'], `${path}.content`);
}

function validateBlock(block: Body & { type: string }, path: string): void {
  const { type } = block;
  if (!SERVED_BLOCKS.has(type)) throw notSupported(path, `"${type}" blocks`);
  if (Object.hasOwn(SERVED_SOURCES, type)) validateSource(block, type, path);
  if (type === 'tool_result') validateToolResult(block, path);
}

/** `messages` as the client sent it, its shape already checked, so paths carry the client's indices. */
export function validateContentBlocks(messages: readonly ClientMessage[]): void {
  messages.forEach((message, index) => {
    if (typeof message.content === 'string') return;
    message.content.forEach((block, position) => validateBlock(block, `messages.${index}.content.${position}`));
  });
}
