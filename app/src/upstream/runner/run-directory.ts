/**
 * A run's private directory (`RunSpec.runDir`, spec sections 10 and 14): created owner-only with
 * its `0600` files before spawn, removed with everything in it at exit. The control-server token
 * and connector credentials live only in these files, never in argv or the environment.
 */
import * as fs from 'fs';
import * as path from 'path';
import { RunDirectory, RunSpec } from './types';

/** One plain path segment: no separator, no `.`/`..`, not hidden. */
const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function checkNames(directory: RunDirectory): void {
  for (const name of Object.keys(directory.files)) {
    if (!FILE_NAME.test(name)) throw new Error(`invalid run file name ${JSON.stringify(name)}`);
  }
}

/** Throws when it cannot; whatever it created by then is removed again. */
export function createRunDirectory(directory: RunDirectory): void {
  checkNames(directory);
  fs.mkdirSync(path.dirname(directory.path), { recursive: true, mode: 0o700 });
  fs.mkdirSync(directory.path, { mode: 0o700 });
  try {
    for (const [name, content] of Object.entries(directory.files)) {
      fs.writeFileSync(path.join(directory.path, name), content, { mode: 0o600, flag: 'wx' });
    }
  } catch (error) {
    removeRunDirectory(directory);
    throw error;
  }
}

/** Never throws: a directory that cannot be removed must not stop the exit being reported. */
export function removeRunDirectory(directory: RunDirectory): void {
  try {
    fs.rmSync(directory.path, { recursive: true, force: true });
  } catch {
    // left for the next start's sweep of the runs directory
  }
}

/**
 * How a file joins a planned run: a new spec whose run directory also holds `name`, written
 * `0600` before spawn. The caller references it in a flag as `path.join(spec.runDir.path, name)`.
 */
export function withRunFile(spec: RunSpec, name: string, content: string): RunSpec {
  const { runDir } = spec;
  if (!runDir) throw new Error('the run spec has no run directory');
  if (name in runDir.files) throw new Error(`the run directory already has ${name}`);
  return { ...spec, runDir: { path: runDir.path, files: { ...runDir.files, [name]: content } } };
}
