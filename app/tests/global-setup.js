/**
 * Global Test Setup
 * Runs once before all tests in the suite
 */

module.exports = async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JEST_WORKER_ID = '1';
  process.env.TEST_MAX_LISTENERS = '100';
  
  // Increase process max listeners for tests
  process.setMaxListeners(100);
  
  // Suppress console output during tests unless debugging
  if (!process.env.DEBUG) {
    const originalConsole = global.console;
    global.console = {
      ...originalConsole,
      log: () => {},
      info: () => {},
      warn: () => {},
      debug: () => {}
    };
  }
  
  console.log('🧪 Global test setup completed');
};