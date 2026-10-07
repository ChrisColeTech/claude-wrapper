/**
 * Loads the catalogue file: the one shipped with the package, or the operator's
 * (`CLAUDE_WRAPPER_CATALOGUE_PATH`). Loaded once at start; a file that cannot be read or does
 * not check out stops the start with a message naming the file and the problem.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Catalogue, createCatalogue } from './catalogue';
import { checkCatalogueFile } from './check-file';
import { CatalogueFormatError } from './checks';

/** `catalogue/models.json` at the package root, beside `dist/` (and `src/` in development). */
export const SHIPPED_CATALOGUE_PATH = resolve(__dirname, '../../../catalogue/models.json');

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readJson(path: string): unknown {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (error) {
    throw new Error(`Cannot read the model catalogue ${path}: ${messageOf(error)}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid model catalogue ${path}: not JSON (${messageOf(error)})`);
  }
}

export function loadCatalogue(path: string): Catalogue {
  const content = readJson(path);
  try {
    return createCatalogue(checkCatalogueFile(content));
  } catch (error) {
    if (error instanceof CatalogueFormatError) throw new Error(`Invalid model catalogue ${path}: ${error.message}`);
    throw error;
  }
}
