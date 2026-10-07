/**
 * Upstream's transcripts (spec sections 5 and 14): Claude Code keeps each session as
 * `<config dir>/projects/<project>/<session id>.jsonl` (plus a side directory of the same name),
 * the config dir being `CLAUDE_CONFIG_DIR` else `~/.claude`, the project the run's working
 * directory with every non-alphanumeric character replaced by `-` (or
 * `CLAUDE_CODE_PROJECT_DIR_NAME`). Forgetting a session deletes both.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createTranscriptStore, upstreamProjectDirectory } from '../../../src/upstream/transcripts';

describe('upstreamProjectDirectory', () => {
  let temp: string;

  beforeEach(() => {
    temp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'transcripts-')));
  });

  afterEach(() => {
    fs.rmSync(temp, { recursive: true, force: true });
  });

  it("is under the child's home, named after the working directory", () => {
    expect(upstreamProjectDirectory('/var/lib/claude-wrapper/cwd', { HOME: '/home/operator' }))
      .toBe('/home/operator/.claude/projects/-var-lib-claude-wrapper-cwd');
  });

  it('replaces every non-alphanumeric character of the working directory', () => {
    expect(upstreamProjectDirectory('/srv/my_state.d/claude-wrapper/cwd', { HOME: '/h' }))
      .toBe('/h/.claude/projects/-srv-my-state-d-claude-wrapper-cwd');
  });

  it('follows CLAUDE_CONFIG_DIR and CLAUDE_CODE_PROJECT_DIR_NAME when the child has them', () => {
    const env = { HOME: '/h', CLAUDE_CONFIG_DIR: '/etc/claude', CLAUDE_CODE_PROJECT_DIR_NAME: 'wrapper' };

    expect(upstreamProjectDirectory('/var/cwd', env)).toBe('/etc/claude/projects/wrapper');
  });

  it('names the project after the real path of the working directory, as upstream sees it', () => {
    const real = path.join(temp, 'real-cwd');
    fs.mkdirSync(real);
    fs.symlinkSync(real, path.join(temp, 'link'));

    expect(upstreamProjectDirectory(path.join(temp, 'link'), { HOME: '/h' }))
      .toBe(`/h/.claude/projects/${real.replace(/[^a-zA-Z0-9]/g, '-')}`);
  });
});

describe('createTranscriptStore', () => {
  let projects: string;
  const file = (name: string) => path.join(projects, name);

  beforeEach(() => {
    projects = fs.mkdtempSync(path.join(os.tmpdir(), 'transcripts-'));
    fs.writeFileSync(file('session-1.jsonl'), '{}\n');
    fs.mkdirSync(file('session-1'));
    fs.writeFileSync(path.join(file('session-1'), 'subagent.jsonl'), '{}\n');
    fs.writeFileSync(file('session-2.jsonl'), '{}\n');
  });

  afterEach(() => {
    fs.rmSync(projects, { recursive: true, force: true });
  });

  it("deletes the session's transcript and its side directory, and nothing else", async () => {
    await createTranscriptStore(() => projects).delete('session-1');

    expect(fs.readdirSync(projects)).toEqual(['session-2.jsonl']);
  });

  it('is content when there is nothing to delete', async () => {
    const store = createTranscriptStore(() => path.join(projects, 'missing'));

    await expect(store.delete('session-1')).resolves.toBeUndefined();
  });

  it('asks for the directory only when deleting (the state directory opens at the first turn)', async () => {
    const directory = jest.fn(() => projects);
    const store = createTranscriptStore(directory);
    expect(directory).not.toHaveBeenCalled();

    await store.delete('session-2');

    expect(directory).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(file('session-2.jsonl'))).toBe(false);
  });

  it.each(['', '..', '../session-2', 'a/b', '.hidden'])('deletes nothing for %p, which is no session id', async (id) => {
    const warn = jest.fn();

    await createTranscriptStore(() => path.join(projects, 'session-1'), { warn }).delete(id);

    expect(fs.readdirSync(projects).sort()).toEqual(['session-1', 'session-1.jsonl', 'session-2.jsonl']);
    expect(warn).toHaveBeenCalledWith('Upstream transcript not deleted: the session id is not one path segment');
  });

  it('logs a failure to find the directory instead of rejecting', async () => {
    const warn = jest.fn();
    const store = createTranscriptStore(() => { throw new Error('no state directory'); }, { warn });

    await expect(store.delete('session-1')).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith('Upstream transcript could not be deleted',
      { sessionId: 'session-1', error: 'Error: no state directory' });
  });
});
