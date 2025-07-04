const fs = require("fs");
const path = require("path");

class SuiteReporter {
  onRunComplete(contexts, aggregatedResult) {
    const logDir = path.resolve(__dirname, "../logs");
    const passDir = path.join(logDir, "pass");
    const failDir = path.join(logDir, "fail");
    
    // Create directories
    if (!fs.existsSync(passDir)) {
      fs.mkdirSync(passDir, { recursive: true });
    }
    if (!fs.existsSync(failDir)) {
      fs.mkdirSync(failDir, { recursive: true });
    }

    // Loop through each test suite (test file)
    aggregatedResult.testResults.forEach((suiteResult) => {
      const filePath = suiteResult.testFilePath;
      const suiteName = path.basename(filePath, path.extname(filePath));

      // Create formatted text output
      const relativePath = path.relative(process.cwd(), filePath);
      let output = `\n📋 Test Results: ${relativePath}\n`;
      output += `${"=".repeat(60)}\n`;
      output += `✅ Passing: ${suiteResult.numPassingTests}\n`;
      output += `❌ Failing: ${suiteResult.numFailingTests}\n`;
      output += `📊 Total: ${suiteResult.testResults.length}\n\n`;

      if (suiteResult.numFailingTests > 0) {
        output += `🚨 Failed Tests:\n`;
        suiteResult.testResults
          .filter(test => test.status === "failed")
          .forEach((test) => {
            output += `  ❌ ${test.fullName}\n`;
            if (test.failureMessages && test.failureMessages.length > 0) {
              const errorMsg = test.failureMessages[0].split("\n")[0];
              output += `     💡 ${errorMsg}\n`;
            }
          });
        output += `\n`;
      }

      if (suiteResult.numPassingTests > 0) {
        output += `✅ Passed Tests:\n`;
        suiteResult.testResults
          .filter(test => test.status === "passed")
          .forEach((test) => {
            const duration = test.duration ? `(${test.duration}ms)` : "";
            output += `  ✅ ${test.fullName} ${duration}\n`;
          });
      }

      // Show failures in console
      suiteResult.testResults.forEach((test) => {
        if (test.status === "failed") {
          console.error(`FAIL: ${suiteResult.testFilePath}`);
          console.error(`  ● ${test.fullName}`);
          test.failureMessages.forEach((message) =>
            console.error(`    ${message.split("\n")[0]}`)
          );
        }
      });

      // Determine which folder based on pass/fail status
      const targetDir = suiteResult.numFailingTests > 0 ? failDir : passDir;
      const resultsFile = path.join(targetDir, `test-results-${suiteName}.txt`);
      fs.writeFileSync(resultsFile, output);
      
      const status = suiteResult.numFailingTests > 0 ? "❌ FAIL" : "✅ PASS";
      console.log(`📄 ${status} results saved to ${resultsFile}`);
    });

    if (aggregatedResult.numFailedTests > 0) {
      throw new Error(`${aggregatedResult.numFailedTests} test(s) failed.`);
    }
  }
}

module.exports = SuiteReporter;
