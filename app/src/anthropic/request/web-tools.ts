/**
 * The web tools a turn enables (spec sections 4.4 and 8): each `web_search_*` tool enables
 * upstream's WebSearch and each `web_fetch_*` tool its WebFetch, with the limits the wrapper's
 * hook enforces (`max_uses`, one domain list). Their fields are validated at the client's index
 * and type, as the real API words it; one tool of each kind at most (the names must be unique).
 * The fields the surface does not serve (`user_location`, `citations`, `max_content_tokens`,
 * `response_inclusion`, ...) are accepted and ignored. Types have passed `validate-server-tools`.
 * `tool_choice: none` disables them, though they are validated all the same.
 */
import { HookPolicySpec, WebTool, WebToolLimits } from '../../upstream/hook-policy';
import { JsonObject, isObject } from '../../utils/json-object';
import { SurfaceError } from '../surface-error';
import { WEB_TOOL_NAMES } from '../web-tools';
import { fieldInvalid, fieldRequired, present } from './field-errors';
import { toolsHidden } from './validate-tool-choice';

const KINDS = Object.values(WEB_TOOL_NAMES);


function validateName(value: unknown, name: string, path: string): void {
  if (value === undefined) throw fieldRequired(`${path}.name`);
  if (value !== name) throw fieldInvalid(`${path}.name`, `'${name}'`);
}

function maxUses(value: unknown, path: string): number | undefined {
  if (!present(value)) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value)) throw fieldInvalid(`${path}.max_uses`, 'a valid integer');
  if (value <= 0) throw fieldInvalid(`${path}.max_uses`, 'greater than 0');
  return value;
}

function domains(value: unknown, path: string): readonly string[] | undefined {
  if (!present(value)) return undefined;
  if (!Array.isArray(value)) throw fieldInvalid(path, 'a valid list');
  value.forEach((entry, index) => {
    if (typeof entry !== 'string') throw fieldInvalid(`${path}.${index}`, 'a valid string');
  });
  return value.length > 0 ? (value as string[]) : undefined;
}

function limits(tool: JsonObject, path: string): WebToolLimits {
  const uses = maxUses(tool['max_uses'], path);
  const allowed = domains(tool['allowed_domains'], `${path}.allowed_domains`);
  const blocked = domains(tool['blocked_domains'], `${path}.blocked_domains`);
  return {
    ...(uses === undefined ? {} : { maxUses: uses }),
    ...(allowed === undefined ? {} : { allowedDomains: allowed }),
    ...(blocked === undefined ? {} : { blockedDomains: blocked })
  };
}

/** The hook policy for the request's web tools, or undefined when it enables none. */
export function webTools(tools: unknown, toolChoice: unknown): HookPolicySpec | undefined {
  if (!Array.isArray(tools)) return undefined;
  const policy: { [tool in WebTool]?: WebToolLimits } = {};
  tools.forEach((tool: unknown, index) => {
    const type = isObject(tool) ? tool['type'] : undefined;
    const kind = typeof type === 'string' ? KINDS.find(candidate => type.startsWith(candidate.typePrefix)) : undefined;
    if (!kind || !isObject(tool)) return;
    const path = `tools.${index}.${String(type)}`;
    validateName(tool['name'], kind.name, path);
    if (policy[kind.tool]) throw SurfaceError.invalidRequest('tools: Tool names must be unique.');
    policy[kind.tool] = limits(tool, path);
  });
  return toolsHidden(toolChoice) || Object.keys(policy).length === 0 ? undefined : policy;
}
