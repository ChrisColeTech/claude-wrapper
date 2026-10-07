/**
 * The operator's live account values, read from the CLI's account file at run
 * time and never written anywhere. Each value carries the placeholder it is
 * scrubbed to; values are ordered longest first so a full name is replaced
 * before the display name it contains.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export const EMAIL_PLACEHOLDER = 'user@example.invalid';
export const NAME_PLACEHOLDER = 'Example User';

const FIELDS = {
  emailAddress: EMAIL_PLACEHOLDER,
  displayName: NAME_PLACEHOLDER,
  fullName: NAME_PLACEHOLDER,
} as const;

export type LiveField = keyof typeof FIELDS;

export interface LiveValue {
  readonly field: LiveField;
  readonly value: string;
  readonly placeholder: string;
}

export type LiveValues = ReadonlyArray<LiveValue>;

export function defaultAccountFile(): string {
  return path.join(os.homedir(), '.claude.json');
}

/** The live values in an `oauthAccount` object, or null when it holds none. */
export function liveValuesFrom(oauthAccount: unknown): LiveValues | null {
  if (!oauthAccount || typeof oauthAccount !== 'object') return null;
  const account = oauthAccount as Record<string, unknown>;
  const found: LiveValue[] = [];
  for (const field of Object.keys(FIELDS) as LiveField[]) {
    const raw = account[field];
    const value = typeof raw === 'string' ? raw.trim() : '';
    const seen = found.some(v => v.value.toLowerCase() === value.toLowerCase());
    if (value && !seen) found.push({ field, value, placeholder: FIELDS[field] });
  }
  assertPlaceholdersAreSafe(found);
  return found.length ? found.sort((a, b) => b.value.length - a.value.length) : null;
}

/** Reads the account file; null when the file or its OAuth account is absent. */
export function readLiveValues(accountFile: string = defaultAccountFile()): LiveValues | null {
  if (!fs.existsSync(accountFile)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(accountFile, 'utf8'));
  } catch {
    // The parser's message quotes the file's text, which holds the values.
    throw new Error('The CLI account file is not valid JSON');
  }
  const account = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>)['oauthAccount'] : null;
  return liveValuesFrom(account);
}

function assertPlaceholdersAreSafe(found: LiveValue[]): void {
  const placeholders = Object.values(FIELDS).join('\n').toLowerCase();
  const clash = found.find(v => placeholders.includes(v.value.toLowerCase()));
  if (clash) {
    throw new Error(`The account's ${clash.field} occurs inside a placeholder; scrubbing cannot remove it`);
  }
}
