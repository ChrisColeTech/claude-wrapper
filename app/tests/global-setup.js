/**
 * Global Jest setup - runs once before all tests
 * Configures memory monitoring and cleanup prevention
 */

module.exports = async () => {
  // Set up global test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JEST_WORKER_ID = '1';
  
  // Enable garbage collection if available
  if (typeof global.gc === 'function') {
    console.log('Garbage collection available for tests');
    global.gc();
  } else {
    console.log('Garbage collection not available - run with --expose-gc for better memory management');
  }
  
  // Set up process signal handler monitoring
  const originalListenerCount = process.listenerCount('SIGTERM') + process.listenerCount('SIGINT');
  
  global.__INITIAL_SIGNAL_LISTENERS__ = originalListenerCount;
  global.__TEST_START_TIME__ = Date.now();
  
  console.log(`Global test setup completed. Initial signal listeners: ${originalListenerCount}`);
};