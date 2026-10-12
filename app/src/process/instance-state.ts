import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

export interface InstanceState {
  workingDirectory: string;
  instanceId: string;
  pidFilePath: string;
  portFilePath: string;
}

export function createInstanceState(directory: string = process.cwd()): InstanceState {
  const resolved = path.resolve(directory);
  let canonical = resolved;
  try {
    canonical = fs.realpathSync.native(resolved);
  } catch {
    // The caller may be describing a directory that will be created later.
  }
  if (process.platform === 'win32') canonical = canonical.toLowerCase();

  const instanceId = crypto.createHash('sha256').update(canonical).digest('hex').substring(0, 16);
  return {
    workingDirectory: canonical,
    instanceId,
    pidFilePath: path.join(os.tmpdir(), `claude-wrapper-${instanceId}.pid`),
    portFilePath: path.join(os.tmpdir(), `claude-wrapper-${instanceId}.port`)
  };
}

export const instanceState = createInstanceState();
