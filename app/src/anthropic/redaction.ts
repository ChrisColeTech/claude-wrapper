/**
 * Arming redaction at startup (spec section 6): the CLI's account file gives the OAuth account's
 * email, display name and full name, and the operator's `redact` setting adds strings. The
 * translator replaces each in every turn's output. Logged by how many strings are armed, never
 * by value; a surface with nothing armed starts with a warning, since the account email then
 * reaches any client that asks for it.
 */
import { ANTHROPIC_SETTING_ENV } from '../config/anthropic-settings';
import { readAccountValues } from '../upstream/account-file';
import { logger as defaultLogger, Logger } from '../utils/logger';

export interface RedactionSources {
  /** The CLI account file the runs read. */
  accountFile: string;
  /** The operator's `redact` setting. */
  extra: readonly string[];
}

/** Each string once, ignoring case, as the translator matches it. */
function distinct(strings: readonly string[]): string[] {
  const seen = new Set<string>();
  return strings.map(text => text.trim()).filter(text => {
    const key = text.toLowerCase();
    if (!text || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** The strings every turn redacts. */
export function armRedaction(sources: RedactionSources, logger: Pick<Logger, 'info' | 'warn'> = defaultLogger): readonly string[] {
  const account = readAccountValues(sources.accountFile);
  if (account.kind === 'unreadable') {
    logger.warn('The CLI account file could not be read, so its account values are not redacted',
      { accountFile: sources.accountFile, reason: account.reason });
  }
  const armed = distinct([...(account.kind === 'read' ? account.values : []), ...sources.extra]);
  if (armed.length > 0) {
    logger.info('Redaction armed', { strings: armed.length });
  } else {
    logger.warn('Redaction is unarmed: the CLI account file names no OAuth account and the redact list is empty, '
      + 'so the account email reaches any client that asks for it',
      { accountFile: sources.accountFile, setting: ANTHROPIC_SETTING_ENV.redact });
  }
  return armed;
}
