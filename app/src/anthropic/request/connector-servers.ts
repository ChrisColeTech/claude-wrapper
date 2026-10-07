/**
 * The `mcp_servers` definitions (spec section 9), validated as the real API validates them: each a
 * dictionary of `type: "url"`, an `https` `url`, a `name` unique among them, an optional
 * `authorization_token` and an optional `tool_configuration` (`enabled`, `allowed_tools`). Two
 * rules are the surface's own: `client` is the bridge server's fixed name, and a name must be one
 * upstream can address, since it names the server's tools `mcp__<name>__<tool>` and reads the name
 * back by splitting on `__` (renaming it would change `server_name` in the response).
 */
import { BRIDGE_SERVER_NAME } from '../../upstream/bridge';
import { isObject } from '../../utils/json-object';
import { SurfaceError } from '../surface-error';
import { fieldInvalid, fieldRequired } from './field-errors';

export interface DeclaredServer {
  /** The client's index in `mcp_servers`. */
  index: number;
  name: string;
  /** The `https` URL as the client sent it. */
  url: string;
  /** Its host, lower-cased, without and with the port: what the operator's host list is matched against. */
  hosts: readonly string[];
  /** `authorization_token`, sent upstream only in the run's `0600` MCP config file. */
  token?: string;
  /** `tool_configuration.enabled`; a disabled server is not mounted. */
  enabled: boolean;
  /** `tool_configuration.allowed_tools`; null allows every tool. */
  allowedTools: readonly string[] | null;
}

const NAME = /^[a-zA-Z0-9_-]+$/;

const absent = (value: unknown): boolean => value === undefined || value === null;

function requiredString(value: unknown, path: string): string {
  if (absent(value)) throw fieldRequired(path);
  if (typeof value !== 'string') throw fieldInvalid(path, 'a valid string');
  return value;
}

function validateName(value: unknown, path: string): string {
  const name = requiredString(value, path);
  if (name === BRIDGE_SERVER_NAME) {
    throw SurfaceError.invalidRequest(`${path}: "client" is reserved on this surface (it names the server that carries the client's own tools)`);
  }
  if (!NAME.test(name) || name.includes('__')) {
    throw SurfaceError.invalidRequest(
      `${path}: on this surface a server name holds only letters, digits, "_" and "-", and no "__" (upstream names its tools mcp__<name>__<tool>)`);
  }
  return name;
}

function parsedUrl(text: string): URL | undefined {
  try {
    return new URL(text);
  } catch {
    return undefined;
  }
}

/** The URL as sent, and its host without and with the port. */
function validateUrl(value: unknown, path: string): Pick<DeclaredServer, 'url' | 'hosts'> {
  const text = requiredString(value, path);
  const url = parsedUrl(text);
  if (url?.protocol !== 'https:') throw SurfaceError.invalidRequest(`${path}: must be an https URL`);
  return { url: text, hosts: [url.hostname, url.host] };
}

export function optionalBoolean(value: unknown, path: string): boolean | undefined {
  if (absent(value)) return undefined;
  if (typeof value !== 'boolean') throw fieldInvalid(path, 'a valid boolean');
  return value;
}

function stringList(value: unknown, path: string): string[] | null {
  if (absent(value)) return null;
  if (!Array.isArray(value)) throw fieldInvalid(path, 'a valid list');
  value.forEach((entry, index) => {
    if (typeof entry !== 'string') throw fieldInvalid(`${path}.${index}`, 'a valid string');
  });
  return value as string[];
}

function toolConfiguration(value: unknown, path: string): Pick<DeclaredServer, 'enabled' | 'allowedTools'> {
  if (absent(value)) return { enabled: true, allowedTools: null };
  if (!isObject(value)) throw fieldInvalid(path, 'a valid dictionary');
  return {
    enabled: optionalBoolean(value['enabled'], `${path}.enabled`) ?? true,
    allowedTools: stringList(value['allowed_tools'], `${path}.allowed_tools`)
  };
}

function declaredServer(server: unknown, index: number): DeclaredServer {
  const path = `mcp_servers.${index}`;
  if (!isObject(server)) throw fieldInvalid(path, 'a valid dictionary');
  if (absent(server['type'])) throw fieldRequired(`${path}.type`);
  if (server['type'] !== 'url') throw fieldInvalid(`${path}.type`, "'url'");
  const address = validateUrl(server['url'], `${path}.url`);
  const name = validateName(server['name'], `${path}.name`);
  const token = server['authorization_token'];
  if (!absent(token) && typeof token !== 'string') throw fieldInvalid(`${path}.authorization_token`, 'a valid string');
  const configuration = toolConfiguration(server['tool_configuration'], `${path}.tool_configuration`);
  return { index, name, ...address, ...(typeof token === 'string' ? { token } : {}), ...configuration };
}

/** The request's servers, in order; `value` is the present `mcp_servers` field. */
export function declaredServers(value: unknown): DeclaredServer[] {
  if (!Array.isArray(value)) throw fieldInvalid('mcp_servers', 'a valid list');
  const servers = value.map(declaredServer);
  const seen = new Set<string>();
  for (const { name } of servers) {
    if (seen.has(name)) throw SurfaceError.invalidRequest(`mcp_servers: server names must be unique; "${name}" is declared twice`);
    seen.add(name);
  }
  return servers;
}
