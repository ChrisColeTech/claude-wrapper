/**
 * The CLI's account file (spec section 6): `.claude.json` in the CLI's configuration directory,
 * whose `oauthAccount` names the subscription login's account. A run's CLI looks in
 * `CLAUDE_CONFIG_DIR` when its environment sets it, else in its home directory. A run's
 * environment takes `HOME` from the wrapper's and everything else `CLAUDE_*` only from the
 * operator's `upstream.env`, so the file a run reads is found from those two.
 *
 * Its values are the operator's personal data: read here, they are never logged, and neither
 * is the file's text (a JSON parser's message quotes it).
 */
import { isObject } from '../utils/json-object';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const ACCOUNT_FILE_NAME = '.claude.json';
/** The account values upstream puts in a session's context, the email among them. */
const ACCOUNT_FIELDS = ['emailAddress', 'displayName', 'fullName'] as const;

type Environment = Readonly<Record<string, string | undefined>>;

export type AccountRead =
  | { kind: 'read'; values: string[] }
  | { kind: 'missing' }
  | { kind: 'unreadable'; reason: string };

/** The account file a CLI with environment `env` reads. */
export function accountFilePath(env: Environment, home: string = os.homedir()): string {
  return path.join(env['CLAUDE_CONFIG_DIR'] || env['HOME'] || home, ACCOUNT_FILE_NAME);
}

/** The account file the runs read, given the operator's `upstream.env` and the wrapper's own environment. */
export function cliAccountFile(upstreamEnv: Readonly<Record<string, string>>, environment: Environment = process.env): string {
  return accountFilePath({ HOME: environment['HOME'], ...upstreamEnv });
}

/** The OAuth account's email, display name and full name that `file` holds, trimmed, when present. */
export function readAccountValues(file: string): AccountRead {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    const code = (error as { code?: string }).code;
    return code === 'ENOENT' ? { kind: 'missing' } : { kind: 'unreadable', reason: code ?? 'read failed' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { kind: 'unreadable', reason: 'not valid JSON' };
  }
  const account = isObject(parsed) ? parsed['oauthAccount'] : undefined;
  if (!isObject(account)) return { kind: 'read', values: [] };
  const values = ACCOUNT_FIELDS.map(field => account[field])
    .flatMap(value => (typeof value === 'string' && value.trim() ? [value.trim()] : []));
  return { kind: 'read', values };
}
