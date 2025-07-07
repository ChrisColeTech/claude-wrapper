import { ProcessManager } from '../../../src/process/manager';

describe('ProcessManager', () => {
  let manager: ProcessManager;

  beforeEach(() => {
    manager = new ProcessManager('/tmp/test.pid');
  });

  it('should create instance', () => {
    expect(manager).toBeInstanceOf(ProcessManager);
  });
});