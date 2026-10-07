/**
 * The calls a run's upstream runs itself (spec sections 8 and 9), shared by the translators of the
 * run's turns: the flattener notes each WebSearch, WebFetch and connector call upstream announces,
 * so a parked run's next turn still knows the call whose result opens it (spec section 11, mixed
 * message). Denials are read from the run's hook policy, which decided them.
 */
import { DenialCode } from '../../upstream/hook-policy';
import { ServerToolCalls, UpstreamCall } from './turn-event';

export function createServerToolCalls(denialOf: (toolUseId: string) => DenialCode | undefined = () => undefined): ServerToolCalls {
  const tools = new Map<string, UpstreamCall>();
  return {
    note: (toolUseId, tool) => { tools.set(toolUseId, tool); },
    toolOf: toolUseId => tools.get(toolUseId),
    denialOf
  };
}
