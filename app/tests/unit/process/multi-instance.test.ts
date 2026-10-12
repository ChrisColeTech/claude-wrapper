import { readFile, rm } from 'fs/promises';
import { ProcessManager } from '../../../src/process/manager';
import { createInstanceState } from '../../../src/process/instance-state';
import { IDaemonManager } from '../../../src/process/daemon';
import { IPidManager } from '../../../src/process/pid';
import { ISignalHandler } from '../../../src/process/signals';

function pidManager(): IPidManager {
  return {
    getPidFilePath: () => '',
    savePid: () => undefined,
    readPid: () => null,
    isProcessRunning: () => false,
    cleanupPidFile: () => undefined,
    getPidInfo: () => ({ pid: 0, filePath: '', exists: false, running: false }),
    validateAndCleanup: () => false
  };
}

function daemonManager(): IDaemonManager {
  return {
    startDaemon: async () => 12345,
    isDaemonRunning: () => false,
    stopDaemon: async () => true,
    getDaemonStatus: async () => ({ running: false, pid: null })
  };
}

const signalHandler = {} as ISignalHandler;

describe('multiple working-directory instances', () => {
  it('persists ports independently for separate project directories', async () => {
    const firstState = createInstanceState('project-a');
    const secondState = createInstanceState('project-b');
    const first = new ProcessManager(pidManager(), daemonManager(), signalHandler, firstState);
    const second = new ProcessManager(pidManager(), daemonManager(), signalHandler, secondState);

    try {
      await first.start({ port: '8101' });
      await second.start({ port: '8102' });

      await expect(readFile(firstState.portFilePath, 'utf8')).resolves.toBe('8101');
      await expect(readFile(secondState.portFilePath, 'utf8')).resolves.toBe('8102');
      expect(firstState.portFilePath).not.toBe(secondState.portFilePath);
    } finally {
      await rm(firstState.portFilePath, { force: true });
      await rm(secondState.portFilePath, { force: true });
    }
  });
});
