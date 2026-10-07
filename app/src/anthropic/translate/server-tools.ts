/**
 * Pass 3, the server-tool pass (spec sections 8 and 11): upstream's built-in calls become the
 * API's server tool blocks. A WebSearch or WebFetch `tool_use` is relayed as `server_tool_use`
 * (`web_search`, `web_fetch`), opened at once with `input: {}`; upstream's input deltas (which may
 * carry the WebFetch extraction prompt or a search mode) are never relayed: at the block's stop one
 * `input_json_delta` carries exactly `{"query": …}` or `{"url": …}`. Each call's result arrives
 * from the flattener and is emitted whole, in one `content_block_start` and its stop: the search's
 * results across its backend searches, or the fetch's document as upstream's model received it.
 * A call the wrapper's hook denied carries the hook's code; any other failure is `unavailable`
 * (search) or `url_not_accessible` (fetch). Each result adds its request count to the usage. A
 * connector call's result passes on to the connector pass.
 */
import { JsonObject } from '../../upstream/frames';
import { isWebTool, WebTool } from '../../upstream/hook-policy';
import { isObject } from '../../utils/json-object';
import { Pass } from './pass';
import { fetchContent, searchContent, searchCount } from './server-tool-results';
import { ApiEvent, ServerToolCalls, ServerToolResultSignal, TurnEvent } from './turn-event';

type BlockEvent<T extends ApiEvent['type']> = Extract<ApiEvent, { type: T }>;

const SERVER_NAMES: Readonly<Record<WebTool, string>> = { WebSearch: 'web_search', WebFetch: 'web_fetch' };
const INPUT_FIELDS: Readonly<Record<WebTool, string>> = { WebSearch: 'query', WebFetch: 'url' };

/** The client-facing id of upstream's call: the same id under the API's `srvtoolu_` prefix. */
export const serverToolUseId = (toolUseId: string): string =>
  (toolUseId.startsWith('toolu_') ? `srv${toolUseId}` : `srvtoolu_${toolUseId}`);

function filteredInput(tool: WebTool, json: string): JsonObject {
  let input: unknown;
  try {
    input = JSON.parse(json);
  } catch {
    return {};
  }
  const field = INPUT_FIELDS[tool];
  const value = isObject(input) ? input[field] : undefined;
  return value === undefined ? {} : { [field]: value };
}

interface OpenCall {
  tool: WebTool;
  toolUseId: string;
  json: string;
}

class ServerToolPass implements Pass<TurnEvent, TurnEvent> {
  private readonly open = new Map<number, OpenCall>();
  /** Each call's filtered input, by upstream id: a fetch result names the URL the call asked for. */
  private readonly inputs = new Map<string, JsonObject>();

  constructor(private readonly calls: ServerToolCalls, private readonly now: () => number) {}

  push(event: TurnEvent): TurnEvent[] {
    switch (event.type) {
      case 'content_block_start':
        return this.onStart(event);
      case 'content_block_delta':
        return this.onDelta(event);
      case 'content_block_stop':
        return this.onStop(event);
      case 'server_tool_result':
        return this.onResult(event);
      default:
        return [event];
    }
  }

  end(): TurnEvent[] {
    return [];
  }

  private onStart(event: BlockEvent<'content_block_start'>): TurnEvent[] {
    const block = event.content_block;
    const name = block['name'];
    if (block['type'] !== 'tool_use' || !isWebTool(name)) return [event];
    const toolUseId = String(block['id']);
    this.open.set(event.index, { tool: name, toolUseId, json: '' });
    const content_block = { type: 'server_tool_use', id: serverToolUseId(toolUseId), name: SERVER_NAMES[name], input: {} };
    return [{ ...event, content_block }];
  }

  private onDelta(event: BlockEvent<'content_block_delta'>): TurnEvent[] {
    const call = this.open.get(event.index);
    if (!call) return [event];
    if (event.delta['type'] === 'input_json_delta') call.json += String(event.delta['partial_json'] ?? '');
    return [];
  }

  private onStop(event: BlockEvent<'content_block_stop'>): TurnEvent[] {
    const call = this.open.get(event.index);
    if (!call) return [event];
    this.open.delete(event.index);
    const input = filteredInput(call.tool, call.json);
    this.inputs.set(call.toolUseId, input);
    const delta = { type: 'input_json_delta', partial_json: JSON.stringify(input) };
    return [{ type: 'content_block_delta', index: event.index, delta }, event];
  }

  private onResult(result: ServerToolResultSignal): TurnEvent[] {
    if (!isWebTool(result.tool)) return [result];
    const denial = this.calls.denialOf(result.toolUseId);
    const content = result.tool === 'WebSearch'
      ? searchContent(result, denial)
      : fetchContent(result, denial, { url: this.inputs.get(result.toolUseId)?.['url'], now: this.now });
    const content_block = { type: `${SERVER_NAMES[result.tool]}_tool_result`, tool_use_id: serverToolUseId(result.toolUseId), content };
    const failed = !Array.isArray(content) && String(content['type']).endsWith('_error');
    const requests = failed ? 0 : result.tool === 'WebSearch' ? searchCount(result.toolUseResult) : 1;
    const usage = { server_tool_use: {
      web_search_requests: result.tool === 'WebSearch' ? requests : 0, web_fetch_requests: result.tool === 'WebFetch' ? requests : 0
    } };
    return [
      { type: 'content_block_start', index: result.index, content_block },
      { type: 'content_block_stop', index: result.index },
      { type: 'usage', usage }
    ];
  }
}

export function createServerToolPass(calls: ServerToolCalls, now: () => number): Pass<TurnEvent, TurnEvent> {
  return new ServerToolPass(calls, now);
}
