/**
 * A global, case-insensitive matcher for one literal value, as a whole word:
 * no letter, mark, digit or underscore may touch either end, so a short name
 * is not found inside another word (or inside base64 data). A JSON escape
 * written out as text (`\n`, `\t`, ` ` in a harness log) counts as a
 * boundary, not as the letter that ends it.
 */
const WORD = '[\\p{L}\\p{M}\\p{N}_]';
const AFTER_BOUNDARY = `(?:(?<=\\\\[nrtbf])|(?<=\\\\u[0-9a-fA-F]{4})|(?<!${WORD}))`;

export function valueMatcher(value: string): RegExp {
  const literal = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${AFTER_BOUNDARY}${literal}(?!${WORD})`, 'giu');
}
