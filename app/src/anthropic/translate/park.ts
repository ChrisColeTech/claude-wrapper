/**
 * The flattener's park rule (spec section 11, rule (c); section 7; ADR 0001), kept in its own
 * pass right after the flattener: when a model call ends with `message_delta {stop_reason:
 * "tool_use"}` and at least one of its `tool_use` blocks is a client tool (named under
 * `mcp__client__`), that `message_delta` and `message_stop` are relayed as upstream sent them and
 * the `park` signal follows the `message_stop`, naming every client `tool_use` id of the call in
 * order. Nothing is synthesised. A call whose `tool_use` blocks are all built-in or connector
 * calls never parks: the run continues on upstream's side.
 */
import { JsonObject } from '../../upstream/frames';
import { Pass } from './pass';
import { toolUseKind } from './tool-use-kind';
import { TurnEvent } from './turn-event';

const clientToolUseId = (block: JsonObject): string | undefined =>
  (toolUseKind(block) === 'client' ? String(block['id']) : undefined);

class ParkRule implements Pass<TurnEvent, TurnEvent> {
  /** The current call's client `tool_use` ids. */
  private callIds: string[] = [];
  /** Set by a `tool_use` stop with client calls in it: the ids the `message_stop` parks on. */
  private parking: string[] | undefined;

  push(event: TurnEvent): TurnEvent[] {
    switch (event.type) {
      case 'message_start':
        this.callIds = [];
        return [event];
      case 'content_block_start':
        this.onBlock(event.content_block);
        return [event];
      case 'message_delta':
        this.parking = event.delta['stop_reason'] === 'tool_use' && this.callIds.length > 0 ? this.callIds : undefined;
        this.callIds = [];
        return [event];
      case 'message_stop':
        return this.parking ? [event, { type: 'park', toolUseIds: this.parking }] : [event];
      default:
        return [event];
    }
  }

  end(): TurnEvent[] {
    return [];
  }

  private onBlock(block: JsonObject): void {
    const id = clientToolUseId(block);
    if (id !== undefined) this.callIds.push(id);
  }
}

export function createParkRule(): Pass<TurnEvent, TurnEvent> {
  return new ParkRule();
}
