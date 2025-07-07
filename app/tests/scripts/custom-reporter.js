const fs = require('fs');
const path = require('path');

class CustomReporter {
  constructor(globalConfig, options) {
    this.globalConfig = globalConfig;
    this.options = options;
    this.logsDir = path.join(__dirname, '..', 'logs');
    this.passDir = path.join(this.logsDir, 'pass');
    this.failDir = path.join(this.logsDir, 'fail');
    
    // Clean up previous test results before each run
    this.cleanupLogs();
  }

  cleanupLogs() {
    try {
      // Create logs directory structure if it doesn't exist
      if (!fs.existsSync(this.logsDir)) {
        fs.mkdirSync(this.logsDir, { recursive: true });
      }
      if (!fs.existsSync(this.passDir)) {
        fs.mkdirSync(this.passDir, { recursive: true });
      }
      if (!fs.existsSync(this.failDir)) {
        fs.mkdirSync(this.failDir, { recursive: true });
      }

      // Clean previous results
      const cleanDir = (dir) => {
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir);
          for (const file of files) {
            const filePath = path.join(dir, file);
            if (fs.statSync(filePath).isFile()) {
              fs.unlinkSync(filePath);
            }
          }
        }
      };

      cleanDir(this.passDir);
      cleanDir(this.failDir);
    } catch (error) {
      console.error('Failed to cleanup logs:', error.message);
    }
  }

  onRunStart() {
    // Called before test run starts
  }

  onTestResult(test, testResult) {
    const { testFilePath, testResults } = testResult;
    const relativePath = path.relative(process.cwd(), testFilePath);
    const filename = path.basename(testFilePath, '.ts') + '.txt';
    
    const passingTests = testResults.filter(t => t.status === 'passed');
    const failingTests = testResults.filter(t => t.status === 'failed');
    const skippedTests = testResults.filter(t => t.status === 'skipped');
    
    const hasFailing = failingTests.length > 0;
    const targetDir = hasFailing ? this.failDir : this.passDir;
    const statusIcon = hasFailing ? '❌' : '✅';
    
    // Generate formatted output
    let output = '';
    output += `📋 Test Results: ${relativePath}\n`;
    output += '============================================================\n';
    output += `✅ Passing: ${passingTests.length}\n`;
    output += `❌ Failing: ${failingTests.length}\n`;
    if (skippedTests.length > 0) {
      output += `⏭️  Skipped: ${skippedTests.length}\n`;
    }
    output += `📊 Total: ${testResults.length}\n\n`;
    
    if (passingTests.length > 0) {
      output += '✅ Passed Tests:\n';
      passingTests.forEach(test => {
        const duration = test.duration !== undefined ? `(${test.duration}ms)` : '';
        output += `  ✅ ${test.fullName} ${duration}\n`;
      });
      output += '\n';
    }
    
    if (failingTests.length > 0) {
      output += '🚨 Failed Tests:\n';
      failingTests.forEach(test => {
        output += `  ❌ ${test.fullName}\n`;
        if (test.failureMessages && test.failureMessages.length > 0) {
          test.failureMessages.forEach(message => {
            // Clean up Jest error message formatting
            const cleanMessage = message
              .replace(/\u001b\[[0-9;]*m/g, '') // Remove ANSI colors
              .split('\n')
              .slice(0, 5) // Take first 5 lines for brevity
              .join('\n');
            output += `     💡 Error: ${cleanMessage}\n`;
          });
        }
        output += '\n';
      });
    }
    
    if (skippedTests.length > 0) {
      output += '⏭️  Skipped Tests:\n';
      skippedTests.forEach(test => {
        output += `  ⏭️  ${test.fullName}\n`;
      });
      output += '\n';
    }
    
    // Write to appropriate directory
    const filePath = path.join(targetDir, filename);
    try {
      fs.writeFileSync(filePath, output, 'utf8');
      
      // Console output
      if (hasFailing) {
        console.log(`\n${statusIcon} FAIL ${relativePath}`);
        failingTests.forEach(test => {
          console.log(`  ❌ ${test.title}`);
          if (test.failureMessages && test.failureMessages.length > 0) {
            const shortMessage = test.failureMessages[0]
              .replace(/\u001b\[[0-9;]*m/g, '')
              .split('\n')[0];
            console.log(`     ${shortMessage}`);
          }
        });
      } else {
        console.log(`${statusIcon} PASS ${relativePath} (${passingTests.length} tests)`);
      }
    } catch (error) {
      console.error(`Failed to write test results to ${filePath}:`, error.message);
    }
  }

  onRunComplete(contexts, results) {
    const { numFailedTests, numPassedTests, numTotalTests, startTime } = results;
    const duration = Date.now() - startTime;
    
    console.log('\n============================================================');
    console.log(`📊 Test Run Complete (${duration}ms)`);
    console.log(`✅ Passed: ${numPassedTests}`);
    console.log(`❌ Failed: ${numFailedTests}`);
    console.log(`📊 Total: ${numTotalTests}`);
    
    if (numFailedTests > 0) {
      console.log(`\n🔍 Failed test details saved to: ${this.failDir}`);
    }
    
    if (numPassedTests > 0) {
      console.log(`📁 Passed test details saved to: ${this.passDir}`);
    }
    
    console.log('============================================================\n');
  }
}

module.exports = CustomReporter;