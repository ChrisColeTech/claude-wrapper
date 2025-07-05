// Jest memory optimization setup
if (typeof global.gc === 'function') {
  // Force garbage collection every few tests
  let testCount = 0;
  const originalTest = global.test;
  global.test = function(...args) {
    testCount++;
    if (testCount % 5 === 0 && global.gc) {
      global.gc();
    }
    return originalTest.apply(this, args);
  };
}

// Set Node.js memory limits
process.env.NODE_OPTIONS = '--max-old-space-size=4096';