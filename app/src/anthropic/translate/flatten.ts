/**
 * Pass 2, the flattener (spec section 11, ADR 0003): the run's model calls become one turn stream.
 * (a) The turn's first `message_start` is relayed and every later one suppressed (kept as an
 * internal `call_start` for the passes that read a call's usage); (b) each call's block indices
 * are offset by the blocks already relayed in the turn, the built-in calls' result blocks
 * included (`surface-blocks`); (c) a call that stops with `tool_use` and whose `tool_use` blocks
 * are all built-in or connector calls (or that relays none: a failed StructuredOutput answer,
 * which pass 6 took out) has its `message_delta` suppressed (its usage kept as an internal `usage` signal) and its
 * `message_stop` dropped, as upstream runs the calls itself and calls the model again; with a
 * client or any other call among them both are relayed and the turn ends there, where the park
 * rule (`park.ts`, the next pass) parks a client call; (d) a frame with a non-null
 * `parent_tool_use_id` is dropped; (e) any other call end is relayed verbatim as the turn's end,
 * and nothing after it is. A `user` frame's results for the run's built-in and connector calls
 * become internal `server_tool_result` signals for the server-tool and connector passes; a client
 * call behind one of them waits for its result (`mixed-message`).
 *
 * It also ends the turn with the `fail` signal, mapped by the run's failure reader: (i) a broken
 * model call, either a `message_start` while the current upstream message still has an open block
 * or a `message_stop` with no `message_delta` before it (Claude Code closes a call broken by a
 * mid-stream error that way and retries it where no stream event shows it), (ii) a failed
 * `result` before the end, and a `system/api_retry` whose category is deterministic. A plain
 * `api_retry` is not a trigger: a failed call that had no open block is retried as one more
 * suppressed `message_start`.
 */
import { ApiRetryFrame, Frame, isCleanResult, ResultFrame, StreamEvent, UserFrame } from '../../upstream/frames';
import { WebTool } from '../../upstream/hook-policy';
import { FailureReader } from '../failure';
import { SurfaceError } from '../surface-error';
import { MixedMessageHold } from './mixed-message';
import { Pass } from './pass';
import { BlockOffsets, serverToolResults } from './surface-blocks';
import { runsUpstream, ToolKind, toolUseKind } from './tool-use-kind';
import { ServerToolCalls, TurnEvent } from './turn-event';



class Flattener implements Pass<Frame, TurnEvent> {
  private started = false;
  private ended = false;
  /** The current upstream message's blocks that have started and not stopped, as they arrive. */
  private readonly openBlocks = new Set<number>();
  /** The current upstream message has had its `message_delta`, so its `message_stop` ends a whole call. */
  private delta = false;
  /** The tools the current call relayed `tool_use` blocks for (c). */
  private callTools: (ToolKind | undefined)[] = [];
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
    if (this.brokeOff(event)) return this.fail(this.failures.errorFor({ kind: 'broken_call' }));
    if (event.type === 'message_start') this.delta = false;
    if (event.type === 'message_delta') this.delta = true;
    if (event.type === 'content_block_start') this.onBlockStart(event.index, event.content_block);
    if (event.type === 'content_block_stop') this.openBlocks.delete(event.index);
    if (event.type === 'message_stop') this.openBlocks.clear();
    return this.hold.arrive(event) ? [] : this.emit(this.relay(event));
  }

  /** Trigger (i): a new call while this one has a block open, or this one stopping without its `message_delta`. */
  private brokeOff(event: StreamEvent): boolean {
    if (event.type === 'message_start') return this.openBlocks.size > 0;
    return event.type === 'message_stop' && !this.delta;
  }

  private onBlockStart(index: number, block: Record<string, unknown>): void {
    this.openBlocks.add(index);
    const kind = toolUseKind(block);
    if (kind === 'web') this.calls.note(String(block['id']), block['name'] as WebTool);
    else if (kind === 'connector') this.calls.note(String(block['id']), 'connector');
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
        if (event.content_block['type'] === 'tool_use') this.callTools.push(toolUseKind(event.content_block));
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

  /** Rule (c): a call whose tool calls upstream all runs itself is not the turn's end. */
  private onMessageDelta(event: Extract<StreamEvent, { type: 'message_delta' }>): TurnEvent[] {
    this.continues = event.delta['stop_reason'] === 'tool_use' && this.callTools.every(runsUpstream);
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
    return isCleanResult(result) ? [] : this.fail(this.failures.errorFor({ kind: 'result', result }));
  }

  private fail(error: SurfaceError): TurnEvent[] {
    this.ended = true;
    return [{ type: 'fail', error }];
  }
}

export function createFlattener(failures: FailureReader, calls: ServerToolCalls): Pass<Frame, TurnEvent> {
  return new Flattener(failures, calls);
}
