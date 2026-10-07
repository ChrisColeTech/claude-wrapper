/**
 * The web tools' blocks in a replayed turn's history (spec sections 5 and 8): `server_tool_use`
 * as `<web_search query="…"/>` or `<web_fetch url="…"/>`, and any other server tool's call as
 * `<server_tool_use id="…" name="…">{input}</server_tool_use>`; `web_search_tool_result` as
 * `<web_search_results>` with one `title: url` line per result, or `<web_search_error code="…"/>`;
 * `web_fetch_tool_result` as `<web_fetch_result>` holding the document text (a fetched PDF as a
 * real block inside), or `<web_fetch_error code="…"/>`. The blocks are taken exactly as the client
 * sent them: `encrypted_content` is never read, and a missing field renders empty.
 */
import { isObject } from '../../utils/json-object';
import { attribute, callTag } from './history-markup';
import { ContentBlock } from './turn-plan';

type HistoryPart = string | ContentBlock;

const INPUT_FIELDS: Readonly<Record<string, string>> = { web_search: 'query', web_fetch: 'url' };

/** A web tool's call by its one input field; any other server tool's generically, as sent. */
function serverToolUse(block: ContentBlock): HistoryPart[] {
  const name = String(block['name']);
  const field = Object.hasOwn(INPUT_FIELDS, name) ? INPUT_FIELDS[name] : undefined;
  if (!field) return [callTag('server_tool_use', block)];
  const input = isObject(block['input']) ? block['input'] : {};
  return [`<${name} ${field}="${attribute(input[field])}"/>`];
}

const errorTag = (tag: string, content: Record<string, unknown>): HistoryPart[] =>
  [`<${tag} code="${attribute(content['error_code'])}"/>`];

function webSearchResult(block: ContentBlock): HistoryPart[] {
  const content = block['content'];
  if (!Array.isArray(content)) return errorTag('web_search_error', isObject(content) ? content : {});
  const lines = content.filter(isObject).map(result => `${String(result['title'] ?? '')}: ${String(result['url'] ?? '')}\n`);
  return [`<web_search_results>\n${lines.join('')}</web_search_results>`];
}

/** The fetched document: its text, or the document itself when it is not text (a PDF). */
function documentParts(document: unknown): HistoryPart[] {
  const source = isObject(document) && isObject(document['source']) ? document['source'] : {};
  if (source['type'] === 'text') return [String(source['data'] ?? '')];
  if (source['type'] === 'content' && Array.isArray(source['content'])) {
    return [source['content'].filter(isObject).map(item => String(item['text'] ?? '')).join('\n')];
  }
  return isObject(document) ? [document as ContentBlock] : [];
}

function webFetchResult(block: ContentBlock): HistoryPart[] {
  const content = isObject(block['content']) ? block['content'] : {};
  if (content['type'] !== 'web_fetch_result') return errorTag('web_fetch_error', content);
  const parts = documentParts(content['content']);
  if (parts.every(part => typeof part === 'string')) return [`<web_fetch_result>\n${parts.join('')}\n</web_fetch_result>`];
  return ['<web_fetch_result>\n', ...parts, '\n</web_fetch_result>'];
}

export const WEB_HISTORY_BLOCKS: readonly [string, (block: ContentBlock) => HistoryPart[]][] = [
  ['server_tool_use', serverToolUse],
  ['web_search_tool_result', webSearchResult],
  ['web_fetch_tool_result', webFetchResult]
];
