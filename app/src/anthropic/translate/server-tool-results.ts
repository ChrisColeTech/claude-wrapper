/**
 * The content of a server tool's result block (spec section 8), from upstream's `tool_result` and
 * the tool's own output (`tool_use_result`). A search lists every `{url, title}` across its
 * backend searches as a `web_search_result` with an opaque wrapper-minted `encrypted_content`
 * (base64 of url and title, never validated on replay) and `page_age: null`; upstream's summary
 * is not exposed. A fetch is the document upstream's model received (its extraction of the page,
 * not the page) with the wrapper's time. A denial by the wrapper's hook carries its code.
 */
import { JsonObject } from '../../upstream/frames';
import { DenialCode } from '../../upstream/hook-policy';
import { ServerToolResultSignal } from './turn-event';

type ResultInput = Pick<ServerToolResultSignal, 'block' | 'toolUseResult'>;

const isObject = (value: unknown): value is JsonObject => typeof value === 'object' && value !== null && !Array.isArray(value);

const failed = ({ block }: ResultInput): boolean => block['is_error'] === true;

const encrypted = (url: unknown, title: unknown): string => Buffer.from(JSON.stringify({ url, title })).toString('base64');

/** Upstream's backend searches for the call; a call it reported no count for is one. */
export function searchCount(toolUseResult: unknown): number {
  const count = isObject(toolUseResult) ? toolUseResult['searchCount'] : undefined;
  return typeof count === 'number' ? count : 1;
}

export function searchContent(result: ResultInput, denial: DenialCode | undefined): JsonObject | JsonObject[] {
  if (denial || failed(result)) return { type: 'web_search_tool_result_error', error_code: denial ?? 'unavailable' };
  const searches = isObject(result.toolUseResult) && Array.isArray(result.toolUseResult['results']) ? result.toolUseResult['results'] : [];
  return searches.flatMap(search => (isObject(search) && Array.isArray(search['content']) ? search['content'] : []))
    .filter(isObject)
    .map(({ url, title }) => ({ type: 'web_search_result', url, title, encrypted_content: encrypted(url, title), page_age: null }));
}

/** The text upstream's model received: a string, or its text blocks. */
function receivedText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.filter(isObject).filter(item => item['type'] === 'text').map(item => String(item['text'])).join('\n');
}

export interface FetchContext {
  /** The URL the call asked for, when this turn saw the call. */
  url: unknown;
  now: () => number;
}

export function fetchContent(result: ResultInput, denial: DenialCode | undefined, context: FetchContext): JsonObject {
  const output = isObject(result.toolUseResult) ? result.toolUseResult : {};
  const status = output['code'];
  if (denial || failed(result) || (typeof status === 'number' && status >= 400)) {
    return { type: 'web_fetch_tool_result_error', error_code: denial ?? 'url_not_accessible' };
  }
  const url = typeof output['url'] === 'string' ? output['url'] : typeof context.url === 'string' ? context.url : '';
  return {
    type: 'web_fetch_result',
    url,
    retrieved_at: new Date(context.now()).toISOString(),
    content: {
      type: 'document',
      source: { type: 'text', media_type: 'text/plain', data: receivedText(result.block['content']) },
      title: null
    }
  };
}
