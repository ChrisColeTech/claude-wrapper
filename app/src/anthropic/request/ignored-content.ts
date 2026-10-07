/**
 * Content accepted and ignored (spec sections 4.2 and 5), removed before normalisation so it
 * never reaches upstream nor the conversation's fingerprint: `thinking` and `redacted_thinking`
 * blocks (a continued turn never needs them; a replayed turn cannot carry their signatures), and
 * `cache_control` on any block, nested ones included (a client may move its cache breakpoint
 * between turns; prompt caching is upstream's own). A message left with no blocks is removed, so
 * its neighbours merge. The client's own objects are never changed.
 */
import { JsonObject } from '../../upstream/frames';
import { isObject } from './field-errors';
import { ContentBlock } from './turn-plan';
import { ClientMessage } from './validate-messages';

const DROPPED_BLOCKS: ReadonlySet<string> = new Set(['thinking', 'redacted_thinking']);

function withoutCacheControl<T extends JsonObject>(value: T): T {
  const { cache_control: _cacheControl, ...rest } = value;
  return rest as T;
}

const stripNested = (item: unknown): unknown => (isObject(item) ? withoutCacheControl(item) : item);

/** The block without `cache_control`, nor the blocks it nests: a tool result's content, a content document's parts. */
function stripBlock(block: ContentBlock): ContentBlock {
  const stripped = withoutCacheControl(block);
  const content = stripped['content'];
  if (stripped.type === 'tool_result' && Array.isArray(content)) return { ...stripped, content: content.map(stripNested) };
  const source = stripped['source'];
  if (stripped.type === 'document' && isObject(source) && Array.isArray(source['content'])) {
    return { ...stripped, source: { ...source, content: source['content'].map(stripNested) } };
  }
  return stripped;
}

/** `messages` without the ignored content, in the client's order; string content is kept as is. */
export function withoutIgnoredContent(messages: readonly ClientMessage[]): ClientMessage[] {
  return messages.flatMap(message => {
    if (typeof message.content === 'string') return [message];
    const content = message.content.filter(block => !DROPPED_BLOCKS.has(block.type)).map(stripBlock);
    return content.length === 0 ? [] : [{ role: message.role, content }];
  });
}
