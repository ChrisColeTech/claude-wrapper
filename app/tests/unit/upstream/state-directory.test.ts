/**
 * The state directory (spec sections 10 and 14): one fixed, empty working directory for every
 * run and the parent of the per-run directories, both owner-only, opened once at startup.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { defaultStateRoot, openStateDirectory } from '../../../src/upstream/state-directory';

const modeOf = (target: string): number => fs.statSync(target).mode & 0o777;

let root: string;

beforeEach(() => {
  root = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'state-directory-')), 'claude-wrapper');
});

afterEach(() => {
  fs.rmSync(path.dirname(root), { recursive: true, force: true });
});

describe('openStateDirectory', () => {
  it('creates the root, the fixed working directory and the runs directory, owner-only', () => {
    const state = openStateDirectory(root);

    expect(state).toEqual({ cwd: path.join(root, 'cwd'), runs: path.join(root, 'runs') });
    expect(modeOf(root)).toBe(0o700);
    expect(modeOf(state.cwd)).toBe(0o700);
    expect(modeOf(state.runs)).toBe(0o700);
    expect(fs.readdirSync(state.cwd)).toEqual([]);
    expect(fs.readdirSync(state.runs)).toEqual([]);
  });

  it('empties the working directory and removes the per-run directories an earlier process left', () => {
    fs.mkdirSync(path.join(root, 'cwd', '.claude'), { recursive: true });
    fs.writeFileSync(path.join(root, 'cwd', 'CLAUDE.md'), 'stray instructions');
    fs.mkdirSync(path.join(root, 'runs', 'crashed-run'), { recursive: true });
    fs.writeFileSync(path.join(root, 'runs', 'crashed-run', 'mcp-config.json'), '{"token":"stale"}', { mode: 0o600 });

    const state = openStateDirectory(root);

    expect(fs.readdirSync(state.cwd)).toEqual([]);
    expect(fs.readdirSync(state.runs)).toEqual([]);
  });

  it('keeps whatever else the root holds', () => {
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(path.join(root, 'notes.txt'), 'operator notes');

    openStateDirectory(root);

    expect(fs.readFileSync(path.join(root, 'notes.txt'), 'utf8')).toBe('operator notes');
  });
});

describe('defaultStateRoot', () => {
  it('is claude-wrapper under XDG_STATE_HOME when that is an absolute path', () => {
    expect(defaultStateRoot({ XDG_STATE_HOME: '/srv/state' }, '/home/operator')).toBe('/srv/state/claude-wrapper');
  });

  it.each([[{}], [{ XDG_STATE_HOME: '' }], [{ XDG_STATE_HOME: 'relative/state' }]])(
    'is ~/.local/state/claude-wrapper otherwise: %p',
    (env) => {
      expect(defaultStateRoot(env, '/home/operator')).toBe('/home/operator/.local/state/claude-wrapper');
    }
  );
});
