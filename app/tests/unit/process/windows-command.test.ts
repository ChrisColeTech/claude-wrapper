import { mkdtemp, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { resolveWindowsCommand } from '../../../src/process/windows-command';

describe('resolveWindowsCommand', () => {
  const originalPlatform = process.platform;
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), 'claude-wrapper-shim-'));
  });

  afterEach(async () => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    await rm(directory, { recursive: true, force: true });
  });

  it('leaves native commands unchanged', async () => {
    const spec = { command: '/usr/local/bin/claude', args: ['--version'] };

    await expect(resolveWindowsCommand(spec)).resolves.toBe(spec);
  });

  it('resolves Windows npm shims to Node without invoking cmd.exe', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    const command = path.join(directory, 'claude.cmd');
    const script = path.join(directory, 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');
    await writeFile(command, '"%_prog%" "%dp0%\\node_modules\\@anthropic-ai\\claude-code\\cli.js" %*');

    await expect(resolveWindowsCommand({ command, args: ['--version'] })).resolves.toEqual({
      command: process.execPath,
      args: [script, '--version']
    });
  });
});
