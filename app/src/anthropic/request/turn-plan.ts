/**
 * The request module's types (spec section 16): what `planTurn` takes beside the request, and
 * the `TurnPlan` it returns.
 */
import { AnthropicSettings } from '../../config/anthropic-settings';
import { JsonObject } from '../../upstream/frames';
import { RunSpec, UserMessage } from '../../upstream/runner';
import { StateDirectory } from '../../upstream/state-directory';
import { ModelInfo } from '../catalogue';

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

/** How the turn reaches upstream. Until conversation state lands, every turn is a replayed turn. */
export interface Continuation {
  /** The one stream-json user message a fresh run receives. */
  replay: UserMessage;
}

/** What the conductor checks on `system/init` before relaying anything; a mismatch fails the turn. */
export interface StartupChecks {
  /** `init.model` must equal it: the canonical id. */
  model: string;
  /** `init.tools` must equal it. */
  tools: string[];
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
  startupChecks: StartupChecks;
}
