/**
 * The registry of held-open runs (spec section 7), keyed by every `tool_use` id a parked turn
 * returned, so the next request's `tool_result` ids find their run.
 */
import { ParkedRun, ParkedRuns } from './types';

export function createParkedRuns(): ParkedRuns {
  const byToolUseId = new Map<string, ParkedRun>();
  return {
    get: toolUseId => byToolUseId.get(toolUseId),
    put: run => run.toolUseIds.forEach(id => byToolUseId.set(id, run)),
    remove: run => run.toolUseIds.forEach(id => {
      if (byToolUseId.get(id) === run) byToolUseId.delete(id);
    })
  };
}
