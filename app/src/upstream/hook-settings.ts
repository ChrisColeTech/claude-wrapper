/**
 * The per-run settings file upstream reads through `--settings <path>` (spec sections 8 and 10):
 * one `PreToolUse` command hook on `WebSearch|WebFetch` running the shipped hook client with the
 * absolute Node path. The hook client learns where to post and the run's token from the run's
 * hook endpoint file, so the token is in that `0600` file and nowhere else: never in argv (the
 * hook command names only the file), never in the environment. Both files are written `0600`
 * into the run's own directory before spawn and removed with it at exit.
 */
import * as path from 'path';
import { RunEndpoint } from './runner';

export const HOOK_SETTINGS_FILE_NAME = 'settings.json';
export const HOOK_ENDPOINT_FILE_NAME = 'hook-endpoint.json';

/** The hook client, shipped beside `dist/` in the package: right from both `src/` and `dist/`. */
export const HOOK_CLIENT_PATH = path.resolve(__dirname, '..', '..', 'bin', 'hook-client.js');

/** Upstream's limit on one hook call, in seconds; the hook client gives up (and denies) well before it. */
export const HOOK_TIMEOUT_SECONDS = 30;

/** The matcher upstream tests against the tool name. */
export const HOOK_MATCHER = 'WebSearch|WebFetch';

/** One POSIX shell word: upstream runs a command hook through the shell. */
const shellWord = (value: string): string => `'${value.split("'").join(`'\\''`)}'`;

export interface HookCommand {
  /** The absolute Node binary; defaults to the wrapper's own. */
  node?: string;
  /** The hook client script; defaults to the shipped one. */
  client?: string;
  /** The run's hook endpoint file. */
  endpointFile: string;
}

/** The hook's shell command: Node, the hook client, and the run's endpoint file, each quoted. */
export function hookCommand({ node = process.execPath, client = HOOK_CLIENT_PATH, endpointFile }: HookCommand): string {
  return [node, client, endpointFile].map(shellWord).join(' ');
}

/** The settings file's content: the hook, and nothing else. */
export function hookSettingsContent(command: string): string {
  const hook = { type: 'command', command, timeout: HOOK_TIMEOUT_SECONDS };
  return JSON.stringify({ hooks: { PreToolUse: [{ matcher: HOOK_MATCHER, hooks: [hook] }] } });
}

/** The hook endpoint file's content: where the hook client posts, and the Bearer token it presents. */
export function hookEndpointContent(endpoint: RunEndpoint): string {
  return JSON.stringify({ url: endpoint.url, token: endpoint.token });
}
