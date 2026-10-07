/**
 * The run's audit of its hook (spec section 8). `result.permission_denials` may hold only the
 * denials the wrapper's hook issued, matched by `tool_use_id`, and those of connector tools the
 * request did not allow (spec section 9: `--allowedTools` leaves them out, so upstream denies
 * them); any other entry means upstream's permissions are not the wrapper's (a misconfiguration).
 * A web tool call whose result arrives with no decision from the hook ran unenforced (upstream
 * lets a call through when a command hook fails to start or times out). And every call the hook
 * denied must come back as an error result and be listed in `result.permission_denials`; else
 * upstream ran it despite the denial (the client still gets the denial's error block, so only
 * this audit shows it). Each is logged at error by name and id, never with the input: the
 * response has closed by `result`, so none fails the turn.
 */
import { isObject } from '../../utils/json-object';
import { Logger } from '../../utils/logger';
import { isConnectorTool } from '../connector-tools';
import { Frame, JsonObject } from '../frames';
import { DenialCode, isWebTool } from './types';

/** One decision of the hook: the tool asked for, and the denial code (null: let through). */
interface Decision {
  tool: string;
  code: DenialCode | null;
}

const RAN_DESPITE_DENIAL = "Upstream ran a call the wrapper's hook denied: the denial was not enforced";

const blocksOf = (content: unknown): JsonObject[] =>
  (Array.isArray(content) ? content.filter(isObject) : []);

export class HookAudit {
  /** Every call the hook decided, by `tool_use_id`. */
  private readonly decisions = new Map<string, Decision>();
  /** The web tool calls upstream announced. */
  private readonly webCalls = new Set<string>();
  /** Denied calls a `result` has been checked against. */
  private readonly checked = new Set<string>();
  /** Denied calls already logged as run despite the denial (each is logged once). */
  private readonly ran = new Set<string>();

  constructor(private readonly logger: Pick<Logger, 'error'>) {}

  /** The hook decided `toolUseId`: denied with `code`, or let through (null). */
  decided(toolUseId: string, tool: string, code: DenialCode | null): void {
    this.decisions.set(toolUseId, { tool, code });
  }

  /** The code the hook denied the call with; undefined for a call it let through or never saw. */
  denialOf(toolUseId: string): DenialCode | undefined {
    return this.decisions.get(toolUseId)?.code ?? undefined;
  }

  onFrame(frame: Frame): void {
    if (frame.type === 'assistant' && frame.parent_tool_use_id == null) this.onAnnounced(frame.message.content);
    if (frame.type === 'user' && frame.parent_tool_use_id == null) this.onResults(frame.message.content);
    if (frame.type === 'result') this.onDenials(frame.permission_denials);
  }

  private onAnnounced(content: unknown): void {
    for (const block of blocksOf(content)) {
      if (block['type'] === 'tool_use' && isWebTool(block['name'])) this.webCalls.add(String(block['id']));
    }
  }

  private onResults(content: unknown): void {
    for (const block of blocksOf(content).filter(item => item['type'] === 'tool_result')) {
      const id = String(block['tool_use_id']);
      const decision = this.decisions.get(id);
      if (!decision && this.webCalls.has(id)) {
        this.logger.error("A web tool call ran without the wrapper's hook: its limits were not enforced", undefined, { toolUseId: id });
      }
      if (decision?.code && block['is_error'] !== true) this.ranDespiteDenial(id, decision, 'its tool_result is not an error');
    }
  }

  private onDenials(denials: unknown): void {
    const listed = new Set<string>();
    for (const denial of blocksOf(denials)) {
      const id = String(denial['tool_use_id']);
      listed.add(id);
      if (this.denialOf(id) || isConnectorTool(denial['tool_name'])) continue;
      this.logger.error("Upstream denied a tool call the wrapper's hook did not: the run is misconfigured", undefined,
        { toolName: denial['tool_name'], toolUseId: id });
    }
    for (const [id, decision] of this.decisions) {
      if (!decision.code || this.checked.has(id)) continue;
      this.checked.add(id);
      if (!listed.has(id)) this.ranDespiteDenial(id, decision, 'result.permission_denials does not list it');
    }
  }

  private ranDespiteDenial(id: string, { tool, code }: Decision, evidence: string): void {
    if (this.ran.has(id)) return;
    this.ran.add(id);
    this.logger.error(RAN_DESPITE_DENIAL, undefined, { toolName: tool, toolUseId: id, denial: code, evidence });
  }
}
