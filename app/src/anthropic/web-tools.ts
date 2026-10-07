/**
 * The API's two web server tools and upstream's built-ins behind them (spec section 8), in one
 * place: the API's tool name and type prefix, upstream's tool name, the one input field each call
 * carries, and the permission rule that admits the built-in. The planner, the history renderer and
 * the translator all read it.
 */
import { WebTool } from '../upstream/hook-policy';

export interface WebToolNames {
  /** Upstream's built-in. */
  tool: WebTool;
  /** The API's server tool name: `server_tool_use.name`, and the result block's `<name>_tool_result`. */
  name: 'web_search' | 'web_fetch';
  /** The API's tool `type` prefix (`web_search_20250305`). */
  typePrefix: string;
  /** The one input field a call carries, upstream's and the API's alike. */
  inputField: 'query' | 'url';
  /** The `--allowedTools` rule that admits the built-in; the hook enforces the request's limits on top. */
  allowRule: string;
}

export const WEB_TOOL_NAMES: Readonly<Record<WebTool, WebToolNames>> = {
  WebSearch: { tool: 'WebSearch', name: 'web_search', typePrefix: 'web_search_', inputField: 'query', allowRule: 'WebSearch' },
  WebFetch: { tool: 'WebFetch', name: 'web_fetch', typePrefix: 'web_fetch_', inputField: 'url', allowRule: 'WebFetch(domain:*)' }
};

/** The web tool the API calls `name`, if any. */
export const webToolNamed = (name: unknown): WebToolNames | undefined =>
  Object.values(WEB_TOOL_NAMES).find(web => web.name === name);
