import { mkdtemp, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import { createInstanceState } from '../../../src/process/instance-state';

describe('working-directory instance state', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'claude-wrapper-instances-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('creates stable state paths for the same working directory', () => {
    const first = createInstanceState(root);
    const second = createInstanceState(path.join(root, '.'));

    expect(first).toEqual(second);
    expect(first.pidFilePath).toContain(first.instanceId);
    expect(first.portFilePath).toContain(first.instanceId);
  });

  it('isolates state for different working directories', () => {
    const first = createInstanceState(path.join(root, 'project-a'));
    const second = createInstanceState(path.join(root, 'project-b'));

    expect(first.instanceId).not.toBe(second.instanceId);
    expect(first.pidFilePath).not.toBe(second.pidFilePath);
    expect(first.portFilePath).not.toBe(second.portFilePath);
  });

  it('does not expose the working directory in state filenames', () => {
    const state = createInstanceState(path.join(root, 'private-project-name'));

    expect(path.basename(state.pidFilePath)).toMatch(/^claude-wrapper-[a-f0-9]{16}\.pid$/);
    expect(path.basename(state.portFilePath)).toMatch(/^claude-wrapper-[a-f0-9]{16}\.port$/);
    expect(path.basename(state.pidFilePath)).not.toContain('private-project-name');
  });
});
