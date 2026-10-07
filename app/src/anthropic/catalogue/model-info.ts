/**
 * The API's `ModelInfo` (`GET /v1/models`), as the official SDK types it, and the catalogue
 * entry that carries it. An entry is a `ModelInfo` plus the aliases it resolves; fields the
 * surface does not read pass through as the catalogue file states them.
 */

export interface CapabilitySupport {
  supported: boolean;
}

export interface ContextManagementCapability extends CapabilitySupport {
  clear_thinking_20251015: CapabilitySupport | null;
  clear_tool_uses_20250919: CapabilitySupport | null;
  compact_20260112: CapabilitySupport | null;
}

export interface EffortCapability extends CapabilitySupport {
  low: CapabilitySupport;
  medium: CapabilitySupport;
  high: CapabilitySupport;
  xhigh: CapabilitySupport | null;
  max: CapabilitySupport;
}

export interface ThinkingCapability extends CapabilitySupport {
  types: {
    adaptive: CapabilitySupport;
    enabled: CapabilitySupport;
    /** Whether `thinking: {type: "disabled"}` is accepted; newer than the pinned SDK's types. */
    disabled?: CapabilitySupport;
  };
}

export interface ModelCapabilities {
  batch: CapabilitySupport;
  citations: CapabilitySupport;
  code_execution: CapabilitySupport;
  context_management: ContextManagementCapability;
  effort: EffortCapability;
  image_input: CapabilitySupport;
  pdf_input: CapabilitySupport;
  structured_outputs: CapabilitySupport;
  thinking: ThinkingCapability;
}

export interface ModelInfo {
  /** The canonical id: what `--model` receives and what every response names. */
  id: string;
  type: 'model';
  display_name: string;
  /** RFC 3339 release time; the epoch when unknown, as the real API does. */
  created_at: string;
  max_input_tokens: number | null;
  /** The largest `max_tokens` a request may ask for. */
  max_tokens: number | null;
  capabilities: ModelCapabilities | null;
}

/** One model as the catalogue file lists it: its `ModelInfo` and the aliases that resolve to it. */
export interface CatalogueEntry extends ModelInfo {
  aliases: readonly string[];
}
