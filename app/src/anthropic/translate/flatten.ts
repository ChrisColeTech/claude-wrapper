/**
 * Pass 2, the flattener (spec section 11, ADR 0003): the run's model calls become one turn stream.
 * (a) The turn's first `message_start` is relayed and every later one suppressed (kept as an
 * internal `call_start` for the passes that read a call's usage); (b) each call's block indices
 * are offset by the blocks already relayed in the turn, the built-in calls' result blocks
 * included (`surface-blocks`); (c) a call that stops with `tool_use` and whose `tool_use` blocks
 * are all built-in (or that relays none: a failed StructuredOutput answer, which pass 6 took out)
 * has its `message_delta` suppressed (its usage kept as an internal `usage` signal) and its
 * `message_stop` dropped, as upstream runs the calls itself and calls the model again; with a
 * client or any other call among them both are relayed and the turn ends there, where the park
 * rule (`park.ts`, the next pass) parks a client call; (d) a frame with a non-null
 * `parent_tool_use_id` is dropped; (e) any other call end is relayed verbatim as the turn's end,
 * and nothing after it is. A `user` frame's results for the run's built-in calls become internal
 * `server_tool_result` signals for the server-tool pass; a client call behind a built-in waits
 * for the built-in's result (`mixed-message`).
 *
 * It also ends the turn with the `fail` signal, mapped by the run's failure reader: (i) a
 * `message_start` while the current upstream message still has an open block (its model call
 * broke after streaming content), (ii) a failed `result` before the end, and a `system/api_retry`
 * whose category is deterministic. A plain `api_retry` is not a trigger: a failed call that had
 * no open block is retried as one more suppressed `message_start`.
 */
import { ApiRetryFrame, Frame, ResultFrame, StreamEvent, UserFrame } from '../../upstream/frames';
import { isWebTool } from '../../upstream/hook-policy';
import { FailureReader } from '../failure';
import { SurfaceError } from '../http/surface-error';
import { MixedMessageHold } from './mixed-message';
import { Pass } from './pass';
import { BlockOffsets, serverToolResults } from './surface-blocks';
import { ServerToolCalls, TurnEvent } from './turn-event';

/** `is_error: true` or a subtype other than `success`. */
const isFailedResult = (result: ResultFrame): boolean => result.is_error || result.subtype !== 'success';

class Flattener implements Pass<Frame, TurnEvent> {
  private started = false;
  private ended = false;
  /** The current upstream message's blocks that have started and not stopped, as they arrive. */
  private readonly openBlocks = new Set<number>();
  /** The tools the current call relayed `tool_use` blocks for (c). */
  private callTools: string[] = [];
  /** The current call's end is suppressed (c): its `message_stop` does not end the turn. */
  private continues = false;
  private readonly blocks = new BlockOffsets();
  private readonly hold = new MixedMessageHold();

  constructor(private readonly failures: FailureReader, private readonly calls: ServerToolCalls) {}

  push(frame: Frame): TurnEvent[] {
    if (this.ended) return [];
    if (frame.type === 'result') return this.onResult(frame);
    if (frame.type === 'system' && frame.subtype === 'api_retry') return this.onRetry(frame);
    if (frame.type === 'user') return frame.parent_tool_use_id == null ? this.onUser(frame) : [];
    if (frame.type !== 'stream_event' || frame.parent_tool_use_id != null) return [];
    return this.onArrival(frame.event);
  }

  end(): TurnEvent[] {
    return [];
  }

  /** Tracks the message's open blocks and the run's built-in calls as upstream sends them. */
  private onArrival(event: StreamEvent): TurnEvent[] {
    if (event.type === 'message_start' && this.openBlocks.size > 0) {
      return this.fail(this.failures.errorFor({ kind: 'broken_call' }));
    }
    if (event.type === 'content_block_start') this.onBlockStart(event.index, event.content_block);
    if (event.type === 'content_block_stop') this.openBlocks.delete(event.index);
    if (event.type === 'message_stop') this.openBlocks.clear();
    return this.hold.arrive(event) ? [] : this.emit(this.relay(event));
  }

  private onBlockStart(index: number, block: Record<string, unknown>): void {
    this.openBlocks.add(index);
    const name = block['name'];
    if (block['type'] === 'tool_use' && isWebTool(name)) this.calls.note(String(block['id']), name);
  }

  private onUser(frame: UserFrame): TurnEvent[] {
    return this.emit(this.blocks.results(serverToolResults(frame, this.calls)));
  }

  /** Each placed result may release a held client call, which is relayed right after it. */
  private emit(events: TurnEvent[]): TurnEvent[] {
    return events.flatMap(event => (event.type === 'server_tool_result'
      ? [event, ...this.emit(this.hold.placed(event.toolUseId).flatMap(released => this.relay(released)))]
      : [event]));
  }

  private relay(event: StreamEvent): TurnEvent[] {
    if (this.ended) return [];
    switch (event.type) {
      case 'message_start':
        return this.onMessageStart(event);
      case 'message_delta':
        return this.onMessageDelta(event);
      case 'message_stop':
        return this.onMessageStop(event);
      case 'content_block_start':
        if (event.content_block['type'] === 'tool_use') this.callTools.push(String(event.content_block['name']));
        return this.blocks.block(event);
      default:
        return this.blocks.block(event);
    }
  }

  private onMessageStart(event: Extract<StreamEvent, { type: 'message_start' }>): TurnEvent[] {
    this.blocks.newCall();
    this.callTools = [];
    if (this.started) return [{ type: 'call_start', usage: (event.message['usage'] as Record<string, unknown>) ?? {} }];
    this.started = true;
    return [event, ...this.blocks.start()];
  }

  /** Rule (c): a call whose tool calls are all built-in is not the turn's end. */
  private onMessageDelta(event: Extract<StreamEvent, { type: 'message_delta' }>): TurnEvent[] {
    this.continues = event.delta['stop_reason'] === 'tool_use' && this.callTools.every(isWebTool);
    return this.continues ? [{ type: 'usage', usage: event.usage }] : [event];
  }

  private onMessageStop(event: StreamEvent): TurnEvent[] {
    if (this.continues) {
      this.continues = false;
      return [];
    }
    this.ended = true;
    return [event];
  }

  private onRetry(retry: ApiRetryFrame): TurnEvent[] {
    const error = this.failures.failFast(retry);
    return error ? this.fail(error) : [];
  }

  private onResult(result: ResultFrame): TurnEvent[] {
    return isFailedResult(result) ? this.fail(this.failures.errorFor({ kind: 'result', result })) : [];
  }

  private fail(error: SurfaceError): TurnEvent[] {
    this.ended = true;
    return [{ type: 'fail', error }];
  }
}

export function createFlattener(failures: FailureReader, calls: ServerToolCalls): Pass<Frame, TurnEvent> {
  return new Flattener(failures, calls);
}
