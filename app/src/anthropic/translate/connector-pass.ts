/**
 * Pass 4, the connector pass (spec sections 9 and 11): a connector's calls become the beta API's
 * MCP blocks. A `tool_use` block named `mcp__<server>__<tool>` is relayed as `mcp_tool_use` with
 * upstream's id kept and `name` and `server_name` split out; its `input_json_delta`s are relayed as
 * they arrive. Each call's result, placed by the flattener as a built-in's is, is emitted whole as
 * one `mcp_tool_result`: `tool_use_id`, `is_error`, and the text upstream's model received as text
 * blocks; any other item (an image, a resource) is dropped and logged. A connector call separates
 * two model calls as a built-in does (the flattener's rule (c)) and never parks. No usage counter
 * is added: the real API has none for MCP.
 */
import { splitConnectorTool } from '../../upstream/connector-tools';
import { JsonObject } from '../../upstream/frames';
import { Logger } from '../../utils/logger';
import { eachEvent, Pass } from './pass';
import { receivedTexts } from './server-tool-results';
import { toolUseKind } from './tool-use-kind';
import { ApiEvent, ServerToolResultSignal, TurnEvent } from './turn-event';

type BlockStart = Extract<ApiEvent, { type: 'content_block_start' }>;

function useBlock(event: BlockStart): TurnEvent {
  const block = event.content_block;
  if (toolUseKind(block) !== 'connector') return event;
  const { server, tool } = splitConnectorTool(String(block['name']));
  return { ...event, content_block: { type: 'mcp_tool_use', id: block['id'], name: tool, server_name: server, input: block['input'] ?? {} } };
}

/** What upstream's model received, as the API's text blocks. */
const textBlocks = (content: unknown, logger: Pick<Logger, 'debug'>): JsonObject[] =>
  receivedTexts(content, type => logger.debug('Connector result item dropped', { type })).map(text => ({ type: 'text', text }));

function resultBlocks(result: ServerToolResultSignal, logger: Pick<Logger, 'debug'>): TurnEvent[] {
  const content_block = {
    type: 'mcp_tool_result', tool_use_id: result.toolUseId, is_error: result.block['is_error'] === true,
    content: textBlocks(result.block['content'], logger)
  };
  return [{ type: 'content_block_start', index: result.index, content_block }, { type: 'content_block_stop', index: result.index }];
}

export function createConnectorPass(logger: Pick<Logger, 'debug'>): Pass<TurnEvent, TurnEvent> {
  return eachEvent(event => {
    if (event.type === 'content_block_start') return [useBlock(event)];
    if (event.type === 'server_tool_result' && event.tool === 'connector') return resultBlocks(event, logger);
    return [event];
  });
}
