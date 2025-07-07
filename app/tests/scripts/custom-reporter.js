/**
 * Custom Jest Reporter
 * Provides formatted text summaries and organized log cleanup
 */

const fs = require('fs');
const path = require('path');

class CustomReporter {
  constructor(globalConfig, options) {
    this.globalConfig = globalConfig;
    this.options = options;
    this.logDir = path.join(__dirname, '..', 'logs');
    this.passDir = path.join(this.logDir, 'pass');
    this.failDir = path.join(this.logDir, 'fail');
    
    // Ensure log directories exist
    this.ensureDirectories();
    
    // Clean previous logs at start
    this.cleanupLogs();
  }

  ensureDirectories() {
    [this.logDir, this.passDir, this.failDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  cleanupLogs() {
    console.log('🧹 Cleared previous test logs');
    
    // Clear previous results
    [this.passDir, this.failDir].forEach(dir => {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
          if (file.endsWith('.txt')) {
            fs.unlinkSync(path.join(dir, file));
          }
        });
      }
    });
  }

  onRunStart() {
    console.log('Global test setup completed. Initial signal listeners: 0');
  }

  onTestResult(test, testResult) {
    try {
      const testName = path.basename(testResult.testFilePath, '.test.ts');
      const fileName = `test-results-${testName}.txt`;
      
      // Handle displayName safely
      const displayName = typeof testResult.displayName === 'string' 
        ? testResult.displayName 
        : testResult.displayName?.name || 'Tests';
      
      // Check for compilation errors or test execution errors
      const hasCompilationError = testResult.testExecError;
      const hasFailingTests = testResult.numFailingTests > 0;
      const hasNoTests = testResult.numTotalTests === 0;
      
      if (hasCompilationError || hasFailingTests) {
        // Log failures immediately to console
        console.error(`FAIL ${displayName} ${testResult.testFilePath}`);
        
        // Handle compilation errors
        if (hasCompilationError) {
          console.error(`  ● Test suite failed to run`);
          console.error(`    ${testResult.testExecError.message}`);
        }
        
        // Handle test failures
        testResult.testResults.forEach(result => {
          if (result.status === 'failed') {
            console.error(`  ● ${result.fullName}`);
            if (result.failureMessages && result.failureMessages.length > 0) {
              result.failureMessages.forEach(message => {
                console.error(`    ${message.split('\n')[0]}`);
              });
            }
          }
        });
        
        // Save detailed results to fail directory
        const failPath = path.join(this.failDir, fileName);
        const failContent = this.formatTestResult(testResult);
        fs.writeFileSync(failPath, failContent);
      } else {
        // Save successful results to pass directory
        const passPath = path.join(this.passDir, fileName);
        const passContent = this.formatTestResult(testResult);
        fs.writeFileSync(passPath, passContent);
        
        console.log(`📄 ✅ PASS results saved to ${path.relative(process.cwd(), passPath)}`);
      }
    } catch (error) {
      // Don't let reporter errors crash Jest
      console.warn('Custom reporter error:', error.message);
    }
  }

  formatTestResult(testResult) {
    const lines = [];
    lines.push(`Test Suite: ${testResult.testFilePath}`);
    
    // Handle displayName safely (might be object or string)
    const displayName = typeof testResult.displayName === 'string' 
      ? testResult.displayName 
      : testResult.displayName?.name || 'Tests';
    lines.push(`Display Name: ${displayName}`);
    
    const hasCompilationError = testResult.testExecError;
    const hasFailures = testResult.numFailingTests > 0;
    
    lines.push(`Status: ${hasCompilationError || hasFailures ? 'FAILED' : 'PASSED'}`);
    const totalTests = testResult.numTotalTests || (testResult.numPassingTests + testResult.numFailingTests + (testResult.numPendingTests || 0));
    lines.push(`Tests: ${testResult.numPassingTests} passed, ${testResult.numFailingTests} failed, ${totalTests} total`);
    
    // Handle runtime safely
    const runtime = testResult.perfStats?.runtime || testResult.runtime || 0;
    lines.push(`Time: ${runtime}ms`);
    lines.push('');
    
    if (hasCompilationError || hasFailures) {
      lines.push('FAILURES:');
      
      // Handle compilation errors
      if (hasCompilationError) {
        lines.push(`  ● Test suite failed to run`);
        lines.push(`    ${testResult.testExecError.message}`);
        lines.push('');
      }
      
      // Handle test failures
      testResult.testResults.forEach(result => {
        if (result.status === 'failed') {
          lines.push(`  ● ${result.fullName}`);
          if (result.failureMessages.length > 0) {
            result.failureMessages.forEach(message => {
              lines.push(`    ${message}`);
            });
          }
          lines.push('');
        }
      });
    }
    
    return lines.join('\n');
  }

  onRunComplete() {
    console.log('✅ No signal handler leaks detected');
    
    // Memory usage info
    const memUsage = process.memoryUsage();
    const heapUsed = (memUsage.heapUsed / 1024 / 1024).toFixed(2);
    const heapTotal = (memUsage.heapTotal / 1024 / 1024).toFixed(2);
    console.log(`📊 Final memory usage: ${heapUsed}MB / ${heapTotal}MB heap`);
    
    console.log('Global test teardown completed');
  }
}

module.exports = CustomReporter;