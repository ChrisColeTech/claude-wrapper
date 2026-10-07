/**
 * Checks the catalogue file's content: `{models: [...]}`, each entry a `ModelInfo` plus
 * `aliases[]`, and no name (id or alias) served by two entries. Fields the surface does not
 * read are kept as written, so an entry copied from the real API's listing loads as it is.
 */
import { checkCapabilities } from './check-capabilities';
import { isObject } from '../../utils/json-object';
import { CatalogueFormatError, fail, objectAt } from './checks';
import { CatalogueEntry } from './model-info';

const RFC_3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/i;

function checkCreatedAt(value: unknown, at: string): void {
  if (typeof value !== 'string' || !RFC_3339.test(value) || Number.isNaN(Date.parse(value))) {
    fail(at, 'an RFC 3339 date-time');
  }
}

function checkLimit(value: unknown, at: string): void {
  if (value === null) return;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) fail(at, 'a positive integer or null');
}

function checkAliases(value: unknown, at: string): void {
  const valid = Array.isArray(value) && value.every((alias) => typeof alias === 'string' && alias !== '');
  if (!valid) fail(at, 'an array of non-empty strings');
}

function checkEntry(value: unknown, at: string): CatalogueEntry {
  const entry = objectAt(value, at);
  if (typeof entry['id'] !== 'string' || entry['id'] === '') fail(`${at}.id`, 'a non-empty string');
  if (entry['type'] !== 'model') fail(`${at}.type`, '"model"');
  if (typeof entry['display_name'] !== 'string') fail(`${at}.display_name`, 'a string');
  checkCreatedAt(entry['created_at'], `${at}.created_at`);
  checkLimit(entry['max_input_tokens'], `${at}.max_input_tokens`);
  checkLimit(entry['max_tokens'], `${at}.max_tokens`);
  checkCapabilities(entry['capabilities'], `${at}.capabilities`);
  checkAliases(entry['aliases'], `${at}.aliases`);
  return entry as unknown as CatalogueEntry;
}

function checkNamesUnique(entries: readonly CatalogueEntry[]): void {
  const servedBy = new Map<string, number>();
  entries.forEach((entry, index) => {
    for (const name of [entry.id, ...entry.aliases]) {
      const earlier = servedBy.get(name);
      if (earlier !== undefined) {
        throw new CatalogueFormatError(`models[${index}] names "${name}", which models[${earlier}] already serves`);
      }
      servedBy.set(name, index);
    }
  });
}

export function checkCatalogueFile(content: unknown): CatalogueEntry[] {
  const models = isObject(content) ? content['models'] : undefined;
  if (!Array.isArray(models)) throw new CatalogueFormatError('the file must be an object with a "models" array');
  if (models.length === 0) throw new CatalogueFormatError('models must list at least one model');

  const entries = models.map((model: unknown, index) => checkEntry(model, `models[${index}]`));
  checkNamesUnique(entries);
  return entries;
}
