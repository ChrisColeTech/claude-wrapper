/**
 * The tool bridge (spec section 7, section 16 bridge; ADR 0001): the state machine fed by
 * upstream's frames and the client's results, and the bridge server it answers upstream's
 * `tools/call`s through. One bridge per run that exposes client tools.
 */
import { Frame } from '../frames';
import { McpHttpHandler } from '../control-server';
import { Clock, systemClock } from '../../utils/clock';
import { logger as defaultLogger } from '../../utils/logger';
import { createMcpEndpoint, McpEndpointLogger } from './mcp-endpoint';
import { createBridgeMachine } from './state-machine';
import { toDeliveredResult } from './tool-result-content';
import { BridgeEventListener, ClientTool, DeliverOutcome, ToolResultBlock } from './types';

/** What `abandon` needs of the run: its interrupt (the runner's `Run` is one). */
export interface Interruptible {
  interrupt(): Promise<unknown>;
}

export interface BridgeEvents {
  /** Hears every later event in order (`park` is the one a caller acts on); returns the unsubscribe. */
  subscribe(listener: BridgeEventListener): () => void;
}

export interface Bridge {
  /** Feeds every upstream frame of the run, in order. */
  onFrame(frame: Frame): void;
  /**
   * The client's `tool_result` blocks for the parked message, all or nothing: `resumed` delivers
   * them (waiting calls answered, the rest held until upstream asks); `partial` and `unknown`
   * deliver none and leave the park as it was.
   */
  deliver(results: ToolResultBlock[]): DeliverOutcome;
  /**
   * Ends a park the client will not answer (park TTL, disconnect): interrupts the run first and,
   * once upstream has answered the interrupt (or cannot any more), rejects every waiting call.
   * The other order hands the model an error result and it calls again.
   */
  abandon(run: Interruptible, reason: string): Promise<void>;
  readonly events: BridgeEvents;
  /** The bridge server, for `controlServer.registerRun(id, {mcpHandler})`. */
  readonly mcpHandler: McpHttpHandler;
}

export interface BridgeOptions {
  clock?: Clock;
  logger?: McpEndpointLogger;
}

export function createBridge(tools: ClientTool[], options: BridgeOptions = {}): Bridge {
  const log = options.logger ?? defaultLogger;
  const listeners = new Set<BridgeEventListener>();
  const machine = createBridgeMachine({
    clock: options.clock ?? systemClock,
    onEvent: event => listeners.forEach(listener => listener(event))
  });
  return {
    onFrame: frame => machine.onFrame(frame),
    deliver: results => machine.deliver(results.map(toDeliveredResult)),
    async abandon(run, reason) {
      try {
        await run.interrupt();
      } catch (error) {
        log.debug('Bridge abandon: the run could not be interrupted', { error: String(error) });
      }
      machine.abandon(reason);
    },
    events: {
      subscribe(listener) {
        listeners.add(listener);
        return () => { listeners.delete(listener); };
      }
    },
    mcpHandler: createMcpEndpoint(tools, call => machine.call(call), log)
  };
}
