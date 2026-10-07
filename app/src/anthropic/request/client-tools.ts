/**
 * Client tools (spec sections 4.4 and 7): every tool whose `type` is absent, `null` or `custom`,
 * validated at the client's index and handed to the bridge server as declared (`name`,
 * `description`, `input_schema`), never reshaped. A name may have at most 115 characters, not the
 * real API's 128, because upstream sees it prefixed `mcp__client__` and the API behind it limits
 * the prefixed name to 128. Names must be unique among the client tools: the bridge server lists
 * them under one MCP server. Other fields (`cache_control`, `strict`, ...) are accepted and not
 * passed on. Server tool types are checked by `validate-server-tools.ts`.
 */
import { JsonObject } from '../../upstream/frames';
import { ClientTool } from '../../upstream/bridge';
import { SurfaceError } from '../surface-error';
import { Body, fieldInvalid, fieldRequired, isObject } from './field-errors';

/** The real API's limit and pattern; the surface's own ceiling is 115 (128 less the prefix). */
const API_NAME_LIMIT = 128;
const NAME_LIMIT = 115;
const NAME_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;
const tooLong = (path: string, limit: number) =>
  SurfaceError.invalidRequest(`${path}: String should have at most ${limit} characters`);

const isClientTool = (tool: Body): boolean => tool['type'] === undefined || tool['type'] === null || tool['type'] === 'custom';

function validateName(value: unknown, path: string): string {
  if (value === undefined) throw fieldRequired(path);
  if (typeof value !== 'string') throw fieldInvalid(path, 'a valid string');
  if (value.length > API_NAME_LIMIT) throw tooLong(path, API_NAME_LIMIT);
  if (!NAME_PATTERN.test(value)) {
    throw SurfaceError.invalidRequest(`${path}: String should match pattern '${NAME_PATTERN.source}'`);
  }
  if (value.length > NAME_LIMIT) throw tooLong(path, NAME_LIMIT);
  return value;
}

function validateSchema(value: unknown, path: string): JsonObject {
  if (value === undefined) throw fieldRequired(path);
  if (!isObject(value)) throw fieldInvalid(path, 'a valid dictionary');
  if (value['type'] === undefined) throw fieldRequired(`${path}.type`);
  if (value['type'] !== 'object') throw fieldInvalid(`${path}.type`, "'object'");
  return value as JsonObject;
}

function clientTool(tool: Body, index: number): ClientTool {
  const path = `tools.${index}.custom`;
  const name = validateName(tool['name'], `${path}.name`);
  const description = tool['description'];
  if (description !== undefined && description !== null && typeof description !== 'string') {
    throw fieldInvalid(`${path}.description`, 'a valid string');
  }
  const input_schema = validateSchema(tool['input_schema'], `${path}.input_schema`);
  return typeof description === 'string' ? { name, description, input_schema } : { name, input_schema };
}

/** The request's client tools, in order; `tools` has passed the tool-type checks. */
export function clientTools(tools: unknown): ClientTool[] {
  if (!Array.isArray(tools)) return [];
  const declared = tools.flatMap((tool: Body, index) => (isClientTool(tool) ? [clientTool(tool, index)] : []));
  const names = new Set(declared.map(tool => tool.name));
  if (names.size !== declared.length) throw SurfaceError.invalidRequest('tools: Tool names must be unique.');
  return declared;
}
