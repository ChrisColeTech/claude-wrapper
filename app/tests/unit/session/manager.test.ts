import { SessionManager } from '../../../src/session/manager';

describe('SessionManager', () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager();
  });

  it('should create session', () => {
    const session = manager.create('test-session');
    expect(session.id).toBe('test-session');
  });

  it('should get session', () => {
    const created = manager.create('test-session');
    const retrieved = manager.get('test-session');
    expect(retrieved).toEqual(created);
  });
});