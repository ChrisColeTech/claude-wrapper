/**
 * File-level helpers shared by the scrub script and the guard: listing a
 * directory's files and reading one as text, UTF-8 when it decodes as UTF-8
 * and Latin-1 otherwise (a binary such as a PDF is scanned, never rewritten).
 */
import * as fs from 'fs';
import * as path from 'path';

export interface FileText {
  readonly text: string;
  readonly utf8: boolean;
}

const UTF8 = new TextDecoder('utf-8', { fatal: true });

/** Every file under `dir`, as paths relative to it, sorted. */
export function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .flatMap(e => {
      if (e.isDirectory()) return listFiles(path.join(dir, e.name)).map(f => path.join(e.name, f));
      return e.isFile() ? [e.name] : [];
    })
    .sort();
}

export function readFileText(file: string): FileText {
  const bytes = fs.readFileSync(file);
  try {
    return { text: UTF8.decode(bytes), utf8: true };
  } catch {
    return { text: bytes.toString('latin1'), utf8: false };
  }
}
