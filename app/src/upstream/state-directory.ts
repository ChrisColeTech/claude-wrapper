/**
 * The wrapper's state directory (spec sections 10 and 14): `<state>/cwd`, the one fixed, empty
 * working directory every run uses, so every upstream transcript lands in one CLI project
 * directory; and `<state>/runs/<run id>/`, each run's private directory for its `0600` files,
 * which the spawn runner creates before spawn and removes at exit (`RunSpec.runDir`).
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface StateDirectory {
  /** The fixed, empty working directory of every run. */
  cwd: string;
  /** Where each run's private directory goes, as `<runs>/<run id>`. */
  runs: string;
}

const OWNER_ONLY = 0o700;

/** `$XDG_STATE_HOME/claude-wrapper` when that is absolute, else `~/.local/state/claude-wrapper`. */
export function defaultStateRoot(
  env: Readonly<Record<string, string | undefined>> = process.env, home: string = os.homedir()
): string {
  const xdg = env['XDG_STATE_HOME'];
  const base = xdg && path.isAbsolute(xdg) ? xdg : path.join(home, '.local', 'state');
  return path.join(base, 'claude-wrapper');
}

function freshDirectory(directory: string): void {
  fs.rmSync(directory, { recursive: true, force: true });
  fs.mkdirSync(directory, { mode: OWNER_ONLY });
}

/**
 * Creates the layout under `root` (owner-only) and clears what an earlier wrapper process left:
 * anything in the working directory, and every per-run directory (their files may hold tokens).
 * Call it once per wrapper process, at startup, before any run: it removes live runs' directories.
 */
export function openStateDirectory(root: string): StateDirectory {
  fs.mkdirSync(root, { recursive: true, mode: OWNER_ONLY });
  const state = { cwd: path.join(root, 'cwd'), runs: path.join(root, 'runs') };
  freshDirectory(state.cwd);
  freshDirectory(state.runs);
  return state;
}

let processState: StateDirectory | undefined;

/**
 * The wrapper process's own state directory under `defaultStateRoot()`: opened on the first call
 * (the first turn), then the same one for every app in the process, so opening it never removes
 * a live run's directory.
 */
export function processStateDirectory(): StateDirectory {
  processState ??= openStateDirectory(defaultStateRoot());
  return processState;
}
