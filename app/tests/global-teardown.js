/**
 * Global Test Teardown
 * Runs once after all tests in the suite complete
 */

module.exports = async () => {
  // Force cleanup of any remaining process listeners
  const signalEvents = ['SIGTERM', 'SIGINT', 'SIGUSR2', 'SIGHUP', 'exit'];
  signalEvents.forEach(event => {
    try {
      process.removeAllListeners(event);
    } catch (error) {
      // Ignore cleanup errors
    }
  });
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  
  // Small delay to allow cleanup to complete
  await new Promise(resolve => setTimeout(resolve, 100));
  
  console.log('🧹 Global test teardown completed');
};