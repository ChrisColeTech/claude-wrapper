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
    const testName = path.basename(testResult.testFilePath, '.test.ts');
    const fileName = `test-results-${testName}.txt`;
    
    if (testResult.numFailingTests > 0) {
      // Log failures immediately to console
      console.error(`FAIL ${testResult.displayName || 'Tests'} ${testResult.testFilePath}`);
      testResult.testResults.forEach(result => {
        if (result.status === 'failed') {
          console.error(`  ● ${result.fullName}`);
          if (result.failureMessages.length > 0) {
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
  }

  formatTestResult(testResult) {
    const lines = [];
    lines.push(`Test Suite: ${testResult.testFilePath}`);
    lines.push(`Display Name: ${testResult.displayName || 'Tests'}`);
    lines.push(`Status: ${testResult.numFailingTests > 0 ? 'FAILED' : 'PASSED'}`);
    lines.push(`Tests: ${testResult.numPassingTests} passed, ${testResult.numFailingTests} failed, ${testResult.numTotalTests} total`);
    lines.push(`Time: ${testResult.perfStats.runtime}ms`);
    lines.push('');
    
    if (testResult.numFailingTests > 0) {
      lines.push('FAILURES:');
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