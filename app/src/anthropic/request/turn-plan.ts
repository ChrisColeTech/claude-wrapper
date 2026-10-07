/**
 * The request module's types (spec section 16): what `planTurn` takes beside the request, and
 * the `TurnPlan` it returns.
 */
import { AnthropicSettings } from '../../config/anthropic-settings';
import { ClientTool, ToolResultBlock } from '../../upstream/bridge';
import { JsonObject } from '../../upstream/frames';
import { RunSpec, UserMessage } from '../../upstream/runner';
import { StateDirectory } from '../../upstream/state-directory';
import { ModelInfo } from '../catalogue';
import { ParkedRun } from '../sessions';
import { RunBound } from './run-bound';

/** A content block as the client sent it; `type` is all this module reads of most kinds. */
export type ContentBlock = JsonObject & { type: string };

/** A message after normalisation: same-role neighbours merged, string content as one text block. */
export interface NormalisedMessage {
  role: 'user' | 'assistant';
  content: ContentBlock[];
}

/** What a run needs from the wrapper beside the request. Read only; the planner performs no I/O. */
export interface RunContext {
  /** Timers, park TTL, `--max-turns` and `upstream.env` come from here. */
  settings: AnthropicSettings;
  /** The wrapper's own environment: only the base variables are copied into the child's. */
  environment: Readonly<Record<string, string | undefined>>;
  state: StateDirectory;
  /** Names this run's private directory, `<state.runs>/<runId>`. */
  runId: string;
}

/** How a turn that starts a run reaches upstream (spec section 5). */
export type RunContinuation =
  /** A replayed turn: a fresh run receives this one message, any history rendered into it. */
  | { replay: UserMessage }
  /** A continued turn: the run resumes upstream session `resume` and receives only the new message. */
  | { resume: string; message: UserMessage };

/**
 * A resuming turn (spec section 7): the request answers the parked run's `tool_use` ids, so no
 * run is started; `results` go to the parked run's bridge server, and it continues.
 */
export interface ParkedContinuation {
  parked: ParkedRun;
  results: ToolResultBlock[];
}

export type Continuation = RunContinuation | ParkedContinuation;

/** What the conductor checks on `system/init` before relaying anything; a mismatch fails the turn. */
export interface StartupChecks {
  /** `init.model` must equal it: the canonical id. */
  model: string;
  /** `init.tools` must equal it. */
  tools: string[];
}

/** What the turn's translator applies beside the run (spec section 12): not run-bound, so per turn. */
export interface TurnTranslation {
  /** The request's `stop_sequences`; empty when it has none. */
  stopSequences: readonly string[];
  /** The run is started with `--json-schema`: its `StructuredOutput` call is the answer. Run-bound. */
  structuredOutput: boolean;
}

export interface TurnPlan {
  /** The catalogue entry the request's `model` resolved to. */
  model: ModelInfo;
  messages: NormalisedMessage[];
  /** Exactly the client's `system`: a string as is, text blocks joined with a blank line, else ''. */
  system: string;
  /** The whole spawn contract: argument list, child environment, working and per-run directories, timers. */
  runSpec: RunSpec;
  continuation: Continuation;
  translatorConfig: TurnTranslation;
  startupChecks: StartupChecks;
  /** The client tools the bridge server serves this turn's run; none (or `tool_choice: none`): not mounted. */
  bridgeTools: ClientTool[];
  /** What the run is spawned with and a resuming turn cannot change. */
  runBound: RunBound;
  /** The `tool_result` ids of a replayed turn whose results named no parked run (spec section 7): a lost park. */
  lostPark?: string[];
}
