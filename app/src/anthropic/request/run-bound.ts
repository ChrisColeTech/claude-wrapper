/**
 * Run-bound parameters (spec section 12): what is fixed when upstream is spawned, so the turn
 * that resumes a parked run cannot change it. Each is kept as the run took it (the canonical
 * model id, the system prompt as passed), as JSON, so a resuming request's can be compared and the
 * differences logged. `stop_sequences` and the redaction list are not run-bound: they apply per
 * turn in the translator.
 */
import { JsonObject, isObject } from '../../utils/json-object';

export type RunBound = Readonly<Record<string, string>>;

export function runBoundParameters(request: JsonObject, modelId: string, system: string): RunBound {
  const output = isObject(request['output_config']) ? request['output_config'] : {};
  const values: Record<string, unknown> = {
    model: modelId,
    max_tokens: request['max_tokens'],
    system,
    thinking: request['thinking'],
    'output_config.effort': output['effort'],
    'output_config.format': output['format'],
    tools: request['tools'],
    mcp_servers: request['mcp_servers']
  };
  return Object.fromEntries(Object.entries(values).map(([name, value]) => [name, JSON.stringify(value ?? null)]));
}

/** The names of the parameters `now` asks to differ from what the run was spawned with. */
export function changedRunBound(spawned: RunBound, now: RunBound): string[] {
  return Object.keys(spawned).filter(name => spawned[name] !== now[name]);
}
