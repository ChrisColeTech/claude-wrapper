/**
 * Pass 5, the bridge prefix strip (spec sections 7 and 11): upstream sees each client tool as
 * `mcp__client__<name>`; the client gets its own `<name>` back in the `tool_use` block. Only a
 * `tool_use` block whose name starts with the prefix is touched, and only the prefix is removed.
 */
import { CLIENT_TOOL_PREFIX } from '../../upstream/bridge';
import { eachEvent, Pass } from './pass';
import { TurnEvent } from './turn-event';

export function createBridgePrefixStrip(): Pass<TurnEvent, TurnEvent> {
  return eachEvent(event => {
    if (event.type !== 'content_block_start') return [event];
    const block = event.content_block;
    const name = block['name'];
    if (block['type'] !== 'tool_use' || typeof name !== 'string' || !name.startsWith(CLIENT_TOOL_PREFIX)) return [event];
    return [{ ...event, content_block: { ...block, name: name.slice(CLIENT_TOOL_PREFIX.length) } }];
  });
}
