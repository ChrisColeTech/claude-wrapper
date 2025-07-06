/**
 * Global Jest teardown - runs once after all tests
 * Verifies no memory leaks and cleans up global resources
 */

module.exports = async () => {
  const testDuration = Date.now() - (global.__TEST_START_TIME__ || 0);
  
  // Check for signal handler leaks
  const finalListenerCount = process.listenerCount('SIGTERM') + process.listenerCount('SIGINT');
  const initialListenerCount = global.__INITIAL_SIGNAL_LISTENERS__ || 0;
  const leakedListeners = finalListenerCount - initialListenerCount;
  
  if (leakedListeners > 0) {
    console.warn(`⚠️  Signal handler leak detected: ${leakedListeners} handlers not cleaned up`);
    
    // Force cleanup of signal handlers
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGHUP');
    process.removeAllListeners('SIGUSR1');
    process.removeAllListeners('SIGUSR2');
    
    console.log('✅ Forced cleanup of signal handlers completed');
  } else {
    console.log('✅ No signal handler leaks detected');
  }
  
  // Force final garbage collection
  if (typeof global.gc === 'function') {
    global.gc();
    console.log('✅ Final garbage collection completed');
  }
  
  // Report memory usage
  const memUsage = process.memoryUsage();
  const heapUsedMB = (memUsage.heapUsed / 1024 / 1024).toFixed(2);
  const heapTotalMB = (memUsage.heapTotal / 1024 / 1024).toFixed(2);
  
  console.log(`📊 Final memory usage: ${heapUsedMB}MB / ${heapTotalMB}MB heap`);
  console.log(`⏱️  Total test duration: ${(testDuration / 1000).toFixed(2)}s`);
  console.log('Global test teardown completed');
};