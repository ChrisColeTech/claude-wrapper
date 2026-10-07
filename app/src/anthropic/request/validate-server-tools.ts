/**
 * Tool types (spec sections 4.4 and 8). A client tool (`type` absent, `null` or `custom`) and the
 * web search and web fetch versions the spec maps to upstream's built-ins are served; their own
 * rules (names, mounting, hook policy) belong to the tools tickets. Every other type, the server
 * tools upstream cannot run (`code_execution_*`, `bash_*`, `computer_*`, ...) and unknown ones, is
 * a 400 naming the type at the client's index. A web tool with both domain lists is a 400, as on
 * the real API. `mcp_toolset` waits for the connectors ticket, which adds it here.
 */
import { SurfaceError } from '../http/surface-error';
import { Body, fieldInvalid, isObject } from './field-errors';

const WEB_TOOL_TYPES: ReadonlySet<unknown> = new Set([
  'web_search_20250305', 'web_search_20260209', 'web_search_20260318',
  'web_fetch_20250910', 'web_fetch_20260209', 'web_fetch_20260309', 'web_fetch_20260318'
]);

const present = (value: unknown): boolean => value !== undefined && value !== null;

function validateWebTool(tool: Body, path: string): void {
  if (present(tool['allowed_domains']) && present(tool['blocked_domains'])) {
    throw SurfaceError.invalidRequest(`${path}: use either allowed_domains or blocked_domains, not both`);
  }
}

function validateTool(tool: unknown, index: number): void {
  const path = `tools.${index}`;
  if (!isObject(tool)) throw fieldInvalid(path, 'a valid dictionary');
  const type = tool['type'];
  if (!present(type) || type === 'custom') return;
  if (typeof type !== 'string') throw fieldInvalid(`${path}.type`, 'a valid string');
  if (!WEB_TOOL_TYPES.has(type)) {
    throw SurfaceError.invalidRequest(`${path}: tool type "${type}" is not supported on this surface`);
  }
  validateWebTool(tool, path);
}

export function validateServerTools(tools: unknown): void {
  if (!present(tools)) return;
  if (!Array.isArray(tools)) throw fieldInvalid('tools', 'a valid list');
  tools.forEach(validateTool);
}
