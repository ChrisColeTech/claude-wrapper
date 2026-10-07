/**
 * What kind of call one of upstream's `tool_use` blocks is, by its name (spec sections 7 to 12):
 * a client tool behind the bridge server (`mcp__client__<name>`), a built-in web tool, a
 * connector's tool, or the structured-output answer. A client call parks the turn; a web or
 * connector call runs upstream, and the model is called again.
 */
import { CLIENT_TOOL_PREFIX } from '../../upstream/bridge';
import { isConnectorTool } from '../../upstream/connector-tools';
import { isWebTool } from '../../upstream/hook-policy';
import { STRUCTURED_OUTPUT_TOOL } from '../../upstream/structured-output';
import { JsonObject } from '../../utils/json-object';

export type ToolKind = 'client' | 'web' | 'connector' | 'structured_output';

/** The kind of tool upstream calls `name`; none for a name the surface did not give upstream. */
export function toolKindOf(name: unknown): ToolKind | undefined {
  if (typeof name !== 'string') return undefined;
  if (name.startsWith(CLIENT_TOOL_PREFIX)) return 'client';
  if (isWebTool(name)) return 'web';
  if (isConnectorTool(name)) return 'connector';
  return name === STRUCTURED_OUTPUT_TOOL ? 'structured_output' : undefined;
}

/** The kind of call `block` is; none when it is not a `tool_use` block. */
export const toolUseKind = (block: JsonObject): ToolKind | undefined =>
  (block['type'] === 'tool_use' ? toolKindOf(block['name']) : undefined);

/** A call upstream runs itself, the model then called again: a built-in web tool or a connector's tool. */
export const runsUpstream = (kind: ToolKind | undefined): boolean => kind === 'web' || kind === 'connector';
